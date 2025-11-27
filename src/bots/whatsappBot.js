const { sendMessage, sendButtons, sendTranslated } = require('../services/messageService');
const { getSession, saveSession } = require('../utils/sessionStore');
const { classify } = require('../ai/aiEngine');
const { handleAIAction } = require('../flows/housingFlow');
const { getUserProfile, saveUserLanguage } = require('../database/firestore');
const { getString } = require('../utils/languageStrings');

async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender || !msgBody) return;

  msgBody = msgBody.trim();
  // Load session (getSession now returns _isNew:true if doc didn't exist)
  let session = (await getSession(sender)) || { step: 'start', housingFlow: { step: 'start', data: {} }, _isNew: true };

  // Load user profile (may contain preferredLanguage)
  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || 'en';

  const lowerMsg = msgBody.toLowerCase();
  const languageKeywords = ['change language', 'language', 'lang'];

  // -----------------------
  // INITIAL GREETING LOGIC
  // -----------------------
  // If the session doc is brand new (no doc existed previously) => this is a "new user"
  if (session._isNew) {
    // Build a friendly intro and language buttons
    const introText = getString('en', 'intro') ||
`Hi 👋 I can help you buy, sell, find a cleaner/maid, rent, or find a handyman, technician or electrician.
Choose your preferred language below or type it out.
I'll continue in that language until you change it.`;

    await sendButtons(sender, introText, [
      { id: 'lang_en', title: 'English' },
      { id: 'lang_hi', title: 'हिंदी' },
      { id: 'lang_ta', title: 'தமிழ்' }
    ]);

    // mark session as existing now and awaiting language selection
    session._isNew = false;
    session.housingFlow = { ...session.housingFlow, step: 'awaiting_language', awaitingLangSelection: true, greeted: true };
    await saveSession(sender, session);
    return session;
  }

  // If this is an existing session but we haven't greeted in this session yet, send welcome back
  // We guard so we don't repeatedly send welcome back on every message — only when housingFlow.greeted is falsy and step is 'start'
  if (!session.housingFlow?.greeted && (session.housingFlow?.step === 'start' || session.housingFlow?.step === undefined) && !session.housingFlow?.awaitingLangSelection) {
    const welcomeText = getString(userLang, 'welcomeBack') || 'Welcome back! 👋 Let me know what you are looking for — I can help find listings, post a property, or manage your listings.';
    await sendMessage(sender, welcomeText);

    // mark greeted so we don't re-send this on the next message
    session.housingFlow = { ...session.housingFlow, greeted: true, step: 'start' };
    await saveSession(sender, session);
    // Important: we return here because we treat this incoming message as the "session start" event.
    // The user can now send a follow-up message which will be processed by the AI flow.
    return session;
  }

  // -----------------------
  // LANGUAGE SELECTION FLOW
  // -----------------------
  // This covers both the case when we previously asked for language, or user explicitly asked to change
  if (!userProfile?.preferredLanguage || languageKeywords.includes(lowerMsg) || session?.housingFlow?.awaitingLangSelection) {
    await sendButtons(sender, getString(userLang, 'chooseLanguage') || 'Select your language:', [
      { id: 'lang_en', title: 'English' },
      { id: 'lang_hi', title: 'हिंदी' },
      { id: 'lang_ta', title: 'தமிழ்' }
    ]);

    session.housingFlow = { ...session.housingFlow, step: 'awaiting_language', awaitingLangSelection: true };
    await saveSession(sender, session);
    return session;
  }

  // Handle language selection by button id or free text like 'english', 'हिंदी', 'தமிழ்', 'hi', 'ta'
  if (/^lang_/.test(lowerMsg) || ['english', 'हिंदी', 'தமிழ்', 'hi', 'ta', 'en'].includes(lowerMsg)) {
    let lang = 'en';
    if (lowerMsg.includes('hi') || lowerMsg.includes('हिंदी')) lang = 'hi';
    if (lowerMsg.includes('ta') || lowerMsg.includes('தமிழ்')) lang = 'ta';

    // persist language in user profile table
    await saveUserLanguage(sender, lang);

    // reset housing flow state (user picked language so we can continue)
    session.housingFlow = { step: 'start', data: {}, awaitingLangSelection: false, greeted: true };
    await saveSession(sender, session);

    // send main menu / localized menu
    await sendTranslated(sender, 'menu', lang);
    return session;
  }

  // -----------------------
  // AI-FIRST FLOW (existing)
  // -----------------------
  const ai = await classify(msgBody);
  console.log('🤖 AI classify:', ai);

  try {
    const { nextSession, reply, buttons, mustSaveLanguage } = await handleAIAction({
      sender,
      message: msgBody,
      aiResult: ai,
      session: session.housingFlow || { step: 'start', data: {} },
      userLang: userProfile?.preferredLanguage || ai.language || 'en'
    });

    if (mustSaveLanguage) await saveUserLanguage(sender, mustSaveLanguage);

    if (buttons?.length) {
      await sendButtons(sender, reply || getString(userLang, 'chooseOption') || 'Choose an option:', buttons);
    } else if (reply) {
      await sendMessage(sender, reply);
    } else {
      await sendTranslated(sender, 'fallback', userLang);
    }

    // Save full session
    const newFullSession = { ...session, housingFlow: nextSession, _isNew: false };
    await saveSession(sender, newFullSession);
    return newFullSession;
  } catch (err) {
    console.error('Error in AI flow handler:', err);
    await sendTranslated(sender, 'fallback', userLang);
    return session;
  }
}

module.exports = { handleIncomingMessage };
