// src/ai/aiEngine.js
/**
 * AI Engine — AI-first intent + entity extraction & listing search
 * - Lightweight Groq wrapper (askAI)
 * - classify(message) -> { intent, category, entities, missing, language }
 * - searchListings(listings, entities, opts) -> filtered listings + scores
 * - generateFollowUpQuestion(missing, ctx) -> single LLM question (user language)
 * - generatePropertyReply(entities, listings, ctx) -> conversational reply (user language)
 *
 * This file assumes:
 * - src/intents.js exists and exports intent definitions (keywords + requiredInfo)
 * - src/utils/sheets.js provides getHousingData() (listings are objects)
 *
 * Drop this file at src/ai/aiEngine.js
 */

require("dotenv").config();
const Groq = require("groq-sdk");
const intents = require("../../intentsintents");
const { detectIntent: fallbackDetectIntent } = require("../utils/messageUtils");

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ----- Low-level LLM call -----
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

// ----- Utilities -----
function detectLanguageByScript(text = "") {
  if (!text) return "en";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (/[ಀ-೿]/.test(text)) return "kn";
  if (/[஀-௿]/.test(text)) return "ta";
  if (/[ء-ي]/.test(text)) return "ar";
  if (/[À-ÖØ-öø-ÿ]/.test(text)) return "fr";
  return "en";
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

// Use your intents.js keywords to map raw LLM intent or fallback text to an intent category
function mapToIntentCategory(intentName, userText = "") {
  // prefer explicit LLM-provided normalized intent
  if (intentName && typeof intentName === "string") {
    const k = intentName.toString().trim().toLowerCase();
    // common normalized names we expect
    if (["buy_house", "browse_housing", "post_listing", "sell_house"].includes(k)) {
      return k;
    }
  }

  // fallback: try to detect intent from keyword lists in src/intents.js
  const text = (userText || "").toString().toLowerCase();
  for (const key of Object.keys(intents)) {
    const def = intents[key];
    if (!def || !def.keywords) continue;
    for (const kw of def.keywords) {
      if (!kw) continue;
      if (text.includes(kw.toString().toLowerCase())) {
        // map file-level keys to our engine intent names
        if (key === "housing" || key === "browse") return "buy_house";
        if (key === "sellProperty" || key === "sell") return "sell_house";
        if (key === "budget" || key === "location") return "buy_house";
        return "buy_house";
      }
    }
  }

  // last fallback: fallbackDetectIntent (simple keyword fallback)
  const fb = fallbackDetectIntent(userText);
  if (fb === "housing") return "buy_house";
  return "unknown";
}

// ----- classify(message) -----
// Purpose: single entrypoint to extract intent, entities, missing fields and language
// returns: { intent, category, entities, missing, language }
// - intent: raw intent label from LLM if available (or fallback)
// - category: internal normalized intent (buy_house / sell_house / post_listing / browse_housing / unknown)
// - entities: { property_type, city, locality, budget, bhk, contact, name, details, raw_text }
// - missing: array of suggested optional fields to request (but you will treat them optional)
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
3. Suggest OPTIONAL fields that might refine the search; return them in array "missing" (these are optional hints — not required).
4. Detect the user's language as a two-letter code in "language".
5. Return STRICT JSON only (no extra text).

FORMAT:
{
  "intent": "<one of allowed intents>",
  "entities": { "property_type":"", "city":"", "locality":"", "budget":"", "bhk":"", "contact":"", "name":"", "details":"" },
  "missing": [ /* e.g. ["locality", "budget"] */ ],
  "language": "en"
}

User message: """${message.replace(/`/g, "'")}"""
`.trim();

  try {
    const raw = await askAI(prompt, { temperature: 0.0, max_tokens: 500 });
    const cleaned = raw.replace(/```json|```/gi, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      // LLM didn't return strict JSON — fallback to lightweight heuristics
      console.warn("classify: LLM JSON parse failed, falling back:", err?.message || err);
      const fb = fallbackDetectIntent(message) || "unknown";
      const category = fb === "housing" ? "buy_house" : "unknown";
      return {
        intent: "fallback",
        category,
        entities: { raw_text: message },
        missing: [],
        language: detectLanguageByScript(message)
      };
    }

    // normalize and enrich
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

    // parse budget to numeric if possible
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

// ----- searchListings(listings, entities, opts) -----
// Flexible filtering that behaves like "search within a sheet" (for WhatsApp quick searches).
// - listings: array of objects (from getHousingData)
// - entities: as returned by classify()
// - opts: { scoreThreshold, maxResults, fuzzy }
// Returns: array of matched items sorted by score (higher first)
function scoreListing(listing = {}, entities = {}) {
  // scoring heuristics: each matching attribute increases score
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

  // city match (strong)
  if (qCity && lCity.includes(qCity)) score += 40;
  else if (qCity && qCity.split(" ").some(tok => lCity.includes(tok))) score += 15;

  // locality match
  if (qLocality && lCity.includes(qLocality)) score += 30;
  else if (qLocality && lDesc.includes(qLocality)) score += 10;

  // type match
  if (qType && lType.includes(qType)) score += 30;
  else if (qType && lDesc.includes(qType)) score += 8;

  // bhk match
  if (qBhk && (lDesc.includes(qBhk) || (listing.bhk && normalizeText(listing.bhk).includes(qBhk)))) score += 20;

  // details keywords
  if (qDetails) {
    const tokens = qDetails.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (lDesc.includes(t) || lType.includes(t)) score += 2;
    }
  }

  // price influence: if user provided budget, increase score for listings <= budget
  if (entities.budget && typeof entities.budget === "number" && lPrice) {
    if (lPrice <= entities.budget) score += 25;
    else {
      // small score if slightly above
      const ratio = lPrice / entities.budget;
      if (ratio <= 1.2) score += 5;
    }
  }

  // small boost for presence of contact
  if ((listing.contact || "").toString().trim()) score += 5;

  return score;
}

function searchListings(listings = [], entities = {}, opts = {}) {
  const maxResults = opts.maxResults || 10;
  const scored = listings.map(item => {
    const s = scoreListing(item, entities);
    return { score: s, item };
  });

  // filter by score threshold (default: any positive score or if user gave city/type, require > 0)
  const hasFilter = !!(entities.city || entities.locality || entities.property_type || entities.bhk || entities.budget);
  const threshold = typeof opts.scoreThreshold === "number" ? opts.scoreThreshold : (hasFilter ? 1 : 0);

  const filtered = scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(maxResults, 50));

  return filtered.map(f => ({ ...f.item, _score: f.score }));
}

// ----- generateFollowUpQuestion(missing / optional) -----
// Returns a single short question in user's language. Importantly: optional-only tone.
// Example output: "Sure — which area in Noida are you looking at?" or "Would you like results with a budget filter?"
async function generateFollowUpQuestion({ missing = [], entities = {}, language = "en" } = {}) {
  if (!Array.isArray(missing) || missing.length === 0) return "";

  const prompt = `
You are a concise, polite WhatsApp assistant that asks ONE short follow-up question.
User language hint: ${language}
User partial query (extracted): ${JSON.stringify(entities)}
Missing refinements: ${JSON.stringify(missing)}

Write ONE short natural question (in user's language) that invites optional clarification — do NOT demand or make it sound mandatory.
Examples:
- "Which area of Noida are you looking in?"
- "Do you want to limit by budget?"

Return only the question (single line).
`.trim();

  const res = await askAI(prompt, { temperature: 0.2, max_tokens: 80 });
  return res ? res.toString().trim().split("\n")[0] : "";
}

// ----- generatePropertyReply(entities, listings, language) -----
// Compose a friendly result summary in user language. The LLM must NOT invent listings.
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
- Offer a short next step at the end (e.g., "Want more? Reply 'more'").
- IMPORTANT: Do NOT invent or change listing data — use exactly the provided JSON.

Return only the message text.
`.trim();

  const out = await askAI(prompt, { temperature: 0.2, max_tokens: 700 });
  return out ? out.toString().trim() : "";
}

// ----- Exported API -----
module.exports = {
  askAI,
  classify,                    // message -> { intent, category, entities, missing, language }
  searchListings,              // (listings, entities, opts) -> filtered listing objects with _score
  generateFollowUpQuestion,    // ({missing, entities, language}) -> string
  generatePropertyReply,       // ({entities, listings, language}) -> string
  detectLanguageByScript,
  parseBudget,                 // parse budget text -> number (INR)
  extractPhone,
  normalizeText
};
