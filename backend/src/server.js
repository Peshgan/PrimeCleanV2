'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const chatRoutes    = require('./routes/chat');
const leadsRoutes   = require('./routes/leads');
const webhookRoutes = require('./routes/webhook');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/chat',    chatRoutes);
app.use('/api/leads',   leadsRoutes);
app.use('/api/telegram', webhookRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`[PrimeClean API] running on port ${PORT}`));
