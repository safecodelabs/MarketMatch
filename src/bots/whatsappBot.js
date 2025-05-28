const { mainFlow } = require('../flows/main.flow');
const { handleAdsIntent } = require('../features/ads/ads.controller');

// Simulated WhatsApp Bot Handler
async function onMessageReceived(message) {
  const sendMessage = (reply) => {
    console.log(`Bot: ${reply}`);
    // TODO: Replace this with actual WhatsApp API sendMessage logic
  };

  // Run main flow first
  const mainHandled = await mainFlow(message, sendMessage);
  if (mainHandled) return;

  // Try ads handler
  const adsHandled = await handleAdsIntent(message, sendMessage);
  if (adsHandled) return;

  // Default fallback message
  await sendMessage("🤖 I didn't understand that. Try asking about metro ads in your city.");
}

module.exports = { onMessageReceived };
