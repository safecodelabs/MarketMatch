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

  // Step 3: Greet if new user or intent is a greeting
  const greetingIntents = ['greeting', 'start', 'hello'];

  if (isNewUser || greetingIntents.includes(intent)) {
    await greetingFlow(sender, sendMessage);
  }

  // Step 4: Handle main flow (commands, etc.)
  const mainHandled = await mainFlow(userMessage, sendMessage);
  if (mainHandled) return;

  // Step 5: Handle ads flow
  const adsHandled = await handleAdsIntent(userMessage, sendMessage);
  if (adsHandled) return;

  // Step 6: Fallback
  await sendMessage("🤖 I didn't understand that. Try asking about metro ads in your city.");
}

module.exports = { onMessageReceived };
