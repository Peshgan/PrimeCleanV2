'use strict';
const express = require('express');
const { getLeads, updateLead, deleteLead, getStats } = require('../services/db');

const router = express.Router();

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return res.status(503).json({ error: 'ADMIN_TOKEN not configured on server' });
  }
  if (!token || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return res.status(503).json({ error: 'ADMIN_TOKEN not configured on server' });
  }
  if (!password || password !== expected) {
    return res.status(401).json({ ok: false, error: 'Wrong password' });
  }
  res.json({ ok: true, token: expected });
});

// ── GET /api/admin/leads ──────────────────────────────────────────────────────

router.get('/leads', requireAuth, (req, res) => {
  const { search, service, source, status, dateFrom, dateTo } = req.query;
  try {
    const leads = getLeads({ search, service, source, status, dateFrom, dateTo });
    res.json({ ok: true, leads, total: leads.length });
  } catch (err) {
    console.error('[admin/leads GET]', err.message);
    res.status(500).json({ error: 'Could not fetch leads' });
  }
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────

router.get('/stats', requireAuth, (req, res) => {
  try {
    const stats = getStats();
    res.json({ ok: true, stats });
  } catch (err) {
    console.error('[admin/stats]', err.message);
    res.status(500).json({ error: 'Could not fetch stats' });
  }
});

// ── PUT /api/admin/leads/:id ──────────────────────────────────────────────────

router.put('/leads/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body || {};
  try {
    const updated = updateLead(id, { status, notes });
    if (!updated) return res.status(404).json({ error: 'Lead not found' });
    res.json({ ok: true, lead: updated });
  } catch (err) {
    console.error('[admin/leads PUT]', err.message);
    res.status(500).json({ error: 'Could not update lead' });
  }
});

// ── DELETE /api/admin/leads/:id ───────────────────────────────────────────────

router.delete('/leads/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  try {
    const deleted = deleteLead(id);
    if (!deleted) return res.status(404).json({ error: 'Lead not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/leads DELETE]', err.message);
    res.status(500).json({ error: 'Could not delete lead' });
  }
});

module.exports = router;
