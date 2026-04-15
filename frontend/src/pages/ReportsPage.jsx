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
const $ = v => ({ v: Number(v) || 0, t: 'n', z: '"$"#,##0.00' });
const m2c = v => ({ v: Number(v) || 0, t: 'n', z: '#,##0' });
const s  = v => ({ v: String(v ?? ''), t: 's' });
const pct = v => ({ v: (Number(v) || 0) / 100, t: 'n', z: '0.0%' });

function buildWorkbook(data) {
  const wb = XLSX.utils.book_new();
  const r  = data.resumen;
  const periodo = `${data.period.dateFrom || 'Inicio'} — ${data.period.dateTo || 'Hoy'}`;

  // ── Hoja 1: Resumen ──────────────────────────────────────────────────────
  const wsR = XLSX.utils.aoa_to_sheet([
    [s('REPORTE APEX CONCRETE'), s('')],
    [s('Período'), s(periodo)],
    [s(''), s('')],
    [s('RESUMEN GENERAL'), s('')],
    [s('Total Facturado'),        $(r.totalRevenue)],
    [s('Total Cobrado'),          $(r.totalRevenue - r.totalReceivable)],
    [s('Por Cobrar'),             $(r.totalReceivable)],
    [s('Costo Collaboradores'),   $(r.totalCollabCost)],
    [s('Margen Bruto'),           $(r.grossMargin)],
    [s('% Margen'),               pct(r.marginPct)],
    [s('Total M²'),               m2c(r.totalM2)],
    [s('Total Facturas'),         m2c(r.invoiceCount)],
  ]);
  wsR['!cols'] = [{ wch: 26 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsR, 'Resumen');

  // ── Hoja 2: Salarios ─────────────────────────────────────────────────────
  const wsSal = XLSX.utils.aoa_to_sheet([
    [s('SALARIOS POR COLABORADOR'), s(''), s(''), s('')],
    [s('Período'), s(periodo), s(''), s('')],
    [s(''), s(''), s(''), s('')],
    [s('Colaborador'), s('M²'), s('Total a Pagar'), s('# Facturas')],
    ...data.salaries.map(sal => [s(sal.colaborador), m2c(sal.m2), $(sal.total), m2c(sal.facturas)]),
    [s(''), s(''), s(''), s('')],
    [s('TOTAL'), m2c(data.salaries.reduce((a,x)=>a+x.m2,0)), $(data.salaries.reduce((a,x)=>a+x.total,0)), m2c(data.salaries.reduce((a,x)=>a+x.facturas,0))],
  ]);
  wsSal['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSal, 'Salarios');

  // ── Hoja 3: Facturas ─────────────────────────────────────────────────────
  const wsInv = XLSX.utils.aoa_to_sheet([
    [s('Fecha'), s('Factura #'), s('Cliente'), s('Estado'), s('Total Facturado'), s('Saldo Pendiente'), s('Cobrado'), s('Mono Slab'), s('M²'), s('Pago Collab'), s('Colaborador')],
    ...data.invoices.map(i => [
      s(i.fecha), s(i.factura), s(i.cliente), s(i.estado),
      $(i.totalFacturado), $(i.saldoPendiente), $(i.pagado),
      s(i.esMonoSlab), m2c(i.m2), $(i.pagoCollab), s(i.colaborador)
    ]),
  ]);
  wsInv['!cols'] = [12,10,32,14,16,16,14,10,10,13,16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsInv, 'Facturas');

  return wb;
}

function openPrintView(data) {
  const periodo = `${data.period.dateFrom || 'Inicio'} — ${data.period.dateTo || 'Hoy'}`;
  const fmtUSD  = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
  const fmtNum  = n => new Intl.NumberFormat('en-US').format(n ?? 0);
  const r = data.resumen;

  const salRows = data.salaries.map(sal => `
    <tr>
      <td>${sal.colaborador}</td>
      <td class="num">${fmtNum(sal.m2)}</td>
      <td class="num money">${fmtUSD(sal.total)}</td>
      <td class="num">${sal.facturas}</td>
    </tr>`).join('');

  const invRows = data.invoices.map((i, idx) => `
    <tr class="${idx % 2 === 0 ? 'even' : ''}">
      <td>${i.fecha}</td>
      <td>${i.factura}</td>
      <td>${i.cliente}</td>
      <td>${i.estado}</td>
      <td class="num money">${fmtUSD(i.totalFacturado)}</td>
      <td class="num ${i.saldoPendiente > 0 ? 'pending' : 'paid'}">${i.saldoPendiente > 0 ? fmtUSD(i.saldoPendiente) : 'Pagado'}</td>
      <td class="num">${i.m2 > 0 ? fmtNum(i.m2) : '—'}</td>
      <td class="num money">${i.pagoCollab > 0 ? fmtUSD(i.pagoCollab) : '—'}</td>
      <td>${i.colaborador}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Apex Concrete — ${periodo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 3px solid #f97316; padding-bottom: 12px; }
  .header h1 { font-size: 20px; font-weight: 900; color: #1e293b; }
  .header .period { font-size: 12px; color: #64748b; margin-top: 2px; }
  .header .logo { font-size: 22px; font-weight: 900; color: #f97316; letter-spacing: -1px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi { background: #f8fafc; border-left: 4px solid #f97316; padding: 10px 12px; border-radius: 4px; }
  .kpi.green { border-color: #10b981; }
  .kpi.red { border-color: #ef4444; }
  .kpi.blue { border-color: #3b82f6; }
  .kpi.amber { border-color: #f59e0b; }
  .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #94a3b8; }
  .kpi-value { font-size: 16px; font-weight: 900; color: #1e293b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #1e293b; color: white; padding: 7px 8px; text-align: left; font-weight: 700; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  tr.even td { background: #f8fafc; }
  td.num { text-align: right; }
  td.money { font-weight: 600; }
  td.pending { color: #d97706; font-weight: 700; }
  td.paid { color: #10b981; }
  .sal-table { max-width: 500px; }
  @media print {
    body { padding: 12px; }
    .no-print { display: none; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="no-print" style="background:#f97316;color:white;padding:8px 16px;margin-bottom:16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
  <span style="font-weight:700">Vista de impresión — Apex Concrete</span>
  <button onclick="window.print()" style="background:white;color:#f97316;border:none;padding:6px 16px;font-weight:700;border-radius:4px;cursor:pointer">🖨️ Imprimir / Guardar PDF</button>
</div>

<div class="header">
  <div>
    <h1>REPORTE APEX CONCRETE</h1>
    <div class="period">Período: ${periodo}</div>
  </div>
  <div class="logo">APEX</div>
</div>

<div class="kpi-grid">
  <div class="kpi blue"><div class="kpi-label">Total Facturado</div><div class="kpi-value">${fmtUSD(r.totalRevenue)}</div></div>
  <div class="kpi green"><div class="kpi-label">Total Cobrado</div><div class="kpi-value">${fmtUSD(r.totalRevenue - r.totalReceivable)}</div></div>
  <div class="kpi amber"><div class="kpi-label">Por Cobrar</div><div class="kpi-value">${fmtUSD(r.totalReceivable)}</div></div>
  <div class="kpi red"><div class="kpi-label">Costo Collabs</div><div class="kpi-value">${fmtUSD(r.totalCollabCost)}</div></div>
  <div class="kpi green"><div class="kpi-label">Margen Bruto</div><div class="kpi-value">${fmtUSD(r.grossMargin)}</div></div>
</div>

<div class="section">
  <div class="section-title">Salarios por Colaborador</div>
  <table class="sal-table">
    <thead><tr><th>Colaborador</th><th>M²</th><th>Total a Pagar</th><th># Facturas</th></tr></thead>
    <tbody>${salRows}</tbody>
    <tfoot><tr style="background:#1e293b;color:white;font-weight:900">
      <td>TOTAL</td>
      <td class="num">${fmtNum(r.totalM2)}</td>
      <td class="num">${fmtUSD(r.totalCollabCost)}</td>
      <td class="num">${fmtNum(data.salaries.reduce((a,x)=>a+x.facturas,0))}</td>
    </tr></tfoot>
  </table>
</div>

<div class="section">
  <div class="section-title">Detalle de Facturas (${r.invoiceCount} facturas)</div>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Factura</th><th>Cliente</th><th>Estado</th>
      <th>Total</th><th>Saldo</th><th>M²</th><th>Pago Collab</th><th>Colaborador</th>
    </tr></thead>
    <tbody>${invRows}</tbody>
  </table>
</div>

</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ─── Export button component ────────────────────────────────────────────────
function ExportButtons({ params }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format) => {
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
      toast.error('Error al exportar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-steel-400 font-semibold uppercase tracking-wide hidden sm:inline">Exportar:</span>
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
        onClick={() => handleExport('print')}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        PDF / Imagen
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
