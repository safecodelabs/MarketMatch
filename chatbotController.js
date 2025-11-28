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
// 🧠 MAIN BOT LOGIC
// =======================================================================
async function handleIncoming(sender, messageObj) {
  const session = (await getSession(sender)) || {};
  const user = await getUserProfile(sender);

  let userMessageText = "";
  let buttonId = "";

  // ----------------------------------------------------
  // 🔍 Detect message type
  // ----------------------------------------------------
  if (messageObj.type === "text") {
    userMessageText = messageObj.text.body.toLowerCase();
  }

  if (messageObj.type === "interactive" && messageObj.interactive.button_reply) {
    buttonId = messageObj.interactive.button_reply.id;
  }

  console.log("📥 USER INPUT:", { text: userMessageText, button: buttonId });

  // ===================================================================
  // 1️⃣ NEW USER - FIRST MESSAGE "hi"
  // ===================================================================
  if (!user && userMessageText === "hi") {
    await sendMessage(
      sender,
      "Hello! 👋 I’m MarketMatch AI.\nI can help you with:\n• Renting\n• Buying\n• Selling\n• PG rooms\n• House services\n\nLet's start by choosing a language."
    );

    await sendLanguageButtons(sender);

    session.awaitingLang = true;
    await saveSession(sender, session);
    return session;
  }

  // ===================================================================
  // 2️⃣ RETURNING USER - "hi"
  // ===================================================================
  if (user && userMessageText === "hi") {
    await sendMessage(sender, `Welcome back! 😊 How can I help you today?`);
    return session;
  }

  // ===================================================================
  // 3️⃣ USER PRESSED LANGUAGE BUTTON
  // ===================================================================
  if (session.awaitingLang && buttonId.startsWith("lang_")) {
    const langCode = buttonId.replace("lang_", "");

    await saveUserLanguage(sender, langCode);

    await sendMessage(sender, `🎉 Language saved successfully!`);
    await sendMessage(
      sender,
      "How can I help you today?\nTry something like:\n• 2BHK in Noida\n• 1RK in Pune\n• Sell my house\n• Need a maid"
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
    "I'm ready! 😊 Just tell me what you're looking for.\nExamples:\n• 2BHK in Noida\n• Sell my plot\n• I need a cleaner\n• PG in Gurgaon"
  );

  return session;
}

module.exports = {
  handleIncoming,
  sendMessage,
  sendLanguageButtons
};
