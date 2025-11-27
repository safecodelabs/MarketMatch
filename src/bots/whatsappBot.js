// whatsappBot.js (AI-first integration)
const { sendMessage, sendButtons } = require('../services/messageService');
const { handleAIAction } = require('../flows/housingFlow'); // new AI-first handler
const { getSession, saveSession } = require('../utils/sessionStore');
const { classify } = require('../ai/aiEngine');
const { db } = require('../../database/firestore');
const { getString } = require('../utils/languageStrings');

async function getUserProfile(sender) {
  const doc = await db.collection('users').doc(sender).get();
  return doc.exists ? doc.data() : null;
}

async function saveUserLanguage(sender, lang) {
  await db.collection('users').doc(sender).set(
    { preferredLanguage: lang },
    { merge: true }
  );
}

/**
 * sendTranslated: convenience wrapper for keys in languageStrings
 */
async function sendTranslated(sender, key, lang, extra = "") {
  const text = getString(lang || 'en', key);
  return sendMessage(sender, extra ? `${text}\n${extra}` : text);
}

/**
 * Main entry point for incoming messages
 */
async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender || !msgBody) return;

  msgBody = msgBody.trim();
  let session = (await getSession(sender)) || { step: 'start', housingFlow: { step: 'start', data: {} } };
  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || 'en';

  console.log('📨 Incoming:', msgBody);
  console.log('📌 Current Session:', session);

  // --- Handle /start and explicit "change language" trigger ---
  if (msgBody.toLowerCase() === '/start' || msgBody.toLowerCase() === 'start' ||
      session?.housingFlow?.awaitingLangSelection) {
    // ask language buttons
    await sendButtons(sender, getString(userLang, 'selectLanguage') || 'Select your language:', [
      { id: 'lang_en', title: 'English' },
      { id: 'lang_hi', title: 'हिंदी' },
      { id: 'lang_ta', title: 'தமிழ்' }
    ]);

    // mark session awaiting language
    session.housingFlow = { step: 'awaiting_language' , data: {} };
    await saveSession(sender, session);
    return session;
  }

  // --- Handle language button presses (simple convention: lang_xx) ---
  if (/^lang_/.test(msgBody.toLowerCase()) || ['english','हिंदी','தமிழ்','hi','en','ta'].includes(msgBody.toLowerCase())) {
    // normalize language
    const lower = msgBody.toLowerCase();
    let lang = 'en';
    if (lower.includes('hi') || lower.includes('हिंदी')) lang = 'hi';
    if (lower.includes('ta') || lower.includes('தமிழ்')) lang = 'ta';
    if (lower.includes('mr') || lower.includes('मराठी')) lang = 'mr';

    await saveUserLanguage(sender, lang);
    session.housingFlow = { step: 'start', data: {}, intent: null };
    await saveSession(sender, session);

    // show main menu localized
    await sendTranslated(sender, 'menu', lang);
    return session;
  }

  // If user profile has no language, ask language before anything else
  if (!userProfile?.preferredLanguage) {
    await sendButtons(sender, 'Select your language:', [
      { id: 'lang_en', title: 'English' },
      { id: 'lang_hi', title: 'हिंदी' },
      { id: 'lang_ta', title: 'தமிழ்' }
    ]);
    session.housingFlow = { step: 'awaiting_language', data: {} };
    await saveSession(sender, session);
    return session;
  }

  // --- AI classify the incoming message (language + entities + intent) ---
  const ai = await classify(msgBody);
  console.log('🤖 AI classify:', ai);

  // If AI says unknown but user typed textual menu options (1,2,3,4) handle those
  const normalized = msgBody.toLowerCase();
  if (['1','2','3','4','view listings','post listings','manage listings','change language'].includes(normalized)) {
    // convert numeric shortcuts to explicit intents for downstream flow
    if (normalized === '1' || normalized.includes('view')) ai.intent = 'buy_house';
    if (normalized === '2' || normalized.includes('post')) ai.intent = 'post_listing';
    if (normalized === '3' || normalized.includes('manage')) ai.intent = 'manage_listings';
    if (normalized === '4' || normalized.includes('change')) {
      // send language selection
      await sendButtons(sender, getString(userLang, 'selectLanguage') || 'Select your language:', [
        { id: 'lang_en', title: 'English' },
        { id: 'lang_hi', title: 'हिंदी' },
        { id: 'lang_ta', title: 'தமிழ்' }
      ]);
      session.housingFlow = { step: 'awaiting_language' };
      await saveSession(sender, session);
      return session;
    }
  }

  // --- Call AI-first flow handler that returns what to reply and new session ---
  try {
    const { nextSession, reply, buttons, mustSaveLanguage } = await handleAIAction({
      sender,
      message: msgBody,
      aiResult: ai,
      session: session.housingFlow || { step: 'start', data: {} },
      userLang: userProfile?.preferredLanguage || ai.language || 'en'
    });

    // If AI handler determined the user changed language
    if (mustSaveLanguage) {
      await saveUserLanguage(sender, mustSaveLanguage);
    }

    // send reply (either text or buttons)
    if (buttons && Array.isArray(buttons) && buttons.length) {
      await sendButtons(sender, reply || getString(userLang,'chooseOption') || 'Choose an option:', buttons);
    } else if (reply) {
      await sendMessage(sender, reply);
    } else {
      // fallback localized
      await sendTranslated(sender, 'fallback', userLang);
    }

    // persist session.housingFlow
    const newFullSession = { ...session, housingFlow: nextSession };
    await saveSession(sender, newFullSession);
    return newFullSession;
  } catch (err) {
    console.error('Error in AI flow handler:', err);
    await sendTranslated(sender, 'fallback', userLang);
    return session;
  }
}

module.exports = { handleIncomingMessage };
