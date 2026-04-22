import { sendDailyReport } from './emailService.js';
import { syncQBOInvoices } from './qboSync.js';
import { getSettings } from '../models/AppSettings.js';

let _interval = null;
const fired = new Set();

function minuteKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

async function tick() {
  const now    = new Date();
  const key    = minuteKey(now);
  if (fired.has(key)) return;

  const hour   = now.getHours();
  const minute = now.getMinutes();
  const dow    = now.getDay();
  const dom    = now.getDate();

  // ── Midnight QBO sync ────────────────────────────────────────────────────
  if (hour === 0 && minute === 0) {
    fired.add(key);
    console.log('⏰ [cron] Midnight QBO sync starting...');
    try {
      const result = await syncQBOInvoices();
      console.log(`✅ [cron] Midnight sync done — ${result.inserted} new, ${result.updated} updated`);
    } catch (err) {
      console.error('❌ [cron] Midnight sync error:', err.message);
    }
    if (fired.size > 100) fired.clear();
    return;
  }

  // ── Scheduled email report ───────────────────────────────────────────────
  try {
    const s = await getSettings();
    const targetHour = s.reportHour ?? Number(process.env.REPORT_HOUR ?? 8);

    if (hour !== targetHour || minute !== 0) return;

    let shouldSend = false;
    switch (s.reportFrequency) {
      case 'daily':   shouldSend = true; break;
      case 'weekly':  shouldSend = dow === (s.reportDayOfWeek ?? 1); break;
      case 'monthly': shouldSend = dom === (s.reportDayOfMonth ?? 1); break;
    }

    if (shouldSend && s.reportEmails?.length > 0) {
      fired.add(key);
      console.log(`⏰ [cron] Enviando reporte (${s.reportFrequency}) a ${s.reportEmails.join(', ')}`);
      await sendDailyReport();
      if (fired.size > 100) fired.clear();
    }
  } catch (err) {
    console.error('❌ [cron] Error:', err.message);
  }
}

export function startCronJobs() {
  if (_interval) return;
  _interval = setInterval(tick, 60_000);
  console.log('⏰ Cron jobs iniciados (midnight QBO sync + email reports)');
}
