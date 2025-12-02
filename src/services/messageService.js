const axios = require("axios");

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
        console.error("❌ AXIOS CONFIG ERROR:", JSON.config?.url);
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
// 3) SEND INTERACTIVE BUTTONS (1–3 buttons only) - (MINIMAL PAYLOAD)
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

    // 4. Construct payload (MINIMAL payload to avoid WABA issues)
    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: bodyText },
            action: { buttons: formattedButtons },
            footer: { text: "Tap a button to interact." }
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
// 5) SEND LISTING CARD (Robust with Text Fallback)
// -------------------------------------------------------------
async function sendListingCard(to, listing, index = 0, total = 1) {
    try {
        // 1. Data Cleaning and Safety Checks
        const listingId = String(listing.id || 'unknown').slice(0, 50);
        const title = String(listing.title || "Property").slice(0, 100);
        const price = listing.price ? `₹${String(listing.price).replace(/[^\d,\.]/g, '')}` : 'N/A';
        const location = String(listing.location || "Location N/A").slice(0, 100);
        const area = String(listing.area || listing.size || "Area N/A").slice(0, 50);
        const furnishing = String(listing.furnishing || "N/A").slice(0, 50);

        // 2. Build bodyText (Max 1024 chars for interactive/text)
        const rawBodyText =
            `🏡 ${title}\n` +
            `💰 Price: ${price}\n` +
            `📍 ${location}\n` +
            `📏 ${area}\n` +
            `🛋 ${furnishing}\n\n` +
            // Fixed redundant text:
            `Listing ${index + 1} of ${total}\n\n` +
            `*To view details, reply with: view ${listingId}*\n` + 
            `*To see the next listing, reply with: next*`;
        
        // Final truncation to ensure safe body length (under 1024 chars)
        const bodyText = rawBodyText.slice(0, 950);

        // 3. Define buttons
        const buttons = [
            { id: `view_${listingId}`, title: "View Details" },
            { id: `save_${listingId}`, title: "Save ❤️" },
            { id: `next_listing`, title: "Next ➡" },
        ];

        // 4. ATTEMPT INTERACTIVE BUTTONS
        const interactiveResponse = await sendButtons(to, bodyText, buttons);

        // 5. ROBUST TEXT FALLBACK (if interactive failed)
        if (!interactiveResponse) {
            console.warn(`⚠️ [${to}] Interactive Button Card failed. Falling back to robust text message.`);
            
            // Send the key information with clear text instructions
            const textMessage = 
                `*Listing ${index + 1} of ${total}*:\n` +
                `🏡 ${title}\n` +
                `💰 Price: ${price}\n` +
                `📍 ${location}\n` +
                `\n` +
                `*Reply with 'Next' to see the next listing.*\n` +
                `*To view details, type 'View ${listingId}'*`;

            return await sendText(to, textMessage);
        }

        return interactiveResponse;
    } catch (err) {
        console.error("❌ sendListingCard caught unhandled error:", err.message, "Listing Index:", index);
        return null;
    }
}


// -------------------------------------------------------------
// 6) SEND GENERIC TEXT (Alias for sendText)
// -------------------------------------------------------------
async function sendSimpleText(to, text) {
    return await sendText(to, text);
}


export {
    sendText,
    sendList,
    sendListingCard,
    sendSimpleText,
    // Note: sendButtons is not exported as it's an internal utility
};