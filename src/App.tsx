import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  ShoppingBasket,
  Boxes,
  Settings as SettingsIcon,
  Bell,
  Moon,
  Sun,
  Users,
  Sparkles,
  Search,
  X,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Planner from './pages/Planner';
import GroceryList from './pages/GroceryList';
import PreferencesPage from './pages/Preferences';
import Chatbot from './components/Chatbot';
import AiJobQueuePanel from './components/AiJobQueuePanel';
import { AiJobQueueProvider } from './context/AiJobQueueContext';
import {
  loadThemeMode,
  migrateLegacyDarkModeToPreferences,
  resolveThemeIsDark,
  toggleExplicitThemeMode,
  ThemeMode,
} from './lib/preferences';
import { useTranslation } from 'react-i18next';

const NAV_ITEMS = [
  { to: '/', labelKey: 'app.nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/planner', labelKey: 'app.nav.planner', icon: Calendar, end: false },
  { to: '/grocery', labelKey: 'app.nav.grocery', icon: ShoppingBasket, end: false },
  { to: '/pantry', labelKey: 'app.nav.pantry', icon: Boxes, end: false },
] as const;

function PageTitle() {
  const { t } = useTranslation('translation');
  const location = useLocation();
  const map: Record<string, string> = {
    '/': t('app.pageTitle.dashboard'),
    '/planner': t('app.pageTitle.planner'),
    '/grocery': t('app.pageTitle.grocery'),
    '/pantry': t('app.pageTitle.pantry'),
    '/preferences': t('app.pageTitle.preferences'),
  };
  return <>{map[location.pathname] ?? t('app.pageTitle.appName')}</>;
}

export default function App() {
  const { t } = useTranslation('translation');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [familyCode, setFamilyCode] = useState('');
  const [currentFamily, setCurrentFamily] = useState('default');

  useEffect(() => {
    migrateLegacyDarkModeToPreferences();
    setThemeMode(loadThemeMode());
  }, []);

  useEffect(() => {
    document.title = t('app.pageTitle.appName');
  }, [t]);

  useEffect(() => {
    const savedFamily = localStorage.getItem('familyId');
    if (savedFamily) {
      setCurrentFamily(savedFamily);
      setFamilyCode(savedFamily);
    }
  }, []);

  useEffect(() => {
    const apply = () => {
      document.documentElement.classList.toggle('dark', resolveThemeIsDark(themeMode));
    };
    apply();
    if (themeMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [themeMode]);

  useEffect(() => {
    const onPrefs = () => setThemeMode(loadThemeMode());
    window.addEventListener('arpa-preferences-updated', onPrefs);
    return () => window.removeEventListener('arpa-preferences-updated', onPrefs);
  }, []);

  const handleQuickTheme = () => {
    const next = toggleExplicitThemeMode();
    setThemeMode(next);
  };

  const themeIconDark = resolveThemeIsDark(themeMode);

  const handleSaveFamily = () => {
    const code = familyCode.trim() || 'default';
    localStorage.setItem('familyId', code);
    setCurrentFamily(code);
    setIsFamilyModalOpen(false);
    window.location.reload();
  };

  return (
    <Router>
      <AiJobQueueProvider>
      <div className="min-h-screen bg-surface text-on-surface font-sans antialiased">
        <div className="flex min-h-screen">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex w-72 flex-col bg-surface-container-low px-6 py-8 gap-8 fixed inset-y-0 left-0 z-30">
            <div className="flex items-center gap-3 px-2">
              <div
                className="w-10 h-10 bg-primary-container dark:bg-primary-fixed-dim transform -scale-x-100 rotate-12 -mr-1"
                style={{
                  WebkitMaskImage: 'url(/arpa-icon.svg)',
                  maskImage: 'url(/arpa-icon.svg)',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }}
              />
              <div className="flex flex-col leading-none">
                <span className="font-display text-2xl font-extrabold tracking-tighter text-primary-container dark:text-primary-fixed-dim">
                  {t('app.logo.title')}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-outline font-bold">
                  {t('app.logo.subtitle')}
                </span>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 rounded-full font-display text-sm transition-all active:scale-[0.98] ${
                      isActive
                        ? 'bg-primary-container text-on-primary shadow-sm font-semibold'
                        : 'text-on-surface-variant font-medium hover:bg-surface-container-high/60 hover:text-on-surface'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {t(labelKey)}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setIsFamilyModalOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-lowest border border-outline-variant/30 rounded-full text-sm font-medium text-on-surface"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('app.nav.familySync')}
                </span>
                <span className="text-xs text-outline truncate max-w-24">
                  {currentFamily === 'default' ? t('app.nav.personal') : currentFamily}
                </span>
              </button>
              <NavLink
                to="/preferences"
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium border transition-colors ${
                    isActive
                      ? 'bg-primary-container/15 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
                      : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface hover:border-primary-container/40'
                  }`
                }
              >
                <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-display font-bold text-sm shrink-0 ring-2 ring-surface-container-low">
                  A
                </div>
                <div className="flex flex-col items-start leading-tight min-w-0">
                  <span className="font-display font-semibold truncate">{t('app.nav.chef.title')}</span>
                  <span className="text-[11px] text-outline truncate">
                    {t('app.nav.chef.subtitle')}
                  </span>
                </div>
              </NavLink>
            </div>
          </aside>

          {/* Main column */}
          <div className="flex-1 flex flex-col lg:ml-72">
            {/* Desktop top bar */}
            <header className="hidden lg:flex sticky top-0 z-20 h-20 items-center px-10 bg-surface/80 backdrop-blur-xl">
              <div className="flex-1 max-w-xl">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    type="text"
                    placeholder={t('app.placeholders.search')}
                    className="w-full pl-12 pr-4 py-2.5 bg-surface-container-low border border-transparent focus:border-primary/30 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 text-on-surface placeholder:text-outline"
                  />
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  className="p-2.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  aria-label={t('app.buttons.notifications')}
                >
                  <Bell className="w-5 h-5" />
                </button>
                {themeMode !== 'system' ? (
                  <button
                    type="button"
                    onClick={handleQuickTheme}
                    className="p-2.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    aria-label={themeIconDark ? t('app.buttons.theme.light') : t('app.buttons.theme.dark')}
                  >
                    {themeIconDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                ) : null}
              </div>
            </header>

            {/* Mobile top bar */}
            <header className="lg:hidden bg-surface sticky top-0 z-20">
              <div className="px-5 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary-container dark:text-primary-fixed-dim">
                  <div
                    className="w-9 h-9 bg-current transform -scale-x-100 rotate-12"
                    style={{
                      WebkitMaskImage: 'url(/arpa-icon.svg)',
                      maskImage: 'url(/arpa-icon.svg)',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                    }}
                  />
                  <div className="flex flex-col leading-none">
                    <span className="font-display text-lg font-extrabold tracking-tighter">{t('app.logo.title')}</span>
                    <span className="text-[9px] uppercase tracking-widest text-outline font-bold mt-0.5">
                      <PageTitle />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFamilyModalOpen(true)}
                    className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"
                    aria-label={t('app.nav.familySync')}
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  {themeMode !== 'system' ? (
                    <button
                      type="button"
                      onClick={handleQuickTheme}
                      className="p-2.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                      aria-label={themeIconDark ? t('app.buttons.theme.light') : t('app.buttons.theme.dark')}
                    >
                      {themeIconDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                  ) : null}
                </div>
              </div>
            </header>

            <main className="relative flex-1 px-5 lg:px-10 py-6 lg:py-8 max-w-[1600px] w-full mx-auto pb-28 lg:pb-12">
              <AiJobQueuePanel />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/grocery" element={<GroceryList />} />
                <Route path="/pantry" element={<GroceryList initialTab="pantry" />} />
                <Route path="/preferences" element={<PreferencesPage />} />
              </Routes>
            </main>

            {/* Mobile bottom navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-container-low/95 backdrop-blur-xl border-t border-outline-variant/30 dark:border-outline-variant/40 px-3 py-2 z-30">
              <div className="grid grid-cols-5 gap-1">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline'
                    }`
                  }
                >
                  <LayoutDashboard className="w-5 h-5" />
                  {t('app.mobileNav.home')}
                </NavLink>
                <NavLink
                  to="/planner"
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline'
                    }`
                  }
                >
                  <Calendar className="w-5 h-5" />
                  {t('app.mobileNav.planner')}
                </NavLink>
                <NavLink
                  to="/grocery"
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline'
                    }`
                  }
                >
                  <ShoppingBasket className="w-5 h-5" />
                  {t('app.mobileNav.grocery')}
                </NavLink>
                <NavLink
                  to="/pantry"
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline'
                    }`
                  }
                >
                  <Boxes className="w-5 h-5" />
                  {t('app.mobileNav.pantry')}
                </NavLink>
                <NavLink
                  to="/preferences"
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline'
                    }`
                  }
                >
                  <SettingsIcon className="w-5 h-5" />
                  {t('app.mobileNav.settings')}
                </NavLink>
              </div>
            </nav>
          </div>
        </div>

        <Chatbot />

        {/* Family Sync Modal */}
        {isFamilyModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setIsFamilyModalOpen(false)}
          >
            <div
              className="bg-surface-container-lowest rounded-[2rem] max-w-md w-full p-7 shadow-xl border border-outline-variant/30 dark:border-outline-variant/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-display font-extrabold tracking-tight text-on-surface">
                    {t('familySyncModal.title')}
                  </h2>
                </div>
                <button
                  onClick={() => setIsFamilyModalOpen(false)}
                  className="p-1 rounded-full text-outline hover:bg-surface-container-high"
                  aria-label={t('app.buttons.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-on-surface-variant mb-6 text-sm">
                {t('familySyncModal.text')}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-display font-bold uppercase tracking-widest text-outline mb-2">
                    {t('familySyncModal.fields.code.label')}
                  </label>
                  <input
                    type="text"
                    value={familyCode === 'default' ? '' : familyCode}
                    onChange={(e) => setFamilyCode(e.target.value)}
                    placeholder={t('familySyncModal.fields.code.placeholder')}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 text-on-surface placeholder:text-outline"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsFamilyModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-outline-variant/50 text-on-surface dark:text-on-surface-variant rounded-full font-display font-semibold text-sm hover:bg-surface-container-low dark:hover:bg-surface-container-high transition-colors"
                  >
                    {t('familySyncModal.buttons.cancel')}
                  </button>
                  <button
                    onClick={handleSaveFamily}
                    className="flex-1 px-4 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-display font-semibold text-sm transition-opacity hover:opacity-90"
                  >
                    {t('familySyncModal.buttons.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </AiJobQueueProvider>
    </Router>
  );
}
