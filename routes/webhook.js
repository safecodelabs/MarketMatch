// routes/webhook.js
const express = require("express");
const router = express.Router();

// Import bot handler
const { handleIncomingMessage } = require("../chatbotController");

// Import message service
let messageService;
try {
    messageService = require("../src/services/messageService");
} catch (error) {
    console.error("❌ Webhook: Failed to load messageService:", error.message);
    messageService = null;
}

// Log level control
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

function log(level, ...args) {
  if (levels[level] <= levels[LOG_LEVEL]) {
    console.log(`[${level}] Webhook:`, ...args);
  }
}

// =======================================================
// 🚀 MAIN WEBHOOK HANDLER (POST)
// =======================================================
router.post("/", async (req, res) => {
  try {
    log('INFO', 'Webhook POST received');
    
    // Parse raw buffer to JSON
    let body;
    if (Buffer.isBuffer(req.body)) {
      try {
        body = JSON.parse(req.body.toString('utf8'));
      } catch (parseError) {
        log('ERROR', 'Failed to parse webhook JSON:', parseError.message);
        return res.status(200).send('OK'); // Still return 200 to WhatsApp
      }
    } else {
      body = req.body;
    }
    
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Skip typing indicators, delivery receipts, etc.
    if (!value || !value.messages || value.messages.length === 0) {
      if (value?.statuses) {
        log('DEBUG', `Status update: ${value.statuses[0]?.status}`);
      }
      return res.status(200).send('OK');
    }

    const message = value.messages[0];
    const sender = message.from;
    
    log('INFO', `${message.type} from ${sender.substring(0, 10)}...`);

    let extractedText = "";
    let messageMetadata = { ...message };

    // TEXT MESSAGE
    if (message.type === "text") {
      extractedText = message.text.body.trim();
      log('DEBUG', `Text: "${extractedText.substring(0, 50)}${extractedText.length > 50 ? '...' : ''}"`);
    }

    // INTERACTIVE MESSAGE
    else if (message.type === "interactive") {
      const interactive = message.interactive;

      if (interactive.button_reply) {
        extractedText = interactive.button_reply.id || interactive.button_reply.title;
      } else if (interactive.list_reply) {
        extractedText = interactive.list_reply.id || interactive.list_reply.title;
      }
      log('DEBUG', `Interactive: ${extractedText}`);
    }

    // BUTTON
    else if (message.type === "button") {
      extractedText = message.button.payload || "";
      log('DEBUG', `Button: ${extractedText}`);
    }

    // AUDIO / VOICE MESSAGE
    else if (message.type === "audio" || message.type === "voice") {
      log('INFO', `Audio from ${sender.substring(0, 10)}...`);
      
      const audioUrl = message.audio?.url || message.voice?.url;
      const isVoice = message.audio?.voice || message.voice || true;
      
      if (!audioUrl) {
        log('ERROR', 'No audio URL');
        if (messageService) {
          await messageService.sendMessage(
            sender,
            "🎤 I received your voice message but couldn't process it. Please try sending it again."
          );
        }
        return res.status(200).send('OK');
      }
      
      log('DEBUG', `Audio URL received`);
      
      // Send immediate response
      if (messageService) {
        messageService.sendMessage(
          sender,
          "🎤 I received your voice message! Processing it now..."
        ).catch(err => {
          log('WARN', 'Failed to send processing message:', err.message);
        });
      }
      
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

    // IMAGE / DOCUMENT
    else if (message.type === "image" || message.type === "document") {
      log('INFO', `${message.type} from ${sender.substring(0, 10)}...`);
      
      if (messageService) {
        messageService.sendMessage(
          sender,
          message.type === "image" 
            ? "📸 I received your image! For now, please send text or voice messages."
            : "📄 I received your document! For now, please send text or voice messages."
        ).catch(() => { /* silent fail */ });
      }
      
      return res.status(200).send('OK');
    }

    // UNSUPPORTED TYPE
    else {
      log('WARN', `Unsupported type: ${message.type} from ${sender.substring(0, 10)}...`);
      
      if (messageService) {
        messageService.sendMessage(
          sender,
          `⚠️ I received a ${message.type} message. Currently, I support text, voice messages, and interactive buttons.`
        ).catch(() => { /* silent fail */ });
      }
      
      return res.status(200).send('OK');
    }

    // Normalize text
    extractedText = (extractedText || "").toLowerCase();

    log('DEBUG', `Processing: ${sender.substring(0, 10)} | ${message.type} | "${extractedText.substring(0, 30)}"`);

    // =======================================================
    // 🔥 PASS TO BOT (Async to avoid webhook timeout)
    // =======================================================
    // Always respond 200 immediately
    res.status(200).send('OK');
    
    // Process asynchronously
    setTimeout(async () => {
      try {
        await handleIncomingMessage(sender, extractedText, messageMetadata, messageService);
      } catch (err) {
        log('ERROR', `Processing failed: ${err.message}`);
        
        // Send error message to user
        if (messageService) {
          messageService.sendMessage(
            sender,
            "❌ Sorry, I encountered an error. Please try again."
          ).catch(() => { /* silent fail */ });
        }
      }
    }, 0);
    
  } catch (err) {
    log('ERROR', `Webhook error: ${err.message}`);
    // Always return 200 to WhatsApp
    return res.status(200).send('ERROR_RECEIVED');
  }
});

// =======================================================
// 🔐 WEBHOOK VERIFICATION (GET)
// =======================================================
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  log('INFO', `Webhook GET verification: mode=${mode}, token=${token ? "provided" : "missing"}`);

  const verifyToken = process.env.VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "marketmatch-ai-token";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      log('INFO', 'Webhook verified successfully');
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