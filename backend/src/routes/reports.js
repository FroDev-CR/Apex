import { Router } from 'express';
import { Invoice } from '../models/Invoice.js';
import { Collaborator } from '../models/Collaborator.js';
import { calculatePeriodSalary } from '../salary/salaryRules.js';

export const reportRoutes = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────
function dateFilter(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};
  const f = {};
  if (dateFrom) f.$gte = new Date(dateFrom);
  if (dateTo) f.$lte = new Date(dateTo);
  return { txnDate: f };
}

// ─── GET /api/reports/salary ───────────────────────────────────────────────
// Salary report: how much to pay each collaborator
// Query: dateFrom, dateTo, collaboratorId (optional)
reportRoutes.get('/salary', async (req, res) => {
  try {
    const { dateFrom, dateTo, collaboratorId } = req.query;

    const invoiceFilter = {
      hasMonoSlab: true,
      collaborator: { $ne: null },
      ...dateFilter(dateFrom, dateTo)
    };
    if (collaboratorId) invoiceFilter.collaborator = collaboratorId;

    const invoices = await Invoice.find(invoiceFilter)
      .populate('collaborator', 'name color email')
      .sort({ txnDate: -1 });

    // Group by collaborator
    const byCollab = new Map();
    for (const inv of invoices) {
      if (!inv.collaborator) continue;
      const key = inv.collaborator._id.toString();
      if (!byCollab.has(key)) {
        byCollab.set(key, { collaborator: inv.collaborator, invoices: [] });
      }
      byCollab.get(key).invoices.push(inv);
    }

    const results = [];
    for (const { collaborator, invoices: collabInvoices } of byCollab.values()) {
      const { total, totalQty, breakdown } = calculatePeriodSalary(collabInvoices);
      results.push({
        collaborator,
        totalPay: total,
        totalM2: totalQty,
        invoiceCount: collabInvoices.length,
        breakdown
      });
    }

    // Sort by totalPay desc
    results.sort((a, b) => b.totalPay - a.totalPay);

    const grandTotal = results.reduce((s, r) => s + r.totalPay, 0);
    res.json({ results, grandTotal, period: { dateFrom, dateTo } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/receivables ─────────────────────────────────────────
// Accounts receivable: unpaid invoices grouped by customer
// Query: dateFrom, dateTo
reportRoutes.get('/receivables', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const invoices = await Invoice.find({
      balance: { $gt: 0 },
      ...dateFilter(dateFrom, dateTo)
    })
      .populate('collaborator', 'name color')
      .sort({ dueDate: 1 });

    // Group by customer
    const byCustomer = new Map();
    for (const inv of invoices) {
      const key = inv.customerName || 'Unknown';
      if (!byCustomer.has(key)) {
        byCustomer.set(key, { customerName: key, invoices: [], totalBalance: 0 });
      }
      const group = byCustomer.get(key);
      group.invoices.push(inv);
      group.totalBalance += inv.balance;
    }

    const customers = Array.from(byCustomer.values())
      .sort((a, b) => b.totalBalance - a.totalBalance);

    const totalReceivable = customers.reduce((s, c) => s + c.totalBalance, 0);
    res.json({ customers, totalReceivable, period: { dateFrom, dateTo } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/revenue ──────────────────────────────────────────────
// Revenue summary: total invoiced, paid, pending
// Query: dateFrom, dateTo
reportRoutes.get('/revenue', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = dateFilter(dateFrom, dateTo);

    const invoices = await Invoice.find(filter).sort({ txnDate: -1 });

    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.totalAmount - i.balance), 0);
    const totalPending = invoices.reduce((s, i) => s + i.balance, 0);

    // Group by month
    const byMonth = new Map();
    for (const inv of invoices) {
      if (!inv.txnDate) continue;
      const key = inv.txnDate.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth.has(key)) {
        byMonth.set(key, { month: key, invoiced: 0, paid: 0, pending: 0, count: 0 });
      }
      const m = byMonth.get(key);
      m.invoiced += inv.totalAmount;
      m.paid += inv.totalAmount - inv.balance;
      m.pending += inv.balance;
      m.count++;
    }

    const monthly = Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));

    res.json({
      totalInvoiced,
      totalPaid,
      totalPending,
      invoiceCount: invoices.length,
      monthly,
      period: { dateFrom, dateTo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/margin ───────────────────────────────────────────────
// Margin report: revenue vs collaborator costs
// Query: dateFrom, dateTo
reportRoutes.get('/margin', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = dateFilter(dateFrom, dateTo);

    const invoices = await Invoice.find(filter);

    const totalRevenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollabCost = invoices.reduce((s, i) => s + (i.collaboratorPay || 0), 0);
    const totalM2 = invoices.reduce((s, i) => s + (i.monoSlabQty || 0), 0);
    const grossMargin = totalRevenue - totalCollabCost;
    const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    // Per-customer margin
    const byCustomer = new Map();
    for (const inv of invoices) {
      const key = inv.customerName || 'Unknown';
      if (!byCustomer.has(key)) {
        byCustomer.set(key, { customerName: key, revenue: 0, collabCost: 0, m2: 0, count: 0 });
      }
      const g = byCustomer.get(key);
      g.revenue += inv.totalAmount;
      g.collabCost += inv.collaboratorPay || 0;
      g.m2 += inv.monoSlabQty || 0;
      g.count++;
    }

    const customers = Array.from(byCustomer.values()).map(c => ({
      ...c,
      margin: c.revenue - c.collabCost,
      marginPct: c.revenue > 0 ? ((c.revenue - c.collabCost) / c.revenue) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);

    res.json({
      totalRevenue,
      totalCollabCost,
      totalM2,
      grossMargin,
      marginPct,
      customers,
      period: { dateFrom, dateTo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/overview ─────────────────────────────────────────────
// Dashboard overview: key numbers at a glance
reportRoutes.get('/overview', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = dateFilter(dateFrom, dateTo);

    const [invoices, collabCount] = await Promise.all([
      Invoice.find(filter),
      Collaborator.countDocuments({ isActive: true })
    ]);

    const totalRevenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollabCost = invoices.reduce((s, i) => s + (i.collaboratorPay || 0), 0);
    const totalReceivable = invoices.reduce((s, i) => s + i.balance, 0);
    const totalM2 = invoices.reduce((s, i) => s + (i.monoSlabQty || 0), 0);

    res.json({
      invoiceCount: invoices.length,
      totalRevenue,
      totalCollabCost,
      grossMargin: totalRevenue - totalCollabCost,
      marginPct: totalRevenue > 0 ? ((totalRevenue - totalCollabCost) / totalRevenue) * 100 : 0,
      totalReceivable,
      totalM2,
      collabCount,
      period: { dateFrom, dateTo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
