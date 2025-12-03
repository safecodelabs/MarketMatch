// =======================================================
// ✅ FULLY PATCHED FILE: routes/webhook.js
// =======================================================
const express = require("express");
const router = express.Router();

// Import bot handler
const { handleIncomingMessage } = require("../chatbotController");

// Fix: Sometimes WhatsApp sends raw buffer instead of JSON
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

// =======================================================
// 🚀 MAIN WEBHOOK HANDLER (POST)
// =======================================================
router.post("/", async (req, res) => {
  try {
    // Log for debugging
    console.log(
      "📩 Webhook Body:",
      JSON.stringify(req.body?.entry?.[0] || req.body).slice(0, 1800)
    );

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Skip typing indicators, delivery receipts, etc.
    if (!value || !value.messages || value.messages.length === 0) {
      console.log("ℹ️ Not a message webhook — ignored.");
      return res.sendStatus(200);
    }

    const message = value.messages[0];
    const sender = message.from;
    const phoneNumberId = value.metadata?.phone_number_id;

    let extractedText = ""; // what we pass to the bot

    // =======================================================
    // 📝 NORMAL TEXT MESSAGE
    // =======================================================
    if (message.type === "text") {
      extractedText = message.text.body.trim();
    }

    // =======================================================
    // 🎛 INTERACTIVE MESSAGE (buttons, list)
    // =======================================================
    else if (message.type === "interactive") {
      const interactive = message.interactive;

      // button press
      if (interactive.button_reply) {
        extractedText =
          interactive.button_reply.id || interactive.button_reply.title;
      }

      // list selection
      else if (interactive.list_reply) {
        extractedText =
          interactive.list_reply.id || interactive.list_reply.title;
      }
    }

    // =======================================================
    // 🧱 FLOW / FORM SUBMISSION (WhatsApp Flows)
    // =======================================================
    else if (message.type === "button") {
      // Some flow callbacks come here
      extractedText = message.button.payload || "";
    }

    else if (message.type === "interactive_response") {
      // Newer meta format
      extractedText = message.interactive_response.id || "";
    }

    // =======================================================
    // ❌ UNSUPPORTED MESSAGE TYPE (images, docs, etc.)
    // =======================================================
    else {
      console.log("⚠️ Unsupported message type:", message.type);
      return res.sendStatus(200);
    }

    // Normalize
    extractedText = (extractedText || "").toLowerCase();

    console.log(
      `💬 Incoming | from=${sender} | bot-number=${phoneNumberId} | text="${extractedText}"`
    );

    // =======================================================
    // 🔥 PASS TO BOT WITH FULL RAW MESSAGE
    // =======================================================
    await handleIncomingMessage(sender, extractedText, message);

    // We ALWAYS respond 200 immediately
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook Handler Error:", err);
    return res.sendStatus(500);
  }
});

module.exports = router;
