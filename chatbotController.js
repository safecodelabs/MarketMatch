// chatbotController.js
const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getUserProfile, saveUserLanguage } = require("./database/firestore");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

// -------------------------------------------------------
// 📤 Send WhatsApp Message
// -------------------------------------------------------
async function sendMessage(to, text, lang = "en") {
  if (!text) return;

  if (lang !== "en") {
    text = await aiTranslate(text, lang);
  }

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

// -------------------------------------------------------
// 📤 Send Language Buttons
// -------------------------------------------------------
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

// -------------------------------------------------------
// 🧠 MAIN HANDLER
// -------------------------------------------------------
async function handleIncoming(sender, msg) {
  // Load DB + session
  const session = (await getSession(sender)) || {};
  const user = await getUserProfile(sender);
  const lang = user?.preferredLanguage || "en";

  // 1️⃣ Returning user → different welcome
  if (user && msg === "hi") {
    await sendMessage(
      sender,
      "Welcome back! 😊 How can I help you today? Looking to buy, sell, rent, or find services like cleaner, maid, handyman, technician, electrician?",
      lang
    );
    return session;
  }

  // 2️⃣ New user → Introduction + language buttons
  if (!user && msg === "hi") {
    await sendMessage(
      sender,
      "Hello! 👋 I’m MarketMatch AI.\nI can help you with:\n• Buying or selling properties\n• Renting houses or PG\n• Finding a cleaner or maid\n• Hiring a handyman, technician or electrician\n\nChoose your preferred language below 👇",
      "en"
    );

    await sendLanguageButtons(sender);

    session.awaitingLang = true;
    await saveSession(sender, session);
    return session;
  }

  // 3️⃣ Handle language selection
  if (session.awaitingLang && msg.startsWith("lang_")) {
    const langCode = msg.replace("lang_", "");

    await saveUserLanguage(sender, langCode);

    await sendMessage(sender, "Language saved! 🎉", langCode);
    await sendMessage(
      sender,
      "How can I assist you today?\nYou may tell me:\n• Buy a house\n• 2BHK in Mumbai\n• Sell my plot\n• Find a maid\n• Find an electrician",
      langCode
    );

    session.awaitingLang = false;
    await saveSession(sender, session);
    return session;
  }

  // 4️⃣ From now on → all replies must be in user language
  await sendMessage(
    sender,
    "I’m ready! Tell me how I can help.\nTry:\n• 2BHK in Noida\n• Sell my apartment\n• I need a maid",
    lang
  );

  return session;
}

module.exports = {
  handleIncoming,
  sendMessage
};
