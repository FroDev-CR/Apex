import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { connectDatabase } from './config/database.js';
import { qboRoutes } from './routes/qbo.js';
import { invoiceRoutes } from './routes/invoices.js';
import { reportRoutes } from './routes/reports.js';
import { collaboratorRoutes } from './routes/collaborators.js';
import { paymentRoutes } from './routes/payments.js';
import { appSettingsRoutes } from './routes/appSettings.js';
import { startCronJobs } from './services/cronJobs.js';

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/qbo', qboRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/collaborators', collaboratorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', appSettingsRoutes);

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function fixIndexes() {
  try {
    const { Collaborator } = await import('./models/Collaborator.js');
    const col = Collaborator.collection;
    const indexes = await col.indexes();
    const emailIdx = indexes.find(i => i.key?.email !== undefined);
    if (emailIdx && !emailIdx.sparse) {
      await col.dropIndex('email_1');
      await col.createIndex({ email: 1 }, { unique: true, sparse: true });
      console.log('✅ Rebuilt email_1 index as sparse');
    }
  } catch (e) {
    console.warn('⚠️ Could not fix email index:', e.message);
  }
}

async function startServer() {
  try {
    await connectDatabase();
    await fixIndexes();
    app.listen(PORT, () => {
      console.log(`🚀 Apex backend running on port ${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
      console.log(`🔗 Connect QBO: http://localhost:${PORT}/api/qbo/connect`);
      startCronJobs();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

startServer();
