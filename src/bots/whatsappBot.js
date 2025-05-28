const { mainFlow } = require('../flows/main.flow');
const { handleAdsIntent } = require('../features/ads/ads.controller');

// Simulated WhatsApp Bot Handler
async function onMessageReceived(sender, userMessage) {
  const sendMessage = async (reply) => {
    console.log(`To ${sender}: ${reply}`);
    // TODO: Replace this with actual WhatsApp API sendMessage logic
    // Example: await sendWhatsAppMessage(sender, reply);
  };

  // Run main flow first (like greeting/intro/commands)
  const mainHandled = await mainFlow(userMessage, sendMessage);
  if (mainHandled) return;

  // Try ads handler
  const adsHandled = await handleAdsIntent(userMessage, sendMessage);
  if (adsHandled) return;

  // Fallback message
  await sendMessage("🤖 I didn't understand that. Try asking about metro ads in your city.");
}

module.exports = { onMessageReceived };
