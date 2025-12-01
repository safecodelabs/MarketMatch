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

// Import bot handler (path matches your structure)
const { handleIncomingMessage } = require("../src/bots/whatsappBot");

/**
 * MAIN WEBHOOK (POST)
 */
router.post("/", async (req, res) => {
  try {
    // Helpful debug — keeps Railway logs populated
    console.log("📩 Webhook raw body:", JSON.stringify(req.body?.entry?.[0] || req.body).slice(0, 1500));

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore non-message webhooks
    if (!value || !value.messages) {
      console.log("🔎 Not a message webhook — ignoring.");
      return res.sendStatus(200);
    }

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

    text = (text || "").toLowerCase();

    console.log(`💬 incoming from=${sender} phoneNumberId=${phoneNumberId} text="${text}"`);

    // --- IMPORTANT: call signature must match the bot's handler
    const updatedSession = await handleIncomingMessage(sender, text, message);

    // saveSession is done inside handler in many flows, but you can persist here if needed
    // if (updatedSession) await saveSession(sender, updatedSession);

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    return res.sendStatus(500);
  }
});

module.exports = router;
