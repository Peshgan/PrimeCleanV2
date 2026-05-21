'use strict';
const fs   = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

const leadsFile    = path.join(dataDir, 'leads.json');
const sessionsFile = path.join(dataDir, 'sessions.json');
const abuseFile    = path.join(dataDir, 'abuse.json');
const expensesFile = path.join(dataDir, 'expenses.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── Existing functions ────────────────────────────────────────────────────────

function saveLead({ name, phone, service, message, source, ip, service_date, service_time, agent_amount }) {
  const leads = readJSON(leadsFile);
  const lead = {
    id: Date.now(),
    name,
    phone,
    service,
    message,
    source: source || 'website-form',
    ip: ip || null,
    status: 'new',
    notes: '',
    service_date: service_date || null,
    service_time: service_time || null,
    agent_amount: agent_amount || null,
    actual_amount: null,
    closed_at: null,
    created_at: new Date().toISOString(),
  };
  leads.push(lead);
  writeJSON(leadsFile, leads);
  return lead;
}

function saveSession(sessionId, messages, ip = null) {
  const sessions = readJSON(sessionsFile);
  const idx      = sessions.findIndex(s => s.session_id === sessionId);
  const existing = idx >= 0 ? sessions[idx] : {};
  const entry = {
    ...existing,
    session_id:  sessionId,
    messages,
    ip:          ip || existing.ip || null,
    updated_at:  new Date().toISOString(),
    created_at:  existing.created_at || new Date().toISOString(),
  };
  if (idx >= 0) sessions[idx] = entry; else sessions.push(entry);
  writeJSON(sessionsFile, sessions);
}

function getSession(sessionId) {
  const sessions = readJSON(sessionsFile);
  const row = sessions.find(s => s.session_id === sessionId);
  return row ? row.messages : [];
}

// ── Admin functions ───────────────────────────────────────────────────────────

/**
 * getLeads — returns leads array sorted newest first, with optional filtering.
 */
function getLeads({ search, service, source, status, dateFrom, dateTo } = {}) {
  let leads = readJSON(leadsFile);

  // Ensure every lead has required fields (migration for old records)
  leads = leads.map(l => ({
    status: 'new',
    notes: '',
    service_date: null,
    service_time: null,
    agent_amount: null,
    actual_amount: null,
    closed_at: null,
    ...l,
  }));

  if (search) {
    const q = search.toLowerCase();
    leads = leads.filter(l =>
      (l.name  && l.name.toLowerCase().includes(q)) ||
      (l.phone && l.phone.toLowerCase().includes(q))
    );
  }

  if (service) {
    leads = leads.filter(l => l.service === service);
  }

  if (source) {
    leads = leads.filter(l => l.source === source);
  }

  if (status) {
    leads = leads.filter(l => l.status === status);
  }

  if (dateFrom) {
    const from = new Date(dateFrom);
    leads = leads.filter(l => new Date(l.created_at) >= from);
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    leads = leads.filter(l => new Date(l.created_at) <= to);
  }

  // Sort newest first
  leads.sort((a, b) => b.id - a.id);
  return leads;
}

/**
 * updateLead — update all editable fields for a lead by id.
 * When status changes to 'done', set closed_at (only if not already set).
 * When status changes away from 'done', keep closed_at (history).
 */
function updateLead(id, fields = {}) {
  const leads = readJSON(leadsFile);
  const numId = Number(id);
  const idx = leads.findIndex(l => l.id === numId);
  if (idx === -1) return null;

  const { status, notes, name, phone, service, message, service_date, service_time, agent_amount, actual_amount } = fields;

  const VALID_STATUSES = ['new', 'in_progress', 'done', 'cancelled'];

  if (status !== undefined && VALID_STATUSES.includes(status)) {
    const prev = leads[idx].status;
    leads[idx].status = status;
    // Set closed_at only when transitioning TO done for the first time
    if (status === 'done' && !leads[idx].closed_at) {
      leads[idx].closed_at = new Date().toISOString();
    }
  }
  if (notes !== undefined) {
    leads[idx].notes = String(notes);
  }
  if (name !== undefined) {
    leads[idx].name = String(name);
  }
  if (phone !== undefined) {
    leads[idx].phone = String(phone);
  }
  if (service !== undefined) {
    leads[idx].service = String(service);
  }
  if (message !== undefined) {
    leads[idx].message = String(message);
  }
  if (service_date !== undefined) {
    leads[idx].service_date = service_date || null;
  }
  if (service_time !== undefined) {
    leads[idx].service_time = service_time || null;
  }
  if (agent_amount !== undefined) {
    leads[idx].agent_amount = agent_amount || null;
  }
  if (actual_amount !== undefined) {
    leads[idx].actual_amount = actual_amount === '' || actual_amount === null ? null : parseFloat(actual_amount) || 0;
  }

  leads[idx].updated_at = new Date().toISOString();

  writeJSON(leadsFile, leads);
  return leads[idx];
}

/**
 * deleteLead — remove a lead by id.
 */
function deleteLead(id) {
  const leads = readJSON(leadsFile);
  const numId = Number(id);
  const idx = leads.findIndex(l => l.id === numId);
  if (idx === -1) return false;
  leads.splice(idx, 1);
  writeJSON(leadsFile, leads);
  return true;
}

/**
 * getStats — aggregate stats across all leads.
 */
function getStats() {
  const allLeads = readJSON(leadsFile).map(l => ({
    status: 'new',
    notes: '',
    ...l,
  }));

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(today); week.setDate(today.getDate() - 6);
  const month = new Date(today); month.setDate(today.getDate() - 29);

  const total = allLeads.length;
  const todayCount = allLeads.filter(l => new Date(l.created_at) >= today).length;
  const weekCount  = allLeads.filter(l => new Date(l.created_at) >= week).length;
  const monthCount = allLeads.filter(l => new Date(l.created_at) >= month).length;

  // By source
  const bySource = {};
  for (const l of allLeads) {
    const src = l.source || 'website-form';
    bySource[src] = (bySource[src] || 0) + 1;
  }

  // By status
  const byStatus = { new: 0, in_progress: 0, done: 0, cancelled: 0 };
  for (const l of allLeads) {
    const st = l.status || 'new';
    if (byStatus[st] !== undefined) byStatus[st]++;
  }

  // Top services (top 5)
  const svcMap = {};
  for (const l of allLeads) {
    if (l.service) svcMap[l.service] = (svcMap[l.service] || 0) + 1;
  }
  const topServices = Object.entries(svcMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: total ? Math.round(count / total * 100) : 0 }));

  // Daily counts — last 14 days
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(today); dayStart.setDate(today.getDate() - i);
    const dayEnd   = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
    const count    = allLeads.filter(l => {
      const d = new Date(l.created_at);
      return d >= dayStart && d < dayEnd;
    }).length;
    daily.push({
      date: dayStart.toISOString().slice(0, 10),
      count,
    });
  }

  return { total, today: todayCount, week: weekCount, month: monthCount, bySource, byStatus, topServices, daily };
}

/**
 * logAbuse — record a profanity/abuse event.
 */
function logAbuse({ ip, session_id, source, message_preview }) {
  const log = readJSON(abuseFile);
  log.push({
    id:              Date.now(),
    ip:              ip || 'unknown',
    session_id:      session_id || null,
    source:          source || 'chat',
    message_preview: String(message_preview || '').slice(0, 200),
    detected_at:     new Date().toISOString(),
  });
  writeJSON(abuseFile, log);
}

/**
 * getAbuseLog — returns abuse events, newest first, with per-IP summary.
 */
function getAbuseLog({ dateFrom, dateTo, ip } = {}) {
  let events = readJSON(abuseFile);

  if (dateFrom) {
    const from = new Date(dateFrom);
    events = events.filter(e => new Date(e.detected_at) >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    events = events.filter(e => new Date(e.detected_at) <= to);
  }
  if (ip) {
    events = events.filter(e => e.ip === ip);
  }

  events.sort((a, b) => b.id - a.id);

  // Build per-IP summary
  const ipMap = {};
  for (const e of events) {
    if (!ipMap[e.ip]) {
      ipMap[e.ip] = { ip: e.ip, count: 0, first_seen: e.detected_at, last_seen: e.detected_at, sources: new Set(), events: [] };
    }
    const rec = ipMap[e.ip];
    rec.count++;
    if (e.detected_at < rec.first_seen) rec.first_seen = e.detected_at;
    if (e.detected_at > rec.last_seen)  rec.last_seen  = e.detected_at;
    rec.sources.add(e.source);
    rec.events.push(e);
  }

  const byIP = Object.values(ipMap)
    .map(r => ({ ...r, sources: [...r.sources] }))
    .sort((a, b) => b.count - a.count);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = events.filter(e => new Date(e.detected_at) >= today).length;

  return {
    events,
    byIP,
    total:       events.length,
    uniqueIPs:   byIP.length,
    todayCount,
  };
}

/**
 * getSessions — returns all AI chat sessions with metadata, newest first.
 */
function getSessions({ dateFrom, dateTo, converted, search } = {}) {
  let sessions = readJSON(sessionsFile);

  sessions = sessions.map(s => {
    const msgs     = Array.isArray(s.messages) ? s.messages : [];
    const userMsgs = msgs.filter(m => m.role === 'user');
    const asstMsgs = msgs.filter(m => m.role === 'assistant');
    const isConverted = asstMsgs.some(m => typeof m.content === 'string' && m.content.includes('[FORM:'));

    let formData = null;
    for (const m of asstMsgs) {
      const match = typeof m.content === 'string' && m.content.match(/\[FORM:([^\]]+)\]/);
      if (match) {
        const [name, phone, service, comment] = match[1].split('|');
        formData = { name, phone, service, comment };
        break;
      }
    }

    return {
      session_id:        s.session_id,
      updated_at:        s.updated_at,
      message_count:     msgs.length,
      user_message_count: userMsgs.length,
      is_converted:      isConverted,
      form_data:         formData,
      first_message:     (userMsgs[0]?.content || '').slice(0, 120),
      messages:          msgs,
    };
  });

  if (search) {
    const q = search.toLowerCase();
    sessions = sessions.filter(s => s.first_message.toLowerCase().includes(q));
  }

  if (dateFrom) {
    const from = new Date(dateFrom);
    sessions = sessions.filter(s => new Date(s.updated_at) >= from);
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    sessions = sessions.filter(s => new Date(s.updated_at) <= to);
  }

  if (converted === 'true')  sessions = sessions.filter(s => s.is_converted);
  if (converted === 'false') sessions = sessions.filter(s => !s.is_converted);

  sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return sessions;
}

// ── Expenses functions ────────────────────────────────────────────────────────

/**
 * saveExpense — create a new expense record.
 */
function saveExpense({ category, description, amount, date }) {
  const expenses = readJSON(expensesFile);
  const expense = {
    id: Date.now(),
    category: category || 'Прочее',
    description: description || '',
    amount: parseFloat(amount) || 0,
    date: date || new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  };
  expenses.push(expense);
  writeJSON(expensesFile, expenses);
  return expense;
}

/**
 * updateExpense — update fields of an expense by id.
 */
function updateExpense(id, { category, description, amount, date } = {}) {
  const expenses = readJSON(expensesFile);
  const numId = Number(id);
  const idx = expenses.findIndex(e => e.id === numId);
  if (idx === -1) return null;

  if (category !== undefined)    expenses[idx].category    = category;
  if (description !== undefined) expenses[idx].description = description;
  if (amount !== undefined)      expenses[idx].amount      = parseFloat(amount) || 0;
  if (date !== undefined)        expenses[idx].date        = date;
  expenses[idx].updated_at = new Date().toISOString();

  writeJSON(expensesFile, expenses);
  return expenses[idx];
}

/**
 * deleteExpense — remove an expense by id.
 */
function deleteExpense(id) {
  const expenses = readJSON(expensesFile);
  const numId = Number(id);
  const idx = expenses.findIndex(e => e.id === numId);
  if (idx === -1) return false;
  expenses.splice(idx, 1);
  writeJSON(expensesFile, expenses);
  return true;
}

/**
 * getExpenses — returns filtered expenses sorted newest first.
 */
function getExpenses({ dateFrom, dateTo, category } = {}) {
  let expenses = readJSON(expensesFile);

  if (dateFrom) {
    expenses = expenses.filter(e => e.date >= dateFrom);
  }
  if (dateTo) {
    expenses = expenses.filter(e => e.date <= dateTo);
  }
  if (category) {
    expenses = expenses.filter(e => e.category === category);
  }

  expenses.sort((a, b) => b.id - a.id);

  const total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  return { expenses, total, count: expenses.length };
}

/**
 * getRevenue — aggregate revenue from done leads with actual_amount > 0.
 */
function getRevenue({ dateFrom, dateTo } = {}) {
  let leads = readJSON(leadsFile).map(l => ({
    status: 'new',
    actual_amount: null,
    service_date: null,
    closed_at: null,
    created_at: l.created_at,
    ...l,
  }));

  // Only done leads with actual_amount > 0
  leads = leads.filter(l => l.status === 'done' && parseFloat(l.actual_amount) > 0);

  // Determine revenue date per lead
  leads = leads.map(l => ({
    ...l,
    _rev_date: l.service_date
      ? l.service_date
      : l.closed_at
        ? l.closed_at.slice(0, 10)
        : l.created_at.slice(0, 10),
  }));

  if (dateFrom) {
    leads = leads.filter(l => l._rev_date >= dateFrom);
  }
  if (dateTo) {
    leads = leads.filter(l => l._rev_date <= dateTo);
  }

  const total = leads.reduce((s, l) => s + (parseFloat(l.actual_amount) || 0), 0);
  const count = leads.length;
  const avgOrder = count > 0 ? total / count : 0;

  // Daily breakdown
  const dailyMap = {};
  for (const l of leads) {
    const d = l._rev_date;
    if (!dailyMap[d]) dailyMap[d] = { date: d, amount: 0, count: 0 };
    dailyMap[d].amount += parseFloat(l.actual_amount) || 0;
    dailyMap[d].count++;
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  return { leads, total, count, avgOrder, daily };
}

module.exports = {
  saveLead,
  saveSession,
  getSession,
  getLeads,
  updateLead,
  deleteLead,
  getStats,
  getSessions,
  logAbuse,
  getAbuseLog,
  saveExpense,
  updateExpense,
  deleteExpense,
  getExpenses,
  getRevenue,
};
