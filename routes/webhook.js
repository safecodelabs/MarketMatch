// routes/webhook.js
const express = require("express");
const router = express.Router();

// Fix: WhatsApp sometimes sends raw buffer -> convert to JSON
router.use((req, res, next) => {
  if (req.is("application/json") && Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString());
    } catch (err) {
      console.error("❌ JSON Parse Error:", err);
    }
  }
  next();
});

// Import bot
const { handleIncomingMessage } = require("../src/bots/whatsappBot");

/**
 * MAIN WEBHOOK (POST)
 */
router.post("/", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value || !value.messages) return res.sendStatus(200);

    const phoneNumberId = value.metadata?.phone_number_id;
    const message = value.messages[0];
    const sender = message.from;

    let text = "";

    if (message.type === "text") {
      text = message.text.body.trim();
    }

    if (message.type === "interactive") {
      const inter = message.interactive;
      if (inter.button_reply) text = inter.button_reply.id || inter.button_reply.title;
      if (inter.list_reply) text = inter.list_reply.id || inter.list_reply.title;
    }

    text = text.toLowerCase();

    await handleIncomingMessage({
      sender,
      text,
      phoneNumberId,
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    return res.sendStatus(500);
  }
});

module.exports = router;
