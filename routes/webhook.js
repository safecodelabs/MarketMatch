// =======================================================
// ✅ FULLY PATCHED FILE: routes/webhook.js WITH VOICE SUPPORT
// =======================================================
const express = require("express");
const router = express.Router();

// Import bot handler
const { handleIncomingMessage } = require("../chatbotController");
// Import services for voice processing
const voiceService = require("../src/services/voiceService");
const messageService = require("../src/services/messageService");

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
    let messageMetadata = { ...message }; // Store message with metadata

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
    // 🎤 AUDIO / VOICE MESSAGE HANDLING
    // =======================================================
    else if (message.type === "audio" || message.type === "voice") {
      console.log("🎤 Audio message received from:", sender);
      
      const audioUrl = message.audio?.url || message.voice?.url;
      const isVoice = message.audio?.voice || message.voice || true;
      
      if (!audioUrl) {
        console.error("❌ No audio URL found in message");
        // Still send a response to user
        await messageService.sendMessage(
          sender,
          "🎤 I received your voice message but couldn't process it. Please try sending it again."
        );
        return res.sendStatus(200);
      }
      
      console.log("🔗 Audio URL:", audioUrl.substring(0, 100) + "...");
      
      // Send immediate processing message
      try {
        await messageService.sendMessage(
          sender,
          "🎤 I received your voice message! Processing it now..."
        );
      } catch (err) {
        console.error("❌ Error sending processing message:", err);
      }
      
      // Mark as voice message for chatbot
      extractedText = "voice_note"; // Special keyword to trigger voice processing
      
      // Store enhanced audio metadata
      messageMetadata.audioMetadata = {
        url: audioUrl,
        mime_type: message.audio?.mime_type || "audio/ogg",
        id: message.audio?.id || message.id,
        voice: isVoice,
        timestamp: message.timestamp || Date.now()
      };
      
      console.log("✅ Audio message processed, triggering voice mode");
    }

    // =======================================================
    // 📸 IMAGE MESSAGE (Optional - for future)
    // =======================================================
    else if (message.type === "image") {
      console.log("📸 Image message received from:", sender);
      await messageService.sendMessage(
        sender,
        "📸 I received your image! For now, please send text or voice messages."
      );
      return res.sendStatus(200);
    }

    // =======================================================
    // 📄 DOCUMENT MESSAGE (Optional - for future)
    // =======================================================
    else if (message.type === "document") {
      console.log("📄 Document message received from:", sender);
      await messageService.sendMessage(
        sender,
        "📄 I received your document! For now, please send text or voice messages."
      );
      return res.sendStatus(200);
    }

    // =======================================================
    // ❌ UNSUPPORTED MESSAGE TYPE
    // =======================================================
    else {
      console.log("⚠️ Unsupported message type:", message.type);
      // Send helpful response for unsupported types
      await messageService.sendMessage(
        sender,
        `⚠️ I received a ${message.type} message. Currently, I support text, voice messages, and interactive buttons.`
      );
      return res.sendStatus(200);
    }

    // Normalize text
    extractedText = (extractedText || "").toLowerCase();

    console.log(
      `💬 Incoming | from=${sender} | type=${message.type} | text="${extractedText}"`
    );

    // =======================================================
    // 🔥 PASS TO BOT WITH ENHANCED METADATA
    // =======================================================
    // Pass null for client (bot will handle it internally if needed)
    // Pass the enhanced metadata with audio info if available
    await handleIncomingMessage(sender, extractedText, messageMetadata, null);

    // We ALWAYS respond 200 immediately to WhatsApp
    return res.sendStatus(200);
    
  } catch (err) {
    console.error("❌ Webhook Handler Error:", err);
    
    // Try to send error message to user if possible
    try {
      if (req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from) {
        const sender = req.body.entry[0].changes[0].value.messages[0].from;
        await messageService.sendMessage(
          sender,
          "❌ Sorry, I encountered an error processing your message. Please try again."
        );
      }
    } catch (innerErr) {
      console.error("❌ Failed to send error message:", innerErr);
    }
    
    return res.sendStatus(500);
  }
});

// =======================================================
// 🔐 WEBHOOK VERIFICATION (GET)
// =======================================================
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "marketmatch-ai-token";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ Webhook verified successfully!");
      return res.status(200).send(challenge);
    } else {
      console.error("❌ Webhook verification failed");
      return res.sendStatus(403);
    }
  }

  console.error("❌ Missing verification parameters");
  return res.sendStatus(400);
});

module.exports = router;