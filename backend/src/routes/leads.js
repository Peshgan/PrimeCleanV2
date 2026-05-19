'use strict';
const express  = require('express');
const { saveLead }     = require('../services/db');
const { notifyLead }   = require('../services/telegram');

const router = express.Router();

router.post('/', async (req, res) => {
  const { name, phone, service, message, source } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    saveLead({ name, phone, service, message, source });
    await notifyLead({ name, phone, service, message, source });
    res.json({ ok: true });
  } catch (err) {
    console.error('[leads]', err.message);
    res.status(500).json({ error: 'Could not save lead' });
  }
});

module.exports = router;
