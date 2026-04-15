import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { reportsApi } from '../api';

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CR', { dateStyle: 'medium' }) : '—';

// ─── Period quick-selectors ────────────────────────────────────────────────
function getPreset(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'this_month':
      return { dateFrom: new Date(y, m, 1).toISOString().slice(0, 10), dateTo: new Date(y, m + 1, 0).toISOString().slice(0, 10) };
    case 'last_month':
      return { dateFrom: new Date(y, m - 1, 1).toISOString().slice(0, 10), dateTo: new Date(y, m, 0).toISOString().slice(0, 10) };
    case 'this_year':
      return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
    case 'last_90':
      return { dateFrom: new Date(now - 90 * 86400000).toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10) };
    default:
      return { dateFrom: '', dateTo: '' };
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'primary' }) {
  const colors = {
    primary: 'border-primary-400',
    green:   'border-green-400',
    blue:    'border-blue-400',
    amber:   'border-amber-400',
    red:     'border-red-400',
  };
  return (
    <div className={`bg-white rounded-xl border-l-4 ${colors[color]} shadow-steel px-5 py-4`}>
      <div className="text-xs text-steel-400 uppercase tracking-wide font-semibold mb-1">{label}</div>
      <div className="text-2xl font-black text-steel-900">{value}</div>
      {sub && <div className="text-xs text-steel-500 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return <h2 className="text-sm font-bold text-steel-500 uppercase tracking-widest mb-3">{children}</h2>;
}

// ─── Loading skeleton ──────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-concrete-200 rounded ${className}`} />;
}

// ─── TAB: Overview ────────────────────────────────────────────────────────
function OverviewTab({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi.overview(params)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
    </div>
  );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Facturado" value={fmt(data.totalRevenue)} sub={`${data.invoiceCount} facturas`} color="blue" />
        <KpiCard label="Por Cobrar" value={fmt(data.totalReceivable)} sub="saldo pendiente" color="amber" />
        <KpiCard label="Costo Collab" value={fmt(data.totalCollabCost)} sub={`${fmtNum(data.totalM2)} m²`} color="red" />
        <KpiCard label="Margen Bruto" value={fmt(data.grossMargin)} sub={fmtPct(data.marginPct)} color="green" />
        <KpiCard label="Colaboradores" value={data.collabCount} sub="activos" color="primary" />
      </div>
    </div>
  );
}

// ─── TAB: Salary ──────────────────────────────────────────────────────────
function SalaryTab({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setLoading(true);
    reportsApi.salary(params)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Pago a Colaboradores</SectionTitle>
        <div className="text-right">
          <div className="text-xs text-steel-400 uppercase">Total a pagar</div>
          <div className="text-xl font-black text-steel-900">{fmt(data.grandTotal)}</div>
        </div>
      </div>

      {data.results.length === 0 ? (
        <div className="text-center py-12 text-steel-400">Sin facturas POUR MONO SLAB con colaborador asignado en este período</div>
      ) : (
        <div className="space-y-2">
          {data.results.map((r, i) => (
            <div key={i} className="bg-white rounded-xl border border-concrete-200 shadow-steel overflow-hidden">
              <button
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-concrete-50 transition-colors text-left"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: r.collaborator?.color || '#9ca3af' }}
                >
                  {r.collaborator ? r.collaborator.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-steel-900">
                    {r.collaborator?.name || <span className="text-steel-400 italic">Sin asignar</span>}
                  </div>
                  <div className="text-xs text-steel-500">{fmtNum(r.totalM2)} m² · {r.invoiceCount} facturas</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-black text-steel-900">{fmt(r.totalPay)}</div>
                  <div className="text-xs text-steel-400">a pagar</div>
                </div>
                <svg className={`w-4 h-4 text-steel-400 transition-transform ${expanded === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === i && (
                <div className="border-t border-concrete-100 px-5 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-steel-400 uppercase tracking-wide">
                        <th className="text-left py-1.5 font-semibold">Factura</th>
                        <th className="text-left py-1.5 font-semibold">Cliente</th>
                        <th className="text-left py-1.5 font-semibold">Fecha</th>
                        <th className="text-right py-1.5 font-semibold">m²</th>
                        <th className="text-right py-1.5 font-semibold">Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-concrete-100">
                      {r.breakdown.map((b, j) => (
                        <tr key={j} className="hover:bg-concrete-50">
                          <td className="py-2 font-mono text-steel-700">#{b.docNumber}</td>
                          <td className="py-2 text-steel-600 truncate max-w-[180px]">{b.customerName}</td>
                          <td className="py-2 text-steel-500">{fmtDate(b.txnDate)}</td>
                          <td className="py-2 text-right text-steel-700">{fmtNum(b.monoSlabQty)}</td>
                          <td className="py-2 text-right font-semibold text-steel-900">{fmt(b.pay)}</td>
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
    </div>
  );
}

// ─── TAB: Receivables ─────────────────────────────────────────────────────
function ReceivablesTab({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi.receivables(params)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Cuentas por Cobrar</SectionTitle>
        <div className="text-right">
          <div className="text-xs text-steel-400 uppercase">Total pendiente</div>
          <div className="text-xl font-black text-amber-600">{fmt(data.totalReceivable)}</div>
        </div>
      </div>

      {data.customers.length === 0 ? (
        <div className="text-center py-12 text-steel-400">Todo pagado en este período</div>
      ) : (
        <div className="bg-white rounded-xl border border-concrete-200 shadow-steel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-concrete-50 border-b border-concrete-200">
              <tr className="text-xs text-steel-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-right px-4 py-3 font-semibold">Facturas</th>
                <th className="text-right px-4 py-3 font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-concrete-100">
              {data.customers.map((c, i) => (
                <tr key={i} className="hover:bg-concrete-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-steel-900">{c.customerName}</td>
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi.revenue(params)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Facturado" value={fmt(data.totalInvoiced)} sub={`${data.invoiceCount} facturas`} color="blue" />
        <KpiCard label="Cobrado" value={fmt(data.totalPaid)} color="green" />
        <KpiCard label="Pendiente" value={fmt(data.totalPending)} color="amber" />
      </div>

      <SectionTitle>Por Mes</SectionTitle>
      <div className="bg-white rounded-xl border border-concrete-200 shadow-steel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-concrete-50 border-b border-concrete-200">
            <tr className="text-xs text-steel-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Mes</th>
              <th className="text-right px-4 py-3 font-semibold">Facturas</th>
              <th className="text-right px-4 py-3 font-semibold">Facturado</th>
              <th className="text-right px-4 py-3 font-semibold">Cobrado</th>
              <th className="text-right px-4 py-3 font-semibold">Pendiente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-concrete-100">
            {data.monthly.map((m, i) => (
              <tr key={i} className="hover:bg-concrete-50">
                <td className="px-4 py-3 font-medium text-steel-900">{m.month}</td>
                <td className="px-4 py-3 text-right text-steel-500">{m.count}</td>
                <td className="px-4 py-3 text-right text-steel-900">{fmt(m.invoiced)}</td>
                <td className="px-4 py-3 text-right text-green-700">{fmt(m.paid)}</td>
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi.margin(params)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ingresos" value={fmt(data.totalRevenue)} color="blue" />
        <KpiCard label="Costo Collab" value={fmt(data.totalCollabCost)} sub={`${fmtNum(data.totalM2)} m²`} color="red" />
        <KpiCard label="Margen Bruto" value={fmt(data.grossMargin)} color="green" />
        <KpiCard label="% Margen" value={fmtPct(data.marginPct)} color="primary" />
      </div>

      <SectionTitle>Por Cliente</SectionTitle>
      <div className="bg-white rounded-xl border border-concrete-200 shadow-steel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-concrete-50 border-b border-concrete-200">
            <tr className="text-xs text-steel-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">Cliente</th>
              <th className="text-right px-4 py-3 font-semibold">m²</th>
              <th className="text-right px-4 py-3 font-semibold">Ingreso</th>
              <th className="text-right px-4 py-3 font-semibold">Costo</th>
              <th className="text-right px-4 py-3 font-semibold">Margen</th>
              <th className="text-right px-4 py-3 font-semibold">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-concrete-100">
            {data.customers.map((c, i) => (
              <tr key={i} className="hover:bg-concrete-50">
                <td className="px-4 py-3 font-medium text-steel-900 truncate max-w-[200px]">{c.customerName}</td>
                <td className="px-4 py-3 text-right text-steel-500">{fmtNum(c.m2)}</td>
                <td className="px-4 py-3 text-right text-steel-900">{fmt(c.revenue)}</td>
                <td className="px-4 py-3 text-right text-red-700">{fmt(c.collabCost)}</td>
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
function buildWorkbook(data) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const r = data.resumen;
  const resumenRows = [
    ['REPORTE APEX CONCRETE', ''],
    ['Período', `${data.period.dateFrom || 'Inicio'} — ${data.period.dateTo || 'Hoy'}`],
    [''],
    ['RESUMEN GENERAL', ''],
    ['Total Facturado',   r.totalRevenue],
    ['Por Cobrar',        r.totalReceivable],
    ['Total Cobrado',     r.totalRevenue - r.totalReceivable],
    ['Costo Collaboradores', r.totalCollabCost],
    ['Margen Bruto',     r.grossMargin],
    ['% Margen',         `${r.marginPct?.toFixed(1)}%`],
    ['Total M²',         r.totalM2],
    ['Total Facturas',   r.invoiceCount],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenRows), 'Resumen');

  // Hoja 2: Facturas
  const invHeaders = ['Fecha','Factura #','Cliente','Empresa','Estado','Total Facturado','Saldo Pendiente','Cobrado','Mono Slab','M²','Pago Collab','Colaborador'];
  const invRows = data.invoices.map(i => [
    i.fecha, i.factura, i.cliente, i.empresa, i.estado,
    i.totalFacturado, i.saldoPendiente, i.pagado,
    i.esMonoSlab, i.m2, i.pagoCollab, i.colaborador
  ]);
  const wsInv = XLSX.utils.aoa_to_sheet([invHeaders, ...invRows]);
  // Anchos de columna
  wsInv['!cols'] = [12,10,30,20,15,15,15,15,10,10,12,15].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsInv, 'Facturas');

  // Hoja 3: Salarios
  const salHeaders = ['Colaborador','M²','Total a Pagar','# Facturas'];
  const salRows = data.salaries.map(s => [s.colaborador, s.m2, s.total, s.facturas]);
  const wsSal = XLSX.utils.aoa_to_sheet([salHeaders, ...salRows]);
  wsSal['!cols'] = [20,12,15,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsSal, 'Salarios');

  return wb;
}

function downloadCSV(data) {
  const rows = [
    ['REPORTE APEX CONCRETE'],
    [`Período: ${data.period.dateFrom || 'Inicio'} — ${data.period.dateTo || 'Hoy'}`],
    [],
    ['=== RESUMEN ==='],
    ['Total Facturado', data.resumen.totalRevenue],
    ['Por Cobrar', data.resumen.totalReceivable],
    ['Costo Collabs', data.resumen.totalCollabCost],
    ['Margen Bruto', data.resumen.grossMargin],
    ['% Margen', `${data.resumen.marginPct?.toFixed(1)}%`],
    [],
    ['=== SALARIOS ==='],
    ['Colaborador', 'M²', 'Total a Pagar', '# Facturas'],
    ...data.salaries.map(s => [s.colaborador, s.m2, s.total, s.facturas]),
    [],
    ['=== FACTURAS ==='],
    ['Fecha','Factura #','Cliente','Estado','Total','Saldo','M²','Pago Collab','Colaborador'],
    ...data.invoices.map(i => [i.fecha, i.factura, i.cliente, i.estado, i.totalFacturado, i.saldoPendiente, i.m2, i.pagoCollab, i.colaborador]),
  ];

  const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apex-reporte-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Export button component ────────────────────────────────────────────────
function ExportButtons({ params }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format) => {
    setLoading(true);
    try {
      const data = await reportsApi.export(params);
      if (format === 'csv') {
        downloadCSV(data);
        toast.success('CSV descargado');
      } else {
        const wb = buildWorkbook(data);
        XLSX.writeFile(wb, `apex-reporte-${new Date().toISOString().slice(0,10)}.xlsx`);
        toast.success('Excel descargado');
      }
    } catch (err) {
      toast.error('Error al exportar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-steel-400 font-semibold uppercase tracking-wide">Exportar:</span>
      <button
        onClick={() => handleExport('xlsx')}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Excel
      </button>
      <button
        onClick={() => handleExport('csv')}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-steel-600 hover:bg-steel-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        CSV
      </button>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',     label: 'Resumen' },
  { id: 'salary',       label: 'Salarios' },
  { id: 'receivables',  label: 'Por Cobrar' },
  { id: 'revenue',      label: 'Ingresos' },
  { id: 'margin',       label: 'Margen' },
];

const PRESETS = [
  { id: 'this_month', label: 'Este mes' },
  { id: 'last_month', label: 'Mes anterior' },
  { id: 'last_90',    label: 'Últimos 90 días' },
  { id: 'this_year',  label: 'Este año' },
  { id: 'all',        label: 'Todo' },
];

function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [preset, setPreset] = useState('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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

  // Re-fetch when sync completes
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('invoices-synced', handler);
    return () => window.removeEventListener('invoices-synced', handler);
  }, []);

  const params = { refreshKey };
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-steel-900">Reportes</h1>
          <p className="text-steel-500 text-sm mt-0.5">Análisis financiero de Apex Concrete</p>
        </div>

        <ExportButtons params={params} />

        {/* Period filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  preset === p.id
                    ? 'bg-steel-900 text-white'
                    : 'bg-white border border-concrete-200 text-steel-600 hover:border-steel-400'
                }`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="flex items-center gap-1">
            <input type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPreset('custom'); }}
              className="text-xs border border-concrete-200 rounded-lg px-2 py-1.5 text-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <span className="text-steel-400 text-xs">—</span>
            <input type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPreset('custom'); }}
              className="text-xs border border-concrete-200 rounded-lg px-2 py-1.5 text-steel-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-concrete-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeTab === t.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-steel-500 hover:text-steel-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeTab === 'overview'    && <OverviewTab params={params} />}
        {activeTab === 'salary'      && <SalaryTab params={params} />}
        {activeTab === 'receivables' && <ReceivablesTab params={params} />}
        {activeTab === 'revenue'     && <RevenueTab params={params} />}
        {activeTab === 'margin'      && <MarginTab params={params} />}
      </div>
    </div>
  );
}

export default ReportsPage;
