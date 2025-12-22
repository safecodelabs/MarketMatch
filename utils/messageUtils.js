// src/utils/messageUtils.js
// housing-only fallback intent detector & missing info helper

const intents = {
  housing: { keywords: ['bhk', 'flat', 'apartment', 'house', 'property', 'rent', 'sale'] }
};

function detectIntent(messageText) {
  if (!messageText) return null;
  const text = messageText.toLowerCase();
  for (const [intent, data] of Object.entries(intents)) {
    if (data.keywords.some(k => text.includes(k))) return intent;
  }
  return null;
}

function getMissingInfo(intent, text) {
  const missing = [];
  if (intent === "housing") {
    if (!text.match(/noida|gurgaon|delhi|bangalore|mumbai|pune/)) missing.push("city");
    if (!text.match(/\d\s?bhk|flat|apartment|room/)) missing.push("property type");
    if (!text.match(/\₹?\d{3,7}/)) missing.push("budget");
  }
  return missing;
}

/**
 * Send interactive buttons to a user
 * @param {Object} client - WhatsApp client
 * @param {string} to - Recipient number
 * @param {string} text - Message text
 * @param {Array<string>} buttons - Array of button labels
 * @returns {Promise<Object>} - Result of sending
 */
async function sendInteractiveButtons(client, to, text, buttons) {
  try {
    console.log(`📤 [DEBUG] sendInteractiveButtons called for ${to}`);
    console.log(`📤 [DEBUG] Buttons:`, buttons);
    
    // Create button objects
    const buttonObjects = buttons.map((btn, index) => ({
      type: 'reply',
      reply: {
        id: `btn_${index + 1}`,
        title: btn
      }
    }));
    
    // Send interactive message
    const result = await client.sendMessage(to, {
      text: text,
      buttons: buttonObjects
    });
    
    console.log(`✅ Interactive buttons sent successfully (ID: ${result.id})`);
    return result;
  } catch (error) {
    console.error(`❌ Error sending interactive buttons:`, error);
    throw error;
  }
}

module.exports = { 
  detectIntent, 
  getMissingInfo,
  sendInteractiveButtons 
};