import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';
import { Invoice } from '../models/Invoice.js';
import { ExternalPayment } from '../models/ExternalPayment.js';

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function getRecipients() {
  const raw = process.env.REPORT_EMAILS || '';
  return raw.split(',').map(e => e.trim()).filter(Boolean);
}

// Build the data payload for a date range (same shape as /api/reports/export)
async function buildReportData(dateFrom, dateTo) {
  const match = {};
  if (dateFrom) match.txnDate = { ...match.txnDate, $gte: new Date(dateFrom) };
  if (dateTo)   match.txnDate = { ...match.txnDate, $lte: new Date(dateTo + 'T23:59:59') };

  const invoices = await Invoice.find(match).populate('collaborator', 'name color').lean();

  const totalRevenue     = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalReceivable  = invoices.reduce((s, i) => s + (i.balance || 0), 0);
  const totalCollabCost  = invoices.reduce((s, i) => s + (i.collaboratorPay || 0), 0);
  const totalM2          = invoices.reduce((s, i) => s + (i.monoSlabQty || 0), 0);
  const grossMargin      = totalRevenue - totalCollabCost;
  const marginPct        = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

  // Salary grouping
  const salaryMap = new Map();
  for (const inv of invoices) {
    if (!inv.hasMonoSlab) continue;
    const key = inv.collaborator?._id?.toString() || '__unassigned__';
    const entry = salaryMap.get(key) || { collaborador: inv.collaborator?.name || 'Sin asignar', m2: 0, total: 0, facturas: 0 };
    entry.m2       += inv.monoSlabQty || 0;
    entry.total    += inv.collaboratorPay || 0;
    entry.facturas += 1;
    salaryMap.set(key, entry);
  }

  // External payments for the period
  const extPayments = await ExternalPayment.find({ active: true }).lean();
  const salaries = [...salaryMap.values()];
  for (const ep of extPayments) {
    salaries.push({ colaborador: ep.name, m2: 0, total: ep.amount, facturas: 0, isExternal: true });
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-CR', { dateStyle: 'short' }) : '—';

  return {
    period: { dateFrom, dateTo },
    resumen: { totalRevenue, totalReceivable, totalCollabCost, totalM2, grossMargin, marginPct, invoiceCount: invoices.length },
    salaries,
    invoices: invoices.map(i => ({
      fecha:          fmtDate(i.txnDate),
      factura:        i.docNumber,
      cliente:        i.customerName,
      estado:         i.estado || '',
      totalFacturado: i.totalAmount || 0,
      saldoPendiente: i.balance || 0,
      pagado:         (i.totalAmount || 0) - (i.balance || 0),
      esMonoSlab:     i.hasMonoSlab ? 'Sí' : 'No',
      m2:             i.monoSlabQty || 0,
      pagoCollab:     i.collaboratorPay || 0,
      colaborador:    i.collaborator?.name || '',
    })),
  };
}

function buildExcel(data) {
  const wb  = XLSX.utils.book_new();
  const r   = data.resumen;
  const per = `${data.period.dateFrom || 'Inicio'} — ${data.period.dateTo || 'Hoy'}`;
  const $x  = v => ({ v: Number(v) || 0, t: 'n', z: '"$"#,##0.00' });
  const m2c = v => ({ v: Number(v) || 0, t: 'n', z: '#,##0' });
  const sx  = v => ({ v: String(v ?? ''), t: 's' });

  const wsR = XLSX.utils.aoa_to_sheet([
    [sx('REPORTE APEX CONCRETE'), sx('')],
    [sx('Período'), sx(per)],
    [sx(''), sx('')],
    [sx('Total Facturado'),      $x(r.totalRevenue)],
    [sx('Total Cobrado'),        $x(r.totalRevenue - r.totalReceivable)],
    [sx('Por Cobrar'),           $x(r.totalReceivable)],
    [sx('Costo Collaboradores'), $x(r.totalCollabCost)],
    [sx('Margen Bruto'),         $x(r.grossMargin)],
    [sx('Total M²'),             m2c(r.totalM2)],
  ]);
  wsR['!cols'] = [{ wch: 26 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsR, 'Resumen');

  const wsSal = XLSX.utils.aoa_to_sheet([
    [sx('Colaborador'), sx('M²'), sx('Total a Pagar'), sx('# Facturas')],
    ...data.salaries.map(s => [sx(s.colaborador), m2c(s.m2), $x(s.total), m2c(s.facturas)]),
  ]);
  wsSal['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSal, 'Salarios');

  const wsInv = XLSX.utils.aoa_to_sheet([
    [sx('Fecha'), sx('Factura #'), sx('Cliente'), sx('Estado'), sx('Total'), sx('Saldo'), sx('M²'), sx('Pago Collab'), sx('Colaborador')],
    ...data.invoices.map(i => [
      sx(i.fecha), sx(i.factura), sx(i.cliente), sx(i.estado),
      $x(i.totalFacturado), $x(i.saldoPendiente), m2c(i.m2), $x(i.pagoCollab), sx(i.colaborador),
    ]),
  ]);
  wsInv['!cols'] = [12, 10, 32, 14, 16, 16, 10, 13, 16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsInv, 'Facturas');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function buildHtmlEmail(data) {
  const fU  = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
  const r   = data.resumen;
  const per = `${data.period.dateFrom || 'Inicio'} — ${data.period.dateTo || 'Hoy'}`;

  const salRows = data.salaries.map(s => `
    <tr>
      <td style="padding:6px 10px">${s.colaborador}${s.isExternal ? ' <span style="font-size:10px;color:#f97316">(ext)</span>' : ''}</td>
      <td style="padding:6px 10px;text-align:right">${s.m2 > 0 ? s.m2.toFixed(0) : '—'}</td>
      <td style="padding:6px 10px;text-align:right;font-weight:700">${fU(s.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Apex — ${per}</title></head>
<body style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;margin:0;padding:0;background:#f1f5f9">
<div style="max-width:640px;margin:24px auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.12)">
  <div style="background:#f97316;padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="color:white;font-size:20px;font-weight:900">APEX Concrete</div>
      <div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:2px">Reporte diario — ${per}</div>
    </div>
  </div>
  <div style="padding:24px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 14px;border-radius:6px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8">Facturado</div>
        <div style="font-size:18px;font-weight:900;color:#1e293b;margin-top:2px">${fU(r.totalRevenue)}</div>
        <div style="font-size:11px;color:#64748b">${r.invoiceCount} facturas</div>
      </div>
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 14px;border-radius:6px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8">Cobrado</div>
        <div style="font-size:18px;font-weight:900;color:#15803d;margin-top:2px">${fU(r.totalRevenue - r.totalReceivable)}</div>
      </div>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 14px;border-radius:6px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8">Por Cobrar</div>
        <div style="font-size:18px;font-weight:900;color:#b45309;margin-top:2px">${fU(r.totalReceivable)}</div>
      </div>
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 14px;border-radius:6px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8">Margen Bruto</div>
        <div style="font-size:18px;font-weight:900;color:#15803d;margin-top:2px">${fU(r.grossMargin)}</div>
        <div style="font-size:11px;color:#64748b">${r.marginPct.toFixed(1)}%</div>
      </div>
    </div>

    <div style="margin-bottom:8px;font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:6px">
      Salarios por colaborador
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#1e293b;color:white">
          <th style="padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase">Colaborador</th>
          <th style="padding:7px 10px;text-align:right;font-size:10px;text-transform:uppercase">M²</th>
          <th style="padding:7px 10px;text-align:right;font-size:10px;text-transform:uppercase">A pagar</th>
        </tr>
      </thead>
      <tbody>${salRows}</tbody>
    </table>
  </div>
  <div style="background:#f8fafc;padding:14px 24px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">
    Reporte automático generado por Apex Concrete · ${new Date().toLocaleString('es-CR')}
  </div>
</div>
</body></html>`;
}

export async function sendDailyReport() {
  const recipients = getRecipients();
  if (recipients.length === 0) {
    console.log('📧 REPORT_EMAILS no configurado, saltando envío de reporte');
    return;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('📧 SMTP no configurado, saltando envío de reporte');
    return;
  }

  try {
    const today = new Date();
    const yesterday = new Date(today - 86400000);
    const dateFrom = yesterday.toISOString().slice(0, 10);
    const dateTo   = yesterday.toISOString().slice(0, 10);

    const data    = await buildReportData(dateFrom, dateTo);
    const excel   = buildExcel(data);
    const html    = buildHtmlEmail(data);
    const subject = `Reporte Apex ${dateFrom} — ${data.resumen.invoiceCount} facturas · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.resumen.totalRevenue)}`;

    const transport = createTransport();
    await transport.sendMail({
      from:    `"Apex Concrete" <${process.env.SMTP_USER}>`,
      to:      recipients.join(', '),
      subject,
      html,
      attachments: [{
        filename: `apex-reporte-${dateFrom}.xlsx`,
        content:  excel,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    console.log(`📧 Reporte enviado a ${recipients.join(', ')}`);
  } catch (err) {
    console.error('❌ Error enviando reporte:', err.message);
  }
}
