// routes/webhook.js
const express = require("express");
const router = express.Router();

// ✅ Fixed paths for your structure
const { handleIncomingMessage } = require("../src/bots/whatsappBot");
const { getSession, saveSession } = require("../utils/sessionStore");

// ------------------------------
// MAIN WEBHOOK (POST)
// ------------------------------
router.post("/", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value || !value.messages) return res.sendStatus(200); // ignore non-message webhooks

    const phoneNumberId = value.metadata?.phone_number_id;
    const message = value.messages[0];
    const sender = message.from;

    let text = "";

    // ------------------------------
    // EXTRACT TEXT FROM MESSAGE
    // ------------------------------
    if (message.type === "text") {
      text = message.text.body.trim();
    } else if (message.type === "interactive") {
      const inter = message.interactive;
      if (inter.button_reply) text = inter.button_reply.id || inter.button_reply.title;
      if (inter.list_reply) text = inter.list_reply.id || inter.list_reply.title;
    }

    text = String(text).toLowerCase();

    // ------------------------------
    // GET SESSION (new users will get undefined)
    // ------------------------------
    let session = await getSession(sender);
    if (!session) session = { step: "start", isInitialized: false, housingFlow: { step: "start", data: {} } };

    // ------------------------------
    // PASS MESSAGE TO WHATSAPP BOT
    // ------------------------------
    const updatedSession = await handleIncomingMessage(sender, text, session);

    // ------------------------------
    // SAVE UPDATED SESSION
    // ------------------------------
    if (updatedSession) await saveSession(sender, updatedSession);

    // Respond with 200 OK
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
