'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const { chat }  = require('../services/ai');
const { saveSession, logAbuse } = require('../services/db');
const { containsProfanity }     = require('../services/profanity');

const router = express.Router();

// 20 AI requests per IP per minute
const chatLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

router.post('/', chatLimit, async (req, res) => {
  const { messages, sessionId } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  if (messages.length > 40) {
    return res.status(400).json({ error: 'conversation too long' });
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || typeof last.content !== 'string') {
    return res.status(400).json({ error: 'last message must be from user' });
  }
  if (last.content.trim().length === 0 || last.content.length > 2000) {
    return res.status(400).json({ error: 'message length invalid' });
  }

  const ip = getClientIP(req);

  // Log profanity/abuse in user messages
  if (containsProfanity(last.content)) {
    logAbuse({
      ip,
      session_id:      sessionId || null,
      source:          'chat',
      message_preview: last.content,
    });
  }

  try {
    const reply = await chat(messages);

    // Persist session with IP after successful reply
    if (sessionId && typeof sessionId === 'string' && sessionId.length <= 64) {
      const fullHistory = [...messages, { role: 'assistant', content: reply }];
      saveSession(sessionId, fullHistory, ip);
    }

    res.json({ reply });
  } catch (err) {
    console.error('[chat]', err.message);
    res.status(500).json({ error: 'AI unavailable' });
  }
});

module.exports = router;
