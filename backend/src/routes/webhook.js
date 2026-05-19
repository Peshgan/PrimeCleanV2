'use strict';
const express = require('express');

const router = express.Router();

// Telegram webhook — placeholder, настроим после подключения бота
router.post('/', (req, res) => {
  const update = req.body;
  console.log('[telegram webhook]', JSON.stringify(update));
  res.sendStatus(200);
});

module.exports = router;
