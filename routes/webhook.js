// =======================================================
// ✅ PATCHED FILE: routes/webhook.js
// =======================================================
const express = require("express");
const router = express.Router();

// Import bot handler (path matches your structure)
const { handleIncomingMessage } = require("../src/bots/whatsappBot");

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

/**
 * MAIN WEBHOOK (POST)
 */
router.post("/", async (req, res) => {
  try {
    // Helpful debug — keeps logs populated
    console.log("📩 Webhook raw body:", JSON.stringify(req.body?.entry?.[0] || req.body).slice(0, 1500));

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore non-message webhooks
    if (!value || !value.messages || value.messages.length === 0) {
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
      // We extract the ID here for logging purposes
      const inter = message.interactive;
      if (inter.button_reply) text = inter.button_reply.id || inter.button_reply.title;
      else if (inter.list_reply) text = inter.list_reply.id || inter.list_reply.title;
    } else if (message.type === "unsupported") {
        console.log("⚠️ Received unsupported message type. Ignoring.");
        return res.sendStatus(200);
    }

    text = (text || "").toLowerCase();

    console.log(`💬 incoming from=${sender} phoneNumberId=${phoneNumberId} text="${text}"`);

    // --- IMPORTANT: Pass the full 'message' object as metadata
    // The bot handler now uses this metadata to accurately extract 
    // button IDs, regardless of how we parse 'text' above.
    await handleIncomingMessage(sender, text, message);

    // Return 200 OK immediately
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    return res.sendStatus(500);
  }
});

module.exports = router;