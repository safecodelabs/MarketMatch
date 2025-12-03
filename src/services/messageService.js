const axios = require("axios");

// Note: These variables must be available in the environment where this code runs.
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// --- Utility function for cleaning strings ---
function cleanString(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  // Remove characters that might break JSON or WhatsApp formatting
  return str.replace(/[\n\t\r]/g, ' ').trim().slice(0, maxLength);
}

// -------------------------------------------------------------
// 1) SEND MESSAGE (FINAL, UNCONDITIONAL LOGGING)
// -------------------------------------------------------------
async function sendMessage(to, messageOrPayload) {
  const logType = messageOrPayload.type || 'Text';
  const payload = typeof messageOrPayload === 'string'
    ? { messaging_product: "whatsapp", to, type: "text", text: { body: messageOrPayload } }
    : messageOrPayload;

  // Add debug logging for payload type
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
    return res.data;
  } catch (err) {
    console.error("❌ FINAL SEND MESSAGE ERROR:");
    console.error("❌ Status:", err.response?.status);
    console.error("❌ Message:", err.message);
    
    // Log the payload that caused the error (but truncate for readability)
    const payloadForLog = JSON.stringify(payload, null, 2);
    console.error("❌ Payload sent:", payloadForLog.substring(0, 500) + (payloadForLog.length > 500 ? "..." : ""));

    // Log the entire response data if available
    if (err.response?.data) {
      console.error("❌ API Error Response:", JSON.stringify(err.response.data));
    }

    // RETHROW THE ERROR to be caught by the calling function
    throw new Error(`API Send Failed: ${err.message}`, { cause: err.response?.data });
  }
}

// -------------------------------------------------------------
// 2) SEND TEXT (Sends a simple text message)
// -------------------------------------------------------------
async function sendText(to, text) {
  const payload = {
    messaging_product: "whatsapp",
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
    // - Header: max 60 characters
    // - Body: max 1024 characters  
    // - Footer: max 60 characters
    // - Button title: max 20 characters
    // - Button ID: max 256 characters
    
    const effectiveHeaderText = headerText 
      ? String(headerText).slice(0, 60)
      : String(bodyText).split('\n')[0].trim().slice(0, 60);
    
    const safeBodyText = String(bodyText).slice(0, 1024);
    
    console.log(`📝 Header (${effectiveHeaderText.length}/60): "${effectiveHeaderText}"`);
    console.log(`📝 Body length: ${safeBodyText.length}/1024`);
    
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        header: { 
          type: "text", 
          text: effectiveHeaderText || 'Property Listing' 
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

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { 
          type: "text", 
          text: String(headerText || "Menu").slice(0, 60) 
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

// -------------------------------------------------------------
// 7) SEND LISTING CARD (Uses sendButtons) - REFINED VERSION
// -------------------------------------------------------------
async function sendListingCard(to, listing, currentIndex, totalCount) {
    console.log("🔄 sendListingCard called");
    console.log("📊 Listing metadata:", { 
        currentIndex, 
        totalCount,
        listingId: listing.id,
        hasTitle: !!listing.title,
        hasLocation: !!listing.location 
    });
    
    try {
        // 1. Clean and validate the listing ID
        // WhatsApp button IDs cannot contain special characters except underscore and hyphen
        const originalId = String(listing.id || 'unknown');
        const listingId = originalId.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        if (listingId !== originalId) {
            console.log(`🔧 Cleaned ID: "${originalId}" → "${listingId}"`);
        }
        
        // 2. Prepare display values with safe defaults
        const listingTitle = cleanString(listing.title || listing.property_type || 'Property', 40);
        const listingLocation = cleanString(listing.location || 'Location not specified', 40);
        const listingPrice = listing.price 
            ? `₹${Number(listing.price).toLocaleString('en-IN')}` 
            : 'Price on request';
        const listingBedrooms = listing.bedrooms || listing.bhk || 'N/A';
        const listingType = listing.property_type || listing.type || 'Property';

        console.log("🎨 Formatted listing data:", {
            title: listingTitle,
            location: listingLocation,
            price: listingPrice,
            bedrooms: listingBedrooms,
            type: listingType
        });

        // 3. Construct the message body (within WhatsApp's 1024 char limit)
        const bodyText = 
`🏡 *Listing ${currentIndex + 1} of ${totalCount}*

*${listingTitle}*
📍 ${listingLocation}
💰 ${listingPrice}
🛏️ ${listingBedrooms} BHK • ${listingType}

Tap a button below to interact.`;

        console.log(`📝 Body text length: ${bodyText.length}/1024`);

        // 4. Construct buttons with SIMPLIFIED IDs for WhatsApp compatibility
        // Critical: Keep button IDs short and simple
        const buttons = [
            { 
                id: `VIEW_${listingId.slice(0, 20)}`, // Keep it short
                title: "View Details" 
            },
            { 
                id: `SAVE_${listingId.slice(0, 20)}`, // Keep it short  
                title: "Save" 
            },
            { 
                id: "NEXT", // Simple static ID
                title: "Next >>" 
            },
        ];

        console.log("🔘 Prepared buttons:", buttons.map(b => ({ id: b.id, title: b.title })));

        // 5. Prepare header (max 60 chars)
        const headerText = `🏡 ${listingTitle}`.slice(0, 60);
        
        console.log(`📋 Header: "${headerText}" (${headerText.length}/60)`);
        console.log("📤 Sending listing card...");
        
        // 6. Send the interactive message
        const result = await sendReplyButtons(to, bodyText, buttons, headerText);
        
        console.log("✅ Listing card sent successfully!");
        return result;
        
    } catch (error) {
        console.error("❌ ERROR in sendListingCard:", error.message);
        
        // 7. FALLBACK: Send a simple text message if interactive fails
        console.log("🔄 Falling back to text message...");
        
        const fallbackText = 
`🏡 *Listing ${currentIndex + 1} of ${totalCount}*
${listing.title || 'Property Listing'}

📍 ${listing.location || 'Location not specified'}
💰 ${listing.price || 'Price on request'}
🛏️ ${listing.bedrooms || listing.bhk || 'N/A'} BHK

Reply with:
• "next" - Next listing
• "view" - View details
• "save" - Save this listing`;

        return await sendText(to, fallbackText);
    }
}

// -------------------------------------------------------------
// 8) EXPORTS
// -------------------------------------------------------------
module.exports = {
  sendMessage, 
  sendText,
  sendButtons, 
  sendList,
  sendReplyButtons, 
  sendSimpleText,
  sendListingCard, 
};