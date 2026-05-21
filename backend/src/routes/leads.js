'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const { saveLead, logAbuse }   = require('../services/db');
const { notifyLead }           = require('../services/telegram');
const { containsProfanity }    = require('../services/profanity');

const router = express.Router();

// 5 leads per IP per 10 minutes (anti-spam)
const leadsLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

router.post('/', leadsLimit, async (req, res) => {
  const { name, phone, service, message, source } = req.body;
  if (!phone || typeof phone !== 'string' || phone.length < 7) {
    return res.status(400).json({ error: 'valid phone required' });
  }

  const ip = getClientIP(req);

  // Log abuse if profanity found in form message or name fields
  const textToCheck = [name, message].filter(Boolean).join(' ');
  if (containsProfanity(textToCheck)) {
    logAbuse({ ip, session_id: null, source: 'form', message_preview: textToCheck });
  }

  try {
    saveLead({ name, phone, service, message, source, ip });
    await notifyLead({ name, phone, service, message, source });
    res.json({ ok: true });
  } catch (err) {
    console.error('[leads]', err.message);
    res.status(500).json({ error: 'Could not save lead' });
  }
});

module.exports = router;
