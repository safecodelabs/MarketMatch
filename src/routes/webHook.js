const express = require('express');
const router = express.Router();
const { onMessageReceived } = require('../bots/whatsappBot');

// ✅ Meta verification (GET)
router.get('/', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'your_verify_token';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ✅ Incoming messages (POST)
router.post('/', async (req, res) => {
  try {
    await onMessageReceived(req.body); // or req.body.entry[0].changes[0] depending on structure
    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error processing message:", error);
    res.sendStatus(500);
  }
});

module.exports = router;
