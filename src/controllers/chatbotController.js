const axios = require('axios');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.error('❌ Missing WHATSAPP_TOKEN or PHONE_NUMBER_ID in environment variables.');
}

const apiUrl = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

async function sendMessage(to, message) {
  try {
    const response = await axios.post(
      apiUrl,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Message sent to ${to}: ${message}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to send message:', error?.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendMessage };
