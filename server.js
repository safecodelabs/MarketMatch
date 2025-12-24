// server.js
require("dotenv").config();
const express = require("express");
const app = express();
const webhookRoute = require("./routes/webhook");

// Import YOUR EXISTING messageService as WhatsApp client
const messageService = require("./src/services/messageService");
initializeVoiceService({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0'
});
// Import controller to set client globally
const { setWhatsAppClient } = require("./chatbotController");

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
    hasAccessToken: !!(process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN)
  });
});

// ---------------------------------------------------------
app.get("/", (_, res) => {
  res.send(`
    🚀 MarketMatchAI WhatsApp Bot is running…
    <br>
    <a href="/test-client">Test Client Status</a>
  `);
});

// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`📱 WhatsApp Client: ${messageService ? '✅ messageService loaded' : '❌ Not loaded'}`);
  console.log(`📱 Has sendMessage: ${typeof messageService.sendMessage === 'function' ? '✅ Yes' : '❌ No'}`);
  console.log(`📱 Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || 'Not set'}`);
});

module.exports = { messageService };