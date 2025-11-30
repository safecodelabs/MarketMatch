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
        `Buttons array must have 1–3 items. Received: ${buttons.length}`
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
    // Validation
    if (!Array.isArray(sections) || sections.length < 1) {
      throw new Error("sections must be a non-empty array.");
    }

    sections.forEach((sec) => {
      if (!sec.title || !Array.isArray(sec.rows)) {
        throw new Error("Each section must contain a title and rows[].");
      }
      if (sec.rows.length < 1 || sec.rows.length > 10) {
        throw new Error(
          `Each section must have 1–10 rows. Section: ${sec.title}`
        );
      }
    });

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: headerText },
        body: { text: bodyText },
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
