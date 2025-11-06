const axios = require('axios');
const { getSession, saveSession } = require('./utils/sessionStore');
const { detectIntent, getMissingInfo } = require('./utils/messageUtils');
const { flowSteps } = require('./utils/constants');
const { getHousingData } = require('./utils/sheets');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

/**
 * Sends a message to a WhatsApp user.
 */
async function sendMessage(to, message, phone_number_id = PHONE_NUMBER_ID) {
  console.log(`✉️  Sending message to ${to}:`, JSON.stringify(message, null, 2));
  try {
    const url = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      ...(typeof message === 'string'
        ? { type: 'text', text: { body: message } }
        : message),
    };

    console.log('🪵 DEBUG → WhatsApp API Payload:', JSON.stringify(payload, null, 2));

    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Message sent successfully.');
  } catch (error) {
    console.error(
      '❌ Error sending message:',
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
    );
  }
}

/**
 * Handles incoming messages based on the user's session.
 */
async function handleIncomingMessage(sender, msg, session, phone_number_id = PHONE_NUMBER_ID) {
  console.log(`\n📩 Incoming message from ${sender}: "${msg}"`);
  console.log('🪵 DEBUG → Current Session:', JSON.stringify(session, null, 2));

  const currentStep = session.step || 'chooseService';
  console.log(`🪵 DEBUG → Current Step: ${currentStep}`);

  // 🔍 Quick Intent Detection
  if (msg.toLowerCase().includes('rent') || msg.toLowerCase().includes('flat') || msg.toLowerCase().includes('house')) {
    console.log('🪵 DEBUG → Quick Intent: housing/rent/flat detected');
    try {
      const listings = await getHousingData();
      console.log(`🪵 DEBUG → ${listings.length} housing listings fetched from Google Sheets.`);

      const sample = listings.slice(0, 3);
      let message = '🏠 Available Properties:\n\n';
      sample.forEach((item, i) => {
        message += `${i + 1}. ${item.property_type} in ${item.location} - ${item.price}\n📞 ${item.contact}\n\n`;
      });

      await sendMessage(sender, message, phone_number_id);
    } catch (err) {
      console.error('❌ Error fetching housing data:', err.message);
      await sendMessage(sender, '⚠️ Something went wrong while fetching data. Please try again later.');
    }
    return session;
  }

  switch (currentStep) {
    case 'chooseService': {
      console.log('🪵 DEBUG → Handling "chooseService" step');

      const validServices = ['housing', 'jobs', 'leads'];
      if (validServices.includes(msg.toLowerCase())) {
        session.step = 'collectingInfo';
        session.intent = msg.toLowerCase();
        console.log(`🪵 DEBUG → User selected service: ${session.intent}`);

        await sendMessage(
          sender,
          `Great! You're interested in *${msg}*. What are you looking for?\n\n(e.g., "1bhk in Noida under 15000", "marketing job in Delhi")`,
          phone_number_id
        );
      } else {
        console.log('🪵 DEBUG → Invalid service selected, showing options again');
        await sendMessage(
          sender,
          "Sorry, I didn't get that. Please choose one of the options below 👇",
          phone_number_id
        );
        await sendMessage(sender, flowSteps.chooseService, phone_number_id);
      }
      break;
    }

    case 'collectingInfo': {
      console.log('🪵 DEBUG → Handling "collectingInfo" step');
      const intent = session.intent;
      console.log(`🪵 DEBUG → Current intent: ${intent}`);

      const missing = getMissingInfo(intent, msg);
      console.log(`🪵 DEBUG → Missing info fields:`, missing);

      if (missing.length > 0) {
        await sendMessage(
          sender,
          `I see you're looking for *${intent}*. Could you also provide: *${missing.join(', ')}*?`,
          phone_number_id
        );
      } else {
        session.step = 'showResults';
        console.log('🪵 DEBUG → All required info gathered, moving to showResults');

        await sendMessage(
          sender,
          `✅ Perfect! Searching for *${intent}* based on your request...`,
          phone_number_id
        );

        if (intent === 'housing') {
          try {
            const listings = await getHousingData();
            console.log(`🪵 DEBUG → ${listings.length} housing listings fetched from Google Sheets.`);

            const sample = listings.slice(0, 3);
            let message = '🏠 Top housing options:\n\n';
            sample.forEach((item, i) => {
              message += `${i + 1}. ${item.property_type} in ${item.location} - ${item.price}\n📞 ${item.contact}\n\n`;
            });

            await sendMessage(sender, message, phone_number_id);
          } catch (err) {
            console.error('❌ Error fetching housing listings:', err.message);
            await sendMessage(sender, '⚠️ Unable to fetch housing listings. Try again later.');
          }
        } else {
          await sendMessage(sender, '🚧 Feature coming soon!', phone_number_id);
        }
      }
      break;
    }

    default: {
      console.log('🪵 DEBUG → Unknown step, resetting to chooseService');
      await sendMessage(
        sender,
        "I'm not sure how to help with that. Let's start over.",
        phone_number_id
      );
      await sendMessage(sender, flowSteps.chooseService, phone_number_id);
      session.step = 'chooseService';
    }
  }

  console.log('🪵 DEBUG → Updated Session:', JSON.stringify(session, null, 2));
  return session;
}

module.exports = { sendMessage, handleIncomingMessage };
