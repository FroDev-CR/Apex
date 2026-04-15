import { sendDailyReport } from './emailService.js';
import { ExternalPayment } from '../models/ExternalPayment.js';

// Simple cron-like scheduler without external dependencies
// Checks every minute if any job needs to run

let _interval = null;

function pad(n) { return String(n).padStart(2, '0'); }

async function tick() {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const hour       = now.getHours();
  const minute     = now.getMinutes();

  // ── Daily email report (8:00 AM by default, configurable via REPORT_HOUR) ──
  const reportHour   = Number(process.env.REPORT_HOUR   || 8);
  const reportMinute = Number(process.env.REPORT_MINUTE || 0);
  if (hour === reportHour && minute === reportMinute) {
    console.log(`⏰ [cron] Enviando reporte diario (${pad(hour)}:${pad(minute)})`);
    await sendDailyReport();
  }

  // ── Recurring external payments ──
  try {
    const recurring = await ExternalPayment.find({ isRecurring: true, active: true });
    for (const ep of recurring) {
      if (
        ep.schedule?.dayOfMonth === dayOfMonth &&
        ep.schedule?.hour       === hour &&
        ep.schedule?.minute     === minute
      ) {
        console.log(`⏰ [cron] Pago recurrente activado: ${ep.name} — $${ep.amount}`);
        // The payment is already in the DB and will appear in reports automatically.
        // Nothing else needed — it's a standing record, not a one-time entry.
      }
    }
  } catch (err) {
    console.error('❌ [cron] Error en pagos recurrentes:', err.message);
  }
}

export function startCronJobs() {
  if (_interval) return;
  _interval = setInterval(tick, 60_000); // every minute
  console.log('⏰ Cron jobs iniciados (cada minuto)');
}
