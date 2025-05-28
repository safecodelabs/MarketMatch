const { fetchAdContacts } = require('../features/ads/ads.service');

// Handle fetching ad contacts
async function handleAdRequest({ city, type }, sendMessage) {
  const contacts = await fetchAdContacts(city, type);

  if (!contacts.length) {
    return sendMessage(`❌ No ad contacts found for ${type} in ${city}.`);
  }

  const response = `📢 Here are advertising contacts for ${type} in ${city}:\n\n${contacts.join('\n')}`;
  sendMessage(response);
}

// Parse intent from incoming message
function parseAdIntent(message) {
  const text = message?.text?.body || message?.body;
  if (typeof text !== 'string') return false;

  const lower = text.toLowerCase();
  return lower.includes('ad') || lower.includes('advertise');
}

module.exports = {
  handleAdRequest,
  parseAdIntent,
};
