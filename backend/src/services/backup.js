'use strict';
const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');

const dataDir      = process.env.DATA_DIR || path.join(__dirname, '../../data');
const leadsFile    = path.join(dataDir, 'leads.json');
const expensesFile = path.join(dataDir, 'expenses.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

async function sendBackup() {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const leads    = readJSON(leadsFile);
  const expenses = readJSON(expensesFile);

  const date    = new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Minsk' });
  const newCount  = leads.filter(l => l.status === 'new').length;
  const doneCount = leads.filter(l => l.status === 'done').length;
  const revenue   = leads
    .filter(l => l.status === 'done' && parseFloat(l.actual_amount) > 0)
    .reduce((s, l) => s + parseFloat(l.actual_amount), 0);

  const caption = [
    `📦 PrimeClean backup ${date}`,
    `Заявок всего: ${leads.length}`,
    `  • новых: ${newCount}`,
    `  • выполнено: ${doneCount}`,
    revenue > 0 ? `Выручка (done): ${revenue.toFixed(2)} BYN` : null,
    `Расходов: ${expenses.length}`,
  ].filter(Boolean).join('\n');

  const payload = JSON.stringify({ leads, expenses }, null, 2);
  const fileName = `primeclean_backup_${date.replace(/\./g, '-')}.json`;

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('document', new Blob([payload], { type: 'application/json' }), fileName);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!data.ok) console.error('[backup] Telegram error:', data.description);
    else console.log('[backup] sent:', fileName);
  } catch (err) {
    console.error('[backup] fetch error:', err.message);
  }
}

// Каждый день в 21:00 UTC = 00:00 Minsk (UTC+3)
function startBackupCron() {
  cron.schedule('0 21 * * *', () => {
    sendBackup();
  }, { timezone: 'UTC' });
  console.log('[backup] cron scheduled — daily 00:00 Minsk');
}

module.exports = { startBackupCron, sendBackup };
