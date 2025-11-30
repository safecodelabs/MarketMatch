// src/bots/whatsappBot.js

const { sendMessage, sendButtons, sendList } = require("../services/messageService");
const { db } = require('../../database/firestore');

const { getSession, saveSession } = require('../../utils/sessionStore');
const { classify, askAI } = require('../ai/aiEngine');
const { handleAIAction } = require('../flows/housingFlow');
const { getUserProfile, saveUserLanguage, getUserListings, addListing } = require('../../database/firestore');
const { getString } = require('../../utils/languageStrings');

// Helper: localized text lookup then send
async function sendTranslated(to, key, lang = 'en', extra = '') {
  const text = getString(lang || 'en', key) || key;
  return sendMessage(to, extra ? `${text}\n${extra}` : text);
}

// Helper: AI-based translation (fallback to original)
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

// Language selection buttons
function languageButtons() {
  return [
    { id: 'lang_en', title: 'English' },
    { id: 'lang_hi', title: 'हिंदी' },
    { id: 'lang_ta', title: 'தமிழ்' },
    { id: 'lang_mr', title: 'मराठी' },
  ];
}

// Menu rows
function menuRows() {
  return [
    { id: "view_listings", title: "View listings" },
    { id: "post_listing", title: "Post listing" },
    { id: "manage_listings", title: "Manage listings" },
    { id: "change_language", title: "Change language" },
  ];
}

// Safe sendList wrapper
async function safeSendList(to, title, body, footer = '') {
  const rows = menuRows();
  const sections = [
    {
      title: "Menu",
      rows: rows.length ? rows : [{ id: "empty", title: "No options available" }]
    }
  ];
  return sendList(to, title, body, footer, sections);
}

// -----------------------------------------------------
// MAIN HANDLER
// -----------------------------------------------------
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
  // GREETINGS
  // ---------------------------
  if (greetings.includes(lowerMsg)) {
    session.isInitialized = true;
    session.step = "menu";
    await saveSession(sender, session);

    await sendMessage(sender, await aiTranslate(getString(userLang, 'welcome') || "Welcome!", userLang));
    await safeSendList(sender, "🏡 MarketMatch AI", "Choose an option:");
    return session;
  }

  // ---------------------------
  // LANGUAGE SELECTION
  // ---------------------------
  const langCandidates = ['english', 'हिंदी', 'தமிழ்', 'hi', 'ta', 'en', 'mr', 'मराठी'];
  const isLanguageTyped = langCandidates.some(c => lowerMsg.includes(c));

  if (session.housingFlow?.awaitingLangSelection || /^lang_/.test(lowerMsg) || isLanguageTyped) {
    let lang = 'en';
    if (/^lang_/.test(lowerMsg)) lang = lowerMsg.split('_')[1] || 'en';
    else if (lowerMsg.includes('hi') || lowerMsg.includes('हिंदी')) lang = 'hi';
    else if (lowerMsg.includes('ta') || lowerMsg.includes('தமிழ்')) lang = 'ta';
    else if (lowerMsg.includes('mr') || lowerMsg.includes('मराठी')) lang = 'mr';
    else if (lowerMsg.includes('en') || lowerMsg.includes('english')) lang = 'en';

    try { await saveUserLanguage(sender, lang); } catch (err) { console.warn('saveUserLanguage failed:', err?.message); }

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
    await sendMessage(sender, await aiTranslate("Sure — send me your search (e.g. `2BHK in Noida sector 56`) and I'll filter results for you.", userLang));
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
    await sendButtons(sender, getString(userLang, 'changeLanguage') || 'Please select your new language:', languageButtons());
    session.housingFlow.awaitingLangSelection = true;
    session.step = 'awaiting_language';
    await saveSession(sender, session);
    return session;
  }

  // ---------------------------
  // POST LISTING DETAILS
  // ---------------------------
  if (session.step === 'awaiting_post_details') {
    const parts = msgBody.split(',').map(p => p.trim()).filter(Boolean);
    const pending = Array.isArray(session.pending) ? session.pending.slice() : ['title', 'location', 'property_type', 'price', 'contact', 'description'];
    const data = {};
    for (let i = 0; i < parts.length && i < pending.length; i++) data[pending[i]] = parts[i];

    const missingFields = pending.filter(k => !data[k]);
    if (missingFields.length > 0) {
      await sendMessage(sender, await aiTranslate(`Still missing: ${missingFields.join(', ')}. Please provide them separated by commas.`, userLang));
      session.pending = missingFields;
      session.data = { ...(session.data || {}), ...data };
      await saveSession(sender, session);
      return session;
    }

    const toSave = { ...data, userId: sender, timestamp: Date.now() };
    try {
      const res = await addListing(toSave);
      if (res?.success) await sendMessage(sender, await aiTranslate('✅ Your property has been posted successfully!', userLang));
      else await sendMessage(sender, await aiTranslate(`❌ Failed to post listing: ${res?.error || 'unknown error'}`, userLang));
    } catch (err) {
      console.error('addListing error', err);
      await sendMessage(sender, await aiTranslate('❌ Failed to post listing (server error).', userLang));
    }

    // return to menu
    session.step = 'menu';
    session.pending = [];
    session.data = {};
    await saveSession(sender, session);
    await safeSendList(sender, "🏡 MarketMatch AI", "Choose an option:");
    return session;
  }

  // ---------------------------
  // AWAITING SEARCH QUERY
  // ---------------------------
  if (session.step === 'awaiting_query') {
    try {
      const ai = await classify(msgBody);
      const { nextSession, reply, buttons, mustSaveLanguage } = await handleAIAction({
        sender,
        message: msgBody,
        aiResult: ai,
        session: session.housingFlow,
        userLang: userProfile?.preferredLanguage || ai.language || 'en'
      });

      if (mustSaveLanguage) await saveUserLanguage(sender, mustSaveLanguage);

      if (buttons?.length) await sendButtons(sender, reply || getString(userLang, 'chooseOption') || 'Choose an option:', buttons);
      else if (reply) {
        const out = (userProfile?.preferredLanguage && userProfile.preferredLanguage !== 'en')
          ? await aiTranslate(reply, userProfile.preferredLanguage)
          : reply;
        await sendMessage(sender, out);
      } else await sendTranslated(sender, 'fallback', userLang);

      const newFullSession = { ...session, housingFlow: nextSession };
      if (nextSession?.step) newFullSession.step = nextSession.step;
      await saveSession(sender, newFullSession);
      return newFullSession;
    } catch (err) {
      console.error('Search AI flow error:', err);
      await sendTranslated(sender, 'fallback', userLang);
      return session;
    }
  }

  // ---------------------------
  // FALLBACK
  // ---------------------------
  await sendMessage(sender, await aiTranslate("I didn't quite get that. Choose an option or type 'hi' to restart.", userLang));
  session.step = 'menu';
  await saveSession(sender, session);
  await safeSendList(sender, "🏡 MarketMatch AI", "Choose an option:");
  return session;
}

module.exports = { handleIncomingMessage };
