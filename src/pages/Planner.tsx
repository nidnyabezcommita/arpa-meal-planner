import { useState, useEffect, useReducer } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek } from 'date-fns';
import {
  Plus,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  GripVertical,
  Clock,
} from 'lucide-react';
import { Meal, PlannerItem } from '../types';
import GeneratePlanModal from '../components/GeneratePlanModal';
import { apiFetch } from '../lib/api';
import { getMealBaseServings, resolveEffectiveServings } from '../lib/meal-scaling';
import { isAiJobNavigationState, type AiJobNavigationState } from '../lib/ai-job-nav-state';
import { loadWeekStartsOn } from '../lib/preferences';
import { useTranslation } from 'react-i18next';
import { dateLocaleFor } from '../lib/date-locale';

export default function Planner() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [discoverySearch, setDiscoverySearch] = useState('');
  const [discoveryFilter, setDiscoveryFilter] = useState<string | null>(null);
  const [draggingPlannerId, setDraggingPlannerId] = useState<number | null>(null);
  const [activeDropDate, setActiveDropDate] = useState<string | null>(null);

  const [, bumpPrefs] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const onPrefs = () => bumpPrefs();
    window.addEventListener('arpa-preferences-updated', onPrefs);
    return () => window.removeEventListener('arpa-preferences-updated', onPrefs);
  }, []);

  const fetchMeals = async () => {
    try {
      const res = await apiFetch('/api/meals');
      const data = await res.json();
      setMeals(data);
    } catch (error) {
      console.error('Failed to fetch meals', error);
    }
  };

  const fetchPlanner = async () => {
    try {
      const res = await apiFetch('/api/planner');
      const data = await res.json();
      setPlannerItems(data);
    } catch (error) {
      console.error('Failed to fetch planner', error);
    }
  };

  useEffect(() => {
    fetchMeals();
    fetchPlanner();
  }, []);

  useEffect(() => {
    const raw = location.state as AiJobNavigationState | null | undefined;
    if (!raw || !isAiJobNavigationState(raw) || !raw.plannerRefresh) return;
    fetchMeals();
    fetchPlanner();
    navigate('.', { replace: true, state: {} });
  }, [location.state, navigate]);

  const weekStartsOn = loadWeekStartsOn();
  const startDate = startOfWeek(selectedDate, { weekStartsOn });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
  const dateLocale = dateLocaleFor(i18n.resolvedLanguage);

  const tags = Array.from(new Set(meals.map((m) => m.tag).filter(Boolean)));

  const filteredDiscovery = meals.filter((meal) => {
    const matchesSearch = meal.name.toLowerCase().includes(discoverySearch.toLowerCase());
    const matchesFilter = discoveryFilter ? meal.tag === discoveryFilter : true;
    return matchesSearch && matchesFilter;
  });

  const handleAddMeal = async (dateStr: string, mealId: number, servingsOverride: number | null = null) => {
    try {
      await apiFetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, meal_id: mealId, servings_override: servingsOverride }),
      });
      fetchPlanner();
      setIsAdding(null);
    } catch (error) {
      console.error('Failed to add meal to planner', error);
    }
  };

  const handleUpdateServingsOverride = async (plannerId: number, servingsOverride: number | null) => {
    const previous = plannerItems;
    setPlannerItems((prev) =>
      prev.map((item) =>
        item.id === plannerId ? { ...item, servings_override: servingsOverride } : item
      )
    );

    try {
      const res = await apiFetch(`/api/planner/${plannerId}/servings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servings_override: servingsOverride }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || t('planner.errors.update')
        );
      }
    } catch (error) {
      setPlannerItems(previous);
      console.error(t('planner.errors.update'), error);
      alert(error instanceof Error ? error.message : t('planner.errors.update'));
    }
  };

  const handleDragStart = (e: React.DragEvent, mealId: number) => {
    e.dataTransfer.setData('mealId', mealId.toString());
    e.dataTransfer.effectAllowed = 'copy';
    setActiveDropDate(null);
  };

  const handlePlannerDragStart = (e: React.DragEvent, plannerId: number) => {
    e.dataTransfer.setData('plannerId', plannerId.toString());
    e.dataTransfer.effectAllowed = 'move';

    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
    setDraggingPlannerId(plannerId);
    setActiveDropDate(null);
  };

  const handleDragEnd = () => {
    setDraggingPlannerId(null);
    setActiveDropDate(null);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, dateStr: string) => {
    e.preventDefault();
    setActiveDropDate(dateStr);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, dateStr: string) => {
    e.preventDefault();
    if (activeDropDate !== dateStr) setActiveDropDate(dateStr);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget;
    if (relatedTarget instanceof Node && e.currentTarget.contains(relatedTarget)) return;
    setActiveDropDate(null);
  };

  const handleMovePlannerItem = async (plannerId: number, dateStr: string) => {
    const previous = plannerItems;
    const movingItem = plannerItems.find((item) => item.id === plannerId);
    if (!movingItem || movingItem.date === dateStr) return;

    setPlannerItems((prev) =>
      prev.map((item) => (item.id === plannerId ? { ...item, date: dateStr } : item))
    );

    try {
      const res = await apiFetch(`/api/planner/${plannerId}/date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || t('planner.errors.move'));
      }
    } catch (error) {
      setPlannerItems(previous);
      console.error('Failed to move meal in planner', error);
      alert(error instanceof Error ? error.message : t('planner.errors.move'));
    }
  };

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setActiveDropDate(null);
    const plannerId = e.dataTransfer.getData('plannerId');
    if (plannerId) {
      handleMovePlannerItem(parseInt(plannerId, 10), dateStr);
      return;
    }

    const mealId = e.dataTransfer.getData('mealId');
    if (mealId) {
      handleAddMeal(dateStr, parseInt(mealId));
    }
  };

  const handleRemoveMeal = async (id: number) => {
    try {
      await apiFetch(`/api/planner/${id}`, { method: 'DELETE' });
      fetchPlanner();
    } catch (error) {
      console.error('Failed to remove meal from planner', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-primary-container dark:text-primary-fixed-dim">
            {t('planner.title')}
          </h1>
          <p className="text-on-surface-variant mt-1 font-medium">
            {t('planner.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-low rounded-full p-1.5">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              className="p-2 rounded-full hover:bg-surface-container-lowest transition-colors active:scale-90"
              aria-label={t('app.buttons.previousWeek')}
            >
              <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
            </button>
            <div className="px-3 text-sm font-display font-semibold text-on-surface whitespace-nowrap">
              {format(startDate, 'MMM d', { locale: dateLocale })} –{' '}
              {format(addDays(startDate, 6), 'MMM d', { locale: dateLocale })}
            </div>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              className="p-2 rounded-full hover:bg-surface-container-lowest transition-colors active:scale-90"
              aria-label={t('app.buttons.nextWeek')}
            >
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </button>
          </div>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-5 py-2.5 rounded-full bg-surface-container-highest text-on-surface font-display font-semibold text-sm hover:bg-surface-container-high transition-colors"
          >
            {t('planner.today')}
          </button>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="px-5 py-2.5 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm flex items-center gap-2 transition-opacity hover:opacity-90 active:scale-95 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">{t('planner.buttons.generatePlan')}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar grid */}
        <section className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 lg:gap-4">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
            const dayMeals = plannerItems.filter((item) => item.date === dateStr);
            const dayMealsWithImg = dayMeals.map((p) => ({
              planner: p,
              meal: meals.find((m) => m.id === p.meal_id),
            }));

            return (
              <div
                key={dateStr}
                onDragEnter={(e) => handleDragEnter(e, dateStr)}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={`relative flex flex-col gap-3 rounded-[1.5rem] p-2 -m-2 transition-colors duration-200 group ${
                  activeDropDate === dateStr
                    ? 'bg-primary-container/15 ring-2 ring-primary/50 shadow-[0_0_0_4px_rgba(45,106,79,0.08)]'
                    : ''
                }`}
              >
                <div className="text-center py-2">
                  <p
                    className={`font-display text-[11px] uppercase tracking-widest font-bold ${
                      isToday ? 'text-primary-container dark:text-primary-fixed-dim' : 'text-outline'
                    }`}
                  >
                    {format(day, 'EEE', { locale: dateLocale })}
                  </p>
                  <p
                    className={`font-display text-xl font-extrabold ${
                      isToday
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-on-surface'
                    }`}
                  >
                    {format(day, 'd')}
                  </p>
                  {activeDropDate === dateStr && (
                    <span className="mt-1 inline-flex rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-primary">
                      {t('planner.dropHere')}
                    </span>
                  )}
                </div>

                {dayMealsWithImg.length > 0 ? (
                  dayMealsWithImg.map(({ planner, meal }) => (
                    <article
                      key={planner.id}
                      draggable
                      onDragStart={(e) => handlePlannerDragStart(e, planner.id)}
                      onDragEnd={handleDragEnd}
                      className={`aspect-[4/5] rounded-[1.5rem] overflow-hidden relative group/card shadow-sm hover:shadow-md transition-all bg-surface-container cursor-grab active:cursor-grabbing select-none ${
                        draggingPlannerId === planner.id ? 'opacity-50 scale-[0.98]' : ''
                      }`}
                      aria-label={t('planner.moveAria', { name: planner.meal_name })}
                    >
                      {meal?.image_url ? (
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          draggable={false}
                          className="w-full h-full object-cover pointer-events-none group-hover/card:grayscale-0 grayscale-[0.15] transition-all duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-container/30 to-secondary-container/30" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3 flex flex-col justify-end pointer-events-none">
                        <h4 className="text-white font-display font-bold text-sm leading-tight line-clamp-2">
                          {planner.meal_name}
                        </h4>
                        {meal?.tag && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-white/80">
                            <span className="px-1.5 py-0.5 bg-white/15 backdrop-blur-sm rounded-full font-bold">
                              {meal.tag}
                            </span>
                          </div>
                        )}
                        {meal ? (
                          <div className="mt-1 inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-white/90 font-bold">
                            <Clock className="w-3 h-3" />
                            {resolveEffectiveServings(meal, planner.servings_override)} {t('planner.servings')}
                          </div>
                        ) : null}
                      </div>
                      {meal ? (
                        <>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = resolveEffectiveServings(meal, planner.servings_override);
                              if (current <= 1) return;
                              const next = current - 1;
                              const base = getMealBaseServings(meal);
                              handleUpdateServingsOverride(planner.id, next === base ? null : next);
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/65 text-white text-xl font-bold flex items-center justify-center shadow-lg opacity-0 group-hover/card:opacity-100 hover:bg-black/80 transition-all pointer-events-auto"
                            aria-label={t('planner.buttons.decrease')}
                          >
                            -
                          </button>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = resolveEffectiveServings(meal, planner.servings_override);
                              const next = Math.min(100, current + 1);
                              const base = getMealBaseServings(meal);
                              handleUpdateServingsOverride(planner.id, next === base ? null : next);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/65 text-white text-xl font-bold flex items-center justify-center shadow-lg opacity-0 group-hover/card:opacity-100 hover:bg-black/80 transition-all pointer-events-auto"
                            aria-label={t('planner.buttons.increase')}
                          >
                            +
                          </button>
                        </>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMeal(planner.id);
                        }}
                        className="absolute top-2 right-2 z-20 p-1.5 bg-white/85 hover:bg-white text-secondary rounded-full opacity-0 group-hover/card:opacity-100 transition-all"
                        aria-label={t('planner.buttons.remove')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </article>
                  ))
                ) : null}

                {isAdding === dateStr ? (
                  <div className="aspect-[4/5] rounded-[1.5rem] border-2 border-primary/40 bg-surface-container-low flex items-center p-3">
                    <select
                      className="w-full h-full text-sm bg-transparent border border-outline-variant/40 rounded-2xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddMeal(dateStr, parseInt(e.target.value, 10));
                        }
                      }}
                      onBlur={() => setIsAdding(null)}
                      autoFocus
                    >
                      <option value="">{t('planner.select')}</option>
                      {meals.map((meal) => (
                        <option key={meal.id} value={meal.id}>
                          {meal.name} ({t('planner.mealOptionServings', { count: getMealBaseServings(meal) })})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAdding(dateStr)}
                    className="aspect-[4/5] rounded-[1.5rem] border-2 border-dashed border-outline-variant/50 hover:border-primary/40 hover:bg-surface-container-low dark:hover:bg-surface-container-low/50 flex flex-col items-center justify-center gap-2 text-outline hover:text-primary-container transition-colors group/empty"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                      {t('planner.buttons.add')}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {/* Discovery panel */}
        <aside className="w-full lg:w-80 flex-shrink-0 bg-surface-container-low rounded-[2rem] p-6 flex flex-col gap-5 self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]">
          <div>
            <h3 className="font-display text-xl font-bold text-primary-container dark:text-primary-fixed-dim">
              {t('planner.discovery.title')}
            </h3>
            <p className="text-xs text-outline font-medium mt-1">{t('planner.discovery.subtitle')}</p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={discoverySearch}
              onChange={(e) => setDiscoverySearch(e.target.value)}
              placeholder={t('planner.discovery.search.placeholder')}
              className="w-full pl-9 pr-3 py-2.5 bg-surface-container-lowest border-none rounded-full text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 text-on-surface placeholder:text-outline"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDiscoveryFilter(null)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-display font-bold transition-colors ${
                discoveryFilter === null
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-dim'
              }`}
            >
              {t('planner.discovery.all')}
            </button>
            {tags.slice(0, 6).map((tag) => (
              <button
                key={tag}
                onClick={() => setDiscoveryFilter(tag)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-display font-bold transition-colors ${
                  discoveryFilter === tag
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-dim'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto thin-scrollbar flex flex-col gap-3 pr-1 -mr-1 max-h-[60vh] lg:max-h-none">
            {filteredDiscovery.length > 0 ? (
              filteredDiscovery.map((meal) => (
                <div
                  key={meal.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, meal.id)}
                  onDragEnd={handleDragEnd}
                  className="group flex items-center gap-3 p-2 bg-surface-container-lowest rounded-2xl hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                >
                  <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-surface-container-high dark:bg-surface-container-highest">
                    {meal.image_url ? (
                      <img
                        src={meal.image_url}
                        alt={meal.name}
                        draggable={false}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h5 className="text-xs font-display font-bold text-on-surface truncate">
                      {meal.name}
                    </h5>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {meal.tag && (
                        <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                          {meal.tag}
                        </span>
                      )}
                      <span className="text-outline text-[9px] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t('planner.discovery.count', {
                          ingredients: meal.ingredients.length,
                          servings: getMealBaseServings(meal),
                        })}
                      </span>
                    </div>
                  </div>
                  <GripVertical className="w-4 h-4 text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))
            ) : (
              <p className="text-xs text-outline italic text-center py-6">
                {t('planner.discovery.empty')}
              </p>
            )}
          </div>
        </aside>
      </div>

      {isGenerateModalOpen && (
        <GeneratePlanModal
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
          startDate={startDate}
          onSave={() => {
            setIsGenerateModalOpen(false);
            fetchMeals();
            fetchPlanner();
          }}
        />
      )}
    </div>
  );
}
