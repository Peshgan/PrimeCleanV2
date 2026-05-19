'use strict';
const fetch = require('node-fetch');

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

// System prompt — настраивается под PrimeClean
const SYSTEM_PROMPT = `Ты — AI-ассистент клининговой компании PrimeClean.
Твоя задача: помочь клиенту определить нужную услугу, уточнить объём работ и сообщить ориентировочную стоимость.
Отвечай кратко, дружелюбно, на русском языке.
Если клиент готов оставить заявку — попроси имя и номер телефона.`;

async function chat(messages) {
  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 400,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

module.exports = { chat };
