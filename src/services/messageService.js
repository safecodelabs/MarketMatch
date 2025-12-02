// =======================================================
// ✅ PATCHED FILE: src/services/messageService.js
// =======================================================
const axios = require("axios");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// -------------------------------------------------------------
// 1) SEND NORMAL TEXT MESSAGE (OR RAW PAYLOAD)
// -------------------------------------------------------------
async function sendMessage(to, messageOrPayload) {
  try {
    let payload;
    let logType;

    // If the input is an object, assume it's a raw payload (e.g., interactive card)
    if (typeof messageOrPayload === 'object' && messageOrPayload !== null) {
        payload = messageOrPayload;
        logType = payload.type === 'interactive' ? 'Interactive Card' : 'Raw Message';
    } else {
        // Otherwise, construct a standard text message payload
        payload = {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: String(messageOrPayload) },
        };
        logType = 'Text';
    }

    const res = await axios.post(API_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

const messageId = res.data.messages?.[0]?.id || 'N/A';
    console.log(`📤 ${logType} sent (ID: ${messageId}):`, res.data); 
    return res.data;
  } catch (err) {
    // ⚠️ CRITICAL DIAGNOSTIC: Log the full error JSON to capture API rejection details.
    const errorDetails = err.response?.data || err.message || err;
    console.error("❌ sendMessage API ERROR:", JSON.stringify(errorDetails, null, 2));
    return null;
  }
}

// -------------------------------------------------------------
// 2) SEND INTERACTIVE BUTTONS (1–3 buttons only) - (NEWLY ADDED/FIXED)
// -------------------------------------------------------------
async function sendButtons(to, bodyText, buttons) {
  try {
    // 1. Validation: Ensure body text is not empty
    if (!bodyText || typeof bodyText !== 'string' || bodyText.trim().length === 0) {
        throw new Error('Interactive body text is required and cannot be empty.');
    }
    
    // 2. Validation: Check button count
    if (!Array.isArray(buttons) || buttons.length < 1 || buttons.length > 3) {
      throw new Error(
        `Buttons array must have 1–3 items. Received: ${buttons?.length || 0}`
      );
    }

    // 3. Format and validate buttons
    const formattedButtons = buttons.map((btn, idx) => {
        const title = String(btn.title || `Button ${idx + 1}`).slice(0, 20);
        const id = String(btn.id || `btn_${idx + 1}`).slice(0, 256);
        if (!title || !id) {
            console.error(`[ERROR] Button validation failed: Title=${title}, ID=${id}`);
            throw new Error('Button title or ID validation failed.');
        }
        return {
          type: "reply",
          reply: { id, title },
        };
    });

    // 4. Construct payload
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: { buttons: formattedButtons },
      },
    };

    // 5. Call sendMessage and check response
    const res = await sendMessage(to, payload);
    
    // ⚠️ CRITICAL DEBUG: If sendMessage failed, log it here.
    if (res === null) {
        console.error("❌ sendButtons: sendMessage returned NULL (API REJECTION LIKELY).");
    }
    
    return res;
  } catch (err) {
    console.error("❌ sendButtons failure (returning null):", err.message, "Recipient:", to);
    return null; 
  }
}


// -------------------------------------------------------------
// 3) SEND INTERACTIVE LIST (WhatsApp menu)
// -------------------------------------------------------------
async function sendList(to, headerText, bodyText, buttonText, sections) {
  try {
    buttonText =
      typeof buttonText === "string" && buttonText.trim()
        ? buttonText
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
      title: sec.title || `Section ${sIdx + 1}`,
      rows:
        Array.isArray(sec.rows) && sec.rows.length
          ? sec.rows.map((r, rIdx) => ({
              id: String(r.id || `row_${sIdx}_${rIdx}`).slice(0, 256),
              title: String(r.title || `Option ${rIdx + 1}`).slice(0, 24),
              description: r.description
                ? String(r.description).slice(0, 72)
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
        header: { type: "text", text: headerText || "Menu" },
        body: { text: bodyText || "Choose an option below" },
        footer: { text: "MarketMatch AI" },
        action: {
          button: buttonText,
          sections: safeSections,
        },
      },
    };

    // Use generic sendMessage for sending the payload
    return await sendMessage(to, payload);
  } catch (err) {
    console.error("❌ sendList error:", err.response?.data || err);
    return null;
  }
}

// -------------------------------------------------------------
// 4) SEND LISTING CARD (Utility that uses sendButtons) - (FINAL FIX: BODY LENGTH)
// -------------------------------------------------------------
async function sendListingCard(to, listing, index = 0, total = 1) {
  try {
    // 1. Ensure listing has a usable ID (from previous fix)
    const listingId = String(listing.id || 'unknown').slice(0, 50);
    
    // 2. Build bodyText with safe string lengths for dynamic fields
    const rawBodyText =
      `🏡 ${String(listing.title || "Property").slice(0, 100)}\n` +
      `💰 Price: ${listing.price ? `₹${listing.price}` : 'N/A'}\n` +
      `📍 ${String(listing.location || "Location N/A").slice(0, 100)}\n` +
      `📏 ${String(listing.area || listing.size || "Area N/A").slice(0, 50)}\n` +
      `🛋 ${String(listing.furnishing || "N/A").slice(0, 50)}\n\n` +
      `(${index + 1} of ${total})`;
    
    // 3. CRITICAL: Truncate the final body text to ensure it's under the 1024 limit
    // We'll use a safer limit like 950 just in case.
    const bodyText = rawBodyText.slice(0, 950);

    const buttons = [
      {
        id: `view_${listingId}`,
        title: "View Details",
      },
      {
        id: `save_${listingId}`,
        title: "Save ❤️",
      },
      {
        id: `next_listing`,
        title: "Next ➡",
      },
    ];

    // Use sendButtons utility
    return await sendButtons(to, bodyText, buttons);
  } catch (err) {
    console.error("❌ sendListingCard error:", err);
    return null;
  }
}


module.exports = {
  sendMessage,
  sendButtons,
  sendList,
  sendListingCard,
};