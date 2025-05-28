const { fetchAdContacts } = require('../features/ads/ads.service');

async function handleAdRequest({ city, type }, sendMessage) {
  const contacts = await fetchAdContacts(city, type);

  if (!contacts.length) {
    return sendMessage(`❌ No ad contacts found for ${type} in ${city}.`);
  }

  const response = `📢 Here are advertising contacts for ${type} in ${city}:\n\n${contacts.join('\n')}`;
  sendMessage(response);
}

function parseAdIntent(message) {
  const lower = message.toLowerCase();
  if (lower.includes('ad') || lower.includes('advertise')) {
    return true;
  }
  return false;
}

module.exports = {
  handleAdRequest,
  parseAdIntent,
};
