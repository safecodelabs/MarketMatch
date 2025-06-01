const { getWitIntent } = require('../middlewares/nlpHandler');
const { createUserIfNotExists } = require('../utils/sessionStore');

const { mainFlow } = require('../flows/main.flow');
const { handleAdsIntent } = require('../features/ads/ads.controller');
const greetingFlow = require('../flows/greeting.flow'); // You'll create this next

async function onMessageReceived(sender, userMessage) {
  const sendMessage = async (reply) => {
    console.log(`To ${sender}: ${reply}`);
    // TODO: Replace with actual WhatsApp API logic
  };

  // Step 1: NLP intent detection
  const { intent, confidence } = await getWitIntent(userMessage);

  // Step 2: Check if it's a new user
  const isNewUser = await createUserIfNotExists(sender);

// Step 3: Handle based on intent
  switch (intent) {
    case 'greeting':
      if (isNewUser) {
        await greetingFlow(sender, sendMessage, { newUser: true });
      } else {
        await greetingFlow(sender, sendMessage, { newUser: false });
      }
      return;

    case 'ads_inquiry':
      await handleAdsIntent(userMessage, sendMessage);
      return;

    case 'about_bot':
      await sendMessage("🤖 I'm your smart assistant. I can help you with advertising, FAQs, and more. Try saying something like *'Show metro ads in Delhi'*.");
      return;

    case 'fallback':
    case 'unknown':
    default:
      if (isNewUser) {
        await greetingFlow(sender, sendMessage, { fallback: true });
      } else {
        await sendMessage("😕 I'm not sure what you meant. Try asking for ad info or say *hi*.");
      }
      return;
  }
}

module.exports = { onMessageReceived };
