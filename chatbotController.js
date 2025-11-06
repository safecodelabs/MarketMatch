const axios = require('axios');
const { getSession, saveSession } = require('./utils/sessionStore');
const { detectIntent, getMissingInfo } = require('./utils/messageUtils');
const { flowSteps } = require('./utils/constants');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

/**
 * Sends a message to a WhatsApp user.
 * @param {string} to - The recipient's phone number.
 * @param {object|string} message - The message object (for interactive) or text string.
 */
async function sendMessage(to, message) {
  console.log(`✉️  Sending message to ${to}:`, JSON.stringify(message));
  try {
    const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      ...(typeof message === 'string' ? { type: 'text', text: { body: message } } : message),
    };

    await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ Message sent successfully.');
  } catch (error) {
    console.error('❌ Error sending message:', error.response ? error.response.data : error.message);
  }
}

/**
 * Handles incoming messages based on the user's session.
 * @param {string} sender - The user's phone number.
 * @param {string} msg - The incoming message text or button ID.
 * @param {object} session - The user's current session data.
 * @returns {object} The updated session object.
 */
async function handleIncomingMessage(sender, msg, session) {
  const currentStep = session.step;

  switch (currentStep) {
    case 'chooseService':
      const validServices = ['housing', 'jobs', 'leads'];
      if (validServices.includes(msg)) {
        session.step = 'collectingInfo';
        session.intent = msg;
        await sendMessage(sender, `Great! You're interested in *${msg}*. What are you looking for? \n\n(e.g., "1bhk in Noida under 15000", "marketing job with 2 years experience in Delhi")`);
      } else {
        await sendMessage(sender, "Sorry, I didn't get that. Please choose one of the options.");
        await sendMessage(sender, flowSteps.chooseService);
      }
      break;

    case 'collectingInfo':
      const intent = session.intent;
      const missing = getMissingInfo(intent, msg);

      if (missing.length > 0) {
        await sendMessage(sender, `I see you're looking for *${intent}*. Could you please also provide: *${missing.join(", ")}*?`);
      } else {
        session.step = 'showResults';
        await sendMessage(sender, `✅ Perfect! Searching for *${intent}* with the details you provided. One moment...`);
        // TODO: Add logic here to fetch data from Google Sheets
        await sendMessage(sender, "Here are some matching results (demo):\n- Listing 1\n- Listing 2");
      }
      break;

    default:
      await sendMessage(sender, "I'm not sure how to help with that. Let's start over.");
      await sendMessage(sender, flowSteps.chooseService);
      session.step = 'chooseService';
  }
  return session;
}

module.exports = { sendMessage, handleIncomingMessage };