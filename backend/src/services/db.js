'use strict';
const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../../data/primeclean.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    phone      TEXT,
    service    TEXT,
    message    TEXT,
    source     TEXT DEFAULT 'form',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    messages   TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

function saveLead({ name, phone, service, message, source }) {
  return db.prepare(
    'INSERT INTO leads (name, phone, service, message, source) VALUES (?, ?, ?, ?, ?)'
  ).run(name, phone, service, message, source || 'form');
}

function saveSession(sessionId, messages) {
  return db.prepare(`
    INSERT INTO chat_sessions (session_id, messages, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(session_id) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at
  `).run(sessionId, JSON.stringify(messages));
}

function getSession(sessionId) {
  const row = db.prepare('SELECT messages FROM chat_sessions WHERE session_id = ?').get(sessionId);
  return row ? JSON.parse(row.messages) : [];
}

module.exports = { saveLead, saveSession, getSession };
