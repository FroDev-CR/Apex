import { sendDailyReport } from './emailService.js';
import { getSettings } from '../models/AppSettings.js';

let _interval = null;
const fired = new Set(); // prevent double-firing in same minute

function minuteKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

async function tick() {
  const now  = new Date();
  const key  = minuteKey(now);
  if (fired.has(key)) return;

  try {
    const s = await getSettings();
    const hour   = now.getHours();
    const minute = now.getMinutes();
    const dow    = now.getDay();    // 0=Sun
    const dom    = now.getDate();   // 1-31

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
      // keep Set small
      if (fired.size > 100) fired.clear();
    }
  } catch (err) {
    console.error('❌ [cron] Error:', err.message);
  }
}

export function startCronJobs() {
  if (_interval) return;
  _interval = setInterval(tick, 60_000);
  console.log('⏰ Cron jobs iniciados');
}
