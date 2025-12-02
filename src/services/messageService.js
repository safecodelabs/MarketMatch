// =======================================================
// ✅ PATCHED FILE: src/services/messageService.js
// =======================================================
const axios = require("axios");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

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
        header: { // Adding a header as a last resort, using 'text' type
            type: "text",
            text: "Listing Details" // This text must be < 60 characters
        }, 
        body: { text: bodyText },
        action: { buttons: formattedButtons },
        footer: { text: "Tap a button to interact." } // Adding a mandatory-style footer
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
    // 1. Use DUMMY/STATIC content for testing
    const bodyText = `Listing Test ${index + 1} of ${total}:\n\nIf this message appears, the interactive button logic is working, and the previous issue was due to dynamic data or payload complexity.`;

    // 2. Use DUMMY buttons (simple and short IDs)
    const buttons = [
      {
        id: `d_view`,
        title: "View Details (TEST)",
      },
      {
        id: `d_save`,
        title: "Save (TEST)",
      },
      {
        id: `d_next`,
        title: "Next (TEST)",
      },
    ];

    // 3. Use sendButtons utility
    return await sendButtons(to, bodyText, buttons);
  } catch (err) {
    console.error("❌ sendListingCard caught unhandled error:", err.message, "Listing Index:", index);
    return null;
  }
}


module.exports = {
  sendMessage,
  sendButtons,
  sendList,
  sendListingCard,
};