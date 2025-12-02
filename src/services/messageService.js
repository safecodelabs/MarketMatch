// src/services/messageService.js
const axios = require("axios");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// -------------------------------------------------------------
// 1) SEND NORMAL TEXT MESSAGE
// -------------------------------------------------------------
async function sendMessage(to, message) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    };

    const res = await axios.post(API_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("📤 Text sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendMessage error:", err.response?.data || err);
    return null;
  }
}

// -------------------------------------------------------------
// 2) SEND INTERACTIVE BUTTONS (1–3 buttons only)
// -------------------------------------------------------------
async function sendButtons(to, bodyText, buttons) {
  try {
    if (!Array.isArray(buttons) || buttons.length < 1 || buttons.length > 3) {
      throw new Error(
        `Buttons array must have 1–3 items. Received: ${buttons?.length || 0}`
      );
    }

    const formattedButtons = buttons.map((btn, idx) => ({
      type: "reply",
      reply: {
        id: btn.id || `btn_${idx + 1}`,
        title: String(btn.title || `Button ${idx + 1}`).slice(0, 20),
      },
    }));

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText || "Choose an option:" },
        action: { buttons: formattedButtons },
      },
    };

    const res = await axios.post(API_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("📤 Buttons sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendButtons error:", err.response?.data || err);
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
              id: String(r.id || `row_${sIdx}_${rIdx}`),
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

    console.log("📤 Sending List Menu:", JSON.stringify(payload, null, 2));

    const res = await axios.post(API_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("📤 List menu sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendList error:", err.response?.data || err);
    return null;
  }
}

// -------------------------------------------------------------
// 🚀 NEW: SEND LISTING CARD (3 buttons)
// -------------------------------------------------------------
async function sendListingCard(to, listing, index = 0) {
  try {
    const bodyText =
      `🏡 ${listing.title || "Property"}\n` +
      `💰 ${listing.price || "Price N/A"}\n` +
      `📍 ${listing.location || "Location N/A"}\n` +
      `📏 ${listing.area || "Area N/A"}\n` +
      `🛋 ${listing.furnishing || "N/A"}`;

    const buttons = [
      {
        id: `listing_view_${listing.id}`,
        title: "View Details",
      },
      {
        id: `listing_save_${listing.id}`,
        title: "Save ❤️",
      },
      {
        id: `listing_next_${index + 1}`,
        title: "Next ➡",
      },
    ];

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
  sendListingCard, // ⭐ NEW EXPORT
};
