// src/ai/aiEngine.js
require("dotenv").config();
const Groq = require("groq-sdk");
const { detectIntent: fallbackDetectIntent } = require("../../utils/messageUtils");

const client = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

// low-level LLM call (may throw if no key)
async function askAI(prompt, opts = {}) {
  try {
    if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
    const res = await client.chat.completions.create({
      model: opts.model || "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2,
      max_tokens: opts.max_tokens || 800
    });
    return res.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.warn("askAI warning:", err?.message || err);
    throw err;
  }
}

function normalizeText(s = "") {
  return (s || "").toString().trim().toLowerCase();
}

function extractPhone(text = "") {
  if (!text) return "";
  const m = text.match(/(?:\+?\d{1,3}[-\s.]*)?(?:\d{10}|\d{5}[-\s.]\d{5}|\d{3}[-\s.]\d{3}[-\s.]\d{4})/g);
  return m ? m[0].replace(/[\s.-]/g, "") : "";
}

function parseBudget(raw) {
  if (!raw) return null;
  const s = raw.toString().toLowerCase();
  const compact = s.replace(/[,\s]/g, "");
  const crore = compact.match(/(\d+(\.\d+)?)\s*(crore|cr)\b/i);
  const lakh = compact.match(/(\d+(\.\d+)?)\s*(lakh|lac)\b/i);
  const k = compact.match(/(\d+(\.\d+)?)k\b/i);
  if (crore) return Math.round(parseFloat(crore[1]) * 10000000);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  const nums = compact.match(/[\d.]+/g);
  if (!nums) return null;
  return Math.round(parseFloat(nums.join("")));
}

function detectLanguageByScript(text = "") {
  if (!text) return "en";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (/[஀-௿]/.test(text)) return "ta";
  return "en";
}

function mapToIntentCategory(intentName, userText = "") {
  if (intentName && typeof intentName === "string") {
    const k = intentName.toString().trim().toLowerCase();
    if (["buy_house", "browse_housing", "post_listing", "sell_house"].includes(k)) return k;
  }
  // last fallback: simple keyword fallback
  const fb = fallbackDetectIntent(userText);
  return fb === "housing" ? "buy_house" : "unknown";
}

async function classify(message) {
  if (!message || !message.trim()) {
    return { intent: "unknown", category: "unknown", entities: {}, missing: [], language: "en" };
  }

  const prompt = `
You are an assistant that extracts intent and structured entities from a user's short message for a marketplace.
User message may be in ANY language. Do NOT translate the message.
TASK:
1. Detect the user's intent. Allowed outputs: buy_house, sell_house, post_listing, browse_housing, unknown.
2. Extract entities if present. Output keys:
   property_type, city, locality, budget, bhk, contact, name, details
3. Suggest OPTIONAL fields that might refine the search; return them in array "missing".
4. Detect the user's language as a two-letter code in "language".
5. Return STRICT JSON only.
User message: """${message.replace(/`/g, "'")}"""
`.trim();

  // Try LLM classification but gracefully fallback
  try {
    let raw;
    try {
      raw = await askAI(prompt, { temperature: 0.0, max_tokens: 500 });
    } catch (e) {
      // LLM call failed — fallback to heuristic
      const fb = fallbackDetectIntent(message) || "unknown";
      return {
        intent: "fallback",
        category: fb === "housing" ? "buy_house" : "unknown",
        entities: { raw_text: message, contact: extractPhone(message) },
        missing: [],
        language: detectLanguageByScript(message)
      };
    }

    const cleaned = raw.replace(/```json|```/gi, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      // LLM returned non-JSON — fallback to heuristics
      const fb = fallbackDetectIntent(message) || "unknown";
      return {
        intent: "fallback",
        category: fb === "housing" ? "buy_house" : "unknown",
        entities: { raw_text: message, contact: extractPhone(message) },
        missing: [],
        language: detectLanguageByScript(message)
      };
    }

    const rawEntities = parsed.entities || {};
    const entities = {
      property_type: rawEntities.property_type || rawEntities.type || "",
      city: rawEntities.city || rawEntities.location || "",
      locality: rawEntities.locality || "",
      budget: rawEntities.budget || "",
      bhk: rawEntities.bhk || "",
      contact: rawEntities.contact || extractPhone(message) || rawEntities.contact || "",
      name: rawEntities.name || "",
      details: rawEntities.details || "",
      raw_text: message
    };

    const budgetNum = parseBudget(entities.budget);
    if (budgetNum) entities.budget = budgetNum;

    const intentRaw = (parsed.intent || "unknown").toString();
    const category = mapToIntentCategory(intentRaw, message);
    const missing = Array.isArray(parsed.missing) ? parsed.missing : [];
    const language = parsed.language || detectLanguageByScript(message);

    return { intent: intentRaw, category, entities, missing, language };
  } catch (err) {
    console.error("classify error:", err?.message || err);
    const fb = fallbackDetectIntent(message) || "unknown";
    return {
      intent: "error",
      category: fb === "housing" ? "buy_house" : "unknown",
      entities: { raw_text: message, contact: extractPhone(message) },
      missing: [],
      language: detectLanguageByScript(message)
    };
  }
}

function scoreListing(listing = {}, entities = {}) {
  let score = 0;
  const low = (s) => normalizeText(s || "");
  const qCity = low(entities.city);
  const qLocality = low(entities.locality);
  const qType = low(entities.property_type);
  const qBhk = normalizeText(entities.bhk || "");
  const qDetails = low(entities.details || "");

  const lCity = low(listing.city || listing.location || listing.locality || "");
  const lType = low(listing.property_type || listing.type || listing.category || "");
  const lDesc = low(listing.description || listing.details || "");
  const lPrice = listing.price ? parseInt((listing.price || "").toString().replace(/\D/g, "")) || 0 : 0;

  if (qCity && lCity.includes(qCity)) score += 40;
  else if (qCity && qCity.split(" ").some(tok => lCity.includes(tok))) score += 15;

  if (qLocality && lCity.includes(qLocality)) score += 30;
  else if (qLocality && lDesc.includes(qLocality)) score += 10;

  if (qType && lType.includes(qType)) score += 30;
  else if (qType && lDesc.includes(qType)) score += 8;

  if (qBhk && (lDesc.includes(qBhk) || (listing.bhk && normalizeText(listing.bhk).includes(qBhk)))) score += 20;

  if (qDetails) {
    const tokens = qDetails.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (lDesc.includes(t) || lType.includes(t)) score += 2;
    }
  }

  if (entities.budget && typeof entities.budget === "number" && lPrice) {
    if (lPrice <= entities.budget) score += 25;
    else {
      const ratio = lPrice / entities.budget;
      if (ratio <= 1.2) score += 5;
    }
  }

  if ((listing.contact || "").toString().trim()) score += 5;
  return score;
}

function searchListings(listings = [], entities = {}, opts = {}) {
  const maxResults = opts.maxResults || 10;
  const scored = listings.map(item => {
    const s = scoreListing(item, entities);
    return { score: s, item };
  });

  const hasFilter = !!(entities.city || entities.locality || entities.property_type || entities.bhk || entities.budget);
  const threshold = typeof opts.scoreThreshold === "number" ? opts.scoreThreshold : (hasFilter ? 1 : 0);

  const filtered = scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(maxResults, 50));

  return filtered.map(f => ({ ...f.item, _score: f.score }));
}

async function generateFollowUpQuestion({ missing = [], entities = {}, language = "en" } = {}) {
  if (!Array.isArray(missing) || missing.length === 0) return "";
  const prompt = `
You are a concise, polite WhatsApp assistant that asks ONE short follow-up question.
User language hint: ${language}
User partial query (extracted): ${JSON.stringify(entities)}
Missing refinements: ${JSON.stringify(missing)}
Write ONE short natural question (in user's language) that invites optional clarification — do NOT demand or make it sound mandatory.
Return only the question (single line).
  `.trim();
  try {
    const res = await askAI(prompt, { temperature: 0.2, max_tokens: 80 });
    return res ? res.toString().trim().split("\n")[0] : "";
  } catch (err) {
    console.warn("generateFollowUpQuestion fallback:", err?.message || err);
    // fallback simple question
    if (missing.includes("city")) return "Which city or area are you looking in?";
    if (missing.includes("budget")) return "Do you have a budget range in mind?";
    return "Can you share more details?";
  }
}

async function generatePropertyReply({ entities = {}, listings = [], language = "en", maxResults = 5 } = {}) {
  const small = listings.slice(0, maxResults).map(l => ({
    title: l.property_type || l.type || "Property",
    location: l.location || l.city || l.locality || "",
    price: l.price || l.price_inr || "",
    contact: l.contact || "",
    desc: l.description || l.details || ""
  }));
  const prompt = `
You are a helpful real-estate assistant composing a WhatsApp response in the user's language (${language}).
User query (extracted): ${JSON.stringify(entities)}
Listings to summarize (JSON): ${JSON.stringify(small, null, 2)}
Task:
- Write a concise conversational reply in the user's language.
- Confirm what the user asked for.
- Summarize the given listings (numbered) with title/location/price/contact.
- Offer a short next step at the end.
- IMPORTANT: Do NOT invent or change listing data.
Return only the message text.
  `.trim();
  try {
    const out = await askAI(prompt, { temperature: 0.2, max_tokens: 700 });
    return out ? out.toString().trim() : "";
  } catch (err) {
    console.warn("generatePropertyReply fallback:", err?.message || err);
    // fallback to simple summary
    return small.map((s, i) => `${i+1}. ${s.title} in ${s.location}\nPrice: ${s.price}\nContact: ${s.contact}`).join("\n\n");
  }
}

module.exports = {
  askAI,
  classify,
  searchListings,
  generateFollowUpQuestion,
  generatePropertyReply,
  detectLanguageByScript,
  parseBudget,
  extractPhone,
  normalizeText
};
