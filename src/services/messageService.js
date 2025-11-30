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
// 2) SEND INTERACTIVE BUTTONS (FIXED VERSION)
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
// 3) SEND LANGUAGE LIST (unchanged but formatted)
// -------------------------------------------------------------
async function sendLanguageList(to) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: "Choose Language" },
        body: { text: "Select your preferred language" },
        action: {
          button: "Select",
          sections: [
            {
              title: "Languages",
              rows: [
                { id: "lang_en", title: "English" },
                { id: "lang_hi", title: "Hindi" },
              ],
            },
          ],
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

    console.log("📤 Language list sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendLanguageList error:", err.response?.data || err);
  }
}

module.exports = {
  sendMessage,
  sendButtons,
  sendLanguageList,
};
