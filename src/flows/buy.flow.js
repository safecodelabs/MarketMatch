// src/flows/buy.flow.js
const { getHousingData } = require("../../utils/sheets");

/**
 * handleBuy(text, session)
 * returns { reply, nextSession }
 */
async function handleBuy(text, session) {
  // ensure session.data has location / budget / property_type if possible
  const { location, budget, property_type } = session.data || {};

  // Fetch all listings
  const listings = await getHousingData();

  // Filter defensively
  const filtered = listings.filter(item => {
    const matchLocation = !location || (item.location || "").toLowerCase().includes((location || "").toLowerCase());
    const matchProperty = !property_type || (item.property_type || "").toLowerCase().includes((property_type || "").toLowerCase());
    const itemPrice = parseInt((item.price || "").toString().replace(/\D/g, "")) || 0;
    const matchBudget = !budget || (parseInt(budget.toString().replace(/\D/g, "")) ? itemPrice <= parseInt(budget.toString().replace(/\D/g, "")) : true);
    return matchLocation && matchProperty && matchBudget;
  });

  if (!filtered.length) {
    // ask for missing info
    const questions = [];
    if (!location) questions.push("location (city or area)");
    if (!property_type) questions.push("property type (1BHK / 2BHK / room)");
    if (!budget) questions.push("budget (e.g., 15000)");

    return {
      reply: {
        type: "text",
        text: { body: `I couldn't find matching properties. Could you provide: ${questions.join(", ")}? Example: "1BHK in Noida under 15000"` }
      },
      nextSession: { ...session, step: "collect", data: session.data }
    };
  }

  // build message for top 5
  let msg = "🏠 Matching Properties:\n\n";
  filtered.slice(0, 5).forEach((item, idx) => {
    msg += `${idx + 1}. ${item.property_type} in ${item.location} — ${item.price}\n📞 ${item.contact}\n${item.description ? item.description + "\n" : ""}\n`;
  });

  return {
    reply: { type: "text", text: { body: msg } },
    nextSession: { ...session, step: "done" }
  };
}

module.exports = { handleBuy };
