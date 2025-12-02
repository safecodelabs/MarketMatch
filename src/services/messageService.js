const axios = require("axios");

// Note: These variables must be available in the environment where this code runs.
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// --- Utility function for cleaning strings ---
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
// 5) SEND REPLY BUTTONS (Alias for sendButtons for clear intent)
// -------------------------------------------------------------
/**
 * Sends a message with 1 to 3 quick reply buttons.
 * Used in chatbotController.js for interactive listings.
 * @param {string} to - Recipient WA_ID
 * @param {string} bodyText - The main text of the message
 * @param {Array<{id: string, title: string}>} buttons - Array of button objects (max 3)
 * @param {string} [headerText] - Optional header text for the interactive message
 * @returns {Promise<object|null>} API response data
 */
async function sendReplyButtons(to, bodyText, buttons, headerText) {
  // Use the core sendButtons function
  return await sendButtons(to, bodyText, buttons, headerText);
}


// -------------------------------------------------------------
// 6) SEND GENERIC TEXT (Alias for sendText)
// -------------------------------------------------------------
async function sendSimpleText(to, text) {
  return await sendText(to, text);
}

// -------------------------------------------------------------
// 7) SEND LISTING CARD (Uses sendButtons)
// -------------------------------------------------------------
/**
 * Sends an interactive listing card with property details and action buttons.
 * This function cleans the Firestore ID for button safety.
 * @param {string} to - Recipient WA_ID
 * @param {object} listing - Listing object with id, title, location, price, bedrooms, property_type
 * @param {number} currentIndex - Index of the current listing
 * @param {number} totalCount - Total number of listings
 * @returns {Promise<object|null>} API response data
 */
async function sendListingCard(to, listing, currentIndex, totalCount) {
    // 1. Prepare safe IDs and display text
    // Replace non-alphanumeric characters (except underscore and hyphen) with underscore for ID safety.
    const listingId = String(listing.id).replace(/[^a-zA-Z0-9_-]/g, '_'); 
    const listingTitle = cleanString(listing.title);
    const listingLocation = cleanString(listing.location);
    const listingPrice = listing.price ? `₹${Number(listing.price).toLocaleString('en-IN')}` : 'N/A';
    const listingBedrooms = listing.bedrooms || 'N/A';
    const listingType = listing.property_type || 'Property';

    // 2. Construct the message body
    const bodyText = 
`🏡 *Listing ${currentIndex + 1} of ${totalCount}*
*Title:* ${listingTitle}
*Location:* ${listingLocation}
*Type:* ${listingType} (${listingBedrooms})
*Price:* ${listingPrice}

Tap 'View Details' for contact info or 'Next' to skip.`;

    // 3. Construct the buttons
    const buttons = [
        // Button 1: View Details (Uses the cleaned ID)
        { id: `VIEW_DETAILS_${listingId}`, title: "View Details" },
        // Button 2: Save for later (Uses the cleaned ID)
        { id: `SAVE_LISTING_${listingId}`, title: "Save Listing" },
        // Button 3: Next (Uses the standard ID from the controller)
        { id: "NEXT_LISTING", title: "Next >>" },
    ];

    // 4. Send the buttons message
    return await sendReplyButtons(to, bodyText, buttons, `MarketMatch Listing: ${listingTitle}`);
}


// -------------------------------------------------------------
// 8) EXPORTS (FIXED: All core functions are exported, including new one)
// -------------------------------------------------------------
module.exports = {
  sendMessage, 
  sendText,
  sendButtons, 
  sendList,
  sendReplyButtons, 
  sendSimpleText,
  sendListingCard, // ⭐ NEW: Exported for use in chatbotController.js
};