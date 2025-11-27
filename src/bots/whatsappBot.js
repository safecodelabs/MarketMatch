// src/bots/whatsappBot.js
const path = require('path');

// messageService may live elsewhere in your project. Try to require it and fall back to a small stub.
let sendMessage, sendButtons;
try {
  const ms = require(path.join(__dirname, '..', 'services', 'messageService'));
  sendMessage = ms.sendMessage;
  sendButtons = ms.sendButtons;
} catch (e) {
  // fallback lightweight stubs (logs only) — replace with your real messageService
  sendMessage = async (to, text) => {
    console.log(`✉️ [stub sendMessage] -> ${to}: ${text}`);
    return true;
  };
  sendButtons = async (to, text, buttons) => {
    console.log(`🔘 [stub sendButtons] -> ${to}: ${text}`, buttons);
    return true;
  };
}

const { getSession, saveSession } = require('../utils/sessionStore');
const { classify } = require('../ai/aiEngine');
const { handleAIAction } = require('../flows/housingFlow');
const { getUserProfile, saveUserLanguage } = require('../../database/firestore');
const { getString } = require('../utils/languageStrings');

/**
 * Helper: send translated key
 */
async function sendTranslated(sender, key, lang = 'en', extra = '') {
  const text = getString(lang || 'en', key) || key;
  return sendMessage(sender, extra ? `${text}\n${extra}` : text);
}

/**
 * Main handler
 */
async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender || !msgBody) return;

  msgBody = msgBody.trim();
  // load session and normalize
  let session = (await getSession(sender)) || { step: 'start', housingFlow: { step: 'start', data: {} } };
  session.housingFlow = session.housingFlow || { step: 'start', data: {} };

  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || 'en';

  const lowerMsg = msgBody.toLowerCase();

  // --- LANGUAGE ONBOARDING + CHANGE LANGUAGE ---
  const languageKeywords = ['change language', 'language', 'lang'];
  const wantsLanguage = languageKeywords.some(k => lowerMsg.includes(k));

  // 1) If user has no preferredLanguage OR explicitly asked to change language OR session awaiting language
  if (!userProfile?.preferredLanguage || wantsLanguage || session.housingFlow.awaitingLangSelection) {
    // If user typed a language name (english / हिन्दी / தமிழ் / hi / ta / en)
    const langCandidates = ['english', 'हिंदी', 'தமிழ்', 'hi', 'ta', 'en', 'mr', 'मराठी'];
    const isLanguageTyped = langCandidates.some(c => lowerMsg.includes(c));

    if (isLanguageTyped || /^lang_/.test(lowerMsg)) {
      // normalize selection
      let lang = 'en';
      if (lowerMsg.includes('hi') || lowerMsg.includes('हिंदी')) lang = 'hi';
      else if (lowerMsg.includes('ta') || lowerMsg.includes('தமிழ்')) lang = 'ta';
      else if (lowerMsg.includes('mr') || lowerMsg.includes('मराठी')) lang = 'mr';
      else if (lowerMsg.includes('en') || lowerMsg.includes('english')) lang = 'en';

      await saveUserLanguage(sender, lang);

      session.housingFlow = { step: 'start', data: {}, awaitingLangSelection: false };
      await saveSession(sender, session);

      // welcome / main menu in selected language
      await sendTranslated(sender, 'menu', lang);
      return session;
    }

    // otherwise show language selection buttons
    await sendButtons(sender, getString(userLang, 'chooseLanguage') || 'Choose your preferred language:', [
      { id: 'lang_en', title: 'English' },
      { id: 'lang_hi', title: 'हिंदी' },
      { id: 'lang_ta', title: 'தமிழ்' },
      { id: 'lang_mr', title: 'मराठी' }
    ]);

    session.housingFlow = { ...session.housingFlow, step: 'awaiting_language', awaitingLangSelection: true };
    await saveSession(sender, session);
    return session;
  }

  // --- Continue AI-first flow ---
  // classify the incoming message; classify is robust and has fallback logic
  const ai = await classify(msgBody);
  console.log('🤖 AI classify:', ai);

  // quick heuristic fallback: if classify returned unknown but message clearly mentions housing keywords, force buy_house
  if ((ai?.category === 'unknown' || ai?.category === 'fallback') && /(\d+\s?bhk|bhk|flat|apartment|house|property|rent|sale)/i.test(msgBody)) {
    ai.category = 'buy_house';
    ai.intent = 'buy_house';
  }

  try {
    const { nextSession, reply, buttons, mustSaveLanguage } = await handleAIAction({
      sender,
      message: msgBody,
      aiResult: ai,
      session: session.housingFlow || { step: 'start', data: {} },
      userLang: userProfile?.preferredLanguage || ai.language || 'en'
    });

    if (mustSaveLanguage) {
      await saveUserLanguage(sender, mustSaveLanguage);
    }

    if (buttons && Array.isArray(buttons) && buttons.length) {
      await sendButtons(sender, reply || getString(userLang, 'chooseOption') || 'Choose an option:', buttons);
    } else if (reply) {
      await sendMessage(sender, reply);
    } else {
      await sendTranslated(sender, 'fallback', userLang);
    }

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
