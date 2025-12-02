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
    console.error("❌ sendMessage error:", err.response?.data || err);
    return null;
  }
}

// -------------------------------------------------------------
// 2) SEND INTERACTIVE BUTTONS (1–3 buttons only)
// -------------------------------------------------------------
async function sendListingCard(to, listing, index = 0, total = 1) {
  try {
    // ⚠️ CRITICAL FIX: Ensure listing has a usable ID. Use 'unknown' if missing.
    const listingId = String(listing.id || 'unknown').slice(0, 50);

    const bodyText =
      `🏡 ${listing.title || "Property"}\n` +
      `💰 Price: ${listing.price ? `₹${listing.price}` : 'N/A'}\n` +
      `📍 ${listing.location || "Location N/A"}\n` +
      `📏 ${listing.area || listing.size || "Area N/A"}\n` +
      `🛋 ${listing.furnishing || "N/A"}\n\n` +
      `(${index + 1} of ${total})`;


    const buttons = [
      {
        id: `view_${listingId}`, // Use the guaranteed string ID
        title: "View Details",
      },
      {
        id: `save_${listingId}`, // Use the guaranteed string ID
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
// 🚀 SEND LISTING CARD (Utility that uses sendButtons)
// -------------------------------------------------------------
async function sendListingCard(to, listing, index = 0, total = 1) {
  try {
    const bodyText =
      `🏡 ${listing.title || "Property"}\n` +
      `💰 Price: ${listing.price ? `₹${listing.price}` : 'N/A'}\n` +
      `📍 ${listing.location || "Location N/A"}\n` +
      `📏 ${listing.area || listing.size || "Area N/A"}\n` +
      `🛋 ${listing.furnishing || "N/A"}\n\n` +
      `(${index + 1} of ${total})`;


    const buttons = [
      {
        id: `view_${listing.id}`,
        title: "View Details",
      },
      {
        id: `save_${listing.id}`,
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