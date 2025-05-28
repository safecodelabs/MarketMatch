const { parseAdIntent, handleAdRequest } = require('./ads.flow');

async function mainFlow(message, sendMessage) {
  if (parseAdIntent(message.body)) {
    sendMessage(`🧩 Where would you like to advertise?\n\n🏙️ Metro Stations\n🚌 Bus Stops\n🏬 Malls\n📺 Local Cable\n📍Local Wall Paintings`);
    
    // Use session manager or follow-up message handler
    return;
  }

  // Handle city/type follow-up — use state or direct input parsing
  const cityMatch = message.body.match(/in\s(\w+)/i);
  const typeMatch = message.body.match(/(metro|bus|mall|cable|wall)/i);

  if (cityMatch && typeMatch) {
    const city = cityMatch[1];
    const type = typeMatch[1];
    await handleAdRequest({ city, type }, sendMessage);
    return;
  }

  sendMessage("Hi! You can type 'advertise' to get started with ad placements.");
}

module.exports = { mainFlow };
