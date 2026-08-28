import { useEffect, useState } from 'react';
import AiProviderSelector from '../components/AiProviderSelector';
import ResponseLanguageSelector from '../components/ResponseLanguageSelector';
import {
  AiLanguageUiMode,
  AiProviderId,
  AiProviderUiMode,
  ResponseLanguageCode,
  defaultModelForProvider,
  loadAiSettings,
  saveAiLanguageUiMode,
  saveAiProviderUiMode,
  saveAiSettings,
} from '../lib/ai-settings';
import {
  loadDefaultServings,
  loadThemeMode,
  loadWeekStartsOn,
  saveDefaultServings,
  saveThemeMode,
  saveWeekStartsOn,
  ThemeMode,
} from '../lib/preferences';
import { useTranslation } from 'react-i18next';

export default function Preferences() {
  const { t, i18n } = useTranslation();
  const [defaultServings, setDefaultServings] = useState(() => loadDefaultServings());
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => loadWeekStartsOn());
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => loadThemeMode());
  const [providerUiMode, setProviderUiModeState] = useState<AiProviderUiMode>(
    () => loadAiSettings().providerUiMode ?? 'per_request',
  );
  const [provider, setProvider] = useState<AiProviderId>(() => loadAiSettings().provider);
  const [model, setModel] = useState(() => loadAiSettings().model);
  const [languageUiMode, setLanguageUiModeState] = useState<AiLanguageUiMode>(
    () => loadAiSettings().languageUiMode ?? 'per_request',
  );
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguageCode>(
    () => loadAiSettings().responseLanguage ?? 'auto',
  );
  const [servingsSaved, setServingsSaved] = useState(false);
  const uiLanguage = i18n.resolvedLanguage?.startsWith('tr') ? 'tr' : 'en';
  const modes = {
    light: t('preferences.appearance.light'),
    dark: t('preferences.appearance.dark'),
    system: t('preferences.appearance.system'),
  };

  useEffect(() => {
    const syncAi = () => {
      const s = loadAiSettings();
      setProvider(s.provider);
      setModel(s.model);
      setProviderUiModeState(s.providerUiMode ?? 'per_request');
      setLanguageUiModeState(s.languageUiMode ?? 'per_request');
      setResponseLanguage(s.responseLanguage ?? 'auto');
    };
    window.addEventListener('arpa-ai-settings-updated', syncAi);
    return () => window.removeEventListener('arpa-ai-settings-updated', syncAi);
  }, []);

  const persistServings = () => {
    saveDefaultServings(defaultServings);
    setServingsSaved(true);
    window.setTimeout(() => setServingsSaved(false), 2000);
  };

  const handleWeekChange = (v: 0 | 1) => {
    setWeekStartsOn(v);
    saveWeekStartsOn(v);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeModeState(mode);
    saveThemeMode(mode);
  };

  const handleProviderUiModeChange = (mode: AiProviderUiMode) => {
    setProviderUiModeState(mode);
    saveAiProviderUiMode(mode);
  };

  const handleProviderChange = (next: AiProviderId) => {
    const nextSettings = {
      provider: next,
      model: model.trim() ? model : defaultModelForProvider(next),
      providerUiMode,
      languageUiMode,
      responseLanguage,
    };
    setProvider(nextSettings.provider);
    setModel(nextSettings.model);
    saveAiSettings(nextSettings);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    saveAiSettings({
      provider,
      model: next,
      providerUiMode,
      languageUiMode,
      responseLanguage,
    });
  };

  const handleLanguageUiModeChange = (mode: AiLanguageUiMode) => {
    setLanguageUiModeState(mode);
    saveAiLanguageUiMode(mode);
  };

  const handleResponseLanguageChange = (next: ResponseLanguageCode) => {
    setResponseLanguage(next);
    saveAiSettings({
      provider,
      model,
      providerUiMode,
      languageUiMode,
      responseLanguage: next,
    });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-primary-container dark:text-primary-fixed-dim">
          {t('preferences.title')}
        </h1>
        <p className="text-on-surface-variant mt-2 font-medium">
          {t('preferences.subtitle')}
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-4">
        <h2 className="text-lg font-display font-bold text-on-surface">
          {t('preferences.interfaceLanguage.title')}
        </h2>
        <p className="text-sm text-on-surface-variant">
          {t('preferences.interfaceLanguage.text')}
        </p>
        <label
          htmlFor="interface-language"
          className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline"
        >
          {t('preferences.interfaceLanguage.label')}
        </label>
        <select
          id="interface-language"
          value={uiLanguage}
          onChange={(event) => void i18n.changeLanguage(event.target.value)}
          className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-2xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="en">English</option>
          <option value="tr">Türkçe</option>
        </select>
      </section>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-4">
        <h2 className="text-lg font-display font-bold text-on-surface">{t('preferences.meals.title')}</h2>
        <p className="text-sm text-on-surface-variant">
          {t('preferences.meals.text')}
        </p>
        <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline">
          {t('preferences.meals.fields.servings.label')}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={1}
            max={100}
            value={defaultServings}
            onChange={(e) => setDefaultServings(Number(e.target.value))}
            className="w-28 px-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-2xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={persistServings}
            className="px-5 py-3 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {t('preferences.meals.buttons.save')}
          </button>
          {servingsSaved ? (
            <span className="text-sm text-primary-container dark:text-primary-fixed-dim font-medium">
              {t('preferences.meals.buttons.saved')}
            </span>
          ) : null}
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-4">
        <h2 className="text-lg font-display font-bold text-on-surface">{t('preferences.calendar.title')}</h2>
        <p className="text-sm text-on-surface-variant">
          {t('preferences.calendar.text')}
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleWeekChange(1)}
            className={`px-5 py-2.5 rounded-full text-sm font-display font-semibold border transition-colors ${
              weekStartsOn === 1
                ? 'bg-primary-container/15 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
                : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container/40'
            }`}
          >
            {t('preferences.calendar.monday')}
          </button>
          <button
            type="button"
            onClick={() => handleWeekChange(0)}
            className={`px-5 py-2.5 rounded-full text-sm font-display font-semibold border transition-colors ${
              weekStartsOn === 0
                ? 'bg-primary-container/15 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
                : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container/40'
            }`}
          >
            {t('preferences.calendar.sunday')}
          </button>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-4">
        <h2 className="text-lg font-display font-bold text-on-surface">{t('preferences.appearance.title')}</h2>
        <p className="text-sm text-on-surface-variant">
          {t('preferences.appearance.text')}
        </p>
        <div className="flex gap-2 flex-wrap">
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleThemeChange(mode)}
              className={`px-5 py-2.5 rounded-full text-sm font-display font-semibold border capitalize transition-colors ${
                themeMode === mode
                  ? 'bg-primary-container/15 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
                  : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container/40'
              }`}
            >
              {modes[mode]}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-5">
        <h2 className="text-lg font-display font-bold text-on-surface">{t('preferences.ai.title')}</h2>

        <div className="space-y-2">
          <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline">
            {t('preferences.ai.fields.providerUi.label')}
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-3 cursor-pointer text-sm text-on-surface">
              <input
                type="radio"
                name="providerUiMode"
                checked={providerUiMode === 'per_request'}
                onChange={() => handleProviderUiModeChange('per_request')}
                className="mt-1"
              />
              <span>
                <span className="font-display font-semibold">{t('preferences.ai.fields.providerUi.options.choose.title')}</span>
                <span className="block text-on-surface-variant text-xs mt-0.5">
                  {t('preferences.ai.fields.providerUi.options.choose.text')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer text-sm text-on-surface">
              <input
                type="radio"
                name="providerUiMode"
                checked={providerUiMode === 'global_only'}
                onChange={() => handleProviderUiModeChange('global_only')}
                className="mt-1"
              />
              <span>
                <span className="font-display font-semibold">{t('preferences.ai.fields.providerUi.options.one.title')}</span>
                <span className="block text-on-surface-variant text-xs mt-0.5">
                  {t('preferences.ai.fields.providerUi.options.one.text')}
                </span>
              </span>
            </label>
          </div>
        </div>

        <AiProviderSelector
          provider={provider}
          model={model}
          onProviderChange={handleProviderChange}
          onModelChange={handleModelChange}
        />

        <div className="space-y-2 pt-2 border-t border-outline-variant/15">
          <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline">
            {t('preferences.ai.fields.lang.label')}
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-3 cursor-pointer text-sm text-on-surface">
              <input
                type="radio"
                name="languageUiMode"
                checked={languageUiMode === 'per_request'}
                onChange={() => handleLanguageUiModeChange('per_request')}
                className="mt-1"
              />
              <span>
                <span className="font-display font-semibold">{t('preferences.ai.fields.lang.options.choose.title')}</span>
                <span className="block text-on-surface-variant text-xs mt-0.5">
                  {t('preferences.ai.fields.lang.options.choose.text')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer text-sm text-on-surface">
              <input
                type="radio"
                name="languageUiMode"
                checked={languageUiMode === 'global_only'}
                onChange={() => handleLanguageUiModeChange('global_only')}
                className="mt-1"
              />
              <span>
                <span className="font-display font-semibold">{t('preferences.ai.fields.lang.options.one.title')}</span>
                <span className="block text-on-surface-variant text-xs mt-0.5">
                  {t('preferences.ai.fields.lang.options.one.text')}
                </span>
              </span>
            </label>
          </div>
        </div>

        <ResponseLanguageSelector
          value={responseLanguage}
          onChange={handleResponseLanguageChange}
          helperText={
            responseLanguage === 'auto'
              ? t('preferences.ai.langHelper')
              : undefined
          }
        />

        <p className="text-[11px] text-outline leading-relaxed">
          {t('preferences.ai.imageText')}
        </p>
      </section>
    </div>
  );
}
