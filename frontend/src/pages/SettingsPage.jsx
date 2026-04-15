import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { qboApi } from '../api';

function StatusBadge({ connected }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      connected
        ? 'bg-green-100 text-green-800'
        : 'bg-steel-100 text-steel-600'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-steel-400'}`} />
      {connected ? 'Conectado' : 'Desconectado'}
    </span>
  );
}

function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await qboApi.status();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Mostrar toast si viene del callback de OAuth
    if (searchParams.get('qbo') === 'connected') {
      toast.success('QuickBooks conectado exitosamente!', { duration: 5000 });
      setSearchParams({});
    }
  }, []);

  const handleConnect = () => {
    window.location.href = qboApi.getConnectUrl();
  };

  const handleSync = async () => {
    setSyncing(true);
    toast.loading('Sincronizando facturas...', { id: 'sync' });
    try {
      const result = await qboApi.sync();
      toast.success(
        `Sync completo: ${result.inserted} nuevas, ${result.updated} actualizadas (${result.total} total)`,
        { id: 'sync', duration: 6000 }
      );
      window.dispatchEvent(new CustomEvent('invoices-synced'));
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar QuickBooks? Perderás el acceso hasta volver a conectar.')) return;
    setDisconnecting(true);
    try {
      await qboApi.disconnect();
      toast.success('QuickBooks desconectado');
      await fetchStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const fmt = (dateStr) => dateStr
    ? new Date(dateStr).toLocaleDateString('es-CR', { dateStyle: 'medium' })
    : '—';

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-steel-900">Configuración</h1>
        <p className="text-steel-500 mt-1">Integración con QuickBooks Online</p>
      </div>

      {/* ── QBO Connection Card ── */}
      <div className="bg-white rounded-xl border border-concrete-200 shadow-steel overflow-hidden">
        <div className="px-6 py-4 border-b border-concrete-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* QBO logo placeholder */}
            <div className="w-10 h-10 bg-[#2CA01C] rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-sm">QB</span>
            </div>
            <div>
              <h2 className="font-bold text-steel-900">QuickBooks Online</h2>
              <p className="text-xs text-steel-500">Fuente de datos de facturas</p>
            </div>
          </div>
          {!loading && <StatusBadge connected={status?.connected} />}
        </div>

        <div className="px-6 py-5 space-y-5">
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
              {/* Connection details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Company ID</div>
                  <div className="font-mono text-steel-700">{status.realmId}</div>
                </div>
                <div>
                  <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Token expira</div>
                  <div className="text-steel-700">{fmt(status.refreshTokenExpiresAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Access token</div>
                  <div className={`font-semibold ${status.accessTokenValid ? 'text-green-600' : 'text-amber-600'}`}>
                    {status.accessTokenValid ? 'Válido' : 'Se refrescará automáticamente'}
                  </div>
                </div>
              </div>

              {/* Warning if refresh token expired */}
              {status.refreshTokenExpired && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-red-700">
                    El token de refresco expiró. Debes volver a conectar QuickBooks.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSync}
                  disabled={syncing || status.refreshTokenExpired}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    syncing || status.refreshTokenExpired
                      ? 'bg-steel-100 text-steel-400 cursor-not-allowed'
                      : 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm active:scale-95'
                  }`}
                >
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

                <button
                  onClick={handleConnect}
                  className="px-4 py-2 rounded-lg font-semibold text-sm border border-steel-200 text-steel-600 hover:bg-steel-50 transition-colors"
                >
                  Reconectar
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="ml-auto px-4 py-2 rounded-lg font-semibold text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Desconectar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-steel-600">
                Conecta tu cuenta de QuickBooks Online para importar automáticamente todas las facturas y generar reportes.
              </p>
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2CA01C] hover:bg-[#238a14] text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Conectar QuickBooks Online
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Info Card ── */}
      <div className="bg-white rounded-xl border border-concrete-200 shadow-steel px-6 py-5">
        <h3 className="font-bold text-steel-900 mb-3">¿Cómo funciona el sync?</h3>
        <ul className="space-y-2 text-sm text-steel-600">
          <li className="flex items-start gap-2">
            <span className="text-primary-500 font-bold mt-0.5">1.</span>
            Descarga todas las facturas de QuickBooks (con paginación automática)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 font-bold mt-0.5">2.</span>
            Detecta líneas de <strong>POUR MONO SLAB</strong> y calcula el pago al colaborador (m² × $1.00)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 font-bold mt-0.5">3.</span>
            Guarda o actualiza cada factura sin crear duplicados
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 font-bold mt-0.5">4.</span>
            Asocia el colaborador desde el campo <em>Memo on statement</em> de cada factura
          </li>
        </ul>
      </div>
    </div>
  );
}

export default SettingsPage;
