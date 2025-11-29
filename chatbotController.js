// chatbotController.js
const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getUserProfile, saveUserLanguage } = require("./database/firestore");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

// =======================================================================
// 📤 Send Text Message
// =======================================================================
async function sendMessage(to, text) {
  if (!text) return;

  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text }
  };

  try {
    await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
  } catch (err) {
    console.error("❌ WhatsApp send error:", err.response?.data || err);
  }
}

// =======================================================================
// 📤 Send Language Buttons
// =======================================================================
async function sendLanguageButtons(to) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Choose your preferred language:" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "lang_en", title: "English" } },
          { type: "reply", reply: { id: "lang_hi", title: "हिंदी" } },
          { type: "reply", reply: { id: "lang_ta", title: "தமிழ்" } }
        ]
      }
    }
  };

  try {
    await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
  } catch (err) {
    console.error("❌ WhatsApp button send error:", err.response?.data || err);
  }
}

// =======================================================================
// 🧠 MAIN BOT LOGIC (THIS MUST MATCH WEBHOOK NAME)
// =======================================================================
async function handleIncomingMessage(sender, text, session, phoneId) {
  const user = await getUserProfile(sender);

  const message = text.toLowerCase();
  let buttonId = "";

  // Webhook may send button replies as text (id)
  if (message.startsWith("lang_")) {
    buttonId = message;
  }

  console.log("📥 USER INPUT:", { text: message, button: buttonId });

  // ===================================================================
  // 1️⃣ NEW USER FIRST MESSAGE
  // ===================================================================
  if (!user && ["hi", "hello", "hey", "start"].includes(message)) {
    await sendMessage(
      sender,
      "Hello! 👋 I’m MarketMatch AI.\nI can help you with:\n• Renting\n• Buying\n• Selling\n• PG rooms\n• Cleaning & Home Services\n\nLet's begin by choosing a language."
    );

    await sendLanguageButtons(sender);

    session.awaitingLang = true;
    await saveSession(sender, session);
    return session;
  }

  // ===================================================================
  // 2️⃣ RETURNING USER - "hi"
  // ===================================================================
  if (user && ["hi", "hello", "hey", "start"].includes(message)) {
    await sendMessage(sender, `Welcome back! 😊 How can I help you today?`);
    return session;
  }

  // ===================================================================
  // 3️⃣ LANGUAGE SELECTION
  // ===================================================================
  if (session.awaitingLang && buttonId.startsWith("lang_")) {
    const langCode = buttonId.replace("lang_", "");

    await saveUserLanguage(sender, langCode);

    await sendMessage(sender, `🎉 Language saved successfully!`);
    await sendMessage(
      sender,
      "How can I help you today?\nFor example:\n• 2BHK in Noida\n• PG in Gurgaon\n• Need a maid\n• Sell my house"
    );

    session.awaitingLang = false;
    await saveSession(sender, session);
    return session;
  }

  // ===================================================================
  // 4️⃣ DEFAULT FALLBACK
  // ===================================================================
  await sendMessage(
    sender,
    "I'm ready! 😊 Just tell me what you're looking for.\nExamples:\n• 2BHK in Noida\n• PG in Gurgaon\n• Need a cleaner\n• Sell my plot"
  );

  return session;
}

// =======================================================================
module.exports = {
  handleIncomingMessage, // 🔥 Your webhook NEEDS THIS EXACT NAME
  sendMessage,
  sendLanguageButtons
};
