import type { Express, Request, Response } from 'express';
import { addDays, format, parseISO } from 'date-fns';
import db from './db.js';
import { getMealsWithIngredients } from './meal-queries.js';
import { resolveProvider } from './ai/provider-resolver.js';
import {
  CHAT_CONTEXT_LANGUAGE_INSTRUCTION,
  buildFetchInstructionsLanguageLead,
  buildStructuredLanguageInstruction,
  buildStructuredLanguageSystemInstruction,
} from './ai/language-instructions.js';
import { normalizeLanguageInput } from './ai/response-languages.js';
import { AiProviderError, AiTaskOptions } from './ai/types.js';

type ImportedRecipe = {
  name?: string;
  tag?: string;
  servings?: number;
  instructions?: string[];
  source_url?: string;
  image_url?: string;
  ingredients?: Array<{
    name: string;
    amount: number;
    measure: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  }>;
};

type GeneratedMealPlan = {
  meals?: Array<{
    name: string;
    tag?: string;
    servings?: number;
    ingredients?: Array<{
      name: string;
      amount: number;
      measure: string;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
    }>;
  }>;
};

type NutritionInputIngredient = {
  name: string;
  amount: number;
  measure: string;
};

type NutritionOutputIngredient = NutritionInputIngredient & {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

function getTaskOptions(req: Request, task: AiTaskOptions['task'], extras: Partial<AiTaskOptions> = {}): AiTaskOptions {
  const model = typeof req.body?.model === 'string' ? req.body.model.trim() : undefined;
  return {
    task,
    ...(model ? { model } : {}),
    ...extras,
  };
}

/** Explicit locale → systemInstruction only; auto → trailing user prompt hint (localeHint fallback). */
function resolvedStructuredLanguage(req: Request): {
  promptSuffix: string;
  systemInstruction?: string;
} {
  const language = normalizeLanguageInput(req.body?.language);
  const localeHintRaw = req.body?.localeHint;
  const opts = { language, localeHintRaw };
  if (language !== 'auto') {
    return {
      promptSuffix: '',
      systemInstruction: buildStructuredLanguageSystemInstruction(opts),
    };
  }
  return {
    promptSuffix: buildStructuredLanguageInstruction(opts),
  };
}

function aiError(res: Response, err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const status =
    err instanceof AiProviderError ? err.status : message.includes('GEMINI_API_KEY') ? 503 : 502;
  return res.status(status).json({ error: message });
}

export function registerAiRoutes(app: Express) {
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const familyId = String(req.headers['x-family-id'] || 'default').trim() || 'default';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    try {
      const provider = resolveProvider(req.body?.provider);
      const meals = getMealsWithIngredients(familyId);
      const contextString =
        meals.length > 0
          ? `\n\nHere is the user's current meal database:\n${JSON.stringify(
              meals.map((m: Record<string, unknown>) => {
                const ings = Array.isArray(m.ingredients)
                  ? (m.ingredients as { amount: number; measure: string; name: string }[])
                  : [];
                return {
                  name: m.name,
                  tag: m.tag,
                  ingredients: ings.map((i) => `${i.amount} ${i.measure} ${i.name}`),
                };
              }),
              null,
              2
            )}`
          : '\n\nThe user currently has no saved meals.';

      const text = await provider.generateText(message, getTaskOptions(req, 'chat', {
        systemInstruction: `You are a helpful meal planning assistant. You can help users come up with recipes, meal plans, and answer questions about cooking. Use the user's meal database to suggest meals they already know how to make, or build meal plans based on their saved recipes.${contextString}

${CHAT_CONTEXT_LANGUAGE_INSTRUCTION}`,
      }));
      return res.json({ text });
    } catch (err) {
      return aiError(res, err, 'Chat failed');
    }
  });

  app.post('/api/ai/import-recipe', async (req: Request, res: Response) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    try {
      const langParts = resolvedStructuredLanguage(req);
      const provider = resolveProvider(req.body?.provider);
      const supportsSearch = provider.id === 'gemini';
      const prompt = `Search for a recipe for "${query}". 
      Extract the recipe name, a suitable category/tag (e.g., Italian, Dessert, Breakfast), the list of ingredients, and step-by-step instructions.
      If the query is a URL, extract the information from that specific URL and include it as the source_url.
      If you can find a high-quality image URL for the recipe, include it as image_url.
      For each ingredient, estimate the nutritional information (calories, protein, fat, carbs) based on standard nutritional databases.
      Return only valid JSON in this exact shape:
      {
        "name": string,
        "tag": string,
        "servings": number,
        "instructions": string[],
        "source_url": string,
        "image_url": string,
        "ingredients": [{ "name": string, "amount": number, "measure": string, "calories": number, "protein": number, "fat": number, "carbs": number }]
      }${
        supportsSearch
          ? ''
          : '\nIf live web search is unavailable, infer a plausible recipe from prior knowledge and set source_url to an empty string.'
      }${langParts.promptSuffix}`;

      const data = await provider.generateJson<ImportedRecipe>(prompt, getTaskOptions(req, 'import-recipe', {
        useWebSearch: supportsSearch,
        ...(langParts.systemInstruction ? { systemInstruction: langParts.systemInstruction } : {}),
      }));
      if (!data.name || !data.ingredients) {
        return res.status(422).json({ error: 'Failed to parse recipe data. Please try another query.' });
      }
      return res.json(data);
    } catch (err) {
      return aiError(res, err, 'Import failed');
    }
  });

  app.post('/api/ai/estimate-nutrition', async (req: Request, res: Response) => {
    const mealName = typeof req.body?.mealName === 'string' ? req.body.mealName.trim() : '';
    if (!mealName) {
      return res.status(400).json({ error: 'mealName is required' });
    }
    if (!Array.isArray(req.body?.ingredients) || req.body.ingredients.length === 0) {
      return res.status(400).json({ error: 'ingredients must be a non-empty array' });
    }

    const ingredients = (req.body.ingredients as Array<Record<string, unknown>>)
      .map((ingredient) => ({
        name: typeof ingredient.name === 'string' ? ingredient.name.trim() : '',
        amount: Number(ingredient.amount),
        measure: typeof ingredient.measure === 'string' ? ingredient.measure.trim() : '',
      }))
      .filter((ingredient) => ingredient.name && Number.isFinite(ingredient.amount) && ingredient.measure);

    if (ingredients.length === 0) {
      return res.status(400).json({ error: 'No valid ingredients provided' });
    }

    try {
      const provider = resolveProvider(req.body?.provider);
      const language = normalizeLanguageInput(req.body?.language);
      const localeHintRaw = req.body?.localeHint;
      // Nutrition merge keys off input names — do not use translate-all system prompts here.
      const nutritionPromptSuffix =
        language === 'auto' ?
          buildStructuredLanguageInstruction({ language, localeHintRaw })
        : '';

      const prompt = `Estimate nutritional values for each ingredient in the meal "${mealName}".
Return ONLY valid JSON with this exact shape:
{
  "ingredients": [
    { "name": string, "amount": number, "measure": string, "calories": number, "protein": number, "fat": number, "carbs": number }
  ]
}
Use this input ingredient list and preserve each ingredient's name, amount, and measure:
${JSON.stringify(ingredients, null, 2)}${nutritionPromptSuffix}`;

      const data = await provider.generateJson<{ ingredients?: Array<Record<string, unknown>> }>(
        prompt,
        getTaskOptions(req, 'chat')
      );
      const raw = Array.isArray(data.ingredients) ? data.ingredients : [];

      const byName = new Map<string, NutritionOutputIngredient[]>();
      for (const row of raw) {
        const normalizedName = String(row.name || '').trim().toLowerCase();
        if (!normalizedName) continue;
        const parsed: NutritionOutputIngredient = {
          name: String(row.name || '').trim() || normalizedName,
          amount: Number(row.amount) || 0,
          measure: String(row.measure || '').trim() || 'Unit',
          calories: Math.max(0, Number(row.calories) || 0),
          protein: Math.max(0, Number(row.protein) || 0),
          fat: Math.max(0, Number(row.fat) || 0),
          carbs: Math.max(0, Number(row.carbs) || 0),
        };
        const current = byName.get(normalizedName) ?? [];
        current.push(parsed);
        byName.set(normalizedName, current);
      }

      const normalized = ingredients.map((ing) => {
        const queue = byName.get(ing.name.toLowerCase());
        const next = queue && queue.length > 0 ? queue.shift() : undefined;
        return {
          name: ing.name,
          amount: ing.amount,
          measure: ing.measure,
          calories: Math.max(0, Number(next?.calories) || 0),
          protein: Math.max(0, Number(next?.protein) || 0),
          fat: Math.max(0, Number(next?.fat) || 0),
          carbs: Math.max(0, Number(next?.carbs) || 0),
        };
      });

      return res.json({ ingredients: normalized });
    } catch (err) {
      return aiError(res, err, 'Nutrition estimation failed');
    }
  });

  app.post('/api/ai/fetch-instructions', async (req: Request, res: Response) => {
    const mealName = typeof req.body?.mealName === 'string' ? req.body.mealName.trim() : '';
    if (!mealName) {
      return res.status(400).json({ error: 'mealName is required' });
    }
    const sourceUrl = typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl.trim() : '';
    const ingredients = Array.isArray(req.body?.ingredients)
      ? (req.body.ingredients as Array<Record<string, unknown>>)
          .map((ingredient) => String(ingredient.name || '').trim())
          .filter(Boolean)
      : [];

    try {
      const fetchLangOpts = {
        language: normalizeLanguageInput(req.body?.language),
        localeHintRaw: req.body?.localeHint,
      };
      const fetchLead = buildFetchInstructionsLanguageLead(fetchLangOpts);
      const provider = resolveProvider(req.body?.provider);
      const supportsSearch = provider.id === 'gemini';
      const prompt = `${fetchLead.userPromptPrefix}Find a step-by-step recipe for "${mealName}".
${sourceUrl ? `Prioritize this source URL: ${sourceUrl}.` : 'Use the best available public source.'}
${ingredients.length > 0 ? `Use these ingredients as context: ${ingredients.join(', ')}.` : ''}
Return ONLY valid JSON:
{
  "instructions": string[],
  "sourceUrl": string
}
Ensure instructions are clear, sequential cooking steps.`;

      const data = await provider.generateJson<{ instructions?: unknown[]; sourceUrl?: string }>(
        prompt,
        getTaskOptions(req, 'import-recipe', {
          useWebSearch: supportsSearch,
          ...(fetchLead.systemInstruction ? { systemInstruction: fetchLead.systemInstruction } : {}),
        })
      );
      const normalizedInstructions = Array.isArray(data.instructions)
        ? data.instructions.map((step) => String(step).trim()).filter(Boolean)
        : [];
      if (normalizedInstructions.length === 0) {
        return res.status(422).json({ error: 'No instructions found for this meal' });
      }
      return res.json({
        instructions: normalizedInstructions,
        sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl.trim() : '',
      });
    } catch (err) {
      return aiError(res, err, 'Instruction fetch failed');
    }
  });

  app.post('/api/ai/generate-plan', async (req: Request, res: Response) => {
    const familyId = String(req.headers['x-family-id'] || 'default').trim() || 'default';
    const diet = typeof req.body?.diet === 'string' ? req.body.diet.trim() : '';
    const startDateRaw = typeof req.body?.startDate === 'string' ? req.body.startDate.trim() : '';
    if (!diet || !startDateRaw) {
      return res.status(400).json({ error: 'startDate and diet are required' });
    }
    let start: Date;
    try {
      start = parseISO(startDateRaw);
      if (Number.isNaN(start.getTime())) throw new Error('bad date');
    } catch {
      return res.status(400).json({ error: 'Invalid startDate' });
    }

    try {
      const langParts = resolvedStructuredLanguage(req);
      const provider = resolveProvider(req.body?.provider);
      const prompt = `Generate a 7-day dinner meal plan for a ${diet} diet.
      Return a JSON object with a 'meals' array containing exactly 7 meals (one for each day of the week).
      Each meal must have:
      - 'name': The name of the meal
      - 'tag': A short category tag (e.g., '${diet}', 'Dinner')
      - 'servings': Number of servings for the recipe
      - 'ingredients': An array of ingredients required for the meal.
      For each ingredient, provide:
      - 'name': Ingredient name
      - 'amount': Quantity (number)
      - 'measure': Unit of measurement (e.g., 'Gram (g)', 'Unit', 'Cup (c)', 'Tablespoon (Tbsp)')
      - 'calories': Estimated calories (number)
      - 'protein': Estimated protein in grams (number)
      - 'fat': Estimated fat in grams (number)
      - 'carbs': Estimated carbs in grams (number)
      Make sure the nutritional values are realistic and appropriate for the selected diet.
      Return only valid JSON with this shape:
      {
        "meals": [{
          "name": string,
          "tag": string,
          "servings": number,
          "ingredients": [{ "name": string, "amount": number, "measure": string, "calories": number, "protein": number, "fat": number, "carbs": number }]
        }]
      }${langParts.promptSuffix}`;

      const data = await provider.generateJson<GeneratedMealPlan>(
        prompt,
        getTaskOptions(req, 'generate-plan', {
          ...(langParts.systemInstruction ? { systemInstruction: langParts.systemInstruction } : {}),
        })
      );
      if (!data.meals || !Array.isArray(data.meals) || data.meals.length !== 7) {
        return res.status(422).json({ error: 'Failed to generate a complete 7-day meal plan. Please try again.' });
      }
      const meals = data.meals;

      const insertMeal = db.prepare(
        'INSERT INTO meals (family_id, name, tag, instructions, source_url, image_url, servings) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const insertIngredient = db.prepare(
        'INSERT INTO ingredients (meal_id, name, amount, measure, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insertPlanner = db.prepare('INSERT INTO planner (family_id, date, meal_id) VALUES (?, ?, ?)');

      const run = db.transaction(() => {
        for (let i = 0; i < 7; i++) {
          const meal = meals[i];
          const dateStr = format(addDays(start, i), 'yyyy-MM-dd');
          const instructionsStr = null;
          const mealResult = insertMeal.run(
            familyId,
            meal.name,
            meal.tag || '',
            instructionsStr,
            null,
            null,
            Number.isInteger(meal.servings) && (meal.servings as number) > 0
              ? (meal.servings as number)
              : 4
          );
          const mealId = mealResult.lastInsertRowid as number;
          for (const ing of meal.ingredients || []) {
            insertIngredient.run(
              mealId,
              ing.name,
              ing.amount,
              ing.measure,
              ing.calories || 0,
              ing.protein || 0,
              ing.fat || 0,
              ing.carbs || 0
            );
          }
          insertPlanner.run(familyId, dateStr, mealId);
        }
      });

      run();
      return res.json({ success: true });
    } catch (err) {
      return aiError(res, err, 'Generate plan failed');
    }
  });

  app.post('/api/ai/grocery-group', async (req: Request, res: Response) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }
    const names = items.map((x) => String(x).trim()).filter(Boolean);
    if (names.length === 0) {
      return res.status(400).json({ error: 'No valid item names' });
    }

    try {
      const langParts = resolvedStructuredLanguage(req);
      const provider = resolveProvider(req.body?.provider);
      const prompt = `Categorize these grocery items into standard supermarket aisles (e.g., Produce, Dairy, Meat, Pantry, Bakery, Frozen, Household). Return a JSON object mapping each item name to its category. Items: ${names.join(', ')}`;
      const categories = await provider.generateJson<Record<string, string>>(
        `${prompt}\nReturn only valid JSON where each key is one of the provided item names and each value is a category string.${langParts.promptSuffix}`,
        getTaskOptions(req, 'grocery-group', {
          ...(langParts.systemInstruction ? { systemInstruction: langParts.systemInstruction } : {}),
        })
      );
      return res.json({ categories });
    } catch (err) {
      return aiError(res, err, 'Grouping failed');
    }
  });

  app.post('/api/ai/generate-meal-image', async (req: Request, res: Response) => {
    const familyId = String(req.headers['x-family-id'] || 'default').trim() || 'default';
    const mealId = Number(req.body?.mealId);
    const size = typeof req.body?.size === 'string' ? req.body.size : '1K';
    if (!Number.isInteger(mealId) || mealId < 1) {
      return res.status(400).json({ error: 'mealId is required' });
    }

    const meal = db
      .prepare(
        `SELECT m.* FROM meals m
         WHERE m.id = ? AND m.family_id = ?`
      )
      .get(mealId, familyId) as Record<string, unknown> | undefined;
    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    const ingredients = db
      .prepare('SELECT name FROM ingredients WHERE meal_id = ? ORDER BY id')
      .all(mealId) as { name: string }[];

    try {
      const provider = resolveProvider(req.body?.provider);
      const prompt = `A high-quality, appetizing food photography shot of ${meal.name}, which is a ${meal.tag} dish. Ingredients include: ${ingredients.map((i) => i.name).join(', ')}. Professional lighting, shallow depth of field, delicious looking.`;
      const imageUrl = await provider.generateImage(
        prompt,
        getTaskOptions(req, 'generate-meal-image', { size })
      );

      if (!imageUrl) {
        return res.status(422).json({ error: 'Failed to generate image' });
      }

      if (imageUrl.length > 2_000_000) {
        return res.status(413).json({ error: 'Generated image too large to store' });
      }

      const updated = db
        .prepare('UPDATE meals SET image_url = ? WHERE id = ? AND family_id = ?')
        .run(imageUrl, mealId, familyId);
      if (updated.changes === 0) {
        return res.status(404).json({ error: 'Meal not found' });
      }

      return res.json({ imageUrl });
    } catch (err) {
      return aiError(res, err, 'Image generation failed');
    }
  });
}
