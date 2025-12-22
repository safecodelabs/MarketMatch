// =======================================================
// ✅ ENHANCED whatsappBot.js with Voice Support
// =======================================================
const { handleIncomingMessage: chatbotHandler } = require("./chatbotController");

async function handleIncomingMessage(sender, msgBody, metadata = {}, client = null) {
  console.log("🔍 [WHATSAPP_BOT] Forwarding to chatbotController");
  
  // Pass the client to chatbotController for voice processing
  return chatbotHandler(sender, msgBody, metadata, client);
}

module.exports = {
  handleIncomingMessage
};