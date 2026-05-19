'use strict';
const fetch = require('node-fetch');

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendMessage(text, chatId) {
  const target = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!target || !process.env.TELEGRAM_BOT_TOKEN) return;

  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: target, text, parse_mode: 'HTML' }),
  });
}

async function notifyLead({ name, phone, service, message, source }) {
  const text =
    `<b>Новая заявка PrimeClean</b>\n` +
    `Источник: ${source || 'form'}\n` +
    `Имя: ${name || '—'}\n` +
    `Телефон: ${phone || '—'}\n` +
    `Услуга: ${service || '—'}\n` +
    `Сообщение: ${message || '—'}`;
  return sendMessage(text);
}

module.exports = { sendMessage, notifyLead };
