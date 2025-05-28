const axios = require('axios');

const WIT_API_URL = 'https://api.wit.ai/message?v=20200513';
const WIT_SERVER_TOKEN = process.env.WIT_SERVER_TOKEN;

async function getIntentFromMessage(message) {
  try {
    const response = await axios.get(`${WIT_API_URL}&q=${encodeURIComponent(message)}`, {
      headers: {
        Authorization: `Bearer ${WIT_SERVER_TOKEN}`,
      },
    });

    const { intents, entities } = response.data;

    const topIntent = intents?.[0]?.name || null;
    return {
      intent: topIntent,
      confidence: intents?.[0]?.confidence || 0,
      entities,
    };

  } catch (error) {
    console.error('Wit.ai NLP error:', error.message);
    return { intent: null, confidence: 0, entities: {} };
  }
}

module.exports = { getIntentFromMessage };