'use strict';
const fs   = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

const leadsFile    = path.join(dataDir, 'leads.json');
const sessionsFile = path.join(dataDir, 'sessions.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── Existing functions ────────────────────────────────────────────────────────

function saveLead({ name, phone, service, message, source }) {
  const leads = readJSON(leadsFile);
  const lead = {
    id: Date.now(),
    name,
    phone,
    service,
    message,
    source: source || 'website-form',
    status: 'new',
    notes: '',
    created_at: new Date().toISOString(),
  };
  leads.push(lead);
  writeJSON(leadsFile, leads);
  return lead;
}

function saveSession(sessionId, messages) {
  const sessions = readJSON(sessionsFile);
  const idx = sessions.findIndex(s => s.session_id === sessionId);
  const entry = { session_id: sessionId, messages, updated_at: new Date().toISOString() };
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
 * @param {object} opts
 * @param {string} [opts.search]   — matches name or phone (case-insensitive)
 * @param {string} [opts.service]  — exact service filter
 * @param {string} [opts.source]   — exact source filter
 * @param {string} [opts.status]   — 'new'|'in_progress'|'done'|'cancelled'
 * @param {string} [opts.dateFrom] — ISO date string, inclusive
 * @param {string} [opts.dateTo]   — ISO date string, inclusive (end of day)
 */
function getLeads({ search, service, source, status, dateFrom, dateTo } = {}) {
  let leads = readJSON(leadsFile);

  // Ensure every lead has status/notes fields (migration for old records)
  leads = leads.map(l => ({
    status: 'new',
    notes: '',
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
    // inclusive: treat dateTo as end of that day
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    leads = leads.filter(l => new Date(l.created_at) <= to);
  }

  // Sort newest first
  leads.sort((a, b) => b.id - a.id);
  return leads;
}

/**
 * updateLead — update status and/or notes for a lead by id.
 * @param {number|string} id
 * @param {object} fields  — { status?, notes? }
 * @returns {object|null}  — updated lead or null if not found
 */
function updateLead(id, { status, notes } = {}) {
  const leads = readJSON(leadsFile);
  const numId = Number(id);
  const idx = leads.findIndex(l => l.id === numId);
  if (idx === -1) return null;

  const VALID_STATUSES = ['new', 'in_progress', 'done', 'cancelled'];
  if (status !== undefined && VALID_STATUSES.includes(status)) {
    leads[idx].status = status;
  }
  if (notes !== undefined) {
    leads[idx].notes = String(notes);
  }
  leads[idx].updated_at = new Date().toISOString();

  writeJSON(leadsFile, leads);
  return leads[idx];
}

/**
 * deleteLead — remove a lead by id.
 * @param {number|string} id
 * @returns {boolean} — true if deleted, false if not found
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
 * @returns {object}
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

  // Daily counts — last 14 days (index 0 = 13 days ago, index 13 = today)
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

module.exports = { saveLead, saveSession, getSession, getLeads, updateLead, deleteLead, getStats };
