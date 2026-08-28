import { useState } from 'react';
import {
  MoreVertical,
  Edit2,
  Trash2,
  Tag as TagIcon,
  Image as ImageIcon,
  Clock,
  Flame,
} from 'lucide-react';
import { Meal } from '../types';
import ImageGenerator from './ImageGenerator';
import MealDetailsModal from './MealDetailsModal';
import { getMealBaseServings, getScaledMealNutritionTotals } from '../lib/meal-scaling';
import { useTranslation } from 'react-i18next';

interface MealCardProps {
  meal: Meal;
  onDelete: () => void;
  onEdit: () => void;
}

export default function MealCard({ meal, onDelete, onEdit }: MealCardProps) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const totals = getScaledMealNutritionTotals(meal, meal.servings);
  const totalCalories = totals.calories;
  const totalProtein = totals.protein;
  const servings = getMealBaseServings(meal);

  return (
    <>
      <article
        className="bg-surface-container-lowest rounded-[2rem] overflow-hidden flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer border border-outline-variant/15 group"
        onClick={() => setShowDetails(true)}
      >
        <div className="relative h-48 bg-surface-container-high flex items-center justify-center overflow-hidden">
          {meal.image_url ? (
            <img
              src={meal.image_url}
              alt={meal.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-outline flex flex-col items-center gap-2">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <span className="text-sm font-display font-medium">{t('mealCard.noImage')}</span>
            </div>
          )}

          <div className="absolute top-3 right-3">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-2 bg-surface/95 backdrop-blur-sm rounded-full text-on-surface hover:bg-surface transition-colors shadow-sm"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-2xl shadow-xl py-1 z-10 border border-outline-variant/20 dark:border-outline-variant">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low dark:hover:bg-surface-container-highest inline-flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" /> {t('mealCard.menu.edit')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      setShowImageGen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low dark:hover:bg-surface-container-highest inline-flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" /> {t('mealCard.menu.generateImage')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-secondary hover:bg-secondary/10 inline-flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> {t('mealCard.menu.delete')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {meal.tag && (
            <div className="absolute bottom-3 left-3">
              <span className="bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-display font-bold uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <TagIcon className="w-3 h-3" />
                {meal.tag}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-lg font-display font-extrabold text-on-surface mb-3 leading-tight">
            {meal.name}
          </h3>

          {(totalCalories > 0 || totalProtein > 0) && (
            <div className="flex flex-wrap gap-2 mb-4 text-xs font-display font-semibold">
              <div className="bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/15 dark:text-primary-fixed-dim px-2.5 py-1.5 rounded-full inline-flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {totalCalories.toFixed(0)} {t('mealCard.kcal')}
              </div>
              <div className="bg-surface-container-high text-on-surface-variant px-2.5 py-1.5 rounded-full inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('mealCard.count', {ingredients: meal.ingredients.length, servings})}
              </div>
            </div>
          )}

          <div className="flex-1">
            <h4 className="text-[10px] font-display font-bold text-outline uppercase tracking-widest mb-2">
              {t('mealCard.ingredients')}
            </h4>
            <ul className="space-y-1.5">
              {meal.ingredients.slice(0, 4).map((ing, i) => (
                <li
                  key={i}
                  className="text-sm text-on-surface-variant flex justify-between gap-3"
                >
                  <span className="truncate">{ing.name}</span>
                  <span className="text-outline whitespace-nowrap font-display font-semibold">
                    {ing.amount} {ing.measure}
                  </span>
                </li>
              ))}
              {meal.ingredients.length > 4 && (
                <li className="text-sm text-outline italic pt-1">
                  + {meal.ingredients.length - 4} {t('mealCard.more')}
                </li>
              )}
            </ul>
          </div>
        </div>
      </article>

      {showImageGen && (
        <ImageGenerator
          meal={meal}
          onClose={() => setShowImageGen(false)}
          onSuccess={() => {
            setShowImageGen(false);
            window.location.reload();
          }}
        />
      )}

      <MealDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onEdit={() => {
          setShowDetails(false);
          onEdit();
        }}
        meal={meal}
      />
    </>
  );
}
