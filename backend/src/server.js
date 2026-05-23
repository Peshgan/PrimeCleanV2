'use strict';
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const chatRoutes    = require('./routes/chat');
const leadsRoutes   = require('./routes/leads');
const webhookRoutes = require('./routes/webhook');
const adminRoutes   = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Gzip all responses ──
app.use(compression());

// ── Security: trust proxy for Railway/Vercel ──
app.set('trust proxy', 1);

// ── CORS ──
const explicitOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : [];

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin), local dev, any *.vercel.app preview, and explicit origins
    if (!origin) return cb(null, true);
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.')) return cb(null, true);
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    // primeclean.бел — unicode and punycode forms
    if (origin.endsWith('.бел') || origin.endsWith('.xn--90ae')) return cb(null, true);
    if (explicitOrigins.length === 0 || explicitOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
}));

// ── JSON body ──
app.use(express.json({ limit: '32kb' }));

// ── Serve admin static files ──
app.use(express.static(path.join(__dirname, '../public')));

// ── Global rate limit (broad abuse protection) ──
app.use(rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
}));

// ── Routes ──
app.use('/api/chat',     chatRoutes);
app.use('/api/leads',    leadsRoutes);
app.use('/api/telegram', webhookRoutes);
app.use('/api/admin',    adminRoutes);

// ── Admin panel HTML ──
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 ──
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ──
app.use((err, _req, res, _next) => {
  console.error('[server error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`[PrimeClean API] running on port ${PORT}`));
