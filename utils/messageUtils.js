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
    // ADDED: Validation for client parameter
    if (!client) {
      console.error('❌ [ERROR] WhatsApp client is null in sendInteractiveButtons');
      console.error('❌ [ERROR] Recipient:', to);
      console.error('❌ [ERROR] Message text:', text.substring(0, 100));
      console.error('❌ [ERROR] Buttons:', buttons);
      throw new Error('WhatsApp client is not available. Client is null.');
    }
    
    // ADDED: Check if client has sendMessage method
    if (typeof client.sendMessage !== 'function') {
      console.error('❌ [ERROR] client.sendMessage is not a function');
      console.error('❌ [ERROR] Client type:', typeof client);
      console.error('❌ [ERROR] Client keys:', Object.keys(client || {}));
      throw new Error('WhatsApp client.sendMessage is not a function');
    }
    
    console.log(`📤 [DEBUG] sendInteractiveButtons called for ${to}`);
    console.log(`📤 [DEBUG] Buttons:`, buttons);
    
    // Handle both string buttons and object buttons
    const buttonObjects = buttons.map((btn, index) => {
      if (typeof btn === 'string') {
        return {
          type: 'reply',
          reply: {
            id: `btn_${index + 1}`,
            title: btn
          }
        };
      } else {
        // btn is an object with id and text properties
        return {
          type: 'reply',
          reply: {
            id: btn.id || `btn_${index + 1}`,
            title: btn.text || btn.title || `Button ${index + 1}`
          }
        };
      }
    });
    
    console.log(`📤 [DEBUG] Prepared ${buttonObjects.length} button objects`);
    
    // Send interactive message
    const result = await client.sendMessage(to, {
      text: text,
      buttons: buttonObjects
    });
    
    console.log(`✅ Interactive buttons sent successfully (ID: ${result?.id || 'unknown'})`);
    return result;
  } catch (error) {
    console.error(`❌ Error sending interactive buttons:`, error.message);
    console.error(`❌ Stack trace:`, error.stack);
    
    // ADDED: Try to send a fallback text message
    if (client && typeof client.sendMessage === 'function') {
      try {
        console.log(`⚠️ Attempting fallback text message...`);
        const buttonTexts = buttons.map((btn, index) => 
          `${index + 1}. ${typeof btn === 'string' ? btn : (btn.text || btn.title || `Option ${index + 1}`)}`
        ).join('\n');
        
        const fallbackText = `${text}\n\nPlease reply with:\n${buttonTexts}`;
        
        const fallbackResult = await client.sendMessage(to, { text: fallbackText });
        console.log(`✅ Fallback text message sent`);
        return fallbackResult;
      } catch (fallbackError) {
        console.error(`❌ Fallback also failed:`, fallbackError.message);
      }
    }
    
    throw error;
  }
}

module.exports = { 
  detectIntent, 
  getMissingInfo,
  sendInteractiveButtons 
};