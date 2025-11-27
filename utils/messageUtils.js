// src/utils/messageUtils.js
// housing-only fallback intent detector & missing info helper

const intents = {
  housing: { keywords: ['bhk', 'flat', 'apartment', 'house', 'property', 'rent', 'sale'] }
};

function detectIntent(messageText) {
  if (!messageText) return null;
  const text = messageText.toLowerCase();
  for (const [intent, data] of Object.entries(intents)) {
    if (data.keywords.some(k => text.includes(k))) return intent;
  }
  return null;
}

function getMissingInfo(intent, text) {
  const missing = [];
  if (intent === "housing") {
    if (!text.match(/noida|gurgaon|delhi|bangalore|mumbai|pune/)) missing.push("city");
    if (!text.match(/\d\s?bhk|flat|apartment|room/)) missing.push("property type");
    if (!text.match(/\₹?\d{3,7}/)) missing.push("budget");
  }
  return missing;
}

module.exports = { detectIntent, getMissingInfo };
