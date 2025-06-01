const fetch = require('node-fetch');

const getWitIntent = async (message) => {
  const WIT_TOKEN = process.env.WIT_AI_TOKEN;

  if (!message || typeof message !== 'string') {
    return { intent: 'unknown', confidence: 0, entities: {} };
  }

  const url = `https://api.wit.ai/message?v=20230529&q=${encodeURIComponent(message)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${WIT_TOKEN}`,
    },
  });

  const data = await response.json();

  const intent = data.intents?.[0]?.name || 'unknown';
  const confidence = data.intents?.[0]?.confidence || 0;
  const entities = data.entities || {};

  return { intent, confidence, entities };
};

module.exports = { getWitIntent };
