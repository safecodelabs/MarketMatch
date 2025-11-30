const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getUserProfile, saveUserLanguage } = require("./database/firestore");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

// =======================================================
// SEND LANGUAGE LIST (Interactive List)
// =======================================================
async function sendLanguageList(to) {
  const rows = [
    { id: "lang_en", title: "English" },
    { id: "lang_hi", title: "हिंदी (Hindi)" },
    { id: "lang_ta", title: "தமிழ் (Tamil)" },
    { id: "lang_gu", title: "ગુજરાતી (Gujarati)" },
    { id: "lang_kn", title: "ಕನ್ನಡ (Kannada)" }
  ];

  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "🌐 Please choose your preferred language:" },
          footer: { text: "MarketMatch AI" },
          action: { button: "Select Language", sections: [{ title: "Available Languages", rows }] }
        }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error("❌ sendLanguageList error:", err.response?.data || err);
  }
}

// =======================================================
// SEND MAIN MENU (Interactive List)
// =======================================================
async function sendListMenu(to) {
  const rows = [
    { id: "view_listings", title: "View listings" },
    { id: "post_listing", title: "Post listing" },
    { id: "manage_listings", title: "Manage listings" },
    { id: "change_language", title: "Change language" }
  ];

  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "🏡 MarketMatch AI — Choose an option:" },
          footer: { text: "MarketMatch AI" },
          action: { button: "Select an option", sections: [{ title: "Menu", rows }] }
        }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error("❌ sendListMenu error:", err.response?.data || err);
  }
}

// =======================================================
// MAIN HANDLER
// =======================================================
async function handleIncomingMessage(sender, text, session) {
  text = (text || "").toLowerCase();

  // Load user profile
  const user = await getUserProfile(sender);

  // Ensure session object exists
  session = session || {};
  
  // =======================================================
  // 1️⃣ New user: intro + language selection
  // =======================================================
  if (!user && !session.introduced) {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: sender,
        type: "text",
        text: { body: "👋 *Welcome to MarketMatch AI!*\n\nI’m your personal assistant for:\n🏠 Rentals\n🏢 Real Estate\n👤 PG / Flatmates\n🧹 Home Services\n\nLet's begin by choosing your preferred language." }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );

    await sendLanguageList(sender);

    session.introduced = true;
    session.awaitingLanguage = true;
    await saveSession(sender, session);
    return session;
  }

  // =======================================================
  // 2️⃣ User must pick language
  // =======================================================
  if (session.awaitingLanguage) {
    const textToLang = { english: "en", hindi: "hi", tamil: "ta", gujarati: "gu", kannada: "kn" };

    let lang = null;
    if (text.startsWith("lang_")) lang = text.replace("lang_", "");
    else if (textToLang[text]) lang = textToLang[text];

    if (lang) {
      await saveUserLanguage(sender, lang);
      session.awaitingLanguage = false;
      await saveSession(sender, session);

      // Send main menu after language selection
      await sendListMenu(sender);
      return session;
    }

    // If input not valid, ask again
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: sender,
        type: "text",
        text: { body: "Please select a language to continue 👇" }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
    await sendLanguageList(sender);
    return session;
  }

  // =======================================================
  // 3️⃣ Returning user or active session: show main menu
  // =======================================================
  if (!session.awaitingLanguage) {
    await sendListMenu(sender);
    return session;
  }

  return session;
}

module.exports = {
  handleIncomingMessage
};
