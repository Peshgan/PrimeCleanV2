'use strict';
const express = require('express');
const { chat }                     = require('../services/ai');
const { saveSession, getSession }  = require('../services/db');

const router = express.Router();

router.post('/', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || !sessionId) return res.status(400).json({ error: 'message and sessionId required' });

  try {
    const history = getSession(sessionId);
    history.push({ role: 'user', content: message });

    const reply = await chat(history);
    history.push({ role: 'assistant', content: reply });

    saveSession(sessionId, history);
    res.json({ reply });
  } catch (err) {
    console.error('[chat]', err.message);
    res.status(500).json({ error: 'AI unavailable' });
  }
});

module.exports = router;
