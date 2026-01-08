// src/flows/urbanHelpFlow.js
// Extracted urban help flow logic to separate module for clarity and testing
const multiLanguage = require('../../utils/multiLanguage');
const constants = require('../../utils/constants');
const { sendMessageWithClient, sendInteractiveButtonsWithClient } = require('../services/messageService');
const {
  searchUrbanServices,
  addUserRequest,
  updateRequestStatus,
  getUserProfile
} = require('../../database/firestore');

const URBAN_HELP_CATEGORIES = Object.fromEntries(
  Object.entries(constants.SERVICE_CATEGORIES).map(([k, v]) => [v.id, { name: v.name, emoji: v.emoji, keywords: v.keywords }])
);

async function handleUrbanHelpVoiceIntent(sender, session, processingResult, client) {
  // Keep behavior consistent with previous implementation
  const { transcription, entities, confidence } = processingResult;
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  const missingInfo = checkMissingUrbanHelpInfo(entities);

  if (missingInfo.length > 0) {
    await askForMissingUrbanHelpInfo(sender, entities, missingInfo, userLang, client);

    session.urbanHelpContext = {
      transcription: transcription,
      entities: entities,
      missingInfo: missingInfo,
      step: 'awaiting_missing_info'
    };
    session.step = 'awaiting_urban_help_info';

    try {
      if (missingInfo.includes('location') && typeof addUserRequest === 'function') {
        const pending = await addUserRequest(sender, {
          category: entities.category || null,
          location: null,
          originalText: transcription || null,
          note: 'awaiting_location'
        });
        if (pending && pending.success) {
          session.urbanHelpContext.requestId = pending.requestId;
          console.log(`✅ [URBAN HELP] Pending user request saved: ${pending.requestId}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ [URBAN HELP] Could not save pending user request:', err);
    }

  } else if (confidence < 0.7) {
    await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'not_understood') + `\n\nI heard: "*${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}*"`, client);

    await sendInteractiveButtonsWithClient(
      client,
      sender,
      'Is this what you need?',
      [
        { id: `confirm_urban_help_${entities.category || 'general'}`, text: '✅ Yes, correct' },
        { id: 'try_again_urban', text: '🔄 Try again' },
        { id: 'type_instead', text: '📝 Type instead' }
      ]
    );

    session.urbanHelpContext = { transcription: transcription, entities: entities, step: 'awaiting_clarification' };
    session.step = 'awaiting_urban_help_clarification';

  } else {
    await sendUrbanHelpConfirmation(sender, transcription, entities, userLang, client);
    session.urbanHelpContext = { transcription: transcription, entities: entities, step: 'awaiting_confirmation' };
    session.step = 'awaiting_urban_help_confirmation';
  }

  await require('../../utils/sessionStore').saveSession(sender, session);
  return session;
}

function checkMissingUrbanHelpInfo(entities) {
  const missing = [];
  if (!entities || !entities.category) missing.push('category');
  if (!entities || !entities.location) missing.push('location');
  return missing;
}

async function askForMissingUrbanHelpInfo(sender, entities, missingInfo, userLang, client) {
  let message = '';
  if (userLang === 'hi') {
    message = 'कृपया स्थान बताएं जहाँ आपको सेवा चाहिए।';
  } else if (userLang === 'ta') {
    message = 'உங்களுக்கு எங்கே சேவை வேண்டும் என்று கூறுங்கள்.';
  } else {
    message = `Where do you need the ${URBAN_HELP_CATEGORIES[entities?.category]?.name || 'service'}?`;
  }

  const buttons = [{ id: 'type_location', text: '📝 Type location' }];
  await sendInteractiveButtonsWithClient(client, sender, message, buttons);
}

async function sendUrbanHelpConfirmation(sender, transcription, entities, userLang, client) {
  const category = entities.category || 'service';
  const categoryName = URBAN_HELP_CATEGORIES[category]?.name || 'Service';
  const location = entities.location || 'your area';

  let confirmationText = '';
  if (userLang === 'hi') {
    confirmationText = `मैंने समझा: "*${transcription}"*\n\nआपको *${location}* में *${categoryName}* चाहिए।\n\nक्या यह सही है?`;
  } else if (userLang === 'ta') {
    confirmationText = `நான் புரிந்து கொண்டேன்: "*${transcription}"*\n\nஉங்களுக்கு *${location}*-ல் *${categoryName}* தேவை.\n\nஇது சரியானதா?`;
  } else {
    confirmationText = `I understood: "*${transcription}"*\n\nYou need a *${categoryName}* in *${location}*.`;
  }

  const buttons = [
    { id: `confirm_urban_${category}`, text: '✅ Yes, find service' },
    { id: 'try_again_urban', text: '🔄 Try again' },
    { id: 'modify_details', text: '✏️ Modify details' }
  ];

  await sendInteractiveButtonsWithClient(client, sender, confirmationText, buttons);
}

async function handleUrbanHelpConfirmation(sender, response, session, client) {
  const urbanContext = session.urbanHelpContext;
  if (!urbanContext) return session;
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';

  if (response.startsWith('confirm_urban_')) {
    await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'searching', {
      category: URBAN_HELP_CATEGORIES[urbanContext.entities.category]?.name || 'Service',
      location: urbanContext.entities.location || 'your area'
    }) || `🔍 Searching for ${urbanContext.entities.category} in ${urbanContext.entities.location}...`, client);

    await executeUrbanHelpSearch(sender, urbanContext.entities, session, client, userLang);

  } else if (response === 'try_again_urban') {
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'try_again'));
    delete session.urbanHelpContext;
    session.step = 'awaiting_voice';

  } else if (response === 'modify_details') {
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'ask_send_updated_request'));
    delete session.urbanHelpContext;
    session.step = 'awaiting_urban_help_text';

  } else if (response.startsWith('category_')) {
    const category = response.replace('category_', '');
    urbanContext.entities.category = category;
    if (!urbanContext.entities.location) {
      await askForMissingUrbanHelpInfo(sender, urbanContext.entities, ['location'], userLang, client);
      session.step = 'awaiting_urban_help_info';
    } else {
      await sendUrbanHelpConfirmation(sender, urbanContext.transcription, urbanContext.entities, userLang, client);
      session.step = 'awaiting_urban_help_confirmation';
    }

  } else if (response.startsWith('location_')) {
    const location = response.replace('location_', '');
    urbanContext.entities.location = location.charAt(0).toUpperCase() + location.slice(1);
    await sendUrbanHelpConfirmation(sender, urbanContext.transcription, urbanContext.entities, userLang, client);
    session.step = 'awaiting_urban_help_confirmation';
  }

  await require('../../utils/sessionStore').saveSession(sender, session);
  return session;
}

async function executeUrbanHelpSearch(sender, entities, session, client, userLang) {
  try {
    const originalText = session.urbanHelpContext?.transcription || session.urbanHelpContext?.text || session.rawTranscription || '';
    const context = require('../core/ai/aiEngine').detectIntentContext(originalText);
    const isOffering = require('../core/ai/aiEngine').isUserOfferingServices(originalText);

    if (isOffering || context === 'offer') {
      await sendMessageWithClient(sender, "I see you're offering services. Please use the '📝 Post Listing' option from the menu or type your service details again.", client);
      delete session.urbanHelpContext;
      session.step = 'menu';
      session.state = 'initial';
      await require('../../utils/sessionStore').saveSession(sender, session);
      return;
    }

    const { category, location } = entities;
    const categoryName = getCategoryDisplayName(category);

    await sendMessageWithClient(sender, `🔍 Searching for ${categoryName} in ${location}...`, client);

    const results = await searchUrbanServices(category, location);

    if (results && results.length > 0) {
      const resultsMessage = formatUrbanHelpResults(results, userLang, categoryName);
      await sendMessageWithClient(sender, resultsMessage, client);

      if (session?.urbanHelpContext?.requestId && typeof updateRequestStatus === 'function') {
        try {
          await updateRequestStatus(session.urbanHelpContext.requestId, 'matched', results.map(r => r.id).slice(0, 3));
        } catch (err) {
          console.warn('⚠️ [URBAN HELP] Could not update request status to matched:', err);
        }
      } else {
        await addUserRequest(sender, {
          category: category,
          location: location,
          status: 'matched',
          matchedProviders: results.map(r => r.id).slice(0, 3),
          timestamp: Date.now()
        });
      }

    } else {
      await sendMessageWithClient(sender, `❌ Sorry, I couldn't find any ${categoryName} in ${location}.\n\nI'll notify you when a matching provider becomes available.`, client);

      try {
        if (typeof addUserRequest === 'function') {
          const pending = await addUserRequest(sender, {
            category: category,
            location: location,
            originalText: originalText,
            note: 'no_results_cache'
          });
          if (pending && pending.success) {
            console.log(`✅ [URBAN HELP] Pending request saved: ${pending.requestId}`);
            await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'REQUEST_POSTED') || '📝 Your request has been posted. We will notify you when a match appears.', client);
          }
        }
      } catch (err) {
        console.warn('⚠️ [URBAN HELP] Could not save pending request:', err);
      }
    }

    delete session.urbanHelpContext;
    session.step = 'menu';
    session.state = 'initial';
    await require('../../utils/sessionStore').saveSession(sender, session);

  } catch (err) {
    console.error('❌ [URBAN HELP] Error in executeUrbanHelpSearch:', err);
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'SERVER_ERROR'));
    session.step = 'menu';
    await require('../../utils/sessionStore').saveSession(sender, session);
  }
}

function extractUrbanHelpFromText(text) {
  const lowerText = text.toLowerCase();
  const result = { category: null, location: null, timing: null, rawText: text, context: require('../core/ai/aiEngine').detectIntentContext(text) };

  const locationMatch = lowerText.match(/\b(in|at|near|around|mein|पर|में)\s+([^,.!?]+)/i);
  if (locationMatch) {
    result.location = locationMatch[2].trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  // Extract category by matching keywords
  for (const [knownCategory, data] of Object.entries(URBAN_HELP_CATEGORIES)) {
    for (const kw of (data.keywords || [])) {
      if (lowerText.includes(kw)) {
        result.category = knownCategory;
        break;
      }
    }
    if (result.category) break;
  }

  // Heuristic: if short text and no category but looks like a single token, treat that as category
  const tokens = lowerText.split(/\s+/).filter(Boolean);
  if (!result.category && tokens.length <= 3) {
    result.category = tokens[0];
  }

  return result;
}

function getCategoryDisplayName(category) {
  return URBAN_HELP_CATEGORIES[category]?.name || category || 'Service';
}

function formatUrbanHelpResults(results, userLang, categoryName = null) {
  let message = '';
  const top = results.slice(0, 5);
  message += `🔍 Found ${results.length} providers:
`;
  for (const r of top) {
    message += `• ${r.name} — ${r.location} — ${r.phone}\n`;
  }
  message += `\nWant to contact any of these providers? Reply with the number.`;
  return message;
}

module.exports = {
  handleUrbanHelpTextRequest: async (sender, text, session, client) => {
    // Replicate earlier handleUrbanHelpTextRequest logic but delegating central functions
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';

    const context = require('../core/ai/aiEngine').detectIntentContext(text);
    const isOffering = require('../core/ai/aiEngine').isUserOfferingServices(text);

    if (isOffering) {
      await sendMessageWithClient(sender, userLang === 'hi' ? "🔧 मैं देख रहा हूं कि आप सेवाएं प्रदान कर रहे हैं। मैं आपकी पोस्टिंग में मदद करता हूं..." : "🔧 I see you're offering services. Let me help you post this...", client);
      const postingResult = await require('../services/posting-service').handlePostingService ? await require('../services/posting-service').handlePostingService(sender, text, session, client) : { handled: false };
      if (postingResult.handled) {
        if (postingResult.type === 'question' || postingResult.type === 'confirmation') session.step = 'posting_flow';
        else session.step = 'menu';
        await require('../../utils/sessionStore').saveSession(sender, session);
      }
      return;
    }

    // If continuing a previous session
    if (session.urbanHelpContext && session.urbanHelpContext.category && !session.urbanHelpContext.location) {
      session.urbanHelpContext.location = text;
      session.urbanHelpContext.text = session.urbanHelpContext.text || text;
      session.urbanHelpContext.step = 'awaiting_confirmation';
      await sendUrbanHelpConfirmation(sender, session.urbanHelpContext.text, session.urbanHelpContext, userLang, client);
      session.step = 'awaiting_urban_help_confirmation';
      await require('../../utils/sessionStore').saveSession(sender, session);
      return;
    }

    const extractedInfo = extractUrbanHelpFromText(text);

    if (!extractedInfo.category) {
      const categories = Object.entries(URBAN_HELP_CATEGORIES).slice(0, 3);
      const buttons = categories.map(([id, data]) => ({ id: `text_category_${id}`, text: `${data.emoji} ${data.name}` }));
      if (buttons.length < 3) buttons.push({ id: 'text_category_other', text: '🔧 Other Service' });
      await sendInteractiveButtonsWithClient(client, sender, 'What type of service do you need?', buttons);
      session.urbanHelpContext = { text: text, step: 'awaiting_category', location: extractedInfo.location || null };
      session.step = 'awaiting_urban_help_category';
      await require('../../utils/sessionStore').saveSession(sender, session);
      return;
    } else if (!extractedInfo.location) {
      await sendMessageWithClient(sender, `Where do you need the ${URBAN_HELP_CATEGORIES[extractedInfo.category]?.name || extractedInfo.category}?`, client);
      session.urbanHelpContext = { ...extractedInfo, step: 'awaiting_location' };
      session.step = 'awaiting_urban_help_location';

      try {
        if (typeof addUserRequest === 'function') {
          const pending = await addUserRequest(sender, { category: extractedInfo.category || null, location: null, originalText: extractedInfo.rawText || text, note: 'awaiting_location' });
          if (pending && pending.success) { session.urbanHelpContext.requestId = pending.requestId; }
        }
      } catch (err) { console.warn('⚠️ [URBAN HELP] Could not save pending user request (text flow):', err); }

      await require('../../utils/sessionStore').saveSession(sender, session);
      return;
    } else {
      // Auto-run search for text-origin requests
      session.urbanHelpContext = { ...extractedInfo, text: text, step: 'searching' };
      session.step = 'searching_urban_help';
      await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'searching', {
        category: URBAN_HELP_CATEGORIES[extractedInfo.category]?.name || extractedInfo.category || 'Service',
        location: extractedInfo.location || 'your area'
      }) || `🔍 Searching for ${URBAN_HELP_CATEGORIES[extractedInfo.category]?.name || extractedInfo.category || 'service'} in ${extractedInfo.location || 'your area'}...`, client);
      await executeUrbanHelpSearch(sender, extractedInfo, session, client, userLang);
      await require('../../utils/sessionStore').saveSession(sender, session);
      return;
    }
  },
  handleUrbanHelpVoiceIntent,
  checkMissingUrbanHelpInfo,
  askForMissingUrbanHelpInfo,
  sendUrbanHelpConfirmation,
  handleUrbanHelpConfirmation,
  executeUrbanHelpSearch,
  extractUrbanHelpFromText,
  formatUrbanHelpResults,
  getCategoryDisplayName
};