// intentEngine.js
/**
 * INTENT ENGINE — scalable & modular
 */

function detectIntent(message) {
  const text = message.toLowerCase();

  const intents = [
    {
      name: "housing",
      keywords: [
        "rent", "flat", "apartment", "1bhk", "2bhk", "3bhk",
        "room", "house", "pg", "studio",
        "plot", "freehold", "residential land", "villa",
        "commercial property", "office space", "warehouse",
        "shop", "builder floor"
      ]
    },
    {
      name: "jobs",
      keywords: ["job", "hiring", "work", "apply", "opening", "career"]
    },
    {
      name: "leads",
      keywords: ["lead", "buyer", "seller", "customer list", "database"]
    }
  ];

  for (const intent of intents) {
    if (intent.keywords.some(k => text.includes(k))) {
      return intent.name;
    }
  }

  return "unknown";
}

module.exports = { detectIntent };
