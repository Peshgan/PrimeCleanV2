'use strict';
const express    = require('express');
const rateLimit  = require('express-rate-limit');
const {
  getLeads, updateLead, deleteLead, getStats, getSessions, getAbuseLog,
  saveExpense, updateExpense, deleteExpense, getExpenses, getRevenue,
} = require('../services/db');

const router = express.Router();

// 5 failed login attempts per IP per 15 minutes
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many login attempts. Try again in 15 minutes.' },
});

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

router.post('/login', loginLimit, (req, res) => {
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
  const { status, notes, name, phone, service, message, service_date, service_time, agent_amount, actual_amount } = req.body || {};
  try {
    const updated = updateLead(id, { status, notes, name, phone, service, message, service_date, service_time, agent_amount, actual_amount });
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

// ── GET /api/admin/sessions ───────────────────────────────────────────────────

router.get('/sessions', requireAuth, (req, res) => {
  const { dateFrom, dateTo, converted, search } = req.query;
  try {
    const sessions = getSessions({ dateFrom, dateTo, converted, search });
    const total          = sessions.length;
    const convertedCount = sessions.filter(s => s.is_converted).length;
    const convRate       = total ? Math.round(convertedCount / total * 100) : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = sessions.filter(s => new Date(s.updated_at) >= today).length;

    res.json({ ok: true, sessions, total, convertedCount, convRate, todayCount });
  } catch (err) {
    console.error('[admin/sessions]', err.message);
    res.status(500).json({ error: 'Could not fetch sessions' });
  }
});

// ── GET /api/admin/abuse ──────────────────────────────────────────────────────

router.get('/abuse', requireAuth, (req, res) => {
  const { dateFrom, dateTo, ip } = req.query;
  try {
    const result = getAbuseLog({ dateFrom, dateTo, ip });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/abuse]', err.message);
    res.status(500).json({ error: 'Could not fetch abuse log' });
  }
});

// ── GET /api/admin/expenses ───────────────────────────────────────────────────

router.get('/expenses', requireAuth, (req, res) => {
  const { dateFrom, dateTo, category } = req.query;
  try {
    const result = getExpenses({ dateFrom, dateTo, category });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[admin/expenses GET]', err.message);
    res.status(500).json({ error: 'Could not fetch expenses' });
  }
});

// ── POST /api/admin/expenses ──────────────────────────────────────────────────

router.post('/expenses', requireAuth, (req, res) => {
  const { category, description, amount, date } = req.body || {};
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be > 0' });
  }
  try {
    const expense = saveExpense({ category, description, amount, date });
    res.json({ ok: true, expense });
  } catch (err) {
    console.error('[admin/expenses POST]', err.message);
    res.status(500).json({ error: 'Could not save expense' });
  }
});

// ── PUT /api/admin/expenses/:id ───────────────────────────────────────────────

router.put('/expenses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { category, description, amount, date } = req.body || {};
  try {
    const updated = updateExpense(id, { category, description, amount, date });
    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    res.json({ ok: true, expense: updated });
  } catch (err) {
    console.error('[admin/expenses PUT]', err.message);
    res.status(500).json({ error: 'Could not update expense' });
  }
});

// ── DELETE /api/admin/expenses/:id ───────────────────────────────────────────

router.delete('/expenses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  try {
    const deleted = deleteExpense(id);
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/expenses DELETE]', err.message);
    res.status(500).json({ error: 'Could not delete expense' });
  }
});

// ── GET /api/admin/revenue ────────────────────────────────────────────────────

router.get('/revenue', requireAuth, (req, res) => {
  const { dateFrom, dateTo } = req.query;
  try {
    const revenue  = getRevenue({ dateFrom, dateTo });
    const expenses = getExpenses({ dateFrom, dateTo });

    // Build expenses daily breakdown
    const expDailyMap = {};
    for (const e of expenses.expenses) {
      const d = e.date;
      if (!expDailyMap[d]) expDailyMap[d] = { date: d, amount: 0, count: 0 };
      expDailyMap[d].amount += parseFloat(e.amount) || 0;
      expDailyMap[d].count++;
    }
    const expDaily = Object.values(expDailyMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      ok: true,
      revenue: { ...revenue, daily: revenue.daily },
      expenses: { total: expenses.total, count: expenses.count, daily: expDaily },
    });
  } catch (err) {
    console.error('[admin/revenue]', err.message);
    res.status(500).json({ error: 'Could not fetch revenue' });
  }
});

module.exports = router;
