async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender || !msgBody) return;

  msgBody = msgBody.trim();
  let session = (await getSession(sender)) || { step: 'start', housingFlow: { step: 'start', data: {} } };
  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || 'en';

  // --- LANGUAGE FEATURE: New user or language change ---
  const lowerMsg = msgBody.toLowerCase();
  const languageKeywords = ['change language', 'language', 'lang'];

  if (!userProfile?.preferredLanguage || languageKeywords.includes(lowerMsg) || session?.housingFlow?.awaitingLangSelection) {
    await sendButtons(sender, getString(userLang, 'selectLanguage') || 'Select your language:', [
      { id: 'lang_en', title: 'English' },
      { id: 'lang_hi', title: 'हिंदी' },
      { id: 'lang_ta', title: 'தமிழ்' }
    ]);

    session.housingFlow = { ...session.housingFlow, step: 'awaiting_language', awaitingLangSelection: true };
    await saveSession(sender, session);
    return session;
  }

  // --- HANDLE LANGUAGE SELECTION ---
  if (/^lang_/.test(lowerMsg) || ['english', 'हिंदी', 'தமிழ்', 'hi', 'ta', 'en'].includes(lowerMsg)) {
    let lang = 'en';
    if (lowerMsg.includes('hi') || lowerMsg.includes('हिंदी')) lang = 'hi';
    if (lowerMsg.includes('ta') || lowerMsg.includes('தமிழ்')) lang = 'ta';

    await saveUserLanguage(sender, lang);
    session.housingFlow = { ...session.housingFlow, step: 'start', awaitingLangSelection: false, data: {} };
    await saveSession(sender, session);

    await sendTranslated(sender, 'menu', lang); // show menu in selected language
    return session;
  }

  // --- Continue normal AI-first flow ---
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

    if (mustSaveLanguage) {
      await saveUserLanguage(sender, mustSaveLanguage);
    }

    if (buttons && buttons.length) {
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
