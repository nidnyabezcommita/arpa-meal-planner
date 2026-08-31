import { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  Clock,
  ChefHat,
  Edit2,
  Tag as TagIcon,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  Users as UsersIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Meal } from '../types';
import {
  getMealBaseServings,
  getScaledIngredients,
  getScaledMealNutritionTotals,
  resolveEffectiveServings,
} from '../lib/meal-scaling';
import { useTranslation } from 'react-i18next';

interface MealDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  meal: Meal | null;
}

export default function MealDetailsModal({ isOpen, onClose, onEdit, meal }: MealDetailsModalProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [displayServings, setDisplayServings] = useState(4);

  const baseServings = meal ? getMealBaseServings(meal) : 4;

  useEffect(() => {
    if (!meal) return;
    setDisplayServings(baseServings);
    setCurrentStep(0);
  }, [meal, baseServings]);

  if (!isOpen || !meal) return null;

  const effectiveServings = resolveEffectiveServings(meal, displayServings);
  const scaledIngredients = getScaledIngredients(meal, effectiveServings);
  const totals = getScaledMealNutritionTotals(meal, effectiveServings);
  const totalCalories = totals.calories;
  const totalProtein = totals.protein;
  const totalFat = totals.fat;
  const totalCarbs = totals.carbs;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-outline-variant/15">
        <div className="relative h-72 bg-surface-container-high flex-shrink-0">
          {meal.image_url ? (
            <img
              src={meal.image_url}
              alt={meal.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-outline">
              <ImageIcon className="w-12 h-12 opacity-40 mb-2" />
              <span className="font-display font-medium">{t('mealDetailsModal.noImageText')}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2.5 bg-surface/90 dark:bg-surface/90 backdrop-blur-sm rounded-full text-on-surface hover:bg-surface shadow-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {meal.tag && (
            <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
              <span className="bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-display font-bold uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <TagIcon className="w-3 h-3" />
                {meal.tag}
              </span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 flex-1 overflow-y-auto thin-scrollbar">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-extrabold text-primary-container dark:text-primary-fixed-dim leading-tight tracking-tight mb-3">
                {meal.name}
              </h2>
              <div className="flex flex-wrap items-center gap-5 text-on-surface-variant text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary-container" />
                  {meal.ingredients.length} {t('mealDetailsModal.ingredients')}
                </span>
                <span className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-primary-container" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-1 py-0.5">
                    <button
                      onClick={() => setDisplayServings((prev) => Math.max(1, prev - 1))}
                      className="w-6 h-6 rounded-full bg-surface-container-low dark:bg-surface-container-highest text-on-surface text-sm font-bold hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors"
                      aria-label={t('planner.buttons.decrease')}
                    >
                      -
                    </button>
                    <span className="min-w-8 text-center text-xs font-display font-bold text-on-surface">
                      {effectiveServings}
                    </span>
                    <button
                      onClick={() => setDisplayServings((prev) => Math.min(100, prev + 1))}
                      className="w-6 h-6 rounded-full bg-surface-container-low dark:bg-surface-container-highest text-on-surface text-sm font-bold hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors"
                      aria-label={t('planner.buttons.increase')}
                    >
                      +
                    </button>
                  </span>
                  {t('mealDetailsModal.servings')}
                  {effectiveServings !== baseServings ? (
                    <span className="text-xs text-outline">({t('mealDetailsModal.base')} {baseServings})</span>
                  ) : null}
                </span>
                {totalCalories > 0 && (
                  <span className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-primary-container" />
                    {Math.round(totalCalories)} kcal
                  </span>
                )}
              </div>
              <div
                className={`mt-4 flex flex-wrap items-center gap-3 ${
                  meal.source_url ? 'justify-between' : 'justify-start'
                }`}
              >
                <button
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim hover:opacity-90 transition-opacity font-display font-semibold text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('mealDetailsModal.edit')}
                </button>
                {meal.source_url ? (
                  <a
                    href={meal.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary-container dark:text-primary-fixed-dim hover:underline font-display font-semibold text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('mealDetailsModal.viewOriginal')}
                  </a>
                ) : null}
              </div>
            </div>

            {(totalCalories > 0 || totalProtein > 0) && (
              <div className="grid grid-cols-4 gap-2 bg-surface-container-low dark:bg-surface-container-high/60 p-3 rounded-2xl text-center">
                <NutrientStat label={t('mealDetailsModal.nutrients.calories')} value={Math.round(totalCalories)} />
                <NutrientStat label={t('mealDetailsModal.nutrients.protein')} value={`${totalProtein.toFixed(0)}g`} />
                <NutrientStat label={t('mealDetailsModal.nutrients.fat')} value={`${totalFat.toFixed(0)}g`} />
                <NutrientStat label={t('mealDetailsModal.nutrients.carbs')} value={`${totalCarbs.toFixed(0)}g`} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <aside className="lg:col-span-1 space-y-4">
              <h3 className="text-lg font-display font-bold text-primary-container dark:text-primary-fixed-dim flex items-center gap-2">
                <ChefHat className="w-5 h-5" />
                {t('mealDetailsModal.ingredientsList.title')}
              </h3>
              <ul className="space-y-3 bg-surface-container-low/95 rounded-2xl p-4">
                {scaledIngredients.map((ing, i) => (
                  <li key={i} className="flex justify-between items-start text-sm gap-3">
                    <span className="text-on-surface font-medium">
                      {ing.name}
                    </span>
                    <span className="text-outline whitespace-nowrap text-right font-display font-semibold">
                      {Number(ing.scaledAmount.toFixed(2)).toString()} {ing.measure}
                    </span>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-display font-bold text-primary-container dark:text-primary-fixed-dim flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {t('mealDetailsModal.instructions.title')}
              </h3>
              {meal.instructions && meal.instructions.length > 0 ? (
                <div className="relative bg-surface-container-lowest/50 rounded-[2rem] p-6 overflow-hidden min-h-[280px] flex flex-col border border-outline-variant/15">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-xs font-display font-bold text-primary-container dark:text-primary-fixed-dim uppercase tracking-widest">
                      {t('mealDetailsModal.instructions.step', {number: currentStep + 1, count: meal.instructions.length})}
                    </span>
                    <div className="flex gap-1.5">
                      {meal.instructions.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2 rounded-full transition-all ${
                            idx === currentStep
                              ? 'w-6 bg-primary-container'
                              : 'w-2 bg-outline-variant'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 relative">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex gap-4"
                      >
                        <span className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-fixed text-primary font-display font-extrabold flex items-center justify-center">
                          {currentStep + 1}
                        </span>
                        <p className="text-on-surface text-base lg:text-lg leading-relaxed whitespace-pre-wrap">
                          {meal.instructions[currentStep]}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex justify-between mt-8 pt-4">
                    <button
                      onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                      disabled={currentStep === 0}
                      className="inline-flex items-center gap-1 text-sm font-display font-semibold px-4 py-2.5 rounded-full text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" /> {t('mealDetailsModal.instructions.prev')}
                    </button>
                    <button
                      onClick={() =>
                        setCurrentStep(Math.min(meal.instructions!.length - 1, currentStep + 1))
                      }
                      disabled={currentStep === meal.instructions.length - 1}
                      className="inline-flex items-center gap-1 text-sm font-display font-semibold px-5 py-2.5 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      {t('mealDetailsModal.instructions.next')} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-container-low dark:bg-surface-container-high/50 border border-dashed border-outline-variant/40 rounded-2xl p-6 text-center text-on-surface-variant">
                  <p>{t('mealDetailsModal.instructions.empty.title')}</p>
                  <p className="text-xs mt-1">{t('mealDetailsModal.instructions.empty.subtitle')}</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function NutrientStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-2 py-1">
      <div className="text-[10px] font-display font-bold uppercase tracking-widest text-outline">
        {label}
      </div>
      <div className="text-sm font-display font-bold text-on-surface mt-0.5">
        {value}
      </div>
    </div>
  );
}
