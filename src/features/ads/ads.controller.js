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
  const lower = message.toLowerCase();

  // Match messages like "show metro ads in delhi"
  const match = lower.match(/(metro\s+ads).*(in\s+)?([a-z\s]+)/i);

  if (match) {
    const type = 'metro ads';
    const city = match[3]?.trim();

    const results = await fetchAdContacts(city, type);

    if (results.length === 0) {
      await sendMessage(`❌ No metro ad contacts found in ${city}.`);
    } else {
      await sendMessage(`📢 *Metro Ads in ${city}*\n\nHere are our advertising contacts:\n\n${results.join('\n')}`);
    }

    return true; // handled
  }

  return false;
}

module.exports = {
  getAdInfo,
  handleAdsIntent
};
