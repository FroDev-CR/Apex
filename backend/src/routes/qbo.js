import { Router } from 'express';
import axios from 'axios';
import {
  QBO_AUTH_URL, QBO_TOKEN_URL, QBO_SCOPES,
  saveTokens, getConnectionStatus, qboRequest, QBOToken
} from '../config/qbo.js';
import { Invoice } from '../models/Invoice.js';
import { Collaborator } from '../models/Collaborator.js';
import { computeInvoicePayFields } from '../salary/salaryRules.js';

export const qboRoutes = Router();

// ─── OAuth: redirect user to QBO authorization page ───────────────────────
qboRoutes.get('/connect', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID,
    response_type: 'code',
    scope: QBO_SCOPES,
    redirect_uri: process.env.QBO_REDIRECT_URI,
    state: 'apex_qbo_auth'
  });
  res.redirect(`${QBO_AUTH_URL}?${params}`);
});

// ─── OAuth: callback — exchange code for tokens ────────────────────────────
qboRoutes.get('/callback', async (req, res) => {
  const { code, realmId, state } = req.query;
  if (!code || !realmId) {
    return res.status(400).json({ error: 'Missing code or realmId in callback' });
  }

  try {
    const credentials = Buffer.from(
      `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      QBO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.QBO_REDIRECT_URI
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json'
        }
      }
    );

    await saveTokens({
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      realmId,
      expiresIn: response.data.expires_in,
      xRefreshTokenExpiresIn: response.data.x_refresh_token_expires_in
    });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?qbo=connected`);
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('❌ QBO callback error:', detail);
    res.status(500).json({ error: 'Failed to exchange authorization code', detail });
  }
});

// ─── Disconnect QBO ────────────────────────────────────────────────────────
qboRoutes.post('/disconnect', async (req, res) => {
  await QBOToken.deleteMany({});
  res.json({ success: true, message: 'QBO disconnected' });
});

// ─── Connection status ─────────────────────────────────────────────────────
qboRoutes.get('/status', async (req, res) => {
  try {
    const status = await getConnectionStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync invoices from QBO ────────────────────────────────────────────────
// Fetches ALL invoices from QBO using pagination and upserts them in MongoDB.
// Also tries to match collaborators from privateNote.
qboRoutes.post('/sync', async (req, res) => {
  try {
    console.log('🔄 Starting QBO invoice sync...');

    const collaborators = await Collaborator.find({ isActive: true });
    const collabMap = buildCollaboratorMap(collaborators);

    let startPosition = 1;
    const pageSize = 100;
    let totalFetched = 0;
    let inserted = 0;
    let updated = 0;

    while (true) {
      const query = `SELECT * FROM Invoice ORDERBY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
      const data = await qboRequest('/query', { query });
      const invoices = data.QueryResponse?.Invoice || [];

      if (invoices.length === 0) break;

      for (const qboInv of invoices) {
        const mapped = mapQBOInvoice(qboInv, collabMap);
        const existing = await Invoice.exists({ qboId: mapped.qboId });
        await Invoice.findOneAndUpdate(
          { qboId: mapped.qboId },
          { $set: mapped },
          { upsert: true, runValidators: true }
        );
        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      }

      totalFetched += invoices.length;
      console.log(`  📄 Synced ${totalFetched} invoices...`);

      if (invoices.length < pageSize) break;
      startPosition += pageSize;
    }

    console.log(`✅ QBO sync complete — ${inserted} new, ${updated} updated`);
    res.json({
      success: true,
      total: totalFetched,
      inserted,
      updated,
      syncedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ QBO sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a map from collaborator name variations → ObjectId
 * Used to match the name in privateNote to a Collaborator doc
 */
function buildCollaboratorMap(collaborators) {
  const map = new Map();
  for (const c of collaborators) {
    map.set(c.name.toLowerCase().trim(), c._id);
  }
  return map;
}

/**
 * Try to find a collaborator ObjectId from a raw string (privateNote)
 */
function matchCollaborator(raw = '', collabMap) {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim();
  for (const [name, id] of collabMap.entries()) {
    if (normalized.includes(name)) return id;
  }
  return null;
}

/**
 * Map a QBO Invoice object to our Invoice schema
 */
function mapQBOInvoice(qbo, collabMap) {
  const lineItems = (qbo.Line || [])
    .filter(l => l.DetailType === 'SalesItemLineDetail')
    .map(l => ({
      lineNum: l.LineNum,
      productService: l.SalesItemLineDetail?.ItemRef?.Name || '',
      description: l.Description || '',
      qty: l.SalesItemLineDetail?.Qty || 0,
      rate: l.SalesItemLineDetail?.UnitPrice || 0,
      amount: l.Amount || 0
    }));

  const privateNote = qbo.PrivateNote || '';
  const collaboratorId = matchCollaborator(privateNote, collabMap);

  // Custom fields: QBO stores them as CustomField[]
  const customFields = qbo.CustomField || [];
  const builderNumber = customFields.find(f => f.Name?.toLowerCase().includes('builder'))?.StringValue || '';
  const estado = customFields.find(f => f.Name?.toLowerCase() === 'estado')?.StringValue || '';

  // Billing company from BillAddr
  const billAddr = qbo.BillAddr || {};
  const billingCompany = billAddr.Line1 || '';

  const payFields = computeInvoicePayFields(lineItems);

  return {
    qboId: qbo.Id,
    docNumber: qbo.DocNumber || '',
    txnDate: qbo.TxnDate ? new Date(qbo.TxnDate) : null,
    dueDate: qbo.DueDate ? new Date(qbo.DueDate) : null,
    customerQboId: qbo.CustomerRef?.value || '',
    customerName: qbo.CustomerRef?.name || '',
    billingCompany,
    lineItems,
    totalAmount: qbo.TotalAmt || 0,
    balance: qbo.Balance || 0,
    builderNumber,
    estado,
    privateNote,
    collaborator: collaboratorId,
    collaboratorRaw: privateNote,
    ...payFields,
    syncedAt: new Date()
  };
}
