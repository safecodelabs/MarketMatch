// src/bots/whatsappBot.js

const { sendMessage, sendList } = require("../services/messageService");
const { getSession, saveSession } = require("../../utils/sessionStore");
const { getUserProfile, saveUserLanguage, getUserListings, addListing } = require("../../database/firestore");
const { classify, askAI } = require("../ai/aiEngine");
const { handleAIAction } = require("../flows/housingFlow");
const { getString } = require("../../utils/languageStrings");

// ----------------------------
// Helpers
// ----------------------------

async function aiTranslate(text, targetLang = 'en') {
  try {
    if (!askAI) return text;
    const prompt = `Translate the following text to ${targetLang} and return only the translated text:\n\n"${text}"`;
    const out = await askAI(prompt, { temperature: 0.0, max_tokens: 400 });
    return out?.toString().trim() || text;
  } catch (err) {
    console.warn('AI translation failed:', err.message);
    return text;
  }
}

function menuRows() {
  return [
    { id: "view_listings", title: "View listings" },
    { id: "post_listing", title: "Post listing" },
    { id: "manage_listings", title: "Manage listings" },
    { id: "change_language", title: "Change language" },
  ];
}

function languageRows() {
  return [
    { id: 'lang_en', title: 'English' },
    { id: 'lang_hi', title: 'हिंदी' },
    { id: 'lang_ta', title: 'தமிழ்' },
    { id: 'lang_mr', title: 'मराठी' },
  ];
}

async function sendLanguageSelection(sender) {
  const sections = [{ title: "Languages", rows: languageRows() }];
  return sendList(
    sender,
    "🌐 Select your preferred language",
    "Choose one option from below:",
    "MarketMatch AI",
    sections
  );
}

async function sendMainMenu(sender) {
  const sections = [{ title: "Menu", rows: menuRows() }];
  return sendList(
    sender,
    "🏡 MarketMatch AI",
    "Choose an option:",
    "MarketMatch AI",
    sections
  );
}

// ----------------------------
// MAIN HANDLER
// ----------------------------

async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender || !msgBody) return;

  msgBody = String(msgBody).trim();
  const lowerMsg = msgBody.toLowerCase();

  // Handle interactive list replies
  if (metadata?.interactive?.type === "list_reply") {
    msgBody = metadata.interactive.list_reply.id;
  }

  // Load session
  let session = (await getSession(sender)) || { step: 'start', housingFlow: { step: 'start', data: {} }, isInitialized: false };
  session.housingFlow = session.housingFlow || { step: 'start', data: {} };

  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || 'en';

  const greetings = ["hi", "hello", "hey", "start"];
  const isNewUser = !session.isInitialized;

  // ---------------------------
  // NEW USER
  // ---------------------------
  if (greetings.includes(lowerMsg) && isNewUser) {
    session.isInitialized = true;
    session.housingFlow.awaitingLangSelection = true;
    await saveSession(sender, session);

    await sendMessage(sender, await aiTranslate(
      getString('en', 'welcome') || "👋 Welcome to MarketMatch AI! I'm your personal assistant for rentals, PGs, real estate, and home services.",
      'en'
    ));

    await sendLanguageSelection(sender);
    return session;
  }

  // ---------------------------
  // EXISTING USER
  // ---------------------------
  if (greetings.includes(lowerMsg) && !isNewUser) {
    session.step = 'menu';
    await saveSession(sender, session);
    await sendMainMenu(sender);
    return session;
  }

  // ---------------------------
  // LANGUAGE SELECTION
  // ---------------------------
  if (session.housingFlow?.awaitingLangSelection || /^lang_/.test(lowerMsg)) {
    let lang = 'en';
    if (/^lang_/.test(lowerMsg)) lang = lowerMsg.split('_')[1];

    try { await saveUserLanguage(sender, lang); } catch (err) { console.warn('saveUserLanguage failed:', err?.message); }

    session.housingFlow.awaitingLangSelection = false;
    session.step = 'menu';
    await saveSession(sender, session);

    // After selecting language, show main menu
    await sendMainMenu(sender);
    return session;
  }

  // ---------------------------
  // MAIN MENU HANDLERS
  // ---------------------------
  switch (lowerMsg) {
    case "view_listings":
      await sendMessage(sender, await aiTranslate("Send me your search query (e.g. `2BHK in Noida sector 56`) and I'll filter results.", userLang));
      session.step = 'awaiting_query';
      break;

    case "post_listing":
      const example = "Example: Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro";
      await sendMessage(sender, await aiTranslate(`Please send the listing details in this format:\n${example}`, userLang));
      session.step = 'awaiting_post_details';
      session.pending = ['title', 'location', 'property_type', 'price', 'contact', 'description'];
      break;

    case "manage_listings":
      const userListings = await getUserListings(sender);
      if (!userListings || userListings.length === 0) {
        await sendMessage(sender, await aiTranslate("You have no listings yet. Would you like to post one?", userLang));
      } else {
        const preview = userListings
          .slice(0, 8)
          .map((l, i) => `${i + 1}. ${l.title || l.property_type} in ${l.location} — ${l.price || 'N/A'} (id:${l.id})`)
          .join('\n\n');
        await sendMessage(sender, await aiTranslate(`Your listings:\n\n${preview}`, userLang));
      }
      break;

    case "change_language":
      session.housingFlow.awaitingLangSelection = true;
      await saveSession(sender, session);
      await sendLanguageSelection(sender);
      break;

    default:
      // ---------------------------
      // FALLBACK
      // ---------------------------
      await sendMessage(sender, await aiTranslate("I didn't understand that. Choose an option or type 'hi' to restart.", userLang));
      await sendMainMenu(sender);
      break;
  }

  await saveSession(sender, session);
  return session;
}

module.exports = { handleIncomingMessage };
