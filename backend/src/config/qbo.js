import axios from 'axios';
import mongoose from 'mongoose';

// ─── QBO OAuth constants ───────────────────────────────────────────────────
export const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
export const QBO_BASE_URL_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com/v3/company';
export const QBO_BASE_URL_PROD = 'https://quickbooks.api.intuit.com/v3/company';
export const QBO_SCOPES = 'com.intuit.quickbooks.accounting';

// ─── Token storage schema (persisted in MongoDB) ──────────────────────────
const tokenSchema = new mongoose.Schema({
  key: { type: String, default: 'qbo_tokens', unique: true },
  accessToken: String,
  refreshToken: String,
  realmId: String,
  accessTokenExpiresAt: Date,
  refreshTokenExpiresAt: Date,
  updatedAt: { type: Date, default: Date.now }
});

export const QBOToken = mongoose.model('QBOToken', tokenSchema);

// ─── Save tokens to DB ─────────────────────────────────────────────────────
export async function saveTokens({ accessToken, refreshToken, realmId, expiresIn, xRefreshTokenExpiresIn }) {
  const now = new Date();
  await QBOToken.findOneAndUpdate(
    { key: 'qbo_tokens' },
    {
      accessToken,
      refreshToken,
      realmId,
      accessTokenExpiresAt: new Date(now.getTime() + (expiresIn - 60) * 1000), // 1 min buffer
      refreshTokenExpiresAt: new Date(now.getTime() + (xRefreshTokenExpiresIn - 3600) * 1000),
      updatedAt: now
    },
    { upsert: true, new: true }
  );
  console.log('✅ QBO tokens saved');
}

// ─── Get valid access token (auto-refresh if needed) ──────────────────────
export async function getAccessToken() {
  const tokens = await QBOToken.findOne({ key: 'qbo_tokens' });
  if (!tokens) throw new Error('QBO not connected. Visit /api/qbo/connect to authorize.');

  const now = new Date();

  // Access token still valid
  if (tokens.accessTokenExpiresAt > now) {
    return { accessToken: tokens.accessToken, realmId: tokens.realmId };
  }

  // Refresh token expired
  if (tokens.refreshTokenExpiresAt <= now) {
    throw new Error('QBO refresh token expired. Re-authorize at /api/qbo/connect');
  }

  // Refresh the access token
  console.log('🔄 Refreshing QBO access token...');
  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    QBO_TOKEN_URL,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      }
    }
  );

  await saveTokens({ ...response.data, realmId: tokens.realmId });
  console.log('✅ QBO access token refreshed');
  return { accessToken: response.data.access_token, realmId: tokens.realmId };
}

// ─── QBO API client (authenticated axios instance) ────────────────────────
export async function qboRequest(path, params = {}) {
  const { accessToken, realmId } = await getAccessToken();
  const isSandbox = process.env.QBO_SANDBOX === 'true';
  const base = isSandbox ? QBO_BASE_URL_SANDBOX : QBO_BASE_URL_PROD;

  const response = await axios.get(`${base}/${realmId}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    },
    params: { minorversion: 70, ...params }
  });

  return response.data;
}

// ─── Check connection status ───────────────────────────────────────────────
export async function getConnectionStatus() {
  const tokens = await QBOToken.findOne({ key: 'qbo_tokens' });
  if (!tokens) return { connected: false };

  const now = new Date();
  return {
    connected: true,
    realmId: tokens.realmId,
    accessTokenValid: tokens.accessTokenExpiresAt > now,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    refreshTokenExpired: tokens.refreshTokenExpiresAt <= now,
    updatedAt: tokens.updatedAt
  };
}
