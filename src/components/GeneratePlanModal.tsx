import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { apiFetch } from '../lib/api';
import AiProviderSelector from './AiProviderSelector';
import ResponseLanguageSelector from './ResponseLanguageSelector';
import {
  AiProviderId,
  ResponseLanguageCode,
  aiJobLanguageLabel,
  defaultModelForProvider,
  loadAiSettings,
  saveAiSettings,
  showAiProviderPickerInModals,
  showLanguagePickerInModals,
  structuredAiLanguagePayload,
} from '../lib/ai-settings';
import { aiJobModelLabel, useAiJobQueue } from '../context/AiJobQueueContext';
import { useTranslation } from 'react-i18next';
import { dateLocaleFor } from '../lib/date-locale';

interface GeneratePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  startDate: Date;
}

const DIET_OPTIONS = [
  { value: 'Any / Balanced', labelKey: 'generatePlanModal.diets.any' },
  { value: 'Vegetarian', labelKey: 'generatePlanModal.diets.vegetarian' },
  { value: 'Vegan', labelKey: 'generatePlanModal.diets.vegan' },
  { value: 'Keto', labelKey: 'generatePlanModal.diets.keto' },
  { value: 'Paleo', labelKey: 'generatePlanModal.diets.paleo' },
  { value: 'High Protein', labelKey: 'generatePlanModal.diets.highProtein' },
  { value: 'Low Carb', labelKey: 'generatePlanModal.diets.lowCarb' },
  { value: 'Mediterranean', labelKey: 'generatePlanModal.diets.mediterranean' },
] as const;

export default function GeneratePlanModal({
  isOpen,
  onClose,
  onSave,
  startDate,
}: GeneratePlanModalProps) {
  const { t, i18n } = useTranslation();
  const { runWithAiJob } = useAiJobQueue();
  const [diet, setDiet] = useState<(typeof DIET_OPTIONS)[number]['value']>(DIET_OPTIONS[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<AiProviderId>(() => loadAiSettings().provider);
  const [model, setModel] = useState(() => loadAiSettings().model);
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguageCode>(
    () => loadAiSettings().responseLanguage ?? 'auto',
  );

  useEffect(() => {
    const sync = () => {
      const s = loadAiSettings();
      setProvider(s.provider);
      setModel(s.model);
      setResponseLanguage(s.responseLanguage ?? 'auto');
    };
    sync();
    window.addEventListener('arpa-ai-settings-updated', sync);
    return () => window.removeEventListener('arpa-ai-settings-updated', sync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const s = loadAiSettings();
    setProvider(s.provider);
    setModel(s.model);
    setResponseLanguage(s.responseLanguage ?? 'auto');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    const dateLocale = dateLocaleFor(i18n.resolvedLanguage);
    const selectedDiet = DIET_OPTIONS.find((option) => option.value === diet) ?? DIET_OPTIONS[0];
    const related = `${t(selectedDiet.labelKey)} · ${format(startDate, 'MMM d, yyyy', { locale: dateLocale })}`;
    try {
      await runWithAiJob(
        {
          kind: 'generate-plan',
          title: t('generatePlanModal.jobTitle'),
          relatedLabel: related,
          providerId: provider,
          modelLabel: aiJobModelLabel(provider, model),
          languageLabel: aiJobLanguageLabel(responseLanguage),
          buildRestore: () => ({
            path: '/planner',
            state: { plannerRefresh: true },
          }),
        },
        async () => {
          const res = await apiFetch('/api/ai/generate-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate: format(startDate, 'yyyy-MM-dd'),
              diet,
              provider,
              model: model.trim() || undefined,
              ...structuredAiLanguagePayload(responseLanguage),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || t('generatePlanModal.errors.generate'));
          }

          onSave();
        },
      );
    } catch (err: unknown) {
      console.error('Generation error:', err);
      setError(
        err instanceof Error ? err.message : t('generatePlanModal.errors.default'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (next: AiProviderId) => {
    const nextSettings = {
      provider: next,
      model: model.trim() ? model : defaultModelForProvider(next),
    };
    setProvider(nextSettings.provider);
    setModel(nextSettings.model);
    if (showAiProviderPickerInModals()) saveAiSettings(nextSettings);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    if (showAiProviderPickerInModals()) saveAiSettings({ provider, model: next });
  };

  const handleResponseLanguageChange = (next: ResponseLanguageCode) => {
    setResponseLanguage(next);
    if (showLanguagePickerInModals()) saveAiSettings({ provider, model, responseLanguage: next });
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-outline-variant/15">
        <div className="px-6 py-5 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold text-primary-container dark:text-primary-fixed-dim tracking-tight">
                {t('generatePlanModal.title')}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {t('generatePlanModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-outline hover:bg-surface-container-high transition-colors"
            aria-label={t('app.buttons.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-2 space-y-5">
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {t('generatePlanModal.text') + ' '}
            <strong className="text-on-surface font-display font-bold">
              {format(startDate, 'MMM d, yyyy', {
                locale: dateLocaleFor(i18n.resolvedLanguage),
              })}
            </strong>
            .
          </p>

          {showAiProviderPickerInModals() ? (
            <div>
              <AiProviderSelector
                provider={provider}
                model={model}
                onProviderChange={handleProviderChange}
                onModelChange={handleModelChange}
              />
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">
              {t('generatePlanModal.AItext')}
            </p>
          )}

          {showLanguagePickerInModals() ? (
            <ResponseLanguageSelector value={responseLanguage} onChange={handleResponseLanguageChange} />
          ) : (
            <p className="text-xs text-on-surface-variant">
              {t('generatePlanModal.langText')}
            </p>
          )}

          <div>
            <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline mb-2">
              {t('generatePlanModal.dietary')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DIET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDiet(option.value)}
                  className={`px-3 py-2.5 text-sm rounded-2xl border text-left transition-all ${
                    diet === option.value
                      ? 'bg-primary-container/10 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim font-display font-semibold'
                      : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:border-primary-container/40'
                  }`}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-error-container text-on-error-container text-sm rounded-2xl border border-error/20">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 mt-4 bg-surface-container-low/95 flex justify-end gap-3 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-on-surface-variant font-display font-semibold text-sm rounded-full hover:bg-surface-container-high dark:hover:bg-surface-container-highest transition-colors"
          >
            {t('generatePlanModal.buttons.cancel')}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('generatePlanModal.buttons.loading')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t('generatePlanModal.buttons.generate')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
