// intents.js
module.exports = {
  housing: {
    keywords: ["flat", "1bhk", "2bhk", "3bhk", "house", "villa", "apartment", "pg", "room", "rent", "tenant"],
    requiredInfo: ["city", "area", "budget"],
  },
  jobs: {
    keywords: ["job", "hiring", "vacancy", "recruitment", "work", "internship", "position"],
    requiredInfo: ["job_type", "experience", "location"],
  },
  leads: {
    keywords: ["lead", "database", "contact list", "buyers", "sellers"],
    requiredInfo: ["category", "quantity"],
  }
};
