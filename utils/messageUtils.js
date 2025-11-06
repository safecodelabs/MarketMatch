const intents = require('../intents');

function detectIntent(messageText) {
  const text = messageText.toLowerCase();
  for (const [intent, data] of Object.entries(intents)) {
    if (data.keywords.some(k => text.includes(k))) {
      return intent;
    }
  }
  return null;
}

function getMissingInfo(intent, text) {
  const missing = [];

  if (intent === "housing") {
    if (!text.match(/noida|gurgaon|delhi|bangalore|mumbai|pune/)) missing.push("city");
    if (!text.match(/\d\s?bhk|flat|room|apartment/)) missing.push("property type");
    if (!text.match(/\₹?\d{4,6}/)) missing.push("budget");
  }

  if (intent === "jobs") {
    if (!text.match(/developer|sales|marketing|designer|teacher|driver/)) missing.push("job type");
    if (!text.match(/\d+\s?(yrs|years)/)) missing.push("experience");
    if (!text.match(/noida|delhi|gurgaon|remote|mumbai|pune/)) missing.push("location");
  }

  if (intent === "leads") {
    if (!text.match(/education|real estate|finance|insurance|retail/)) missing.push("category");
    if (!text.match(/\d+/)) missing.push("quantity");
  }

  return missing;
}

module.exports = { detectIntent, getMissingInfo };
