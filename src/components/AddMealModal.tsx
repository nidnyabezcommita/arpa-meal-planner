import { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Sparkles,
  Loader2,
  Camera,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { Meal, Ingredient } from '../types';
import { apiFetch } from '../lib/api';
import { APPROVED_MEASURE_LABELS } from '../lib/units';
import ResponseLanguageSelector from './ResponseLanguageSelector';
import {
  ResponseLanguageCode,
  aiJobLanguageLabel,
  loadAiSettings,
  saveAiSettings,
  showLanguagePickerInModals,
  structuredAiLanguagePayload,
} from '../lib/ai-settings';
import { loadDefaultServings } from '../lib/preferences';
import { aiJobModelLabel, useAiJobQueue } from '../context/AiJobQueueContext';
import { applyNutritionEstimatesToIngredients } from '../lib/ai-job-apply';
import { useTranslation } from 'react-i18next';

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingMeal?: Meal | Partial<Meal> | null;
  ingredientNameSuggestions?: string[];
  /** When true once after open, scroll the ingredients block into view (AI job restore). */
  scrollToIngredientsOnOpen?: boolean;
  onScrollToIngredientsConsumed?: () => void;
}

export default function AddMealModal({
  isOpen,
  onClose,
  onSave,
  editingMeal,
  ingredientNameSuggestions = [],
  scrollToIngredientsOnOpen = false,
  onScrollToIngredientsConsumed,
}: AddMealModalProps) {
  const { t } = useTranslation();
  const { runWithAiJob } = useAiJobQueue();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [servings, setServings] = useState(4);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState<Partial<Ingredient>[]>([
    { name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 },
  ]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isEstimatingNutrition, setIsEstimatingNutrition] = useState(false);
  const [nutritionError, setNutritionError] = useState<string | null>(null);
  const [nutritionInfo, setNutritionInfo] = useState<string | null>(null);
  const [isFetchingInstructions, setIsFetchingInstructions] = useState(false);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [instructionsInfo, setInstructionsInfo] = useState<string | null>(null);
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguageCode>(
    () => loadAiSettings().responseLanguage ?? 'auto',
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ingredientsSectionRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (editingMeal) {
      setName(editingMeal.name || '');
      setTag(editingMeal.tag || '');
      setServings(
        Number.isInteger(editingMeal.servings) && (editingMeal.servings as number) > 0
          ? (editingMeal.servings as number)
          : 4
      );
      setInstructions(editingMeal.instructions || []);
      setSourceUrl(editingMeal.source_url || '');
      setImageUrl(editingMeal.image_url || '');
      setIngredients(
        editingMeal.ingredients && editingMeal.ingredients.length > 0
          ? editingMeal.ingredients
          : [{ name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 }],
      );
    } else {
      setName('');
      setTag('');
      setServings(loadDefaultServings());
      setInstructions([]);
      setSourceUrl('');
      setImageUrl('');
      setIngredients([
        { name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 },
      ]);
    }
  }, [editingMeal, isOpen]);

  useEffect(() => {
    if (!isOpen || !scrollToIngredientsOnOpen || !ingredientsSectionRef.current) return;
    ingredientsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onScrollToIngredientsConsumed?.();
  }, [isOpen, scrollToIngredientsOnOpen, editingMeal, onScrollToIngredientsConsumed]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  useEffect(() => {
    const sync = () => setResponseLanguage(loadAiSettings().responseLanguage ?? 'auto');
    sync();
    window.addEventListener('arpa-ai-settings-updated', sync);
    return () => window.removeEventListener('arpa-ai-settings-updated', sync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setResponseLanguage(loadAiSettings().responseLanguage ?? 'auto');
  }, [isOpen]);

  const effectiveResponseLanguage = (): ResponseLanguageCode =>
    showLanguagePickerInModals() ? responseLanguage : (loadAiSettings().responseLanguage ?? 'auto');

  const handleResponseLanguageChange = (next: ResponseLanguageCode) => {
    setResponseLanguage(next);
    if (showLanguagePickerInModals()) {
      const cur = loadAiSettings();
      saveAiSettings({ ...cur, responseLanguage: next });
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert(t('addMealModal.errors.camera'));
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImageUrl(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const handleAddIngredient = () => {
    setIngredients([
      ...ingredients,
      { name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 },
    ]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (
    index: number,
    field: keyof Ingredient,
    value: string | number,
  ) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const validIngredients = ingredients
    .map((ingredient) => ({
      name: (ingredient.name || '').trim(),
      amount: Number(ingredient.amount),
      measure: (ingredient.measure || '').trim(),
    }))
    .filter((ingredient) => ingredient.name && Number.isFinite(ingredient.amount) && ingredient.measure);

  const canEstimateNutrition = validIngredients.length > 0 && !isEstimatingNutrition;
  const hasAnyInstructions = instructions.some((step) => step.trim().length > 0);
  const canFetchInstructions = name.trim().length > 0 && !hasAnyInstructions && !isFetchingInstructions;

  const handleEstimateNutrition = async () => {
    setNutritionError(null);
    setNutritionInfo(null);
    if (!canEstimateNutrition) return;

    setIsEstimatingNutrition(true);
    const { provider, model } = loadAiSettings();
    const lang = effectiveResponseLanguage();
    const mealLabel = (name.trim() || t('addMealModal.untitledMeal')).slice(0, 80);
    const ingredientSnapshot = ingredients.map((i) => ({ ...i }));
    const nameSnap = name.trim();
    const tagSnap = tag.trim();
    const servingsSnap = servings;
    const instructionsSnap = [...instructions];
    const sourceUrlSnap = sourceUrl.trim();
    const imageUrlSnap = imageUrl.trim();
    const mealId = typeof editingMeal?.id === 'number' ? editingMeal.id : null;

    try {
      await runWithAiJob(
        {
          kind: 'estimate-nutrition',
          title: t('addMealModal.links.estimate'),
          relatedLabel: mealLabel,
          providerId: provider,
          modelLabel: aiJobModelLabel(provider, model),
          languageLabel: aiJobLanguageLabel(lang),
          buildRestore: (result: { mealId: number | null; partial: Partial<Meal> }) => ({
            path: '/',
            state: {
              addMealRestore: {
                mealId: result.mealId,
                partial: result.partial,
                scrollToIngredients: true,
              },
            },
          }),
        },
        async () => {
          const res = await apiFetch('/api/ai/estimate-nutrition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mealName: name.trim() || t('addMealModal.untitledMeal'),
              ingredients: validIngredients,
              provider,
              model: model.trim() || undefined,
              ...structuredAiLanguagePayload(lang),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error((data as { error?: string }).error || t('addMealModal.errors.nutrition'));
          }

          const estimated = Array.isArray((data as { ingredients?: unknown[] }).ingredients)
            ? ((data as { ingredients: Array<Record<string, unknown>> }).ingredients ?? [])
            : [];

          const merged = applyNutritionEstimatesToIngredients(ingredientSnapshot, estimated);
          const partial: Partial<Meal> = {
            name: nameSnap || undefined,
            tag: tagSnap || undefined,
            servings: servingsSnap,
            instructions: instructionsSnap,
            source_url: sourceUrlSnap || null,
            image_url: imageUrlSnap || null,
            ingredients: merged as Meal['ingredients'],
          };

          if (mountedRef.current) {
            setIngredients(merged);
            setNutritionInfo(t('addMealModal.nutrition'));
          }

          return { mealId, partial };
        },
      );
    } catch (error) {
      setNutritionError(error instanceof Error ? error.message : t('addMealModal.errors.nutrition'));
    } finally {
      setIsEstimatingNutrition(false);
    }
  };

  const handleFetchInstructions = async () => {
    setInstructionsError(null);
    setInstructionsInfo(null);
    if (!canFetchInstructions) {
      if (hasAnyInstructions) {
        setInstructionsError(t('addMealModal.errors.instructions'));
      }
      return;
    }

    setIsFetchingInstructions(true);
    const { provider, model } = loadAiSettings();
    const lang = effectiveResponseLanguage();
    const mealLabel = name.trim().slice(0, 80);
    const ingredientSnapshot = ingredients.map((i) => ({ ...i }));
    const nameSnap = name.trim();
    const tagSnap = tag.trim();
    const servingsSnap = servings;
    const sourceUrlSnap = sourceUrl.trim();
    const imageUrlSnap = imageUrl.trim();
    const mealId = typeof editingMeal?.id === 'number' ? editingMeal.id : null;

    try {
      await runWithAiJob(
        {
          kind: 'fetch-instructions',
          title: t('addMealModal.links.fetchInstructions'),
          relatedLabel: mealLabel || t('addMealModal.meal'),
          providerId: provider,
          modelLabel: aiJobModelLabel(provider, model),
          languageLabel: aiJobLanguageLabel(lang),
          buildRestore: (result: { mealId: number | null; partial: Partial<Meal> }) => ({
            path: '/',
            state: {
              addMealRestore: {
                mealId: result.mealId,
                partial: result.partial,
                scrollToIngredients: true,
              },
            },
          }),
        },
        async () => {
          const res = await apiFetch('/api/ai/fetch-instructions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mealName: name.trim(),
              sourceUrl: sourceUrl.trim() || undefined,
              ingredients: validIngredients,
              provider,
              model: model.trim() || undefined,
              ...structuredAiLanguagePayload(lang),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error((data as { error?: string }).error || t('addMealModal.errors.fetchInstructions'));
          }

          const nextInstructions = Array.isArray((data as { instructions?: unknown[] }).instructions)
            ? ((data as { instructions: unknown[] }).instructions
                .map((step) => String(step).trim())
                .filter(Boolean))
            : [];
          if (nextInstructions.length === 0) {
            throw new Error(t('addMealModal.errors.noInstructions'));
          }
          let resolvedSource = sourceUrlSnap || null;
          if (typeof (data as { sourceUrl?: unknown }).sourceUrl === 'string') {
            const nextSourceUrl = (data as { sourceUrl: string }).sourceUrl.trim();
            if (nextSourceUrl) resolvedSource = nextSourceUrl;
          }

          const partial: Partial<Meal> = {
            name: nameSnap || undefined,
            tag: tagSnap || undefined,
            servings: servingsSnap,
            ingredients: ingredientSnapshot as Meal['ingredients'],
            image_url: imageUrlSnap || null,
            source_url: resolvedSource,
            instructions: nextInstructions,
          };

          if (mountedRef.current) {
            setInstructions(nextInstructions);
            if (resolvedSource) setSourceUrl(resolvedSource);
            setInstructionsInfo(t('addMealModal.successInstruction'));
          }

          return { mealId, partial };
        },
      );
    } catch (error) {
      setInstructionsError(error instanceof Error ? error.message : t('addMealModal.errors.fetchInstructions'));
    } finally {
      setIsFetchingInstructions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validIngredients = ingredients.filter((i) => i.name && i.name.trim() !== '');

    const mealData = {
      name,
      tag,
      servings,
      instructions: instructions.filter((step) => step.trim() !== ''),
      source_url: sourceUrl,
      image_url: imageUrl,
      ingredients: validIngredients,
    };

    try {
      const res =
        editingMeal && editingMeal.id
          ? await apiFetch(`/api/meals/${editingMeal.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mealData),
            })
          : await apiFetch('/api/meals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mealData),
            });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((errBody as { error?: string }).error || t('addMealModal.errors.meal'));
      }
      onSave();
    } catch (error) {
      console.error(t('addMealModal.errors.meal'), error);
      alert(error instanceof Error ? error.message : t('addMealModal.errors.meal'));
    }
  };

  const inputClass =
    'w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline';

  const fieldLabel =
    'block text-[11px] font-display font-bold uppercase tracking-widest text-outline mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-outline-variant/15">
        <div className="px-6 py-5 flex justify-between items-center sticky top-0 bg-surface z-10 border-b border-outline-variant/15">
          <div>
            <h2 className="text-xl font-display font-extrabold text-primary-container dark:text-primary-fixed-dim tracking-tight">
              {editingMeal && editingMeal.id ? t('addMealModal.title.edit') : t('addMealModal.title.add')}
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {t('addMealModal.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-outline hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto thin-scrollbar">
          <div className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={fieldLabel}>{t('addMealModal.fields.name.label')}</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('addMealModal.fields.name.placeholder')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={fieldLabel}>{t('addMealModal.fields.tag.label')}</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder={t('addMealModal.fields.tag.placeholder')}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="max-w-xs">
              <label className={fieldLabel}>{t('addMealModal.fields.servings.label')}</label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                required
                value={servings}
                onChange={(e) => setServings(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={fieldLabel}>{t('addMealModal.fields.url.label')}</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={t('addMealModal.fields.url.placeholder')}
                className={inputClass}
              />
            </div>

            <div>
              <label className={fieldLabel}>{t('addMealModal.fields.image.label')}</label>
              <div className="space-y-3">
                {imageUrl ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container-low">
                    <img
                      src={imageUrl}
                      alt={t('addMealModal.imagePreview')}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-3 right-3 p-2 bg-secondary text-on-secondary rounded-full hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-video rounded-2xl border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center bg-surface-container-low dark:bg-surface-container-high/50 text-outline">
                    {isCameraOpen ? (
                      <div className="relative w-full h-full">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="p-3 bg-primary text-on-primary rounded-full hover:opacity-90 transition-opacity shadow-lg"
                          >
                            <Camera className="w-6 h-6" />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="p-3 bg-on-surface text-surface rounded-full hover:opacity-90 transition-opacity shadow-lg"
                          >
                            <RotateCcw className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-sm">{t('addMealModal.texts.noImage')}</p>
                      </>
                    )}
                  </div>
                )}

                {!isCameraOpen && (
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex flex-col items-center justify-center p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl hover:bg-surface-container-low dark:hover:bg-surface-container-highest cursor-pointer transition-colors">
                      <Upload className="w-5 h-5 mb-1 text-primary-container dark:text-primary-fixed-dim" />
                      <span className="text-xs font-display font-semibold">{t('addMealModal.buttons.upload')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex flex-col items-center justify-center p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors"
                    >
                      <Camera className="w-5 h-5 mb-1 text-primary-container dark:text-primary-fixed-dim" />
                      <span className="text-xs font-display font-semibold">{t('addMealModal.buttons.camera')}</span>
                    </button>
                    <div className="relative group">
                      <div className="flex flex-col items-center justify-center p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors">
                        <LinkIcon className="w-5 h-5 mb-1 text-primary-container dark:text-primary-fixed-dim" />
                        <span className="text-xs font-display font-semibold">{t('addMealModal.buttons.url')}</span>
                      </div>
                      <input
                        type="url"
                        placeholder={t('addMealModal.fields.imageUrl.placeholder')}
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="absolute inset-0 opacity-0 focus:opacity-100 w-full h-full px-3 py-2 border border-primary rounded-2xl bg-surface-container-lowest text-xs transition-opacity"
                      />
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {showLanguagePickerInModals() ? (
              <ResponseLanguageSelector
                value={responseLanguage}
                onChange={handleResponseLanguageChange}
              />
            ) : (
              <p className="text-xs text-on-surface-variant">
                {t('addMealModal.responseLangMsg')}
              </p>
            )}

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className={fieldLabel + ' mb-0'}>{t('addMealModal.fields.instructions.label')}</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFetchInstructions}
                    disabled={!canFetchInstructions}
                    className="text-xs font-display font-bold text-primary-container dark:text-primary-fixed-dim hover:underline inline-flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
                  >
                    {isFetchingInstructions ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {t('addMealModal.links.fetchInstructions')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstructions([...instructions, ''])}
                    className="text-xs font-display font-bold text-primary-container dark:text-primary-fixed-dim hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('addMealModal.links.addStep')}
                  </button>
                </div>
              </div>
              {instructionsError && <p className="text-xs text-secondary mb-2">{instructionsError}</p>}
              {instructionsInfo && <p className="text-xs text-primary-container mb-2">{instructionsInfo}</p>}

              <div className="space-y-3">
                {instructions.map((step, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/15 dark:text-primary-fixed-dim flex items-center justify-center font-display font-bold text-sm mt-1">
                      {index + 1}
                    </div>
                    <textarea
                      value={step}
                      onChange={(e) => {
                        const newInst = [...instructions];
                        newInst[index] = e.target.value;
                        setInstructions(newInst);
                      }}
                      placeholder={t('addMealModal.fields.step.placeholder') + ` ${index + 1}`}
                      rows={2}
                      className={`${inputClass} resize-y`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setInstructions(instructions.filter((_, i) => i !== index))
                      }
                      className="p-2 text-outline hover:text-secondary hover:bg-secondary/10 rounded-full transition-colors mt-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {instructions.length === 0 && (
                  <div className="text-sm text-on-surface-variant italic text-center py-5 bg-surface-container-low dark:bg-surface-container-high/50 rounded-2xl border border-dashed border-outline-variant/40">
                    {t('addMealModal.texts.noInstructions')}
                  </div>
                )}
              </div>
            </div>

            <div ref={ingredientsSectionRef}>
              <div className="flex justify-between items-center mb-3">
                <label className={fieldLabel + ' mb-0'}>{t('addMealModal.fields.ingredients.label')}</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleEstimateNutrition}
                    disabled={!canEstimateNutrition}
                    className="text-xs font-display font-bold text-primary-container dark:text-primary-fixed-dim hover:underline inline-flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
                  >
                    {isEstimatingNutrition ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {t('addMealModal.links.estimate')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="text-xs font-display font-bold text-primary-container dark:text-primary-fixed-dim hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('addMealModal.links.addIngredient')}
                  </button>
                </div>
              </div>
              {nutritionError && <p className="text-xs text-secondary mb-2">{nutritionError}</p>}
              {nutritionInfo && <p className="text-xs text-primary-container mb-2">{nutritionInfo}</p>}

              <div className="space-y-3">
                {ingredients.map((ing, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 p-4 bg-surface-container-low border border-outline-variant/30 rounded-2xl"
                  >
                    <div className="flex flex-wrap gap-2 items-start">
                      <input
                        type="text"
                        placeholder={t('addMealModal.fields.ingredient.placeholder')}
                        value={ing.name || ''}
                        onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                        className={`${inputClass} flex-1 min-w-[160px]`}
                        list="ingredient-name-suggestions"
                      />
                      <datalist id="ingredient-name-suggestions">
                        {ingredientNameSuggestions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t('addMealModal.fields.amount.placeholder')}
                        value={ing.amount || ''}
                        onChange={(e) =>
                          handleIngredientChange(index, 'amount', parseFloat(e.target.value))
                        }
                        className={`${inputClass} w-24`}
                      />
                      <select
                        value={ing.measure || 'Unit'}
                        onChange={(e) => handleIngredientChange(index, 'measure', e.target.value)}
                        className={`${inputClass} w-40`}
                      >
                        {APPROVED_MEASURE_LABELS.map((unitLabel) => (
                          <option key={unitLabel} value={unitLabel}>
                            {unitLabel}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(index)}
                        className="p-2.5 text-outline hover:text-secondary hover:bg-secondary/10 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <NutrientInput
                        placeholder={t('addMealModal.fields.calories.placeholder')}
                        label={t('addMealModal.fields.calories.label')}
                        value={ing.calories}
                        onChange={(v) => handleIngredientChange(index, 'calories', v)}
                      />
                      <NutrientInput
                        placeholder={t('addMealModal.fields.protein.placeholder')}
                        label={t('addMealModal.fields.protein.label')}
                        value={ing.protein}
                        onChange={(v) => handleIngredientChange(index, 'protein', v)}
                      />
                      <NutrientInput
                        placeholder={t('addMealModal.fields.fat.placeholder')}
                        label={t('addMealModal.fields.fat.label')}
                        value={ing.fat}
                        onChange={(v) => handleIngredientChange(index, 'fat', v)}
                      />
                      <NutrientInput
                        placeholder={t('addMealModal.fields.carbs.placeholder')}
                        label={t('addMealModal.fields.carbs.label')}
                        value={ing.carbs}
                        onChange={(v) => handleIngredientChange(index, 'carbs', v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-surface-container-low/95 border-t border-outline-variant/15 flex justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-on-surface-variant font-display font-semibold text-sm rounded-full hover:bg-surface-container-high dark:hover:bg-surface-container-highest transition-colors"
          >
            {t('addMealModal.buttons.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {editingMeal && editingMeal.id ? t('addMealModal.buttons.save') : t('addMealModal.buttons.add')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface NutrientInputProps {
  label: string;
  placeholder: string;
  value: number | undefined;
  onChange: (value: number) => void;
}

function NutrientInput({ label, placeholder, value, onChange }: NutrientInputProps) {
  return (
    <div>
      <input
        type="number"
        min="0"
        step="0.1"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
      />
      <div className="text-[10px] text-outline mt-0.5 ml-1 font-display font-semibold uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
