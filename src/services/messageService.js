// src/services/messageService.js

const axios = require("axios");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

/**
 * Send a normal text message
 */
async function sendMessage(to, message) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message }
    };

    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Message sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendMessage error:", err.response?.data || err);
  }
}



/**
 * Send interactive buttons
 */
async function sendButtons(to, text, buttons) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title }
          }))
        }
      }
    };

    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Buttons sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendButtons error:", err.response?.data || err);
  }
}



/**
 * Send language selection list (example)
 */
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
                { id: "lang_hi", title: "Hindi" }
              ]
            }
          ]
        }
      }
    };

    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Language list sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ sendLanguageList error:", err.response?.data || err);
  }
}



module.exports = {
  sendMessage,
  sendButtons,
  sendLanguageList
};
