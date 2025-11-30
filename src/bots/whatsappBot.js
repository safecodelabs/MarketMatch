// src/bots/whatsappBot.js

const { sendMessage, sendList } = require("../services/messageService");
const { getSession, saveSession } = require('../../utils/sessionStore');
const { classify, askAI } = require('../ai/aiEngine');
const { handleAIAction } = require('../flows/housingFlow');
const { getUserProfile, saveUserLanguage, getUserListings, addListing } = require('../../database/firestore');
const { getString } = require('../../utils/languageStrings');

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

async function sendLanguageList(to) {
  return sendList(to, "🌐 Please select your language", "Choose your preferred language:", "MarketMatch AI", [
    { title: "Languages", rows: languageRows() }
  ]);
}

async function safeSendList(to, title, body, footer = '') {
  const rows = menuRows();
  const sections = [{ title: "Menu", rows: rows.length ? rows : [{ id: "empty", title: "No options available" }] }];
  return sendList(to, title, body, footer, sections);
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
  let session = (await getSession(sender)) || { step: 'start', housingFlow: {}, isInitialized: false };
  session.housingFlow = session.housingFlow || {};

  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || 'en';

  const greetings = ["hi", "hello", "hey", "start"];

  // ---------------------------
  // NEW USER → intro + language selection
  // ---------------------------
  if (!session.isInitialized) {
    session.isInitialized = true;
    session.housingFlow.awaitingLangSelection = true;
    await saveSession(sender, session);

    await sendMessage(sender, await aiTranslate(getString(userLang, 'welcome') || "Welcome to MarketMatch! 🌟", userLang));
    await sendLanguageList(sender);
    return session;
  }

  // ---------------------------
  // LANGUAGE SELECTION
  // ---------------------------
  if (session.housingFlow.awaitingLangSelection || /^lang_/.test(lowerMsg)) {
    let lang = 'en';
    if (/^lang_/.test(lowerMsg)) lang = lowerMsg.split('_')[1] || 'en';
    else if (lowerMsg.includes('hi') || lowerMsg.includes('हिंदी')) lang = 'hi';
    else if (lowerMsg.includes('ta') || lowerMsg.includes('தமிழ்')) lang = 'ta';
    else if (lowerMsg.includes('mr') || lowerMsg.includes('मराठी')) lang = 'mr';
    else if (lowerMsg.includes('en') || lowerMsg.includes('english')) lang = 'en';

    await saveUserLanguage(sender, lang);

    session.housingFlow.awaitingLangSelection = false;
    session.step = 'menu';
    await saveSession(sender, session);

    await sendMessage(sender, await aiTranslate(getString(lang, 'welcome') || 'Welcome!', lang));
    await safeSendList(sender, "🏡 MarketMatch AI", "Choose an option:");
    return session;
  }

  // ---------------------------
  // MAIN MENU HANDLERS
  // ---------------------------
  if (lowerMsg === "view_listings") {
    await sendMessage(sender, await aiTranslate("Send me your search query (e.g. `2BHK in Noida sector 56`) and I'll filter results.", userLang));
    session.step = 'awaiting_query';
    await saveSession(sender, session);
    return session;
  }

  if (lowerMsg === "post_listing") {
    const example = "Example: Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro";
    await sendMessage(sender, await aiTranslate(`Please send the listing details in this format:\n${example}`, userLang));
    session.step = 'awaiting_post_details';
    session.pending = ['title', 'location', 'property_type', 'price', 'contact', 'description'];
    await saveSession(sender, session);
    return session;
  }

  if (lowerMsg === "manage_listings") {
    const userListings = await getUserListings(sender);
    if (!userListings || userListings.length === 0) {
      await sendMessage(sender, await aiTranslate("You have no listings yet. Would you like to post one?", userLang));
      return session;
    }

    const preview = userListings
      .slice(0, 8)
      .map((l, i) => `${i + 1}. ${l.title || l.property_type} in ${l.location} — ${l.price || 'N/A'} (id:${l.id})`)
      .join('\n\n');

    await sendMessage(sender, await aiTranslate(`Your listings:\n\n${preview}`, userLang));
    session.step = 'managing';
    session.lastUserListings = userListings;
    await saveSession(sender, session);
    return session;
  }

  if (lowerMsg === "change_language") {
    session.housingFlow.awaitingLangSelection = true;
    session.step = 'awaiting_language';
    await saveSession(sender, session);
    await sendLanguageList(sender);
    return session;
  }

  // ---------------------------
  // FALLBACK
  // ---------------------------
  await sendMessage(sender, await aiTranslate("I didn't quite get that. Choose an option or type 'hi' to restart.", userLang));
  await safeSendList(sender, "🏡 MarketMatch AI", "Choose an option:");
  return session;
}

module.exports = { handleIncomingMessage };
