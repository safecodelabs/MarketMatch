// routes/webhook.js
const express = require("express");
const router = express.Router();

// Correct paths according to your project structure
const { handleIncomingMessage } = require("../src/bots/whatsappBot");
const { getSession, saveSession } = require("../utils/sessionStore");

/**
 * MAIN WEBHOOK (POST)
 */
router.post("/", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore non-message webhooks
    if (!value || !value.messages) return res.sendStatus(200);

    const phoneNumberId = value.metadata?.phone_number_id;
    const message = value.messages[0];
    const sender = message.from;

    let text = "";

    if (message.type === "text") {
      text = message.text.body.trim();
    } else if (message.type === "interactive") {
      const inter = message.interactive;
      if (inter.button_reply) text = inter.button_reply.id || inter.button_reply.title;
      if (inter.list_reply) text = inter.list_reply.id || inter.list_reply.title;
    }

    text = text.toLowerCase();

    // ------------------------------
    // GET SESSION (can be undefined for new users)
    // ------------------------------
    let session = await getSession(sender) || {};

    // ------------------------------
    // PASS MESSAGE TO WHATSAPP BOT
    // ------------------------------
    const updatedSession = await handleIncomingMessage(sender, text, {
      ...session,
      phoneNumberId,
    });

    // Save updated session
    if (updatedSession) await saveSession(sender, updatedSession);

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    return res.sendStatus(500);
  }
});

module.exports = router;
