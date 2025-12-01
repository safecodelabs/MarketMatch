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
        body: { text: bodyText || "Choose an option" },
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
    return null;
  }
}

// -------------------------------------------------------------
// 3) SEND INTERACTIVE LIST (supports large menus)
// Signature:
//   sendList(to, headerText, bodyText, footerText, buttonText, sectionsArray)
// sectionsArray: [{ title: 'Section title', rows: [{ id, title, description? }, ...] }, ...]
// -------------------------------------------------------------
async function sendList(to, headerText, bodyText, footerText, buttonText, sections) {
  try {
    // Ensure buttonText is a string
    buttonText = typeof buttonText === "string" && buttonText.trim() ? buttonText : "Select";

    // If sections is not a valid array, create a default section with a single "No options" row
    if (!Array.isArray(sections) || sections.length === 0) {
      sections = [
        {
          title: "Menu",
          rows: [{ id: "default", title: "No options available" }],
        },
      ];
    }

    // Map/normalize sections and rows so WhatsApp receives valid ids/titles
    sections = sections.map((sec, sIdx) => {
      const safeRows = Array.isArray(sec.rows) && sec.rows.length
        ? sec.rows.map((r, rIdx) => ({
            id: String(r.id || `row_${sIdx + 1}_${rIdx + 1}`),
            title: String(r.title || `Option ${rIdx + 1}`).slice(0, 24),
            description: r.description ? String(r.description).slice(0, 72) : undefined,
          }))
        : [{ id: `row_${sIdx + 1}_1`, title: "No options available" }];

      return {
        title: sec.title || `Section ${sIdx + 1}`,
        rows: safeRows,
      };
    });

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
          button: buttonText,
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
    return null;
  }
}

module.exports = {
  sendMessage,
  sendButtons,
  sendList,
};
