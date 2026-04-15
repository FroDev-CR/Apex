import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

function Layout({ children }) {
  const { t, lang, toggle } = useLanguage();
  const { dark, toggleDark } = useTheme();

  const NAV_ITEMS = [
    {
      to: '/reports', label: t('nav_reports'), shortLabel: t('nav_reports'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      to: '/invoices', label: t('nav_invoices'), shortLabel: t('nav_invoices'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
  ];

  const iconBtn = 'p-2 rounded transition-colors text-steel-300 hover:text-white hover:bg-steel-700';

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 dark:bg-steel-950">

      {/* ── Header ── */}
      <header className="bg-steel-900 border-b-2 border-primary-600 shadow-lg flex-shrink-0 z-30">
        <div className="w-full px-3 md:px-5">
          <div className="flex items-center justify-between h-13 md:h-14">

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-primary-500 rounded flex items-center justify-center shadow-md flex-shrink-0">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="leading-none">
                <span className="text-white font-black text-sm md:text-base tracking-tight">APEX</span>
                <span className="text-primary-400 font-semibold text-sm md:text-base ml-1">Concrete</span>
              </div>
            </div>

            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ to, label }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) =>
                    `px-4 py-1.5 rounded text-sm font-semibold tracking-wide uppercase transition-all ${
                      isActive
                        ? 'bg-primary-500 text-white shadow'
                        : 'text-steel-300 hover:text-white hover:bg-steel-700'
                    }`
                  }>
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1">

              {/* Language toggle */}
              <button
                onClick={toggle}
                title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
                className={`${iconBtn} flex items-center gap-1 px-2.5 text-xs font-bold uppercase tracking-wide`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span className="hidden sm:inline">{lang === 'es' ? 'EN' : 'ES'}</span>
              </button>

              {/* Dark mode toggle */}
              <button
                onClick={toggleDark}
                title={dark ? 'Modo claro' : 'Modo oscuro'}
                className={iconBtn}
              >
                {dark ? (
                  /* Sol */
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                ) : (
                  /* Luna */
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Settings gear */}
              <NavLink
                to="/settings"
                title={t('nav_settings')}
                className={({ isActive }) =>
                  `p-2 rounded transition-colors ${
                    isActive ? 'text-primary-400 bg-steel-700' : 'text-steel-300 hover:text-white hover:bg-steel-700'
                  }`
                }
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </NavLink>
            </div>
          </div>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="flex-1 w-full px-3 md:px-5 py-4 pb-20 md:pb-5 overflow-auto">
        {children}
      </main>

      {/* ── Bottom Nav — solo móvil ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-steel-900 border-t-2 border-primary-600 flex">
        {NAV_ITEMS.map(({ to, shortLabel, icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-semibold transition-colors ${
              isActive
                ? 'text-primary-400 bg-steel-800'
                : 'text-steel-400 hover:text-steel-200'
            }`
          }>
            {icon}
            <span className="text-[10px] uppercase tracking-wide">{shortLabel}</span>
          </NavLink>
        ))}
        {/* Settings en mobile nav */}
        <NavLink to="/settings" className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-semibold transition-colors ${
            isActive ? 'text-primary-400 bg-steel-800' : 'text-steel-400 hover:text-steel-200'
          }`
        }>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[10px] uppercase tracking-wide">{t('nav_settings')}</span>
        </NavLink>
      </nav>
    </div>
  );
}

export default Layout;
