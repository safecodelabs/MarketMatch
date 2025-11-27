const intents = {
  housing: { keywords: ['bhk', 'flat', 'apartment', 'house', 'property'] }
};

function detectIntent(messageText) {
  const text = messageText.toLowerCase();
  for (const [intent, data] of Object.entries(intents)) {
    if (data.keywords.some((k) => text.includes(k))) return intent;
  }
  return null;
}

function getMissingInfo(intent, text) {
  const missing = [];
  if (intent === 'housing') {
    if (!text.match(/noida|gurgaon|delhi|bangalore|mumbai|pune/)) missing.push('city');
    if (!text.match(/\d\s?bhk|flat|room|apartment/)) missing.push('property type');
    if (!text.match(/\₹?\d{4,6}/)) missing.push('budget');
  }
  return missing;
}

module.exports = { detectIntent, getMissingInfo };
