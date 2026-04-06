const axios = require("axios");

// Note: These variables must be available in the environment where this code runs.
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// Custom error type for API send failures so callers can inspect status and API response
class ApiSendError extends Error {
  constructor(message, status = null, apiData = null) {
    super(message);
    this.name = 'ApiSendError';
    this.status = status;
    this.apiData = apiData;
  }
}

// --- Utility function for cleaning strings ---
function cleanString(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  // Remove characters that might break JSON or WhatsApp formatting
  return str.replace(/[\n\t\r]/g, ' ').trim().slice(0, maxLength);
}

// -------------------------------------------------------------
// 1) SEND MESSAGE (FINAL, UNCONDITIONAL LOGGING) - UPDATED VERSION
// -------------------------------------------------------------
async function sendMessage(to, messageOrPayload) {
  const logType = messageOrPayload.type || 'Text';
  
  // Prepare payload - ensure messaging_product is included
  let payload;
  if (typeof messageOrPayload === 'string') {
    payload = { 
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to, 
      type: "text", 
      text: { body: messageOrPayload } 
    };
  } else {
    // Ensure the payload has required WhatsApp fields
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...messageOrPayload
    };
  }

  console.log(`📤 Attempting to send ${logType} message to ${to}`);
  
  try {
    const res = await axios.post(API_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const messageId = res.data.messages?.[0]?.id || 'N/A';
    console.log(`✅ ${logType} sent successfully (ID: ${messageId})`);

    // Log outbound message to Firestore for metrics and audit (best-effort)
    try {
      const db = require('../../database/firestore');
      await db.addMessageLog({
        direction: 'out',
        to: to,
        body: payload && payload.text && payload.text.body ? payload.text.body : JSON.stringify(payload).slice(0, 1000),
        status: 'sent',
        messageId: messageId
      });
    } catch (logErr) {
      console.warn('⚠️ [MESSAGE SERVICE] Could not log outbound message:', logErr && logErr.message);
    }

    return res.data;
  } catch (err) {
    console.error("❌ FINAL SEND MESSAGE ERROR:");
    console.error("❌ Status:", err.response?.status);
    console.error("❌ Message:", err.message);
    
    // Log the payload that caused the error (but truncate for readability)
    const payloadForLog = JSON.stringify(payload, null, 2);
    console.error("❌ Payload sent:", payloadForLog.substring(0, 500) + (payloadForLog.length > 500 ? "..." : ""));

    // Log the entire response data if available
    const status = err.response?.status || null;
    const apiData = err.response?.data || null;
    if (apiData) {
      console.error("❌ API Error Response:", JSON.stringify(apiData));
    }

    // Record failed outbound attempt (best-effort)
    try {
      const db = require('../../database/firestore');
      await db.addMessageLog({
        direction: 'out',
        to: to,
        body: payload && payload.text && payload.text.body ? payload.text.body : JSON.stringify(payload).slice(0, 1000),
        status: 'error',
        error: apiData || { message: err.message }
      });
    } catch (logErr) {
      console.warn('⚠️ [MESSAGE SERVICE] Could not log failed outbound message:', logErr && logErr.message);
    }

    // Throw a structured ApiSendError so callers can react to status / apiData
    throw new ApiSendError(`API Send Failed: ${err.message}`, status, apiData);
  }
}

// -------------------------------------------------------------
// 2) SEND TEXT (Sends a simple text message)
// -------------------------------------------------------------
async function sendText(to, text) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      body: text,
    },
  };
  return await sendMessage(to, payload);
}

// -------------------------------------------------------------
// 3) SEND INTERACTIVE BUTTONS (1–3 buttons only) - Core function
// -------------------------------------------------------------
async function sendButtons(to, bodyText, buttons, headerText) {
  console.log("🔄 sendButtons called");
  
  try {
    // 1. Validation: Ensure body text is not empty
    if (!bodyText || typeof bodyText !== 'string' || bodyText.trim().length === 0) {
      console.error("❌ Validation failed: Body text is empty");
      throw new Error('Interactive body text is required and cannot be empty.');
    }

    // 2. Validation: Check button count
    if (!Array.isArray(buttons) || buttons.length < 1 || buttons.length > 3) {
      console.error(`❌ Validation failed: Invalid button count: ${buttons?.length}`);
      throw new Error(
        `Buttons array must have 1–3 items. Received: ${buttons?.length || 0}`
      );
    }

    // 3. Format and validate buttons
    const formattedButtons = buttons.map((btn, idx) => {
      // Safety limits applied: title max 20, id max 256
      const title = String(btn.title || `Button ${idx + 1}`).slice(0, 20);
      const id = String(btn.id || `btn_${idx + 1}`).slice(0, 256);
      
      console.log(`🔘 Button ${idx + 1}: id="${id}" title="${title}"`);
      
      if (!title || title.length === 0) {
        console.error(`❌ Button ${idx + 1} validation failed: Empty title`);
        throw new Error(`Button ${idx + 1} has empty title`);
      }
      if (!id || id.length === 0) {
        console.error(`❌ Button ${idx + 1} validation failed: Empty ID`);
        throw new Error(`Button ${idx + 1} has empty ID`);
      }
      
      return {
        type: "reply",
        reply: { id, title },
      };
    });

    // 4. Construct payload with WhatsApp API limits
    // WhatsApp limits:
    // - Header: max 60 characters (NO MARKDOWN ALLOWED)
    // - Body: max 1024 characters  
    // - Footer: max 60 characters
    // - Button title: max 20 characters
    // - Button ID: max 256 characters
    
    // Clean header - remove markdown formatting (WhatsApp doesn't allow markdown in headers)
    let effectiveHeaderText = headerText 
      ? String(headerText).slice(0, 60)
      : String(bodyText).split('\n')[0].trim().slice(0, 60);
    
    // Remove all markdown formatting from header
    effectiveHeaderText = effectiveHeaderText
      .replace(/\*/g, '')      // Remove asterisks
      .replace(/[`~_]/g, '')   // Remove other markdown characters
      .replace(/[#]/g, '')     // Remove hashtags
      .trim();
    
    // If header is empty after cleaning, use a default
    if (!effectiveHeaderText || effectiveHeaderText.length === 0) {
      effectiveHeaderText = 'Property Details';
    }
    
    // Ensure header doesn't exceed WhatsApp limit
    effectiveHeaderText = effectiveHeaderText.slice(0, 60);
    
    const safeBodyText = String(bodyText).slice(0, 1024);
    
    console.log(`📝 Header (${effectiveHeaderText.length}/60): "${effectiveHeaderText}"`);
    console.log(`📝 Body length: ${safeBodyText.length}/1024`);
    
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { 
          type: "text", 
          text: effectiveHeaderText
        },
        body: { 
          text: safeBodyText 
        },
        action: { 
          buttons: formattedButtons 
        },
        footer: { 
          text: "MarketMatch AI • Tap a button" 
        }
      },
    };

    console.log("📦 Sending interactive buttons to WhatsApp API...");
    
    // 5. Call sendMessage
    const res = await sendMessage(to, payload);
    
    console.log("✅ sendButtons completed successfully");
    return res;
    
  } catch (err) {
    console.error("❌ sendButtons failed:", err.message);
    throw new Error(`sendButtons failed: ${err.message}`);
  }
}

// -------------------------------------------------------------
// 4) SEND INTERACTIVE LIST (WhatsApp menu)
// -------------------------------------------------------------
async function sendList(to, headerText, bodyText, buttonText, sections) {
  console.log("📋 sendList called");
  
  try {
    buttonText =
      typeof buttonText === "string" && buttonText.trim()
        ? buttonText.slice(0, 20) // WhatsApp limit: 20 chars for button text
        : "Select";

    if (!Array.isArray(sections) || sections.length === 0) {
      sections = [
        {
          title: "Menu",
          rows: [{ id: "default", title: "No options available" }],
        },
      ];
    }

    const safeSections = sections.map((sec, sIdx) => ({
      title: String(sec.title || `Section ${sIdx + 1}`).slice(0, 24), // Max 24
      rows:
        Array.isArray(sec.rows) && sec.rows.length
          ? sec.rows.map((r, rIdx) => ({
              id: String(r.id || `row_${sIdx}_${rIdx}`).slice(0, 256), // Max 256
              title: String(r.title || `Option ${rIdx + 1}`).slice(0, 24), // Max 24
              description: r.description
                ? String(r.description).slice(0, 72) // Max 72
                : undefined,
            }))
          : [{ id: `row_${sIdx}_1`, title: "No options available" }],
    }));

    // Clean header text for list as well (no markdown in headers)
    let cleanHeaderText = String(headerText || "Menu")
      .replace(/\*/g, '')
      .replace(/[`~_]/g, '')
      .trim()
      .slice(0, 60);

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { 
          type: "text", 
          text: cleanHeaderText
        },
        body: { 
          text: (bodyText || "Choose an option below").slice(0, 1024) 
        },
        footer: { 
          text: "MarketMatch AI" 
        },
        action: {
          button: buttonText,
          sections: safeSections,
        },
      },
    };

    console.log("📦 Sending interactive list...");
    return await sendMessage(to, payload);
    
  } catch (err) {
    console.error("❌ sendList error:", err.message);
    return null;
  }
}

// -------------------------------------------------------------
// 5) SEND REPLY BUTTONS (Alias for sendButtons for clear intent)
// -------------------------------------------------------------
async function sendReplyButtons(to, bodyText, buttons, headerText) {
  console.log("🔘 sendReplyButtons called");
  return await sendButtons(to, bodyText, buttons, headerText);
}

// -------------------------------------------------------------
// 6) SEND GENERIC TEXT (Alias for sendText)
// -------------------------------------------------------------
async function sendSimpleText(to, text) {
  return await sendText(to, text);
}

function normalizeListingButtonId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

// -------------------------------------------------------------
// 7) SEND LISTING CARD (Uses sendButtons) - UPDATED VERSION
// -------------------------------------------------------------
async function sendListingCard(to, listing, currentIndex, totalCount) {
  console.log("🔄 [MESSAGE SERVICE] sendListingCard called");
  console.log("📊 Listing metadata:", { 
    currentIndex, 
    totalCount,
    listingId: listing.id,
    hasTitle: !!listing.title,
    hasLocation: !!listing.location 
  });
  
  try {
    // 1. Clean and validate the listing ID
    const originalId = String(listing.id || 'unknown');
    const listingId = originalId.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    console.log(`🔧 Listing ID: "${originalId}" → "${listingId}"`);
    
    // 2. Prepare display values
    const listingTitle = cleanString(listing.title || listing.property_type || 'Property', 40);
    const listingLocation = cleanString(listing.location || 'Location not specified', 40);
    const listingPrice = listing.price 
      ? `₹${Number(listing.price).toLocaleString('en-IN')}` 
      : 'Price on request';
    const listingBedrooms = listing.bedrooms || listing.bhk || 'N/A';
    const listingType = listing.property_type || listing.type || 'Property';
    const listingContact = listing.contact || 'Contact not provided';
    const listingDescription = listing.description || 'No description available';

    console.log("🎨 Formatted listing:", {
      title: listingTitle,
      location: listingLocation,
      price: listingPrice,
      bedrooms: listingBedrooms,
      type: listingType,
      contact: listingContact
    });

    // 3. Construct the message body
    const bodyText = 
`🏡 *Listing ${currentIndex + 1} of ${totalCount}*

*${listingTitle}*
📍 ${listingLocation}
💰 ${listingPrice}
🛏️ ${listingBedrooms} BHK • ${listingType}

Tap a button below to interact.`;

    console.log(`📝 Body text length: ${bodyText.length}/1024`);

    const buttonListingId = normalizeListingButtonId(listing.id);

  // 4. Construct buttons - MATCHING CONTROLLER'S EXPECTED IDs
  const buttons = [
    { 
      id: `VIEW_DETAILS_${buttonListingId}`, 
      title: "📄 View Details" 
    },
    { 
      id: `INTERESTED_${buttonListingId}`, 
      title: "🤝 I'm Interested" 
    },
    { 
      id: "NEXT_LISTING", 
      title: "⏭️ Next" 
    },
  ];

    console.log("🔘 Prepared buttons:", buttons.map(b => ({ id: b.id, title: b.title })));

    // 5. Prepare header (CLEANED - NO MARKDOWN)
    let headerText = `🏡 ${listingTitle}`.slice(0, 60);
    // Remove emojis and ensure clean header
    headerText = headerText.replace(/[🏡📍💰🛏️]/g, '').trim();
    if (!headerText || headerText.length === 0) {
      headerText = 'Property Listing';
    }
    
    console.log(`📋 Header: "${headerText}"`);
    console.log("📤 Calling sendReplyButtons...");
    
    // 6. Send the interactive message
    const result = await sendReplyButtons(to, bodyText, buttons, headerText);
    
    console.log("✅ [MESSAGE SERVICE] sendListingCard completed successfully!");
    return result;
    
  } catch (error) {
    console.error("❌ [MESSAGE SERVICE] sendListingCard ERROR:", error.message);
    console.error("❌ Error details:", error);
    
    // 7. FALLBACK - Text version with Save option
    console.log("🔄 Falling back to text message...");
    
    const fallbackText = 
`🏡 *Listing ${currentIndex + 1} of ${totalCount}*
${listing.title || 'Property Listing'}

📍 ${listing.location || 'Location not specified'}
💰 ${listing.price || 'Price on request'}
🛏️ ${listing.bedrooms || listing.bhk || 'N/A'} BHK

*Reply with:*
• "next" - Next listing
• "view" - View details
• "interested" - I'm interested in this property`;

    return await sendText(to, fallbackText);
  }
}

// -------------------------------------------------------------
// 8) SEND SAVED LISTING CARD (For Saved Listings view)
// -------------------------------------------------------------
async function sendSavedListingCard(to, listing, index, total) {
  console.log("❤️ [MESSAGE SERVICE] sendSavedListingCard called");
  
  try {
    // Prepare display values
    const listingTitle = cleanString(listing.title || listing.property_type || 'Saved Property', 40);
    const listingLocation = cleanString(listing.location || 'Location not specified', 40);
    const listingPrice = listing.price 
      ? `₹${Number(listing.price).toLocaleString('en-IN')}` 
      : 'Price on request';
    const listingBedrooms = listing.bedrooms || listing.bhk || 'N/A';
    const listingType = listing.property_type || listing.type || 'Property';
    
    // Saved at timestamp if available
    let savedInfo = '';
    if (listing.savedAt) {
      const savedDate = new Date(listing.savedAt);
      const timeAgo = getTimeAgo(savedDate);
      savedInfo = `\n📅 Saved ${timeAgo}`;
    }

    const bodyText = 
`❤️ *Saved Listing ${index + 1} of ${total}*

*${listingTitle}*
📍 ${listingLocation}
💰 ${listingPrice}
🛏️ ${listingBedrooms} BHK • ${listingType}${savedInfo}`;

    const buttons = [
      { 
        id: `view_saved_${listing.id}`, 
        title: "📄 View Details" 
      },
      { 
        id: `remove_saved_${listing.id}`, 
        title: "🗑️ Remove" 
      },
      { 
        id: "next_saved", 
        title: "⏭️ Next" 
      },
    ];

    const headerText = '❤️ Saved Listing';

    return await sendReplyButtons(to, bodyText, buttons, headerText);
    
  } catch (error) {
    console.error("❌ sendSavedListingCard error:", error);
    
    // Fallback text
    const fallbackText = 
`❤️ Saved Listing ${index + 1} of ${total}
${listing.title || 'Property'}

Location: ${listing.location || 'N/A'}
Price: ${listing.price || 'N/A'}

Reply with:
• "view" - View details
• "remove" - Remove from saved`;

    return await sendText(to, fallbackText);
  }
}

// -------------------------------------------------------------
// 9) HELPER FUNCTIONS
// -------------------------------------------------------------
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

// -------------------------------------------------------------
// 10) SEND INTERACTIVE BUTTONS (for voice service compatibility) - UPDATED WITH PROPER VALIDATION
// -------------------------------------------------------------
async function sendInteractiveButtons(to, message, buttons) {
  console.log("🔘 [MESSAGE SERVICE] sendInteractiveButtons called");
  
  try {
    // Validate buttons parameter
    if (!buttons) {
      console.error("❌ [INTERACTIVE] No buttons provided");
      buttons = [
        { id: 'default_yes', text: '✅ Yes' },
        { id: 'default_no', text: '🔄 No' },
        { id: 'default_type', text: '📝 Type' }
      ];
    }
    
    // Ensure buttons is an array
    if (!Array.isArray(buttons)) {
      console.error("❌ [INTERACTIVE] Buttons is not an array:", typeof buttons);
      buttons = [];
    }
    
    console.log("🔘 Message:", message.substring(0, 50) + (message.length > 50 ? "..." : ""));
    console.log("🔘 Button count:", buttons.length);
    
    // Format buttons for WhatsApp API
    const formattedButtons = buttons.map((btn, index) => {
      // Handle different button formats
      const id = btn.id || btn.buttonId || `btn_${index}`;
      const text = btn.text || btn.title || btn.buttonText || `Option ${index + 1}`;
      
      console.log(`🔘 Button ${index + 1}: id="${String(id).slice(0, 20)}", text="${String(text).slice(0, 20)}"`);
      
      return {
        type: "reply",
        reply: {
          id: String(id).slice(0, 256), // WhatsApp limit: 256 chars
          title: String(text).slice(0, 20) // WhatsApp limit: 20 chars
        }
      };
    });

    // Ensure we have at least one button
    if (formattedButtons.length === 0) {
      console.error("❌ [INTERACTIVE] No valid buttons after formatting");
      formattedButtons.push({
        type: "reply",
        reply: {
          id: "default_ok",
          title: "✅ OK"
        }
      });
    }

    // Create interactive payload
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: String(message).slice(0, 1024) // WhatsApp limit: 1024 chars
        },
        action: {
          buttons: formattedButtons
        }
      }
    };

    console.log("📦 Sending interactive buttons via sendMessage...");
    const result = await sendMessage(to, payload);
    console.log("✅ sendInteractiveButtons completed successfully");
    return result;
    
  } catch (error) {
    console.error("❌ sendInteractiveButtons error:", error.message);
    console.error("❌ Error stack:", error.stack);
    
    // Detailed fallback to simple text
    try {
      console.log("🔄 Falling back to text message...");
      
      // If these look like confirmation buttons, provide a clear friendly fallback
      const hasConfirmButtons = Array.isArray(buttons) && buttons.some(b => {
        const id = (b.id || b.buttonId || '').toString();
        return id.includes('confirm_yes') || id.includes('confirm_no') || id.includes('type_instead');
      });

      const fallbackText = hasConfirmButtons
        ? `${message}\n\nPlease reply with:\n✅ Yes - if I heard correctly.\n🔄 No - to try again.\n📝 Type - to type instead.`
        : Array.isArray(buttons) 
          ? `${message}\n\nPlease reply with:\n` + buttons.map((btn, i) => {
              const text = btn.text || btn.title || btn.buttonText || btn.id || `Option ${i + 1}`;
              return `${i + 1}. ${text}`;
            }).join('\n')
          : `${message}\n\nPlease reply with:\n1. ✅ Yes\n2. 🔄 No\n3. 📝 Type`;
      
      console.log("📤 Sending fallback text message...");
      return await sendText(to, fallbackText);
    } catch (fallbackError) {
      console.error("❌ Ultimate fallback also failed:", fallbackError.message);
      throw error; // Re-throw original error
    }
  }
}

// -------------------------------------------------------------
// 11) SEND MESSAGE WITH CLIENT PARAMETER (for compatibility)
// -------------------------------------------------------------
async function sendMessageWithClient(to, message, client = null) {
  // Ignore client parameter, use our own sendMessage
  console.log("📤 sendMessageWithClient called (client ignored)");
  return await sendMessage(to, message);
}

// -------------------------------------------------------------
// 12) SEND INTERACTIVE BUTTONS WITH CLIENT (for compatibility)
// -------------------------------------------------------------
async function sendInteractiveButtonsWithClient(client, to, message, buttons) {
  // Ignore client parameter, use our own function
  console.log("🔘 sendInteractiveButtonsWithClient called (client ignored)");
  return await sendInteractiveButtons(to, message, buttons);
}

// -------------------------------------------------------------
// 13) SEND CONFIRMATION WITH BUTTONS (for posting service)
// -------------------------------------------------------------
async function sendConfirmationWithButtons(to, message, confirmText = "✅ Yes, Post It", cancelText = "❌ No, Cancel") {
  console.log("✅ [MESSAGE SERVICE] sendConfirmationWithButtons called");
  
  const buttons = [
    { id: 'confirm_yes', title: confirmText },
    { id: 'confirm_no', title: cancelText }
  ];
  
  return await sendInteractiveButtons(to, message, buttons);
}

// -------------------------------------------------------------
// 14) SEND LISTING SUMMARY (for posting flow)
// -------------------------------------------------------------
async function sendListingSummary(to, summary, buttons = null) {
  console.log("📋 [MESSAGE SERVICE] sendListingSummary called");
  
  if (!buttons) {
    buttons = [
      { id: 'confirm_yes', title: '✅ Yes' },
      { id: 'confirm_no', title: '🔄 No' },
      { id: 'type_instead', title: '📝 Type' }
    ];
  }
  
  const message = `${summary}\n\n✅ Is this correct?`;
  
  return await sendInteractiveButtons(to, message, buttons);
}

// -------------------------------------------------------------
// 15) EXPORTS
// -------------------------------------------------------------
module.exports = {
  sendMessage, 
  sendText,
  sendButtons, 
  sendList,
  sendReplyButtons, 
  sendSimpleText,
  sendListingCard,
  sendSavedListingCard,
  
  // Compatibility functions
  sendInteractiveButtons,      // For voice service
  sendMessageWithClient,       // For controller compatibility
  sendInteractiveButtonsWithClient,  // For controller compatibility
  
  // New functions for posting flow
  sendConfirmationWithButtons,
  sendListingSummary,

  // Error class for callers
  ApiSendError
};