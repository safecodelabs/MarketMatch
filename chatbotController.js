const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getHousingData } = require("./utils/sheets");
const { classify } = require("./src/ai/aiEngine");  // ❗ Use AI for intent + extraction

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

/* ---------------------------------------------------
   📤 UNIVERSAL SEND MESSAGE
-----------------------------------------------------*/
async function sendMessage(to, message, phone_number_id = PHONE_NUMBER_ID) {
  console.log(`✉️ Sending message to ${to}:`, message);

  const url = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: message }
  };

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    console.log("✅ Message sent");
  } catch (err) {
    console.error("❌ Send error:", err.response?.data || err.message);
  }
}

/* ---------------------------------------------------
   🧠 MAIN HANDLER
-----------------------------------------------------*/
async function handleIncomingMessage(sender, msg, session, phone_number_id) {
  console.log(`📩 Incoming from ${sender}: ${msg}`);
  console.log("Session now:", session);

  // Step 1 → AI classification
  const ai = await classify(msg);
  console.log("AI classify:", ai);

  if (ai.intent === "browse_housing" || ai.intent === "buy_house") {
    return await handleAIHousing(sender, msg, session, ai.entities);
  }

  await sendMessage(
    sender,
    "I'm here to help you with properties! Try:\n\n• 2bhk in Mumbai under 20k\n• Flat in Delhi\n• 1bhk Noida"
  );

  return session;
}

/* ---------------------------------------------------
   🏠 AI HOUSING HANDLER (DYNAMIC)
-----------------------------------------------------*/
async function handleAIHousing(sender, userMsg, session, entities) {
  // Merge newly extracted info into session
  session.housing = {
    ...session.housing,
    ...cleanEntities(entities)
  };

  const needs = getMissingHousingFields(session.housing);

  // Step 1 — If info missing → ask for missing info
  if (needs.length > 0) {
    const question = await buildDynamicQuestion(needs, userMsg);
    await sendMessage(sender, question);
    await saveSession(sender, session);
    return session;
  }

  // Step 2 — All info present → fetch Google Sheet + filter
  const listings = await getHousingData();

  const filtered = filterHousing(listings, session.housing);

  if (filtered.length === 0) {
    await sendMessage(sender, "⚠️ No properties match your criteria.");
    return session;
  }

  // Step 3 — Build response
  let text = "🏠 *Matching Properties:*\n\n";
  filtered.slice(0, 5).forEach((p, i) => {
    text += `${i + 1}. *${p.property_type}* in *${p.location}*\n`;
    text += `💰 ${p.price}\n`;
    text += `📞 ${p.contact}\n\n`;
  });

  await sendMessage(sender, text);

  session.housing = {}; // reset after showing
  await saveSession(sender, session);
  return session;
}

/* ---------------------------------------------------
   🔍 Extract missing fields
-----------------------------------------------------*/
function getMissingHousingFields(h) {
  const missing = [];
  if (!h.location) missing.push("location");
  if (!h.property_type) missing.push("property type");
  if (!h.budget) missing.push("budget");
  if (!h.bhk) missing.push("bhk");
  return missing;
}

/* ---------------------------------------------------
   ✨ AI generates follow-up question dynamically
-----------------------------------------------------*/
const { askAI } = require("./ai/aiEngine");

async function buildDynamicQuestion(missing, userMsg) {
  const prompt = `
You are a conversational real-estate AI bot.
User message: "${userMsg}"

The user is looking for a property but still missing fields: ${missing.join(", ")}.

Ask a SINGLE friendly natural question that:
- Feels like human conversation
- Asks ONLY for the missing details
- Does NOT list them like a robot
- Should sound like: "Sure! What budget are you looking at?" or "Which area in Delhi works for you?"

Return only the question.
`;

  return await askAI(prompt);
}

/* ---------------------------------------------------
   🧹 Clean entity values
-----------------------------------------------------*/
function cleanEntities(e) {
  const cleaned = {};
  if (e.location) cleaned.location = e.location.trim();
  if (e.property_type) cleaned.property_type = e.property_type.trim();
  if (e.details?.includes("1bhk")) cleaned.bhk = "1bhk";
  if (e.details?.includes("2bhk")) cleaned.bhk = "2bhk";
  if (e.details?.includes("3bhk")) cleaned.bhk = "3bhk";
  if (e.budget) cleaned.budget = e.budget.replace(/[^0-9]/g, "");
  return cleaned;
}

/* ---------------------------------------------------
   🧮 Filter results from Google Sheets
-----------------------------------------------------*/
function filterHousing(listings, q) {
  let res = listings;

  if (q.location) res = res.filter(r => r.location.toLowerCase().includes(q.location.toLowerCase()));
  if (q.property_type) res = res.filter(r => r.property_type.toLowerCase().includes(q.property_type.toLowerCase()));
  if (q.bhk) res = res.filter(r => r.description.toLowerCase().includes(q.bhk.toLowerCase()));
  if (q.budget) res = res.filter(r => extractPrice(r.price) <= parseInt(q.budget));

  return res;
}

function extractPrice(price) {
  if (!price) return 999999999;
  return parseInt(price.replace(/[^0-9]/g, ""));
}

module.exports = { sendMessage, handleIncomingMessage };
