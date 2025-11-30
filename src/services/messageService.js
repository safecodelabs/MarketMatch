// src/services/messageService.js

const axios = require("axios");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

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

    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📤 Text sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendMessage error:", err.response?.data || err);
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
        title: btn.title,
      },
    }));

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: formattedButtons,
        },
      },
    };

    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📤 Buttons sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendButtons error:", err.response?.data || err);
  }
}

// -------------------------------------------------------------
// 3) SEND INTERACTIVE LIST (supports large menus)
// -------------------------------------------------------------
async function sendList(to, headerText, bodyText, footerText, buttonText, sections) {
  try {
    // Ensure sections is a non-empty array
    if (!Array.isArray(sections) || sections.length === 0) {
      sections = [
        {
          title: "Menu",
          rows: [{ id: "default", title: "No options available" }],
        },
      ];
    }

    // Ensure every section has at least 1 row
    sections = sections.map((sec) => ({
      title: sec.title || "Menu",
      rows: Array.isArray(sec.rows) && sec.rows.length
        ? sec.rows
        : [{ id: "default", title: "No options available" }],
    }));

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: headerText || "Menu" },
        body: { text: bodyText || "Please choose an option" },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          button: buttonText || "Select",
          sections,
        },
      },
    };

    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📤 List menu sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendList error:", err.response?.data || err);
  }
}

module.exports = {
  sendMessage,
  sendButtons,
  sendList,
};
