// src/ai/aiEngine.js
/**
 * AI Engine — intent + entity extraction & listing search
 * - Lightweight Groq wrapper (askAI)
 * - classify(message) -> { intent, category, entities, missing, language }
 * - searchListings(listings, entities, opts) -> filtered listings + scores
 * - generateFollowUpQuestion(missing, ctx) -> single LLM question (user language)
 * - generatePropertyReply(entities, listings, ctx) -> conversational reply (user language)
 *
 * This file assumes:
 * - src/intents.js exists and exports intent definitions (keywords + requiredInfo)
 * - src/utils/messageUtils.js provides fallbackDetectIntent()
 */

require("dotenv").config();
const Groq = require("groq-sdk");
const intents = require("../../intents");
const { detectIntent: fallbackDetectIntent } = require("../../utils/messageUtils");

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ------------------ Low-level LLM ------------------
async function askAI(prompt, opts = {}) {
  try {
    const res = await client.chat.completions.create({
      model: opts.model || "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2,
      max_tokens: opts.max_tokens || 800
    });
    return res.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("AI call failed:", err?.message || err);
    throw err;
  }
}

// ------------------ Utilities ------------------
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
  if (/[ಀ-೿]/.test(text)) return "kn";
  if (/[஀-௿]/.test(text)) return "ta";
  if (/[ء-ي]/.test(text)) return "ar";
  if (/[À-ÖØ-öø-ÿ]/.test(text)) return "fr";
  return "en";
}

function mapToIntentCategory(intentName, userText = "") {
  if (intentName && typeof intentName === "string") {
    const k = intentName.toString().trim().toLowerCase();
    if (["buy_house", "browse_housing", "post_listing", "sell_house"].includes(k)) return k;
  }

  const text = (userText || "").toString().toLowerCase();
  for (const key of Object.keys(intents)) {
    const def = intents[key];
    if (!def?.keywords) continue;
    for (const kw of def.keywords) {
      if (!kw) continue;
      if (text.includes(kw.toString().toLowerCase())) {
        if (key === "housing" || key === "browse") return "buy_house";
        if (key === "sellProperty" || key === "sell") return "sell_house";
        if (key === "budget" || key === "location") return "buy_house";
        return "buy_house";
      }
    }
  }

  const fb = fallbackDetectIntent(userText);
  return fb === "housing" ? "buy_house" : "unknown";
}

// ------------------ Classification ------------------
async function classify(message) {
  if (!message?.trim()) {
    return { intent: "unknown", category: "unknown", entities: {}, missing: [], language: "en" };
  }

  const prompt = `
You are an assistant extracting intent and entities for a marketplace.
Allowed intents: buy_house, sell_house, post_listing, browse_housing, unknown
Extract entities: property_type, city, locality, budget, bhk, contact, name, details
Suggest optional missing fields in "missing" array.
Detect language as two-letter code in "language".
Return STRICT JSON only.
User message: """${message.replace(/`/g, "'")}"""
  `.trim();

  try {
    const raw = await askAI(prompt, { temperature: 0.0, max_tokens: 500 });
    const cleaned = raw.replace(/```json|```/gi, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const fb = fallbackDetectIntent(message) || "unknown";
      return {
        intent: "fallback",
        category: fb === "housing" ? "buy_house" : "unknown",
        entities: { raw_text: message },
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
      contact: rawEntities.contact || extractPhone(message),
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
      entities: { raw_text: message },
      missing: [],
      language: detectLanguageByScript(message)
    };
  }
}

// ------------------ Listing Search ------------------
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
    else if (lPrice / entities.budget <= 1.2) score += 5;
  }

  if ((listing.contact || "").toString().trim()) score += 5;
  return score;
}

function searchListings(listings = [], entities = {}, opts = {}) {
  const maxResults = opts.maxResults || 10;
  const scored = listings.map(item => ({ score: scoreListing(item, entities), item }));
  const hasFilter = !!(entities.city || entities.locality || entities.property_type || entities.bhk || entities.budget);
  const threshold = typeof opts.scoreThreshold === "number" ? opts.scoreThreshold : (hasFilter ? 1 : 0);

  return scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(maxResults, 50))
    .map(f => ({ ...f.item, _score: f.score }));
}

// ------------------ Follow-up & Reply ------------------
async function generateFollowUpQuestion({ missing = [], entities = {}, language = "en" } = {}) {
  if (!Array.isArray(missing) || missing.length === 0) return "";
  const prompt = `
You are a polite WhatsApp assistant asking ONE short follow-up question.
User language: ${language}
Partial query: ${JSON.stringify(entities)}
Missing refinements: ${JSON.stringify(missing)}
Write ONE short natural question (optional, non-mandatory).
Return only the question (single line).
  `.trim();
  const res = await askAI(prompt, { temperature: 0.2, max_tokens: 80 });
  return res?.toString().trim().split("\n")[0] || "";
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
You are a helpful real-estate assistant composing a WhatsApp reply (${language}).
User query: ${JSON.stringify(entities)}
Listings (JSON): ${JSON.stringify(small, null, 2)}
Task: write concise, friendly summary of listings.
Do NOT invent data. Return only the message.
  `.trim();
  const out = await askAI(prompt, { temperature: 0.2, max_tokens: 700 });
  return out?.toString().trim() || "";
}

// ------------------ Exports ------------------
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
