const axios = require("axios");

// Note: These variables must be available in the environment where this code runs.
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// --- Utility function for cleaning strings ---
// NOTE: This utility should only be used for general cleaning, not for imposing
// character limits. Specific limits must be applied at the payload level via slice().
function cleanString(str) {
  if (typeof str !== 'string') return '';
  // Remove characters that might break JSON or WhatsApp formatting
  return str.replace(/[\n\t\r]/g, ' ').trim().slice(0, 100);
}

// -------------------------------------------------------------
// 1) SEND MESSAGE (FINAL, UNCONDITIONAL LOGGING)
// -------------------------------------------------------------
async function sendMessage(to, messageOrPayload) {
  const logType = messageOrPayload.type || 'Text';
  const payload = typeof messageOrPayload === 'string'
    ? { messaging_product: "whatsapp", to, type: "text", text: { body: messageOrPayload } }
    : messageOrPayload;

  try {
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
    // ⚠️ CRITICAL: Log the simplest possible error message.
    console.error("❌ FINAL SEND MESSAGE ERROR (AXIOS): Status:", err.response?.status, "Message:", err.message);

    // Log the entire response data if available (this is usually the API error body)
    if (err.response?.data) {
      console.error("❌ FINAL SEND MESSAGE API RESPONSE BODY:", JSON.stringify(err.response.data));
    }

    // Log the configuration error (e.g., if URL/Headers failed)
    if (err.config) {
      console.error("❌ AXIOS CONFIG ERROR:", err.config?.url); 
    }

    return null;
  }
}

// -------------------------------------------------------------
// 2) SEND TEXT (Re-introduced: Sends a simple text message)
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
// 3) SEND INTERACTIVE BUTTONS (1–3 buttons only) - The foundation for dynamic cards
// -------------------------------------------------------------
async function sendButtons(to, bodyText, buttons, headerText) {
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
      // Safety limits applied: title max 20, id max 256
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

    // 4. Construct payload (ADDED HEADER for robustness)
    const effectiveHeaderText = headerText 
      ? String(headerText).slice(0, 60) // Use provided header if available (Max 60)
      : String(bodyText).split('\n')[0].trim().slice(0, 60); // Use first line of body as fallback header (Max 60)

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        // ⭐ FIX: Added header for reliability with WABA API
        header: { type: "text", text: effectiveHeaderText || 'Action Required' },
        body: { text: bodyText }, // Body max 1024
        action: { buttons: formattedButtons },
        footer: { text: "Tap a button to interact." } // Footer max 60
      },
    };

    // ⚠️ DEBUG: Log the generated payload before sending to help diagnose silent rejection
    console.log(`[DEBUG] sendButtons Payload for ${to}:`, JSON.stringify(payload, null, 2));


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
// 4) SEND INTERACTIVE LIST (WhatsApp menu)
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
        header: { type: "text", text: String(headerText || "Menu").slice(0, 60) }, // Max 60
        body: { text: bodyText || "Choose an option below" }, // Body max 1024
        footer: { text: "MarketMatch AI" }, // Footer max 60
        action: {
          button: String(buttonText).slice(0, 20), // Button max 20
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
// 5) SEND LISTING CARD (FIXED: Uses Quick Reply Buttons for dynamic card display)
// -------------------------------------------------------------
async function sendListingCard(to, listing, index = 0, total = 1) {
  try {
    if (!listing || typeof listing !== "object") {
      console.error("❌ sendListingCard: Invalid listing object:", listing);
      return null;
    }

    const listingId = String(listing.id || "unknown").slice(0, 50);

    // 1. Build the rich text body content (Header text is passed separately to sendButtons)
    const price = listing.price ? `₹${String(listing.price).replace(/[^\d]/g, '')}` : "N/A";
    const title = String(listing.title || listing.property_type || "Property").slice(0, 60);

    const bodyText = 
      `🏠 *${title}* • ${price}\n` +
      `📍 ${listing.location || 'Location unavailable'}\n` +
      `🛏 ${listing.bedrooms || 'N/A'} | 🚿 ${listing.bathrooms || 'N/A'}\n` +
      `📏 ${listing.area || 'N/A'} sq.ft\n\n` +
      `_Listing ${index + 1} of ${total}_\n\n` +
      `What would you like to do?`;

    // 2. Define the quick reply buttons
    const buttons = [
      { id: `view_${listingId}`, title: "View Details" }, // Note: Renamed from 'View' to 'View Details' for clarity
      // Use the static ID your router expects for the next action, as it's session-aware
      { id: "next_listing", title: "Next Listing" }, 
      { id: `save_${listingId}`, title: "Save Listing" } // Note: Renamed from 'Save ❤️' to 'Save Listing' for button length
    ];

    // 3. Use the robust sendButtons function to dispatch the Interactive Button message
    // We use the listing title as the header text.
    return await sendButtons(to, bodyText, buttons, title);
  } catch (err) {
    console.error("❌ sendListingCard error:", err.message);
    return null;
  }
}


// -------------------------------------------------------------
// 6) SEND GENERIC TEXT (Alias for sendText)
// -------------------------------------------------------------
async function sendSimpleText(to, text) {
  return await sendText(to, text);
}


// -------------------------------------------------------------
// 7) EXPORTS (FIXED: All core functions are exported)
// -------------------------------------------------------------
module.exports = {
  sendMessage, 
  sendText,
  sendButtons, 
  sendList,
  sendListingCard,
  sendSimpleText,
};