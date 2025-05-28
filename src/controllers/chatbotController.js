const { handleAdRequest } = require('../features/ads/ads.flow');

// Intent check based on string content
function isAdIntent(message) {
  const text = message?.text?.body || message?.body;
  if (typeof text !== 'string') return false;
  return text.toLowerCase().includes('ad') || text.toLowerCase().includes('advertise');
}

// Controller function to route ad messages
async function handleAdsIntent(message, sendMessage) {
  const text = message?.text?.body || message?.body;

  if (typeof text !== 'string') {
    return sendMessage("❓ I couldn't understand your message. Please try again.");
  }

  if (isAdIntent(message)) {
    return sendMessage(
      `🧩 Where would you like to advertise?\n\n🏙️ Metro Stations\n🚌 Bus Stops\n🏬 Malls\n📺 Local Cable\n🎨 Wall Paintings\n\nExample: *Show metro ads in Delhi*`
    );
  }

  const cityMatch = text.match(/in\s([a-zA-Z\s]+)/i);
  const typeMatch = text.match(/(metro|bus|mall|cable|wall)/i);

  if (cityMatch && typeMatch) {
    const city = cityMatch[1].trim().toLowerCase();
    const type = typeMatch[1].trim().toLowerCase();
    return await handleAdRequest({ city, type }, sendMessage);
  }

  return sendMessage("👋 Hi! You can type *'advertise'* to get started with ad placements.");
}

module.exports = {
  handleAdsIntent,
};
