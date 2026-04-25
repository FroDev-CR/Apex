import { Router } from 'express';
import axios from 'axios';
import {
  QBO_AUTH_URL, QBO_TOKEN_URL, QBO_SCOPES,
  saveTokens, getConnectionStatus, QBOToken
} from '../config/qbo.js';
import { syncQBOInvoices } from '../services/qboSync.js';

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
qboRoutes.post('/sync', async (req, res) => {
  try {
    const result = await syncQBOInvoices();
    res.json({ success: true, ...result, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('❌ QBO sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Debug: raw custom fields from latest QBO invoices ────────────────────
qboRoutes.get('/debug-fields', async (req, res) => {
  try {
    const { qboRequest } = await import('../config/qbo.js');
    const data = await qboRequest('/query', {
      query: 'SELECT * FROM Invoice ORDERBY TxnDate DESC STARTPOSITION 1 MAXRESULTS 10'
    });
    const invoices = data.QueryResponse?.Invoice || [];
    const result = invoices.map(inv => ({
      docNumber: inv.DocNumber,
      txnDate: inv.TxnDate,
      customFields: inv.CustomField || [],
      privateNote: inv.PrivateNote || ''
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

