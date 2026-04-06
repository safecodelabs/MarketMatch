// src/utils/messageUtils.js
const messageService = require('../src/services/messageService');

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
 * @param {Object} client - WhatsApp client (messageService)
 * @param {string} to - Recipient number
 * @param {string} text - Message text
 * @param {Array<Object>} buttons - Array of button objects with {id, text} or {id, title}
 * @returns {Promise<Object>} - Result of sending
 */
async function sendInteractiveButtons(client, to, text, buttons) {
  try {
    console.log(`📤 [MESSAGE UTILS] sendInteractiveButtons called for ${to}`);
    console.log(`📤 [MESSAGE UTILS] Buttons received:`, buttons);
    
    // Use messageService directly (ignore client parameter for now)
    console.log(`📤 [MESSAGE UTILS] Using messageService for interactive buttons`);
    
    // Format buttons for messageService.sendInteractiveButtons
    const formattedButtons = buttons.map((btn, index) => {
      // Handle both formats: {id, text} or {id, title}
      const buttonId = btn.id || `btn_${index + 1}`;
      const buttonText = btn.text || btn.title || `Option ${index + 1}`;
      
      console.log(`🔘 Button ${index + 1}: id="${buttonId}", text="${buttonText}"`);
      
      return {
        id: buttonId,
        text: buttonText
      };
    });
    
    // Check if messageService has sendInteractiveButtons function
    if (messageService.sendInteractiveButtons) {
      console.log(`📤 [MESSAGE UTILS] Using messageService.sendInteractiveButtons`);
      return await messageService.sendInteractiveButtons(to, text, formattedButtons);
    } 
    // Fallback to sendButtons if sendInteractiveButtons doesn't exist
    else if (messageService.sendButtons) {
      console.log(`📤 [MESSAGE UTILS] Using messageService.sendButtons (fallback)`);
      return await messageService.sendButtons(to, text, formattedButtons, "Select an option");
    }
    // Last resort: use sendText
    else if (messageService.sendText) {
      console.log(`⚠️ [MESSAGE UTILS] No interactive button function found, using text fallback`);
      const buttonTexts = formattedButtons.map((btn, index) => 
        `${index + 1}. ${btn.text} (reply: ${btn.id})`
      ).join('\n');
      
      const fallbackText = `${text}\n\nPlease reply with:\n${buttonTexts}`;
      return await messageService.sendText(to, fallbackText);
    } else {
      throw new Error('No message sending function available');
    }
    
  } catch (error) {
    console.error(`❌ [MESSAGE UTILS] Error sending interactive buttons:`, error.message);
    console.error(`❌ [MESSAGE UTILS] Stack trace:`, error.stack);
    
    // Try fallback with messageService.sendText
    try {
      if (messageService.sendText) {
        console.log(`⚠️ [MESSAGE UTILS] Attempting text fallback...`);
        const buttonTexts = buttons.map((btn, index) => 
          `${index + 1}. ${btn.text || btn.title || `Option ${index + 1}`}`
        ).join('\n');
        
        const fallbackText = `${text}\n\nPlease reply with:\n${buttonTexts}`;
        
        const fallbackResult = await messageService.sendText(to, fallbackText);
        console.log(`✅ [MESSAGE UTILS] Fallback text message sent`);
        return fallbackResult;
      }
    } catch (fallbackError) {
      console.error(`❌ [MESSAGE UTILS] Fallback also failed:`, fallbackError.message);
    }
    
    throw error;
  }
}

/**
 * Send simple message
 * @param {Object} client - WhatsApp client (messageService)
 * @param {string} to - Recipient number
 * @param {string} text - Message text
 * @returns {Promise<Object>} - Result of sending
 */
async function sendMessage(client, to, text) {
  try {
    console.log(`📤 [MESSAGE UTILS] sendMessage called for ${to}`);
    
    // Use messageService directly
    if (messageService.sendText) {
      return await messageService.sendText(to, text);
    } else if (messageService.sendMessage) {
      return await messageService.sendMessage(to, text);
    } else {
      throw new Error('No message sending function available');
    }
    
  } catch (error) {
    console.error(`❌ [MESSAGE UTILS] Error sending message:`, error.message);
    throw error;
  }
}

/**
 * Send buttons (compatibility wrapper)
 */
async function sendButtons(client, to, bodyText, buttons, headerText) {
  console.log(`📤 [MESSAGE UTILS] sendButtons called - redirecting to messageService`);
  
  if (messageService.sendButtons) {
    return await messageService.sendButtons(to, bodyText, buttons, headerText);
  } else {
    return await sendInteractiveButtons(client, to, bodyText, buttons);
  }
}

/**
 * Send list (compatibility wrapper)
 */
async function sendList(client, to, headerText, bodyText, buttonText, sections) {
  console.log(`📤 [MESSAGE UTILS] sendList called - redirecting to messageService`);
  
  if (messageService.sendList) {
    return await messageService.sendList(to, headerText, bodyText, buttonText, sections);
  } else {
    // Fallback to text
    const listText = `${headerText || 'Menu'}\n\n${bodyText || ''}\n\nAvailable options:\n${sections?.map(s => `• ${s.title}`).join('\n') || 'No options'}`;
    return await sendMessage(client, to, listText);
  }
}

module.exports = { 
  detectIntent, 
  getMissingInfo,
  sendInteractiveButtons,
  sendMessage,
  sendButtons,
  sendList
};