const fetch = require('node-fetch');
const { getWitIntent } = require('../middlewares/nlpHandler');
const { createUserIfNotExists } = require('../utils/sessionStore');
const { mainFlow } = require('../flows/main.flow');
const { handleAdsIntent } = require('../features/ads/ads.controller');
const greetingFlow = require('../flows/greeting.flow');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v15.0'; // adjust version if needed
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // from FB Business Manager
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN; // your token here

// Send message to user via WhatsApp API
async function sendWhatsAppMessage(to, message) {
  const body = {
    messaging_product: "whatsapp",
    to,
    text: { body: message }
  };

  const res = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('WhatsApp API error:', error);
  }
}

async function onMessageReceived(sender, userMessage) {
  // Step 1: NLP intent detection
  const { intent, confidence } = await getWitIntent(userMessage);

  // Step 2: Check if it's a new user
  const isNewUser = await createUserIfNotExists(sender);

  // Step 3: Handle based on intent
  switch (intent) {
    case 'greeting':
      if (isNewUser) {
        await greetingFlow(sender, (msg) => sendWhatsAppMessage(sender, msg), { newUser: true });
      } else {
        await greetingFlow(sender, (msg) => sendWhatsAppMessage(sender, msg), { newUser: false });
      }
      return;

    case 'ads_inquiry':
      await handleAdsIntent(userMessage, (msg) => sendWhatsAppMessage(sender, msg));
      return;

    case 'about_bot':
      await sendWhatsAppMessage(sender, "🤖 I'm your smart assistant. I can help you with advertising, listings, FAQs, and more. Try saying something like *'Show metro ads in Delhi'*.");
      return;

    case 'fallback':
    case 'unknown':
    default:
      if (isNewUser) {
        await greetingFlow(sender, (msg) => sendWhatsAppMessage(sender, msg), { fallback: true });
      } else {
        await sendWhatsAppMessage(sender, "😕 I'm not sure what you meant. Try asking for ad info, listings, or say *hi*.");
      }
      return;
  }
}

module.exports = { onMessageReceived };
