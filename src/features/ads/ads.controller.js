const { fetchAdContacts } = require('./ads.service');

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

module.exports = { getAdInfo };
