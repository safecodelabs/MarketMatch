// server.js
require("dotenv").config();
const express = require("express");
const app = express();
const webhookRoute = require("./routes/webhook");

// Import voice service - CORRECTED: This is a module, not a function
const voiceService = require("./src/services/voiceService");

// Import YOUR EXISTING messageService as WhatsApp client
const messageService = require("./src/services/messageService");

// Import controller to set client globally
const { setWhatsAppClient } = require("./chatbotController"); // Make sure this is correct path

// Initialize voice service with WhatsApp credentials
function initializeVoiceService(config) {
  console.log("🎤 [SERVER] Initializing voice service with config:", {
    hasAccessToken: !!config.accessToken,
    hasPhoneNumberId: !!config.phoneNumberId,
    apiVersion: config.apiVersion
  });
  
  // The voiceService module should handle initialization internally
  // We just pass the config if it has an init method
  if (voiceService.initializeWithConfig) {
    voiceService.initializeWithConfig(config);
  } else if (voiceService.init) {
    voiceService.init(config);
  } else {
    console.log("⚠️ [SERVER] Voice service doesn't have an initialization method");
    console.log("🎤 [SERVER] Voice service exports:", Object.keys(voiceService));
  }
  
  return voiceService;
}

// Initialize voice service with WhatsApp config
const voiceServiceInstance = initializeVoiceService({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0'
});

// Set the WhatsApp client globally in controller
setWhatsAppClient(messageService);
console.log("✅ WhatsApp client (messageService) set globally in controller");

// ---------------------------------------------------------
// 1) DEFAULT JSON PARSER — used for normal routes
// ---------------------------------------------------------
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------
// 2) WHATSAPP WEBHOOK VERIFICATION (GET)
// ---------------------------------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook Verified!");
    return res.status(200).send(challenge);
  }

  console.error("❌ Webhook Verification Failed");
  return res.sendStatus(403);
});

// ---------------------------------------------------------
// 3) WHATSAPP WEBHOOK MESSAGE HANDLER (POST)
//    ⚠️ MUST USE RAW BODY — NOT express.json()
// ---------------------------------------------------------
app.use(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhookRoute
);

// ---------------------------------------------------------
// 4) TEST ROUTE TO CHECK CLIENT
// ---------------------------------------------------------
app.get("/test-client", (_, res) => {
  const clientAvailable = !!messageService;
  const hasSendMessage = clientAvailable && typeof messageService.sendMessage === 'function';
  
  res.json({ 
    status: "ok", 
    clientAvailable,
    hasSendMessage,
    clientType: "messageService",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID,
    hasAccessToken: !!(process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN),
    voiceServiceInitialized: !!voiceServiceInstance,
    voiceServiceMethods: voiceServiceInstance ? Object.keys(voiceServiceInstance).filter(key => typeof voiceServiceInstance[key] === 'function') : []
  });
});

// ---------------------------------------------------------
// 5) VOICE SERVICE STATUS ROUTE
// ---------------------------------------------------------
app.get("/voice-status", (_, res) => {
  res.json({
    voiceService: {
      initialized: !!voiceServiceInstance,
      availableMethods: voiceServiceInstance ? Object.keys(voiceServiceInstance) : [],
      hasProcessVoiceMessage: voiceServiceInstance ? typeof voiceServiceInstance.processVoiceMessage === 'function' : false,
      hasInitializeWithConfig: voiceServiceInstance ? typeof voiceServiceInstance.initializeWithConfig === 'function' : false,
      hasInit: voiceServiceInstance ? typeof voiceServiceInstance.init === 'function' : false
    },
    config: {
      hasAccessToken: !!(process.env.WHATSAPP_ACCESS_TOKEN),
      hasPhoneNumberId: !!(process.env.WHATSAPP_PHONE_NUMBER_ID),
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0'
    }
  });
});

// ---------------------------------------------------------
app.get("/", (_, res) => {
  res.send(`
    🚀 MarketMatchAI WhatsApp Bot is running…
    <br>
    <a href="/test-client">Test Client Status</a>
    <br>
    <a href="/voice-status">Voice Service Status</a>
  `);
});

// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`📱 WhatsApp Client: ${messageService ? '✅ messageService loaded' : '❌ Not loaded'}`);
  console.log(`📱 Has sendMessage: ${typeof messageService.sendMessage === 'function' ? '✅ Yes' : '❌ No'}`);
  console.log(`📱 Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || 'Not set'}`);
  console.log(`🎤 Voice Service: ${voiceServiceInstance ? '✅ Initialized' : '❌ Not initialized'}`);
  
  // Log available voice service methods
  if (voiceServiceInstance) {
    const methods = Object.keys(voiceServiceInstance).filter(key => typeof voiceServiceInstance[key] === 'function');
    console.log(`🎤 Voice Service Methods: ${methods.length > 0 ? methods.join(', ') : 'None found'}`);
  }
});

module.exports = { 
  messageService, 
  voiceService: voiceServiceInstance 
};