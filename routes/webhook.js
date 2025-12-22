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

// Log level control
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

function log(level, ...args) {
  if (levels[level] <= levels[LOG_LEVEL]) {
    console.log(`[${level}] Webhook:`, ...args);
  }
}

// Fix: Sometimes WhatsApp sends raw buffer instead of JSON
router.use((req, res, next) => {
  if (req.is("application/json") && Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString());
    } catch (err) {
      log('ERROR', 'JSON Parse Error');
    }
  }
  next();
});

// =======================================================
// 🚀 MAIN WEBHOOK HANDLER (POST)
// =======================================================
router.post("/", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Skip typing indicators, delivery receipts, etc.
    if (!value || !value.messages || value.messages.length === 0) {
      // Don't log status updates to reduce log volume
      if (value?.statuses) {
        // Optional: log every 10th status update
        const statusCount = (global.statusLogCount = (global.statusLogCount || 0) + 1);
        if (statusCount % 10 === 0) {
          log('DEBUG', `Status update: ${value.statuses[0]?.status}`);
        }
      }
      return res.sendStatus(200);
    }

    const message = value.messages[0];
    const sender = message.from;
    
    // Log minimal webhook info
    if (message.type !== 'audio') { // Audio logs handled separately
      log('INFO', `${message.type} from ${sender.substring(0, 10)}...`);
    }

    let extractedText = "";
    let messageMetadata = { ...message };

    // =======================================================
    // 📝 NORMAL TEXT MESSAGE
    // =======================================================
    if (message.type === "text") {
      extractedText = message.text.body.trim();
      log('DEBUG', `Text: "${extractedText.substring(0, 50)}${extractedText.length > 50 ? '...' : ''}"`);
    }

    // =======================================================
    // 🎛 INTERACTIVE MESSAGE (buttons, list)
    // =======================================================
    else if (message.type === "interactive") {
      const interactive = message.interactive;

      if (interactive.button_reply) {
        extractedText = interactive.button_reply.id || interactive.button_reply.title;
      } else if (interactive.list_reply) {
        extractedText = interactive.list_reply.id || interactive.list_reply.title;
      }
      log('DEBUG', `Interactive: ${extractedText}`);
    }

    // =======================================================
    // 🧱 FLOW / FORM SUBMISSION (WhatsApp Flows)
    // =======================================================
    else if (message.type === "button") {
      extractedText = message.button.payload || "";
      log('DEBUG', `Button: ${extractedText}`);
    }

    else if (message.type === "interactive_response") {
      extractedText = message.interactive_response.id || "";
      log('DEBUG', `Interactive Response: ${extractedText}`);
    }

    // =======================================================
    // 🎤 AUDIO / VOICE MESSAGE HANDLING (OPTIMIZED)
    // =======================================================
    else if (message.type === "audio" || message.type === "voice") {
      log('INFO', `Audio from ${sender.substring(0, 10)}...`);
      
      const audioUrl = message.audio?.url || message.voice?.url;
      const isVoice = message.audio?.voice || message.voice || true;
      
      if (!audioUrl) {
        log('ERROR', 'No audio URL');
        await messageService.sendMessage(
          sender,
          "🎤 I received your voice message but couldn't process it. Please try sending it again."
        );
        return res.sendStatus(200);
      }
      
      // Log URL minimally
      log('DEBUG', `Audio URL: ${audioUrl.split('?')[0]}?mid=...`);
      
      // Send immediate response WITHOUT waiting
      messageService.sendMessage(
        sender,
        "🎤 I received your voice message! Processing it now..."
      ).catch(err => {
        log('WARN', 'Failed to send processing message');
      });
      
      // Mark as voice message for chatbot
      extractedText = "voice_note";
      
      // Store enhanced audio metadata
      messageMetadata.audioMetadata = {
        url: audioUrl,
        mime_type: message.audio?.mime_type || "audio/ogg",
        id: message.audio?.id || message.id,
        voice: isVoice,
        timestamp: message.timestamp || Date.now()
      };
      
      log('INFO', 'Audio metadata stored');
    }

    // =======================================================
    // 📸 IMAGE / DOCUMENT MESSAGES (Minimal logging)
    // =======================================================
    else if (message.type === "image" || message.type === "document") {
      log('INFO', `${message.type} from ${sender.substring(0, 10)}...`);
      
      // Send response without logging errors
      messageService.sendMessage(
        sender,
        message.type === "image" 
          ? "📸 I received your image! For now, please send text or voice messages."
          : "📄 I received your document! For now, please send text or voice messages."
      ).catch(() => { /* silent fail */ });
      
      return res.sendStatus(200);
    }

    // =======================================================
    // ❌ UNSUPPORTED MESSAGE TYPE
    // =======================================================
    else {
      log('WARN', `Unsupported type: ${message.type} from ${sender.substring(0, 10)}...`);
      
      // Send response without logging errors
      messageService.sendMessage(
        sender,
        `⚠️ I received a ${message.type} message. Currently, I support text, voice messages, and interactive buttons.`
      ).catch(() => { /* silent fail */ });
      
      return res.sendStatus(200);
    }

    // Normalize text
    extractedText = (extractedText || "").toLowerCase();

    // Log final processing info
    log('DEBUG', `Final: ${sender.substring(0, 10)} | ${message.type} | "${extractedText.substring(0, 30)}"`);

    // =======================================================
    // 🔥 PASS TO BOT (Non-blocking for voice to avoid timeouts)
    // =======================================================
    if (message.type === "audio" || message.type === "voice") {
      // Process voice asynchronously to avoid webhook timeout
      handleIncomingMessage(sender, extractedText, messageMetadata, null)
        .catch(err => {
          log('ERROR', `Voice processing failed: ${err.message}`);
          // Send error message to user
          messageService.sendMessage(
            sender,
            "❌ Sorry, I encountered an error processing your voice message. Please try again."
          ).catch(() => { /* silent fail */ });
        });
    } else {
      // Process text/interactive messages normally
      await handleIncomingMessage(sender, extractedText, messageMetadata, null);
    }

    // Always respond 200 immediately to WhatsApp
    return res.sendStatus(200);
    
  } catch (err) {
    log('ERROR', `Handler error: ${err.message}`);
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
      log('INFO', 'Webhook verified');
      return res.status(200).send(challenge);
    } else {
      log('ERROR', 'Webhook verification failed');
      return res.sendStatus(403);
    }
  }

  log('ERROR', 'Missing verification parameters');
  return res.sendStatus(400);
});

module.exports = router;