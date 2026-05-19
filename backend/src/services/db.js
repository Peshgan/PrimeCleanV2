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

function saveLead({ name, phone, service, message, source }) {
  const leads = readJSON(leadsFile);
  const lead = { id: Date.now(), name, phone, service, message, source: source || 'form', created_at: new Date().toISOString() };
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

module.exports = { saveLead, saveSession, getSession };
