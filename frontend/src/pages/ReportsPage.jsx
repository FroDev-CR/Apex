import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { reportsApi, paymentsApi } from '../api';
import { useLanguage } from '../context/LanguageContext';

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt    = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CR', { dateStyle: 'medium' }) : '—';

// ─── Period presets ────────────────────────────────────────────────────────
function getPreset(preset) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  switch (preset) {
    case 'today_yesterday': {
      const today = now.toISOString().slice(0,10);
      const yest  = new Date(now - 86400000).toISOString().slice(0,10);
      return { dateFrom: yest, dateTo: today };
    }
    case 'this_month': return { dateFrom: new Date(y,m,1).toISOString().slice(0,10), dateTo: new Date(y,m+1,0).toISOString().slice(0,10) };
    case 'last_month': return { dateFrom: new Date(y,m-1,1).toISOString().slice(0,10), dateTo: new Date(y,m,0).toISOString().slice(0,10) };
    case 'this_year':  return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
    case 'last_90':    return { dateFrom: new Date(now - 90*86400000).toISOString().slice(0,10), dateTo: now.toISOString().slice(0,10) };
    default:           return { dateFrom: '', dateTo: '' };
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-concrete-200 dark:bg-steel-700 rounded ${className}`} />;
}

// ─── KPI Card (small, for tabs) ────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'primary' }) {
  const colors = {
    primary: 'border-primary-400', green: 'border-green-400',
    blue: 'border-blue-400', amber: 'border-amber-400', red: 'border-red-400',
  };
  return (
    <div className={`bg-white dark:bg-steel-800 rounded-xl border-l-4 ${colors[color]} shadow-steel px-4 py-3`}>
      <div className="text-xs text-steel-400 dark:text-steel-400 uppercase tracking-wide font-semibold mb-1 leading-tight">{label}</div>
      <div className="text-xl font-black text-steel-900 dark:text-white leading-tight truncate">{value}</div>
      {sub && <div className="text-xs text-steel-500 dark:text-steel-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-sm font-bold text-steel-500 dark:text-steel-400 uppercase tracking-widest mb-3">{children}</h2>;
}

// ─── TAB: Overview ────────────────────────────────────────────────────────
function OverviewTab({ params }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi.overview(params).then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return (
    <div className="space-y-3">
      {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
    </div>
  );
  if (!data) return null;

  const stats = [
    { label: t('kpi_invoiced'),     value: fmt(data.totalRevenue),    sub: `${data.invoiceCount} ${t('kpi_invoices')}`, color: 'blue',    icon: '🧾' },
    { label: t('kpi_paid'),         value: fmt(data.totalRevenue - data.totalReceivable), sub: `${fmtPct(data.totalRevenue > 0 ? ((data.totalRevenue - data.totalReceivable)/data.totalRevenue)*100 : 0)} cobrado`, color: 'green', icon: '✅' },
    { label: t('kpi_receivable'),   value: fmt(data.totalReceivable), sub: 'saldo pendiente', color: 'amber', icon: '⏳' },
    { label: t('kpi_collab_cost'),  value: fmt(data.totalCollabCost), sub: `${fmtNum(data.totalM2)} ${t('kpi_m2')}`, color: 'red', icon: '👷' },
    { label: t('kpi_gross_margin'), value: fmt(data.grossMargin),     sub: fmtPct(data.marginPct), color: 'green', icon: '📈' },
    { label: t('kpi_margin_pct'),   value: fmtPct(data.marginPct),   sub: `${fmtNum(data.totalM2)} m² MONO SLAB`, color: 'primary', icon: '💹' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {stats.map((s, i) => {
        const borderColor = s.color === 'blue' ? 'border-l-blue-400' : s.color === 'green' ? 'border-l-green-400' : s.color === 'amber' ? 'border-l-amber-400' : s.color === 'red' ? 'border-l-red-400' : 'border-l-primary-400';
        const iconStyle = s.color === 'blue' ? 'bg-blue-50 text-blue-500' : s.color === 'green' ? 'bg-green-50 text-green-500' : s.color === 'amber' ? 'bg-amber-50 text-amber-500' : s.color === 'red' ? 'bg-red-50 text-red-500' : 'bg-primary-50 text-primary-500';
        return (
          <div key={i} className={`bg-white dark:bg-steel-800 rounded-2xl shadow-steel overflow-hidden border-l-4 ${borderColor}`}>
            <div className="flex items-center gap-4 px-5 py-5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl ${iconStyle}`}>
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-steel-400 uppercase tracking-widest font-semibold mb-0.5">{s.label}</div>
                <div className="text-2xl sm:text-3xl font-black text-steel-900 dark:text-white leading-none">{s.value}</div>
                <div className="text-xs text-steel-500 dark:text-steel-400 mt-1">{s.sub}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── External Payment Modal ───────────────────────────────────────────────
const FREQ_LABELS = [
  { id: 'none',    label: 'Una vez' },
  { id: 'daily',   label: 'Diario' },
  { id: 'weekly',  label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
];
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function ExternalPaymentModal({ onClose, onSaved }) {
  const { t } = useLanguage();
  const today = new Date();
  const [name, setName]         = useState('');
  const [amount, setAmount]     = useState('');
  const [freq, setFreq]         = useState('none');
  const [hour, setHour]         = useState(8);
  const [dayOfWeek, setDow]     = useState(today.getDay());
  const [saving, setSaving]     = useState(false);

  const dayOfMonth = today.getDate(); // always inferred from today
  const valid = name.trim() && Number(amount) > 0;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await paymentsApi.create({
        name: name.trim(),
        amount: Number(amount),
        isRecurring: freq !== 'none',
        schedule: freq !== 'none' ? {
          frequency:  freq,
          dayOfWeek:  Number(dayOfWeek),
          dayOfMonth,
          hour:       Number(hour),
        } : undefined,
      });
      toast.success('Pago externo guardado');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const iCls = 'w-full border border-concrete-200 dark:border-steel-600 rounded-lg px-3 py-2 text-sm text-steel-800 dark:text-steel-100 bg-white dark:bg-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400';
  const lCls = 'block text-xs text-steel-400 dark:text-steel-400 uppercase tracking-wide font-semibold mb-1';

  const preview = freq === 'daily'   ? `Todos los días a las ${String(hour).padStart(2,'0')}:00`
                : freq === 'weekly'  ? `Cada ${DAYS_ES[dayOfWeek]} a las ${String(hour).padStart(2,'0')}:00`
                : freq === 'monthly' ? `Cada mes el día ${dayOfMonth} a las ${String(hour).padStart(2,'0')}:00`
                : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white dark:bg-steel-800 rounded-t-2xl sm:rounded-2xl shadow-steel-lg w-full sm:max-w-md"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-concrete-100 dark:border-steel-700">
          <h3 className="font-bold text-steel-900 dark:text-white">{t('ext_pay_add')}</h3>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-700 dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className={lCls}>{t('ext_pay_name')}</label>
            <input className={iCls} placeholder="Ej: Alquiler de equipo" value={name}
              onChange={e => setName(e.target.value)} />
          </div>

          {/* Amount */}
          <div>
            <label className={lCls}>{t('ext_pay_amount')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400 text-sm font-semibold">$</span>
              <input className={`${iCls} pl-7`} type="number" min="0" step="0.01"
                placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className={lCls}>Frecuencia</label>
            <div className="grid grid-cols-4 gap-1.5">
              {FREQ_LABELS.map(f => (
                <button key={f.id} onClick={() => setFreq(f.id)}
                  className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                    freq === f.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-concrete-200 dark:border-steel-600 text-steel-500 dark:text-steel-400'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule details */}
          {freq !== 'none' && (
            <div className="bg-concrete-50 dark:bg-steel-700/50 rounded-xl p-3 space-y-3 border border-concrete-200 dark:border-steel-600">
              <div className="grid grid-cols-2 gap-3">
                {freq === 'weekly' && (
                  <div>
                    <label className={lCls}>Día</label>
                    <select className={iCls} value={dayOfWeek} onChange={e => setDow(e.target.value)}>
                      {DAYS_ES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {freq === 'monthly' && (
                  <div>
                    <label className={lCls}>Día del mes</label>
                    <div className={`${iCls} bg-concrete-100 dark:bg-steel-600 text-steel-500 dark:text-steel-300`}>
                      Día {dayOfMonth} (hoy)
                    </div>
                  </div>
                )}
                <div>
                  <label className={lCls}>{t('ext_pay_time')}</label>
                  <select className={iCls} value={hour} onChange={e => setHour(e.target.value)}>
                    {Array.from({ length: 24 }, (_, i) => i).map(h => (
                      <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">{preview}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-concrete-200 dark:border-steel-600 text-sm font-semibold text-steel-600 dark:text-steel-300 hover:bg-concrete-50 dark:hover:bg-steel-700 transition-colors">
            {t('ext_pay_cancel')}
          </button>
          <button onClick={handleSave} disabled={!valid || saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-colors disabled:opacity-40">
            {saving ? 'Guardando...' : t('ext_pay_save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Salary ──────────────────────────────────────────────────────────
function SalaryTab({ params }) {
  const { t } = useLanguage();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(null);
  const [extPayments, setExtPayments] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const fetchSalary = () => {
    setLoading(true);
    reportsApi.salary(params).then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };
  const fetchExtPayments = () => {
    paymentsApi.list().then(setExtPayments).catch(() => {});
  };

  useEffect(() => { fetchSalary(); }, [JSON.stringify(params)]);
  useEffect(() => { fetchExtPayments(); }, []);

  const deleteExtPayment = async (id) => {
    try {
      await paymentsApi.delete(id);
      toast.success('Pago eliminado');
      fetchExtPayments();
    } catch (err) { toast.error(err.message); }
  };

  const extTotal = extPayments.reduce((s, p) => s + p.amount, 0);

  if (loading) return <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {showModal && (
        <ExternalPaymentModal
          onClose={() => setShowModal(false)}
          onSaved={fetchExtPayments}
        />
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>{t('salary_title')}</SectionTitle>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-steel-400 uppercase">{t('salary_total')}</div>
            <div className="text-xl font-black text-steel-900 dark:text-white">{fmt(data.grandTotal + extTotal)}</div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-steel"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {t('ext_pay_add')}
          </button>
        </div>
      </div>

      {data.results.length === 0 ? (
        <div className="text-center py-12 text-steel-400">{t('salary_empty')}</div>
      ) : (
        <div className="space-y-2">
          {data.results.map((r, i) => (
            <div key={i} className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-concrete-50 dark:hover:bg-steel-700 transition-colors text-left"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: r.collaborator?.color || '#9ca3af' }}>
                  {r.collaborator ? r.collaborator.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-steel-900 dark:text-white truncate">
                    {r.collaborator?.name || <span className="text-steel-400 italic">{t('unassigned')}</span>}
                  </div>
                  <div className="text-xs text-steel-500 dark:text-steel-400">{fmtNum(r.totalM2)} m² · {r.invoiceCount} facturas</div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-lg font-black text-steel-900 dark:text-white">{fmt(r.totalPay)}</div>
                </div>
                <svg className={`w-4 h-4 text-steel-400 flex-shrink-0 transition-transform ${expanded === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expanded === i && (
                <div className="border-t border-concrete-100 overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="text-xs text-steel-400 uppercase tracking-wide bg-concrete-50 dark:bg-steel-900">
                        <th className="text-left px-4 py-2 font-semibold">{t('col_invoice')}</th>
                        <th className="text-left px-4 py-2 font-semibold hidden sm:table-cell">{t('col_client')}</th>
                        <th className="text-left px-4 py-2 font-semibold">{t('col_date')}</th>
                        <th className="text-right px-4 py-2 font-semibold">{t('col_m2')}</th>
                        <th className="text-right px-4 py-2 font-semibold">{t('col_pay')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-concrete-100 dark:divide-steel-700">
                      {r.breakdown.map((b, j) => (
                        <tr key={j} className="hover:bg-concrete-50 dark:hover:bg-steel-700">
                          <td className="px-4 py-2 font-mono text-steel-700 dark:text-steel-300">#{b.docNumber}</td>
                          <td className="px-4 py-2 text-steel-600 dark:text-steel-300 truncate max-w-[160px] hidden sm:table-cell">{b.customerName}</td>
                          <td className="px-4 py-2 text-steel-500 dark:text-steel-400 whitespace-nowrap">{fmtDate(b.txnDate)}</td>
                          <td className="px-4 py-2 text-right text-steel-700 dark:text-steel-200">{fmtNum(b.monoSlabQty)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-steel-900 dark:text-white">{fmt(b.pay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── External payments ── */}
      {extPayments.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>{t('ext_pay_title')}</SectionTitle>
          {extPayments.map(ep => (
            <div key={ep._id} className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-steel-100 dark:bg-steel-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-steel-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-steel-900 dark:text-white truncate">{ep.name}</div>
                {ep.isRecurring && (
                  <div className="text-xs text-primary-500 mt-0.5">
                    Automático · día {ep.schedule?.dayOfMonth} a las {String(ep.schedule?.hour).padStart(2,'0')}:00
                  </div>
                )}
              </div>
              <div className="text-lg font-black text-steel-900 dark:text-white flex-shrink-0">{fmt(ep.amount)}</div>
              <button onClick={() => deleteExtPayment(ep._id)}
                className="p-1.5 text-steel-300 hover:text-red-500 transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <div className="text-xs text-steel-400 uppercase tracking-wide">
              Subtotal externo: <span className="font-bold text-steel-700 dark:text-steel-200">{fmt(extTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: Receivables ─────────────────────────────────────────────────────
function ReceivablesTab({ params }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi.receivables(params).then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>{t('receivables_title')}</SectionTitle>
        <div className="text-right">
          <div className="text-xs text-steel-400 uppercase">{t('receivables_total')}</div>
          <div className="text-xl font-black text-amber-600">{fmt(data.totalReceivable)}</div>
        </div>
      </div>
      {data.customers.length === 0 ? (
        <div className="text-center py-12 text-steel-400">{t('receivables_empty')}</div>
      ) : (
        <div className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <thead className="bg-concrete-50 dark:bg-steel-900 border-b border-concrete-200 dark:border-steel-700">
              <tr className="text-xs text-steel-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">{t('col_client')}</th>
                <th className="text-right px-4 py-3 font-semibold">{t('col_invoices')}</th>
                <th className="text-right px-4 py-3 font-semibold">{t('col_balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-concrete-100 dark:divide-steel-700">
              {data.customers.map((c, i) => (
                <tr key={i} className="hover:bg-concrete-50 dark:hover:bg-steel-700">
                  <td className="px-4 py-3 font-medium text-steel-900 dark:text-white max-w-[200px] truncate">{c.customerName}</td>
                  <td className="px-4 py-3 text-right text-steel-500">{c.invoices.length}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">{fmt(c.totalBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── TAB: Revenue ─────────────────────────────────────────────────────────
function RevenueTab({ params }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi.revenue(params).then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label={t('kpi_invoiced')} value={fmt(data.totalInvoiced)} sub={`${data.invoiceCount} facturas`} color="blue" />
        <KpiCard label={t('kpi_paid')} value={fmt(data.totalPaid)} color="green" />
        <KpiCard label={t('kpi_receivable')} value={fmt(data.totalPending)} color="amber" />
      </div>
      <div className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead className="bg-concrete-50 dark:bg-steel-900 border-b border-concrete-200 dark:border-steel-700">
            <tr className="text-xs text-steel-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Mes</th>
              <th className="text-right px-4 py-3 font-semibold">{t('col_invoices')}</th>
              <th className="text-right px-4 py-3 font-semibold">{t('kpi_invoiced')}</th>
              <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">{t('kpi_paid')}</th>
              <th className="text-right px-4 py-3 font-semibold">{t('kpi_receivable')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-concrete-100 dark:divide-steel-700">
            {data.monthly.map((m, i) => (
              <tr key={i} className="hover:bg-concrete-50 dark:hover:bg-steel-700">
                <td className="px-4 py-3 font-medium text-steel-900 dark:text-white">{m.month}</td>
                <td className="px-4 py-3 text-right text-steel-500">{m.count}</td>
                <td className="px-4 py-3 text-right text-steel-900 dark:text-white">{fmt(m.invoiced)}</td>
                <td className="px-4 py-3 text-right text-green-700 hidden sm:table-cell">{fmt(m.paid)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{fmt(m.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB: Margin ──────────────────────────────────────────────────────────
function MarginTab({ params }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi.margin(params).then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label={t('kpi_invoiced')} value={fmt(data.totalRevenue)} color="blue" />
        <KpiCard label={t('kpi_collab_cost')} value={fmt(data.totalCollabCost)} sub={`${fmtNum(data.totalM2)} m²`} color="red" />
        <KpiCard label={t('kpi_gross_margin')} value={fmt(data.grossMargin)} color="green" />
        <KpiCard label={t('kpi_margin_pct')} value={fmtPct(data.marginPct)} color="primary" />
      </div>
      <div className="bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-concrete-50 dark:bg-steel-900 border-b border-concrete-200 dark:border-steel-700">
            <tr className="text-xs text-steel-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">{t('col_client')}</th>
              <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">{t('col_m2')}</th>
              <th className="text-right px-4 py-3 font-semibold">{t('kpi_invoiced')}</th>
              <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Costo</th>
              <th className="text-right px-4 py-3 font-semibold">{t('kpi_gross_margin')}</th>
              <th className="text-right px-4 py-3 font-semibold">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-concrete-100 dark:divide-steel-700">
            {data.customers.map((c, i) => (
              <tr key={i} className="hover:bg-concrete-50 dark:hover:bg-steel-700">
                <td className="px-4 py-3 font-medium text-steel-900 dark:text-white truncate max-w-[160px]">{c.customerName}</td>
                <td className="px-4 py-3 text-right text-steel-500 hidden sm:table-cell">{fmtNum(c.m2)}</td>
                <td className="px-4 py-3 text-right text-steel-900 dark:text-white">{fmt(c.revenue)}</td>
                <td className="px-4 py-3 text-right text-red-700 hidden md:table-cell">{fmt(c.collabCost)}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">{fmt(c.margin)}</td>
                <td className="px-4 py-3 text-right text-steel-500">{fmtPct(c.marginPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Export helpers ────────────────────────────────────────────────────────
const $x = v => ({ v: Number(v) || 0, t: 'n', z: '"$"#,##0.00' });
const m2c = v => ({ v: Number(v) || 0, t: 'n', z: '#,##0' });
const sx  = v => ({ v: String(v ?? ''), t: 's' });
const pctx = v => ({ v: (Number(v) || 0) / 100, t: 'n', z: '0.0%' });

function buildWorkbook(data) {
  const wb  = XLSX.utils.book_new();
  const r   = data.resumen;
  const per = `${data.period.dateFrom || 'Inicio'} — ${data.period.dateTo || 'Hoy'}`;

  const wsR = XLSX.utils.aoa_to_sheet([
    [sx('REPORTE APEX CONCRETE'), sx('')],
    [sx('Período'), sx(per)],
    [sx(''), sx('')],
    [sx('RESUMEN GENERAL'), sx('')],
    [sx('Total Facturado'),      $x(r.totalRevenue)],
    [sx('Total Cobrado'),        $x(r.totalRevenue - r.totalReceivable)],
    [sx('Por Cobrar'),           $x(r.totalReceivable)],
    [sx('Costo Collaboradores'), $x(r.totalCollabCost)],
    [sx('Margen Bruto'),         $x(r.grossMargin)],
    [sx('% Margen'),             pctx(r.marginPct)],
    [sx('Total M²'),             m2c(r.totalM2)],
    [sx('Total Facturas'),       m2c(r.invoiceCount)],
  ]);
  wsR['!cols'] = [{ wch: 26 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsR, 'Resumen');

  const wsSal = XLSX.utils.aoa_to_sheet([
    [sx('SALARIOS POR COLABORADOR'), sx(''), sx(''), sx('')],
    [sx('Período'), sx(per), sx(''), sx('')],
    [sx(''), sx(''), sx(''), sx('')],
    [sx('Colaborador'), sx('M²'), sx('Total a Pagar'), sx('# Facturas')],
    ...data.salaries.map(sal => [sx(sal.colaborador), m2c(sal.m2), $x(sal.total), m2c(sal.facturas)]),
    [sx(''), sx(''), sx(''), sx('')],
    [sx('TOTAL'), m2c(data.salaries.reduce((a,x)=>a+x.m2,0)), $x(data.salaries.reduce((a,x)=>a+x.total,0)), m2c(data.salaries.reduce((a,x)=>a+x.facturas,0))],
  ]);
  wsSal['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSal, 'Salarios');

  const wsInv = XLSX.utils.aoa_to_sheet([
    [sx('Fecha'), sx('Factura #'), sx('Cliente'), sx('Estado'), sx('Total Facturado'), sx('Saldo Pendiente'), sx('Cobrado'), sx('Mono Slab'), sx('M²'), sx('Pago Collab'), sx('Colaborador')],
    ...data.invoices.map(i => [
      sx(i.fecha), sx(i.factura), sx(i.cliente), sx(i.estado),
      $x(i.totalFacturado), $x(i.saldoPendiente), $x(i.pagado),
      sx(i.esMonoSlab), m2c(i.m2), $x(i.pagoCollab), sx(i.colaborador)
    ]),
  ]);
  wsInv['!cols'] = [12,10,32,14,16,16,14,10,10,13,16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsInv, 'Facturas');

  return wb;
}

function openPrintView(data) {
  const per = `${data.period.dateFrom || 'Inicio'} — ${data.period.dateTo || 'Hoy'}`;
  const fU  = n => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n ?? 0);
  const fN  = n => new Intl.NumberFormat('en-US').format(n ?? 0);
  const r   = data.resumen;

  const salRows = data.salaries.map(s => `
    <tr><td>${s.colaborador}</td><td class="num">${fN(s.m2)}</td>
    <td class="num money">${fU(s.total)}</td><td class="num">${s.facturas}</td></tr>`).join('');

  const invRows = data.invoices.map((i, idx) => `
    <tr class="${idx%2===0?'even':''}">
      <td>${i.fecha}</td><td>${i.factura}</td><td>${i.cliente}</td><td>${i.estado}</td>
      <td class="num money">${fU(i.totalFacturado)}</td>
      <td class="num ${i.saldoPendiente>0?'pending':'paid'}">${i.saldoPendiente>0?fU(i.saldoPendiente):'Pagado'}</td>
      <td class="num">${i.m2>0?fN(i.m2):'—'}</td>
      <td class="num money">${i.pagoCollab>0?fU(i.pagoCollab):'—'}</td>
      <td>${i.colaborador}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Apex — ${per}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:24px}
.topbar{background:#f97316;color:white;padding:8px 16px;margin-bottom:16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center}
.topbar button{background:white;color:#f97316;border:none;padding:6px 16px;font-weight:700;border-radius:4px;cursor:pointer}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:3px solid #f97316;padding-bottom:12px}
.header h1{font-size:20px;font-weight:900}.header .logo{font-size:22px;font-weight:900;color:#f97316}
.kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px}
.kpi{background:#f8fafc;border-left:4px solid #f97316;padding:10px 12px;border-radius:4px}
.kpi.green{border-color:#10b981}.kpi.red{border-color:#ef4444}.kpi.blue{border-color:#3b82f6}.kpi.amber{border-color:#f59e0b}
.kpi-label{font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8}
.kpi-value{font-size:15px;font-weight:900;color:#1e293b;margin-top:2px}
.section{margin-bottom:24px}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:10.5px}
th{background:#1e293b;color:white;padding:7px 8px;text-align:left;font-weight:700;font-size:9.5px;text-transform:uppercase}
td{padding:5px 8px;border-bottom:1px solid #f1f5f9}
tr.even td{background:#f8fafc}
td.num{text-align:right}.td.money{font-weight:600}
td.pending{color:#d97706;font-weight:700}.td.paid{color:#10b981}
.sal-table{max-width:480px}
tfoot tr{background:#1e293b;color:white;font-weight:900}
@media print{.topbar{display:none}}
</style></head><body>
<div class="topbar"><span><b>Reporte Apex Concrete</b> — ${per}</span>
<button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button></div>
<div class="header"><div><h1>REPORTE APEX CONCRETE</h1><div style="color:#64748b;font-size:12px;margin-top:2px">Período: ${per}</div></div><div class="logo">APEX</div></div>
<div class="kpi-grid">
  <div class="kpi blue"><div class="kpi-label">Total Facturado</div><div class="kpi-value">${fU(r.totalRevenue)}</div></div>
  <div class="kpi green"><div class="kpi-label">Total Cobrado</div><div class="kpi-value">${fU(r.totalRevenue-r.totalReceivable)}</div></div>
  <div class="kpi amber"><div class="kpi-label">Por Cobrar</div><div class="kpi-value">${fU(r.totalReceivable)}</div></div>
  <div class="kpi red"><div class="kpi-label">Costo Collabs</div><div class="kpi-value">${fU(r.totalCollabCost)}</div></div>
  <div class="kpi green"><div class="kpi-label">Margen Bruto</div><div class="kpi-value">${fU(r.grossMargin)}</div></div>
</div>
<div class="section"><div class="section-title">Salarios por Colaborador</div>
<table class="sal-table"><thead><tr><th>Colaborador</th><th>M²</th><th>Total a Pagar</th><th># Facturas</th></tr></thead>
<tbody>${salRows}</tbody>
<tfoot><tr><td>TOTAL</td><td class="num">${fN(r.totalM2)}</td><td class="num">${fU(r.totalCollabCost)}</td><td class="num">${fN(data.salaries.reduce((a,x)=>a+x.facturas,0))}</td></tr></tfoot>
</table></div>
<div class="section"><div class="section-title">Detalle de Facturas (${r.invoiceCount})</div>
<table><thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Saldo</th><th>M²</th><th>Pago Collab</th><th>Colaborador</th></tr></thead>
<tbody>${invRows}</tbody></table></div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ─── Floating Export Button (FAB) ──────────────────────────────────────────
function ExportFAB({ params }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleExport = async (format) => {
    setOpen(false);
    setLoading(true);
    try {
      const data = await reportsApi.export(params);
      if (format === 'print') {
        openPrintView(data);
      } else {
        const wb = buildWorkbook(data);
        XLSX.writeFile(wb, `apex-reporte-${new Date().toISOString().slice(0,10)}.xlsx`);
        toast.success('Excel descargado');
      }
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col items-end gap-2">
        {/* Options */}
        {open && (
          <div className="flex flex-col gap-2 mb-1 items-end">
            <button onClick={() => handleExport('print')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg transition-all whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {t('export_pdf')}
            </button>
            <button onClick={() => handleExport('xlsx')}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-lg transition-all whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('export_excel')}
            </button>
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={() => setOpen(!open)}
          disabled={loading}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
            loading ? 'bg-steel-400 cursor-not-allowed' :
            open ? 'bg-steel-700' : 'bg-primary-500 hover:bg-primary-600 active:scale-95'
          }`}
        >
          {loading ? (
            <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : open ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
const TABS_DEF = [
  { id: 'overview',    key: 'tab_overview' },
  { id: 'salary',      key: 'tab_salary' },
  { id: 'receivables', key: 'tab_receivables' },
  { id: 'revenue',     key: 'tab_revenue' },
  { id: 'margin',      key: 'tab_margin' },
];

const PRESETS_DEF = [
  { id: 'today_yesterday', key: 'preset_today_yesterday' },
  { id: 'this_month', key: 'preset_this_month' },
  { id: 'last_month', key: 'preset_last_month' },
  { id: 'last_90',    key: 'preset_last_90' },
  { id: 'this_year',  key: 'preset_this_year' },
  { id: 'all',        key: 'preset_all' },
];

function ReportsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab]   = useState('overview');
  const [preset, setPreset]         = useState('this_month');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (preset !== 'custom' && preset !== 'all') {
      const p = getPreset(preset);
      setDateFrom(p.dateFrom);
      setDateTo(p.dateTo);
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  }, [preset]);

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('invoices-synced', handler);
    return () => window.removeEventListener('invoices-synced', handler);
  }, []);

  const params = { refreshKey };
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo)   params.dateTo   = dateTo;

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-steel-900 dark:text-white">Reportes</h1>

        {/* Period presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS_DEF.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                preset === p.id
                  ? 'bg-steel-900 dark:bg-primary-600 text-white'
                  : 'bg-white dark:bg-steel-800 border border-concrete-200 dark:border-steel-700 text-steel-600 dark:text-steel-300 hover:border-steel-400 dark:hover:border-steel-500'
              }`}>
              {t(p.key)}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPreset('custom'); }}
            className="text-xs border border-concrete-200 dark:border-steel-700 rounded-lg px-2 py-1.5 text-steel-700 dark:text-steel-200 bg-white dark:bg-steel-800 focus:outline-none focus:ring-2 focus:ring-primary-400 flex-1 min-w-0"
          />
          <span className="text-steel-400 text-xs flex-shrink-0">—</span>
          <input type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPreset('custom'); }}
            className="text-xs border border-concrete-200 dark:border-steel-700 rounded-lg px-2 py-1.5 text-steel-700 dark:text-steel-200 bg-white dark:bg-steel-800 focus:outline-none focus:ring-2 focus:ring-primary-400 flex-1 min-w-0"
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 border-b border-concrete-200 dark:border-steel-700 overflow-x-auto">
        {TABS_DEF.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-steel-500 dark:text-steel-400 hover:text-steel-800 dark:hover:text-white'
            }`}>
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeTab === 'overview'    && <OverviewTab    params={params} />}
        {activeTab === 'salary'      && <SalaryTab      params={params} />}
        {activeTab === 'receivables' && <ReceivablesTab params={params} />}
        {activeTab === 'revenue'     && <RevenueTab     params={params} />}
        {activeTab === 'margin'      && <MarginTab      params={params} />}
      </div>

      {/* ── Floating Export Button ── */}
      <ExportFAB params={params} />
    </div>
  );
}

export default ReportsPage;
