import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { invoicesApi, collaboratorsApi } from '../api';
import { useLanguage } from '../context/LanguageContext';

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
      {fmtNum(qty)} SF
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
      <div className="bg-white dark:bg-steel-800 rounded-2xl shadow-steel-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-concrete-100 dark:border-steel-700">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-steel-900 dark:text-white">Factura #{invoice.docNumber}</h2>
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
              <div className="font-medium text-steel-900 dark:text-white">{invoice.billingCompany || invoice.customerName}</div>
            </div>
            <div>
              <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Fecha</div>
              <div className="font-medium text-steel-900 dark:text-white">{fmtDate(invoice.txnDate)}</div>
            </div>
            <div>
              <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Vencimiento</div>
              <div className="font-medium text-steel-900 dark:text-white">{fmtDate(invoice.dueDate)}</div>
            </div>
            <div>
              <div className="text-xs text-steel-400 uppercase tracking-wide mb-1">Builder #</div>
              <div className="font-medium text-steel-900 dark:text-white">{invoice.builderNumber || '—'}</div>
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-concrete-50 rounded-xl p-3 text-center">
              <div className="text-xs text-steel-400 uppercase mb-1">Total facturado</div>
              <div className="text-lg font-black text-steel-900 dark:text-white">{fmt(invoice.totalAmount)}</div>
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
                <thead className="bg-concrete-50 dark:bg-steel-900 border-b border-concrete-200 dark:border-steel-700">
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
                        <div className="font-medium text-steel-900 dark:text-white">{l.productService}</div>
                        {l.description && l.description !== l.productService && (
                          <div className="text-xs text-steel-400">{l.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-steel-700 dark:text-steel-200">{fmtNum(l.qty)}</td>
                      <td className="px-3 py-2 text-right text-steel-700 dark:text-steel-200">{fmt(l.rate)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-steel-900 dark:text-white">{fmt(l.amount)}</td>
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
                className="flex-1 border border-concrete-200 dark:border-steel-600 rounded-lg px-3 py-2 text-sm text-steel-700 dark:text-steel-100 bg-white dark:bg-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
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
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    customer: '',
    hasMonoSlab: '',
    unpaidOnly: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 50
  });

  const hasActiveFilters = filters.customer || filters.hasMonoSlab || filters.unpaidOnly || filters.dateFrom || filters.dateTo;

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

  useEffect(() => {
    const handler = () => fetchInvoices();
    window.addEventListener('invoices-synced', handler);
    return () => window.removeEventListener('invoices-synced', handler);
  }, [fetchInvoices]);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value, page: 1 }));
  const clearFilters = () => setFilters({ customer: '', hasMonoSlab: '', unpaidOnly: '', dateFrom: '', dateTo: '', page: 1, limit: 50 });

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-steel-900 dark:text-white">{t('nav_invoices')}</h1>
          <p className="text-steel-500 text-sm mt-0.5">{pagination.total} {t('kpi_invoices').toLowerCase()}</p>
        </div>

        {/* Filter toggle button */}
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
            filtersOpen || hasActiveFilters
              ? 'bg-primary-500 border-primary-500 text-white shadow-md'
              : 'bg-white border-concrete-200 text-steel-600 hover:border-primary-300 hover:text-primary-600'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          {t('filter_btn')}
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-white/80" />
          )}
          <svg
            className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* ── Collapsible filters ── */}
      {filtersOpen && (
        <div className="bg-white dark:bg-steel-800 border border-concrete-200 dark:border-steel-700 rounded-xl shadow-steel px-4 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Customer search */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs text-steel-400 uppercase tracking-wide font-semibold mb-1">{t('col_client')}</label>
              <input
                type="text"
                placeholder={t('filter_customer')}
                value={filters.customer}
                onChange={e => setFilter('customer', e.target.value)}
                className="w-full border border-concrete-200 dark:border-steel-600 rounded-lg px-3 py-2 text-sm text-steel-700 dark:text-steel-100 bg-white dark:bg-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {/* Type filter */}
            <div>
              <label className="block text-xs text-steel-400 uppercase tracking-wide font-semibold mb-1">{t('col_type')}</label>
              <select
                value={filters.hasMonoSlab}
                onChange={e => setFilter('hasMonoSlab', e.target.value)}
                className="w-full border border-concrete-200 dark:border-steel-600 rounded-lg px-3 py-2 text-sm text-steel-700 dark:text-steel-100 bg-white dark:bg-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">{t('filter_type_all')}</option>
                <option value="true">{t('filter_mono')}</option>
                <option value="false">{t('filter_no_mono')}</option>
              </select>
            </div>

            {/* Payment status */}
            <div>
              <label className="block text-xs text-steel-400 uppercase tracking-wide font-semibold mb-1">Estado</label>
              <select
                value={filters.unpaidOnly}
                onChange={e => setFilter('unpaidOnly', e.target.value)}
                className="w-full border border-concrete-200 dark:border-steel-600 rounded-lg px-3 py-2 text-sm text-steel-700 dark:text-steel-100 bg-white dark:bg-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">{t('filter_all_inv')}</option>
                <option value="true">{t('filter_unpaid')}</option>
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs text-steel-400 uppercase tracking-wide font-semibold mb-1">{t('col_date')} desde</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => setFilter('dateFrom', e.target.value)}
                className="w-full border border-concrete-200 dark:border-steel-600 rounded-lg px-3 py-2 text-sm text-steel-700 dark:text-steel-100 bg-white dark:bg-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs text-steel-400 uppercase tracking-wide font-semibold mb-1">{t('col_date')} hasta</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => setFilter('dateTo', e.target.value)}
                className="w-full border border-concrete-200 dark:border-steel-600 rounded-lg px-3 py-2 text-sm text-steel-700 dark:text-steel-100 bg-white dark:bg-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end pt-1 border-t border-concrete-100">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-steel-400 hover:text-red-500 transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('filter_clear')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-steel-400">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {t('loading')}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-steel-400">
            <svg className="w-10 h-10 mx-auto mb-3 text-steel-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No hay facturas. Haz un sync con QuickBooks.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-concrete-50 dark:bg-steel-900 border-b border-concrete-200 dark:border-steel-700">
                <tr className="text-xs text-steel-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">#</th>
                  <th className="text-left px-4 py-3 font-semibold">{t('col_client')}</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">{t('col_date')}</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">{t('col_collab')}</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">{t('col_type')}</th>
                  <th className="text-right px-4 py-3 font-semibold">{t('col_total')}</th>
                  <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">{t('col_balance')}</th>
                  <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">{t('col_pay')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-concrete-100">
                {invoices.map(inv => (
                  <tr
                    key={inv._id}
                    onClick={() => setSelectedInvoice(inv)}
                    className="hover:bg-concrete-50 dark:hover:bg-steel-700 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-steel-700 dark:text-steel-200 font-medium">#{inv.docNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-steel-900 dark:text-white truncate max-w-[180px]">{inv.customerName}</div>
                      {inv.estado && <EstadoBadge estado={inv.estado} />}
                    </td>
                    <td className="px-4 py-3 text-steel-500 hidden md:table-cell">{fmtDate(inv.txnDate)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {inv.collaborator ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: inv.collaborator.color }} />
                          <span className="text-steel-700 dark:text-steel-200 text-xs">{inv.collaborator.name}</span>
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
                    <td className="px-4 py-3 text-right font-semibold text-steel-900 dark:text-white">{fmt(inv.totalAmount)}</td>
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
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            className="px-3 py-1.5 rounded-lg border border-concrete-200 dark:border-steel-700 text-sm text-steel-600 dark:text-steel-300 disabled:opacity-40 hover:bg-concrete-50 dark:hover:bg-steel-700 transition-colors"
          >
            {t('prev')}
          </button>
          <span className="text-sm text-steel-500 dark:text-steel-400">
            {t('page')} {filters.page} {t('of')} {pagination.pages}
          </span>
          <button
            disabled={filters.page >= pagination.pages}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            className="px-3 py-1.5 rounded-lg border border-concrete-200 dark:border-steel-700 text-sm text-steel-600 dark:text-steel-300 disabled:opacity-40 hover:bg-concrete-50 dark:hover:bg-steel-700 transition-colors"
          >
            {t('next')}
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
