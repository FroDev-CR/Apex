import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { qboApi } from '../api';

const NAV_ITEMS = [
  {
    to: '/reports',
    label: 'Reportes',
    shortLabel: 'Rep',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/invoices',
    label: 'Facturas',
    shortLabel: 'Fact',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: '/collaborators',
    label: 'Equipo',
    shortLabel: 'Team',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Config',
    shortLabel: 'CFG',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function Layout({ children }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    toast.loading('Conectando con QuickBooks...', { id: 'sync' });
    try {
      const result = await qboApi.sync();
      const msg = result.total === 0
        ? 'Sin cambios — todo está al día'
        : `${result.total} facturas sincronizadas (${result.inserted} nuevas, ${result.updated} actualizadas)`;
      toast.success(msg, { id: 'sync', duration: 6000 });
      window.dispatchEvent(new CustomEvent('invoices-synced'));
    } catch (error) {
      toast.error(
        error.message.includes('not connected')
          ? 'QuickBooks no conectado — ve a Configuración'
          : `Error: ${error.message}`,
        { id: 'sync', duration: 6000 }
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50">

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

            {/* Sync button */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center gap-1.5 px-3 md:px-5 py-2 rounded font-bold text-xs md:text-sm uppercase tracking-wider transition-all ${
                syncing
                  ? 'bg-steel-700 text-steel-400 cursor-not-allowed'
                  : 'bg-primary-500 hover:bg-primary-600 text-white shadow-md hover:shadow-lg active:scale-95'
              }`}
            >
              {syncing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="hidden sm:inline">Sincronizando...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sync QBO</span>
                </>
              )}
            </button>
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
      </nav>
    </div>
  );
}

export default Layout;
