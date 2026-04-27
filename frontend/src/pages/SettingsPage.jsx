import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { qboApi, settingsApi } from '../api';
import CollaboratorsPage from './CollaboratorsPage';

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CR', { dateStyle: 'medium' }) : '—';

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const inputCls = 'w-full border border-concrete-200 dark:border-steel-600 rounded-lg px-3 py-2 text-sm text-steel-800 dark:text-steel-100 bg-white dark:bg-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400';
const labelCls = 'block text-xs text-steel-500 dark:text-steel-400 uppercase tracking-wide font-semibold mb-1';

// ─── Status badge ─────────────────────────────────────────────────────────
function StatusBadge({ connected }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      connected ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-steel-100 dark:bg-steel-700 text-steel-600 dark:text-steel-300'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-steel-400'}`} />
      {connected ? 'Conectado' : 'Desconectado'}
    </span>
  );
}

// ─── TAB: Conexiones ──────────────────────────────────────────────────────
function ConexionesTab() {
  const [status, setStatus]             = useState(null);
  const [loading, setLoading]           = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [syncingFast, setSyncingFast]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchStatus = async () => {
    try { setStatus(await qboApi.status()); }
    catch { setStatus({ connected: false }); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStatus();
    if (searchParams.get('qbo') === 'connected') {
      toast.success('QuickBooks conectado exitosamente!', { duration: 5000 });
      setSearchParams({});
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    toast.loading('Sincronizando facturas...', { id: 'sync' });
    try {
      const r = await qboApi.sync();
      toast.success(`Sync completo: ${r.inserted} nuevas, ${r.updated} actualizadas`, { id: 'sync', duration: 6000 });
      window.dispatchEvent(new CustomEvent('invoices-synced'));
    } catch (err) { toast.error(`Error: ${err.message}`, { id: 'sync' }); }
    finally { setSyncing(false); }
  };

  const handleSyncFast = async () => {
    setSyncingFast(true);
    toast.loading('Sync rápido (última semana)...', { id: 'sync' });
    try {
      const r = await qboApi.sync({ sinceDays: 7 });
      toast.success(`Sync rápido: ${r.inserted} nuevas, ${r.updated} actualizadas`, { id: 'sync', duration: 6000 });
      window.dispatchEvent(new CustomEvent('invoices-synced'));
    } catch (err) { toast.error(`Error: ${err.message}`, { id: 'sync' }); }
    finally { setSyncingFast(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar QuickBooks? Perderás el acceso hasta volver a conectar.')) return;
    setDisconnecting(true);
    try { await qboApi.disconnect(); toast.success('QuickBooks desconectado'); await fetchStatus(); }
    catch (err) { toast.error(err.message); }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-steel-900 dark:text-white">Conexiones</h2>
        <p className="text-sm text-steel-500 dark:text-steel-400 mt-0.5">Fuentes de datos externas</p>
      </div>

      {/* QBO Card */}
      <div className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel overflow-hidden">
        <div className="px-5 py-4 border-b border-concrete-100 dark:border-steel-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2CA01C] rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-black text-sm">QB</span>
            </div>
            <div>
              <h3 className="font-bold text-steel-900 dark:text-white">QuickBooks Online</h3>
              <p className="text-xs text-steel-500 dark:text-steel-400">Importación automática de facturas</p>
            </div>
          </div>
          {!loading && <StatusBadge connected={status?.connected} />}
        </div>

        <div className="px-5 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-steel-400">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="text-sm">Verificando conexión...</span>
            </div>
          ) : status?.connected ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className={labelCls}>Company ID</div>
                  <div className="font-mono text-steel-700 dark:text-steel-200">{status.realmId}</div>
                </div>
                <div>
                  <div className={labelCls}>Token expira</div>
                  <div className="text-steel-700 dark:text-steel-200">{fmtDate(status.refreshTokenExpiresAt)}</div>
                </div>
                <div>
                  <div className={labelCls}>Access token</div>
                  <div className={`font-semibold ${status.accessTokenValid ? 'text-green-600' : 'text-amber-600'}`}>
                    {status.accessTokenValid ? 'Válido' : 'Se refrescará automáticamente'}
                  </div>
                </div>
              </div>

              {status.refreshTokenExpired && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-red-700 dark:text-red-300">El token de refresco expiró. Vuelve a conectar QuickBooks.</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={handleSync} disabled={syncing || syncingFast || status.refreshTokenExpired}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-primary-500 hover:bg-primary-600 text-white shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  {syncing ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {syncing ? 'Sincronizando...' : 'Sincronizar Facturas'}
                </button>
                <button onClick={handleSyncFast} disabled={syncing || syncingFast || status.refreshTokenExpired}
                  title="Solo sincroniza facturas de los últimos 7 días"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  {syncingFast ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {syncingFast ? 'Sync rápido...' : 'Sync rápido (1 sem)'}
                </button>
                <button onClick={() => window.location.href = qboApi.getConnectUrl()}
                  className="px-4 py-2 rounded-lg font-semibold text-sm border border-concrete-200 dark:border-steel-600 text-steel-600 dark:text-steel-300 hover:bg-concrete-50 dark:hover:bg-steel-700 transition-colors">
                  Reconectar
                </button>
                <button onClick={handleDisconnect} disabled={disconnecting}
                  className="ml-auto px-4 py-2 rounded-lg font-semibold text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  Desconectar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-steel-600 dark:text-steel-300">
                Conecta tu cuenta de QuickBooks Online para importar automáticamente todas las facturas y generar reportes.
              </p>
              <button onClick={() => window.location.href = qboApi.getConnectUrl()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2CA01C] hover:bg-[#238a14] text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Conectar QuickBooks Online
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: General ─────────────────────────────────────────────────────────
function GeneralTab() {
  const [settings, setSettings]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [emailInput, setEmailInput] = useState('');

  // local state mirrors DB
  const [emails, setEmails]             = useState([]);
  const [frequency, setFrequency]       = useState('daily');
  const [hour, setHour]                 = useState(8);
  const [dayOfWeek, setDayOfWeek]       = useState(1);
  const [dayOfMonth, setDayOfMonth]     = useState(1);

  useEffect(() => {
    settingsApi.get()
      .then(s => {
        setSettings(s);
        setEmails(s.reportEmails || []);
        setFrequency(s.reportFrequency || 'daily');
        setHour(s.reportHour ?? 8);
        setDayOfWeek(s.reportDayOfWeek ?? 1);
        setDayOfMonth(s.reportDayOfMonth ?? 1);
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e || !e.includes('@') || emails.includes(e)) return;
    setEmails(prev => [...prev, e]);
    setEmailInput('');
  };

  const removeEmail = (e) => setEmails(prev => prev.filter(x => x !== e));

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.patch({ reportEmails: emails, reportFrequency: frequency, reportHour: Number(hour), reportDayOfWeek: Number(dayOfWeek), reportDayOfMonth: Number(dayOfMonth) });
      toast.success('Configuración guardada');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const FREQ_OPTIONS = [
    { id: 'daily',   label: 'Diario' },
    { id: 'weekly',  label: 'Semanal' },
    { id: 'monthly', label: 'Mensual' },
  ];

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 animate-pulse bg-concrete-200 dark:bg-steel-700 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-steel-900 dark:text-white">General</h2>
        <p className="text-sm text-steel-500 dark:text-steel-400 mt-0.5">Reportes automáticos por correo</p>
      </div>

      {/* ── Email recipients ── */}
      <div className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel px-5 py-5 space-y-4">
        <div>
          <h3 className="font-semibold text-steel-900 dark:text-white mb-0.5">Destinatarios del reporte</h3>
          <p className="text-xs text-steel-500 dark:text-steel-400">El reporte se enviará a estos correos según la frecuencia configurada.</p>
        </div>

        {/* Add email */}
        <div className="flex gap-2">
          <input
            type="email"
            className={`${inputCls} flex-1`}
            placeholder="correo@ejemplo.com"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEmail()}
          />
          <button onClick={addEmail}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold transition-colors flex-shrink-0">
            Agregar
          </button>
        </div>

        {/* Email list */}
        {emails.length > 0 ? (
          <div className="space-y-1.5">
            {emails.map(e => (
              <div key={e} className="flex items-center justify-between px-3 py-2 bg-concrete-50 dark:bg-steel-700 rounded-lg">
                <span className="text-sm text-steel-800 dark:text-steel-100 font-medium">{e}</span>
                <button onClick={() => removeEmail(e)}
                  className="text-steel-300 hover:text-red-500 transition-colors p-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-steel-400 dark:text-steel-500 italic">Sin destinatarios configurados</p>
        )}
      </div>

      {/* ── Frecuencia ── */}
      <div className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel px-5 py-5 space-y-4">
        <div>
          <h3 className="font-semibold text-steel-900 dark:text-white mb-0.5">Frecuencia del reporte</h3>
          <p className="text-xs text-steel-500 dark:text-steel-400">¿Con qué frecuencia se envía el reporte automático?</p>
        </div>

        {/* Frequency selector */}
        <div className="flex gap-2">
          {FREQ_OPTIONS.map(f => (
            <button key={f.id} onClick={() => setFrequency(f.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                frequency === f.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-concrete-200 dark:border-steel-600 text-steel-500 dark:text-steel-400 hover:border-steel-300 dark:hover:border-steel-500'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Conditional fields */}
        <div className="grid grid-cols-2 gap-3">
          {frequency === 'weekly' && (
            <div>
              <label className={labelCls}>Día de la semana</label>
              <select className={inputCls} value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                {DAYS_ES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}
          {frequency === 'monthly' && (
            <div>
              <label className={labelCls}>Día del mes</label>
              <select className={inputCls} value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Día {d}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Hora de envío</label>
            <select className={inputCls} value={hour} onChange={e => setHour(e.target.value)}>
              {Array.from({ length: 24 }, (_, i) => i).map(h => (
                <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview */}
        <div className="text-xs text-steel-400 dark:text-steel-500 bg-concrete-50 dark:bg-steel-700/50 rounded-lg px-3 py-2">
          {frequency === 'daily'   && `Se enviará todos los días a las ${String(hour).padStart(2,'0')}:00`}
          {frequency === 'weekly'  && `Se enviará cada ${DAYS_ES[dayOfWeek]} a las ${String(hour).padStart(2,'0')}:00`}
          {frequency === 'monthly' && `Se enviará el día ${dayOfMonth} de cada mes a las ${String(hour).padStart(2,'0')}:00`}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold text-sm transition-colors shadow-steel disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
const TABS = [
  {
    id: 'conexiones', label: 'Conexiones',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  },
  {
    id: 'general', label: 'General',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    id: 'colaboradores', label: 'Colaboradores',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('conexiones');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-display font-black tracking-tight text-steel-900 dark:text-white">Configuración</h1>
      </div>

      <div className="flex gap-4 items-start">
        {/* ── Sidebar tabs ── */}
        <nav className="w-44 flex-shrink-0 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-steel'
                  : 'text-steel-600 dark:text-steel-300 hover:bg-concrete-100 dark:hover:bg-steel-700'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">
          {activeTab === 'conexiones'    && <ConexionesTab />}
          {activeTab === 'general'       && <GeneralTab />}
          {activeTab === 'colaboradores' && <CollaboratorsPage />}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
