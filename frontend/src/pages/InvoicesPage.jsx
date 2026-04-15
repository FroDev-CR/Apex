import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { invoicesApi, collaboratorsApi } from '../api';

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CR', { dateStyle: 'medium' }) : '—';

// ─── Status badge ──────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  if (!estado) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
      {estado}
    </span>
  );
}

// ─── MonoSlab tag ──────────────────────────────────────────────────────────
function MonoSlabTag({ qty }) {
  if (!qty) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
      <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
      {fmtNum(qty)} m²
    </span>
  );
}

// ─── Invoice detail modal ──────────────────────────────────────────────────
function InvoiceModal({ invoice, collaborators, onClose, onCollaboratorChange }) {
  const [assigningCollab, setAssigningCollab] = useState(false);
  const [selectedCollab, setSelectedCollab] = useState(invoice.collaborator?._id || '');

  const handleAssign = async () => {
    setAssigningCollab(true);
    try {
      await invoicesApi.assignCollaborator(invoice._id, selectedCollab || null);
      toast.success('Colaborador actualizado');
      onCollaboratorChange();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAssigningCollab(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-steel-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-concrete-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-steel-900">Factura #{invoice.docNumber}</h2>
              {invoice.hasMonoSlab && <MonoSlabTag qty={invoice.monoSlabQty} />}
              {invoice.estado && <EstadoBadge estado={invoice.estado} />}
            </div>
            <p className="text-steel-500 text-sm mt-1">{invoice.customerName}</p>
          </div>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-700 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Main info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Empresa facturada</div>
              <div className="font-medium text-steel-900">{invoice.billingCompany || invoice.customerName}</div>
            </div>
            <div>
              <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Fecha</div>
              <div className="font-medium text-steel-900">{fmtDate(invoice.txnDate)}</div>
            </div>
            <div>
              <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Vencimiento</div>
              <div className="font-medium text-steel-900">{fmtDate(invoice.dueDate)}</div>
            </div>
            <div>
              <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Builder #</div>
              <div className="font-medium text-steel-900">{invoice.builderNumber || '—'}</div>
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-concrete-50 rounded-xl p-3 text-center">
              <div className="text-xs text-steel-400 uppercase mb-1">Total facturado</div>
              <div className="text-lg font-black text-steel-900">{fmt(invoice.totalAmount)}</div>
            </div>
            <div className={`rounded-xl p-3 text-center ${invoice.balance > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <div className="text-xs text-steel-400 uppercase mb-1">Saldo pendiente</div>
              <div className={`text-lg font-black ${invoice.balance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {invoice.balance > 0 ? fmt(invoice.balance) : 'Pagado'}
              </div>
            </div>
            <div className="bg-primary-50 rounded-xl p-3 text-center">
              <div className="text-xs text-steel-400 uppercase mb-1">Pago collab</div>
              <div className="text-lg font-black text-primary-700">{fmt(invoice.collaboratorPay)}</div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="text-xs text-steel-400 uppercase tracking-wide font-semibold mb-2">Líneas de producto</div>
            <div className="border border-concrete-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-concrete-50 border-b border-concrete-200">
                  <tr className="text-xs text-steel-400 uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-semibold">Producto/Servicio</th>
                    <th className="text-right px-3 py-2 font-semibold">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold">Rate</th>
                    <th className="text-right px-3 py-2 font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-concrete-100">
                  {invoice.lineItems?.map((l, i) => (
                    <tr key={i} className={l.productService?.toUpperCase().includes('MONO SLAB') ? 'bg-primary-50/50' : ''}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-steel-900">{l.productService}</div>
                        {l.description && l.description !== l.productService && (
                          <div className="text-xs text-steel-400">{l.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-steel-700">{fmtNum(l.qty)}</td>
                      <td className="px-3 py-2 text-right text-steel-700">{fmt(l.rate)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-steel-900">{fmt(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Collaborator assignment */}
          <div>
            <div className="text-xs text-steel-400 uppercase tracking-wide font-semibold mb-2">Colaborador</div>
            <div className="flex items-center gap-3">
              <select
                value={selectedCollab}
                onChange={e => setSelectedCollab(e.target.value)}
                className="flex-1 border border-concrete-200 rounded-lg px-3 py-2 text-sm text-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">Sin asignar</option>
                {collaborators.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={assigningCollab}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {assigningCollab ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            {invoice.collaboratorRaw && (
              <p className="text-xs text-steel-400 mt-1.5">
                Memo raw: <span className="font-mono">{invoice.collaboratorRaw}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [collaborators, setCollaborators] = useState([]);

  const [filters, setFilters] = useState({
    customer: '',
    hasMonoSlab: '',
    unpaidOnly: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 50
  });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const data = await invoicesApi.list(clean);
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => {
    collaboratorsApi.list({ active: true }).then(setCollaborators).catch(() => {});
  }, []);

  // Refresh when global sync fires
  useEffect(() => {
    const handler = () => fetchInvoices();
    window.addEventListener('invoices-synced', handler);
    return () => window.removeEventListener('invoices-synced', handler);
  }, [fetchInvoices]);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value, page: 1 }));

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-steel-900">Facturas</h1>
          <p className="text-steel-500 text-sm mt-0.5">{pagination.total} facturas en total</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border border-concrete-200 rounded-xl shadow-steel px-4 py-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={filters.customer}
          onChange={e => setFilter('customer', e.target.value)}
          className="flex-1 min-w-[160px] border border-concrete-200 rounded-lg px-3 py-1.5 text-sm text-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />

        <select
          value={filters.hasMonoSlab}
          onChange={e => setFilter('hasMonoSlab', e.target.value)}
          className="border border-concrete-200 rounded-lg px-3 py-1.5 text-sm text-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="">Todos los tipos</option>
          <option value="true">Solo MONO SLAB</option>
          <option value="false">Sin MONO SLAB</option>
        </select>

        <select
          value={filters.unpaidOnly}
          onChange={e => setFilter('unpaidOnly', e.target.value)}
          className="border border-concrete-200 rounded-lg px-3 py-1.5 text-sm text-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="">Todas</option>
          <option value="true">Solo pendientes de pago</option>
        </select>

        <input type="date" value={filters.dateFrom}
          onChange={e => setFilter('dateFrom', e.target.value)}
          className="border border-concrete-200 rounded-lg px-3 py-1.5 text-sm text-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <span className="text-steel-400 text-sm">—</span>
        <input type="date" value={filters.dateTo}
          onChange={e => setFilter('dateTo', e.target.value)}
          className="border border-concrete-200 rounded-lg px-3 py-1.5 text-sm text-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />

        {(filters.customer || filters.hasMonoSlab || filters.unpaidOnly || filters.dateFrom || filters.dateTo) && (
          <button
            onClick={() => setFilters({ customer: '', hasMonoSlab: '', unpaidOnly: '', dateFrom: '', dateTo: '', page: 1, limit: 50 })}
            className="text-xs text-steel-400 hover:text-red-500 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-concrete-200 shadow-steel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-steel-400">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Cargando facturas...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-steel-400">
            <svg className="w-10 h-10 mx-auto mb-3 text-steel-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No hay facturas. Haz un sync con QuickBooks.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-concrete-50 border-b border-concrete-200">
              <tr className="text-xs text-steel-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">#</th>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Colaborador</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Tipo</th>
                <th className="text-right px-4 py-3 font-semibold">Total</th>
                <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">Saldo</th>
                <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Pago collab</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-concrete-100">
              {invoices.map(inv => (
                <tr
                  key={inv._id}
                  onClick={() => setSelectedInvoice(inv)}
                  className="hover:bg-concrete-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-steel-700 font-medium">#{inv.docNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-steel-900 truncate max-w-[180px]">{inv.customerName}</div>
                    {inv.estado && <EstadoBadge estado={inv.estado} />}
                  </td>
                  <td className="px-4 py-3 text-steel-500 hidden md:table-cell">{fmtDate(inv.txnDate)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {inv.collaborator ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: inv.collaborator.color }} />
                        <span className="text-steel-700 text-xs">{inv.collaborator.name}</span>
                      </div>
                    ) : (
                      <span className="text-steel-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {inv.hasMonoSlab
                      ? <MonoSlabTag qty={inv.monoSlabQty} />
                      : <span className="text-xs text-steel-300">Otro</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-steel-900">{fmt(inv.totalAmount)}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    {inv.balance > 0
                      ? <span className="text-amber-700 font-semibold">{fmt(inv.balance)}</span>
                      : <span className="text-green-600 text-xs font-semibold">Pagado</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    {inv.collaboratorPay > 0
                      ? <span className="text-primary-700 font-semibold">{fmt(inv.collaboratorPay)}</span>
                      : <span className="text-steel-300">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            className="px-3 py-1.5 rounded-lg border border-concrete-200 text-sm text-steel-600 disabled:opacity-40 hover:bg-concrete-50 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-sm text-steel-500">
            Página {filters.page} de {pagination.pages}
          </span>
          <button
            disabled={filters.page >= pagination.pages}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            className="px-3 py-1.5 rounded-lg border border-concrete-200 text-sm text-steel-600 disabled:opacity-40 hover:bg-concrete-50 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* ── Invoice detail modal ── */}
      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          collaborators={collaborators}
          onClose={() => setSelectedInvoice(null)}
          onCollaboratorChange={() => {
            setSelectedInvoice(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}

export default InvoicesPage;
