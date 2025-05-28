async function handleAdsIntent(message, sendMessage) {
  const text = typeof message === 'string'
    ? message
    : message?.text?.body || message?.body || '';

  if (typeof text !== 'string') return false;

  const lower = text.toLowerCase();

  const typeMap = {
    'metro ad': 'metro ads',
    'metro ads': 'metro ads',
    'ads': 'ads',
    'advertisement': 'ads',
    'advertising': 'ads'
  };

  const cityMap = {
    delhi: 'delhi',
    gurgaon: 'gurugram',
    gurugram: 'gurugram',
    mumbai: 'mumbai',
    bangalore: 'bangalore'
  };

  const matchedTypeKey = Object.keys(typeMap).find(k => lower.includes(k));
  const matchedCityKey = Object.keys(cityMap).find(c => lower.includes(c));

  if (matchedTypeKey && matchedCityKey) {
    const type = typeMap[matchedTypeKey];
    const city = cityMap[matchedCityKey];

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
