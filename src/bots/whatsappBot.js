// src/bots/whatsappBot.js
const { sendMessage } = require('../services/messageService');

const { sendMessage, sendButtons } = require("../../chatbotController");
const { db } = require('../../database/firestore');

const path = require('path');


const { getSession, saveSession, deleteSession } = require('../../utils/sessionStore');
const { classify, askAI } = require('../ai/aiEngine');
const { handleAIAction } = require('../flows/housingFlow');
const { getUserProfile, saveUserLanguage, getUserListings, addListing } = require('../../database/firestore');
const { getString } = require('../../utils/languageStrings');
const chatbotController = require('../../chatbotController');

// helper: localized text lookup then send
async function sendTranslated(to, key, lang = 'en', extra = '') {
  const text = getString(lang || 'en', key) || key;
  return sendMessage(to, extra ? `${text}\n${extra}` : text);
}

// helper: try a simple AI-based translation (falls back to identity)
async function aiTranslate(text, targetLang = 'en') {
  // if askAI not available or no key supplied, return identity
  try {
    if (!askAI) return text;
    // small prompt that asks the LLM to translate text to target language (concise)
    const prompt = `Translate the following text to ${targetLang} and return only the translated text:\n\n"${text}"`;
    const out = await askAI(prompt, { temperature: 0.0, max_tokens: 400 });
    if (!out) return text;
    return out.toString().trim();
  } catch (err) {
    console.warn('AI translation failed, using original text:', err.message);
    return text;
  }
}

// build language selection buttons (WhatsApp Cloud-style reply ids)
function languageButtons(lang = 'en') {
  return [
    { id: 'lang_en', title: 'English' },
    { id: 'lang_hi', title: 'हिंदी' },
    { id: 'lang_ta', title: 'தமிழ்' },
    { id: 'lang_mr', title: 'मराठी' },
    // you can remove/add languages easily here
  ];
}

// build main menu buttons
function mainMenuButtons(lang = 'en') {
  return [
    { id: '1', title: getString(lang, 'viewListings') || 'View listings' }, // label can be localized if desired
    { id: '2', title: 'Post listing' },
    { id: '3', title: 'Manage listings' },
    { id: '4', title: 'Change language' },
  ];
}

/**
 * Main handler — called by webhook route
 * @param {string} sender - phone id like '919xxxxxxxxx'
 * @param {string} msgBody - raw message or button id (already normalized in webhook)
 * @param {object} metadata - optional (not used here)
 */
async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender || !msgBody) return;

  // normalize incoming
  msgBody = String(msgBody).trim();
  const lowerMsg = msgBody.toLowerCase();

  // load session and user profile
  let session = (await getSession(sender)) || { step: 'start', housingFlow: { step: 'start', data: {} } };
  session.housingFlow = session.housingFlow || { step: 'start', data: {} };

  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || 'en';

  // ---------------------------
  // GREETINGS / ENTRY POINTS
  // ---------------------------
  const greetings = ["hi", "hello", "hey", "start"];
  const isNewUser = !session.isInitialized;

if (greetings.includes(lowerMsg)) {
  if (isNewUser) {
    session.isInitialized = true;
    session.step = "menu";
    await saveSession(sender, session);

    await sendMessage(sender, await aiTranslate(getString(userLang, 'welcome') || "Welcome!", userLang));
    await sendButtons(sender, getString(userLang, 'menu') || "Choose an option:", mainMenuButtons(userLang));
    return session;
  }

  // For returning users
  await sendButtons(sender, getString(userLang, 'menu') || "Choose an option:", mainMenuButtons(userLang));
  return session;
}



  // ---------------------------
  // LANGUAGE SELECTION HANDLING
  // ---------------------------
  // button payloads: lang_en / lang_hi / lang_ta OR user may type 'english' / 'हिंदी' / 'தமிழ்'
  const langCandidates = ['english', 'हिंदी', 'தமிழ்', 'hi', 'ta', 'en', 'mr', 'मराठी'];
  const isLanguageTyped = langCandidates.some(c => lowerMsg.includes(c));
  if (session.housingFlow?.awaitingLangSelection || /^lang_/.test(lowerMsg) || isLanguageTyped) {
    let lang = 'en';
    if (/^lang_/.test(lowerMsg)) {
      lang = lowerMsg.split('_')[1] || 'en';
    } else {
      if (lowerMsg.includes('hi') || lowerMsg.includes('हिंदी')) lang = 'hi';
      else if (lowerMsg.includes('ta') || lowerMsg.includes('தமிழ்')) lang = 'ta';
      else if (lowerMsg.includes('mr') || lowerMsg.includes('मराठी')) lang = 'mr';
      else if (lowerMsg.includes('en') || lowerMsg.includes('english')) lang = 'en';
    }

    try { await saveUserLanguage(sender, lang); } catch (err) { console.warn('saveUserLanguage failed:', err?.message || err); }

    session.housingFlow = { step: 'start', data: {}, awaitingLangSelection: false };
    session.step = 'menu';
    await saveSession(sender, session);

    await sendMessage(sender, await aiTranslate(getString(lang, 'welcome') || 'Welcome!', lang));
    await sendButtons(sender, getString(lang, 'menu') || 'Choose an option:', mainMenuButtons(lang));
    return session;
  }

  // ---------------------------
  // HANDLE MAIN MENU BUTTONS / SHORTCUTS
  // ---------------------------
  // numeric shortcuts: '1', '2', '3', '4' OR user typed words
  if (['1', 'view listings', 'view'].includes(lowerMsg)) {
    // show a short prompt and set session to awaiting_query
    await sendMessage(sender, await aiTranslate("Sure — send me your search (e.g. `2BHK in Noida sector 56`) and I'll filter results for you.", userLang));
    session.step = 'awaiting_query';
    await saveSession(sender, session);
    return session;
  }

  if (['2', 'post listing', 'post'].includes(lowerMsg)) {
    // ask user to type listing in a single-line example format
    const example = "Example: Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro";
    await sendMessage(sender, await aiTranslate(`Please send the listing details in this format:\n${example}`, userLang));
    session.step = 'awaiting_post_details';
    session.pending = ['title', 'location', 'property_type', 'price', 'contact', 'description'];
    await saveSession(sender, session);
    return session;
  }

  if (['3', 'manage listings', 'manage'].includes(lowerMsg)) {
    // fetch user listings and show as text with delete buttons (first 4)
    const userListings = await getUserListings(sender);
    if (!userListings || userListings.length === 0) {
      await sendMessage(sender, await aiTranslate("You have no listings yet. Would you like to post one?", userLang));
      await sendButtons(sender, "Options:", [{ id: 'post_listing', title: 'Post listing' }]);
      session.step = 'menu';
      await saveSession(sender, session);
      return session;
    }

    // present first few listings and creation of delete buttons
    const preview = userListings.slice(0, 8).map((l, i) => `${i + 1}. ${l.title || l.property_type} in ${l.location} — ${l.price || 'N/A'} (id:${l.id})`).join('\n\n');
    const buttons = userListings.slice(0, 4).map(l => ({ id: `del_${l.id}`, title: `Delete: ${String(l.title || l.id).slice(0, 20)}` }));
    buttons.push({ id: 'post_listing', title: 'Post new' });

    await sendMessage(sender, await aiTranslate(`Your listings:\n\n${preview}`, userLang));
    await sendButtons(sender, "Tap a button to delete or post new:", buttons);
    session.step = 'managing';
    session.lastUserListings = userListings;
    await saveSession(sender, session);
    return session;
  }

  if (['4', 'change language', 'language', 'lang'].includes(lowerMsg)) {
    // send language buttons again
    await sendButtons(sender, getString(userLang, 'changeLanguage') || 'Please select your new language:', languageButtons(userLang));
    session.housingFlow = { ...session.housingFlow, step: 'awaiting_language', awaitingLangSelection: true };
    session.step = 'awaiting_language';
    await saveSession(sender, session);
    return session;
  }

  // ---------------------------
  // HANDLE DELETE BUTTONS (payload del_<id>)
  // ---------------------------
  if (/^del_/.test(lowerMsg)) {
    const id = msgBody.split('_')[1];
try {
    await db.collection('listings').doc(id).delete();
    await sendMessage(sender, '✅ Listing deleted.');
} catch (err) {
    console.error('Delete error:', err);
    await sendMessage(sender, '❌ Failed to delete listing.');
}return session;

  }

  // ---------------------------
  // AWAITING POST DETAILS (CSV style)
  // ---------------------------
  if (session.step === 'awaiting_post_details') {
    // accept comma-separated values in the order of pending keys
    const parts = msgBody.split(',').map(p => p.trim()).filter(Boolean);
    const pending = Array.isArray(session.pending) ? session.pending.slice() : ['title', 'location', 'property_type', 'price', 'contact', 'description'];
    const data = {};
    for (let i = 0; i < parts.length && i < pending.length; i++) {
      data[pending[i]] = parts[i];
    }

    // simple validation: require title, location, property_type, price, contact
    const missingFields = [];
    if (!data.title) missingFields.push('title');
    if (!data.location) missingFields.push('location');
    if (!data.property_type) missingFields.push('property_type');
    if (!data.price) missingFields.push('price');
    if (!data.contact) missingFields.push('contact');

    if (missingFields.length > 0) {
      await sendMessage(sender, await aiTranslate(`Still missing: ${missingFields.join(', ')}. Please provide them separated by commas.`, userLang));
      // keep awaiting_post_details
      session.pending = pending.filter(k => !data[k]);
      session.step = 'awaiting_post_details';
      session.data = { ...(session.data || {}), ...data };
      await saveSession(sender, session);
      return session;
    }

    // save to DB
    const toSave = {
      title: data.title,
      location: data.location,
      property_type: data.property_type,
      price: data.price,
      contact: data.contact,
      description: data.description || '',
      userId: sender,
      timestamp: Date.now()
    };

    try {
      const res = await addListing(toSave);
      if (res && res.success) {
        await sendMessage(sender, await aiTranslate('✅ Your property has been posted successfully!', userLang));
      } else {
        await sendMessage(sender, await aiTranslate(`❌ Failed to post listing: ${res?.error || 'unknown error'}`, userLang));
      }
    } catch (err) {
      console.error('addListing error', err);
      await sendMessage(sender, await aiTranslate('❌ Failed to post listing (server error).', userLang));
    }

    // return to menu
    session.step = 'menu';
    session.pending = [];
    session.data = {};
    await saveSession(sender, session);
    await sendButtons(sender, getString(userLang, 'menu') || 'Choose an option:', mainMenuButtons(userLang));
    return session;
  }

  // ---------------------------
  // AWAITING SEARCH QUERY (user typed e.g. '2bhk in noida')
  // ---------------------------
  if (session.step === 'awaiting_query') {
    // Use the AI classify + housingFlow handler to run search + reply
    try {
      const ai = await classify(msgBody);
      const { nextSession, reply, buttons, mustSaveLanguage } = await handleAIAction({
        sender,
        message: msgBody,
        aiResult: ai,
        session: session.housingFlow || { step: 'start', data: {} },
        userLang: userProfile?.preferredLanguage || ai.language || 'en'
      });

      if (mustSaveLanguage) await saveUserLanguage(sender, mustSaveLanguage);

      if (buttons && Array.isArray(buttons) && buttons.length) {
        await sendButtons(sender, reply || getString(userLang, 'chooseOption') || 'Choose an option:', buttons);
      } else if (reply) {
        // translate reply if user's lang != en
        const out = await (userProfile?.preferredLanguage && userProfile.preferredLanguage !== 'en' ? aiTranslate(reply, userProfile.preferredLanguage) : reply);
        await sendMessage(sender, out);
      } else {
        await sendTranslated(sender, 'fallback', userLang);
      }

      const newFullSession = { ...session, housingFlow: nextSession };
      // keep step -> adopt nextSession.step if provided
      if (nextSession && nextSession.step) newFullSession.step = nextSession.step;
      await saveSession(sender, newFullSession);
      return newFullSession;
    } catch (err) {
      console.error('Search AI flow error:', err);
      await sendTranslated(sender, 'fallback', userLang);
      return session;
    }
  }

  // ---------------------------
  // FALLBACK: unknown message -> show main menu
  // ---------------------------
  await sendMessage(sender, await aiTranslate("I didn't quite get that. Choose an option or type 'hi' to restart.", userLang));
  await sendButtons(sender, getString(userLang, 'menu') || 'Choose an option:', mainMenuButtons(userLang));
  session.step = 'menu';
  await saveSession(sender, session);
  return session;
}

module.exports = { handleIncomingMessage };
