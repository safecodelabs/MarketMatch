const { fetchAdContacts } = require('./ads.service');
const chatbotController = require('../../controllers/chatbotController');

// Web (REST API) usage — optional
async function getAdInfo(req, res) {
  const { city, type } = req.body;

  if (!city || !type) {
    return res.status(400).json({ message: 'City and type are required.' });
  }

  const results = await fetchAdContacts(city, type);

  if (results.length === 0) {
    return res.send(`❌ No ad contacts found for ${type} in ${city}.`);
  }

  return res.send(`Here are advertising contacts for ${type} in ${city}:\n\n${results.join('\n')}`);
}

// WhatsApp Flow usage
async function handleAdsIntent(message, sendMessage) {
  const text = typeof message === 'string'
    ? message
    : message?.text?.body || message?.body || '';

  if (typeof text !== 'string') {
    return false;
  }

  const lower = text.toLowerCase();

  // Flexible matching pattern for "metro ads in <city>"
  const match = lower.match(/(metro\s+ads?|ads?|advertis(e|ing)?)\s*(in)?\s*([a-z\s]+)/i);

  if (match) {
    const type = match[1]?.includes('metro') ? 'metro ads' : 'ads';
    const city = match[5]?.trim();

    if (!city) {
      await sendMessage("❌ Please specify a city for ad contacts.");
      return true;
    }

    const results = await fetchAdContacts(city, type);

    if (results.length === 0) {
      await sendMessage(`❌ No ${type} contacts found in ${city}.`);
    } else {
      await sendMessage(`📢 *${type.charAt(0).toUpperCase() + type.slice(1)} in ${city}*\n\nHere are our advertising contacts:\n\n${results.join('\n')}`);
    }

    return true;
  }

  return false;
}

module.exports = {
  getAdInfo,
  handleAdsIntent
};
