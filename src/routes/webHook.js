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
    const body = req.body;
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const sender = message.from;

      let msgText = '';

      if (message.type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
          msgText = interactive.button_reply.id;
        } else if (interactive.type === 'list_reply') {
          msgText = interactive.list_reply.id;
        }
      } else if (message.type === 'text') {
        msgText = message.text.body.trim().toLowerCase();
      }

      if (msgText) {
        await onMessageReceived(sender, msgText);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error processing message:", error);
    res.sendStatus(500);
  }
});

module.exports = router;
