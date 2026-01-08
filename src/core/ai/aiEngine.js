// src/ai/aiEngine.js
require("dotenv").config();
const Groq = require("groq-sdk");
const { detectIntent: fallbackDetectIntent } = require("../../../utils/messageUtils");

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
  if (/[ઁ-૿]/.test(text)) return "gu";
  if (/[ಀ-೿]/.test(text)) return "kn";
  return "en";
}

// ✅ UPDATED: Added urban help intent categories
function mapToIntentCategory(intentName, userText = "") {
  if (intentName && typeof intentName === "string") {
    const k = intentName.toString().trim().toLowerCase();
    
    // Property-related intents
    if (["buy_house", "browse_housing", "post_listing", "sell_house"].includes(k)) return k;
    
    // Urban help intents
    if (["urban_help", "service_request", "need_service", "find_service"].includes(k)) return "urban_help";
    
    // Specific service intents
    const lowerText = userText.toLowerCase();
    if (k === "unknown") {
      // Check if it's an urban help request
      const urbanHelpKeywords = [
        'electrician', 'plumber', 'maid', 'carpenter', 'cleaner', 
        'technician', 'driver', 'painter', 'naukrani', 'househelp',
        'service', 'repair', 'chahiye', 'required', 'needed'
      ];
      
      if (urbanHelpKeywords.some(keyword => lowerText.includes(keyword))) {
        return "urban_help";
      }
    }
  }
  
  // last fallback: simple keyword fallback
  const fb = fallbackDetectIntent(userText);
  if (fb === "housing") return "buy_house";
  if (fb === "service") return "urban_help";
  return "unknown";
}

// ✅ ADDED: Check if text is urban help request
function isUrbanHelpRequest(text = "") {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  
  const urbanHelpKeywords = [
    'electrician', 'plumber', 'maid', 'carpenter', 'cleaner', 
    'technician', 'driver', 'painter', 'naukrani', 'househelp',
    'service', 'repair', 'chahiye', 'required', 'needed',
    'mechanic', 'welder', 'gardener', 'security', 'cook',
    'मिस्त्री', 'प्लंबर', 'नौकरानी', 'बढ़ई', 'ड्राइवर',
    'மின்தொழிலாளி', 'குழாய்த்தொழிலாளி', 'வேலைக்காரி', 'தச்சர்', 'ஓட்டுநர்'
  ];
  
  return urbanHelpKeywords.some(keyword => lowerText.includes(keyword));
}

// ✅ ADDED: Extract urban help entities
function extractUrbanHelpEntities(text = "") {
  const entities = {
    category: null,
    location: null,
    timing: null,
    details: ""
  };
  
  const lowerText = text.toLowerCase();
  
  // Extract category
  const categories = {
    'electrician': ['electrician', 'wiring', 'electrical', 'fuse', 'light', 'switch', 'मिस्त्री', 'மின்தொழிலாளி'],
    'plumber': ['plumber', 'pipe', 'water', 'leak', 'tap', 'bathroom', 'toilet', 'प्लंबर', 'குழாய்த்தொழிலாளி'],
    'maid': ['maid', 'househelp', 'cleaning', 'cook', 'naukrani', 'housekeeping', 'नौकरानी', 'வேலைக்காரி'],
    'carpenter': ['carpenter', 'woodwork', 'furniture', 'repair', 'door', 'window', 'बढ़ई', 'தச்சர்'],
    'cleaner': ['cleaner', 'cleaning', 'deep clean', 'house cleaning', 'सफाई', 'சுத்தம்'],
    'technician': ['technician', 'ac repair', 'appliance repair', 'tv repair'],
    'driver': ['driver', 'chauffeur', 'car driver', 'permanent driver', 'ड्राइवर', 'ஓட்டுநர்'],
    'painter': ['painter', 'painting', 'wall', 'color', 'house painting', 'पेंटर', 'ஓவியர்']
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      entities.category = category;
      break;
    }
  }
  
  // Extract location
  const locations = ['noida', 'gurgaon', 'delhi', 'gurugram', 'greater noida', 'ghaziabad', 'faridabad'];
  for (const location of locations) {
    if (lowerText.includes(location)) {
      entities.location = location.charAt(0).toUpperCase() + location.slice(1);
      break;
    }
  }
  
  // Extract timing
  if (lowerText.includes('now') || lowerText.includes('immediate') || lowerText.includes('urgent')) {
    entities.timing = 'immediate';
  } else if (lowerText.includes('tomorrow') || lowerText.includes('next week')) {
    entities.timing = 'future';
  }
  
  // Extract details (remaining text)
  entities.details = text.trim();
  
  return entities;
}

async function classify(message) {
  if (!message || !message.trim()) {
    return { 
      intent: "unknown", 
      category: "unknown", 
      entities: {}, 
      missing: [], 
      language: "en" 
    };
  }

  // ✅ UPDATED: Check if it's an urban help request first
  const isUrbanHelp = isUrbanHelpRequest(message);
  
  // Use simpler classification for urban help to avoid LLM costs
  if (isUrbanHelp) {
    const urbanEntities = extractUrbanHelpEntities(message);
    return {
      intent: "urban_help_request",
      category: "urban_help",
      entities: {
        ...urbanEntities,
        raw_text: message,
        contact: extractPhone(message)
      },
      missing: !urbanEntities.category ? ['category'] : (!urbanEntities.location ? ['location'] : []),
      language: detectLanguageByScript(message),
      confidence: 0.8
    };
  }

  const prompt = `
You are an assistant that extracts intent and structured entities from a user's short message for a marketplace.
User message may be in ANY language. Do NOT translate the message.
TASK:
1. Detect the user's intent. Allowed outputs: 
   - Property intents: buy_house, sell_house, post_listing, browse_housing
   - Urban help intents: urban_help, service_request
   - Other: unknown
2. Extract entities if present. Output keys:
   - For property: property_type, city, locality, budget, bhk, contact, name, details
   - For urban help: service_category, service_location, service_timing, contact, details
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
      const category = fb === "housing" ? "buy_house" : "unknown";
      
      return {
        intent: "fallback",
        category: category,
        entities: { 
          raw_text: message, 
          contact: extractPhone(message) 
        },
        missing: [],
        language: detectLanguageByScript(message),
        confidence: 0.5
      };
    }

    const cleaned = raw.replace(/```json|```/gi, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      // LLM returned non-JSON — fallback to heuristics
      const fb = fallbackDetectIntent(message) || "unknown";
      const category = fb === "housing" ? "buy_house" : "unknown";
      
      return {
        intent: "fallback",
        category: category,
        entities: { 
          raw_text: message, 
          contact: extractPhone(message) 
        },
        missing: [],
        language: detectLanguageByScript(message),
        confidence: 0.5
      };
    }

    const rawEntities = parsed.entities || {};
    const intentRaw = (parsed.intent || "unknown").toString();
    
    // ✅ UPDATED: Handle different entity structures based on intent
    let entities = {};
    
    if (intentRaw.includes('urban_help') || intentRaw.includes('service')) {
      // Urban help entities
      entities = {
        category: rawEntities.service_category || rawEntities.category || "",
        location: rawEntities.service_location || rawEntities.location || "",
        timing: rawEntities.service_timing || "",
        contact: rawEntities.contact || extractPhone(message) || "",
        details: rawEntities.details || "",
        raw_text: message
      };
    } else {
      // Property entities
      entities = {
        property_type: rawEntities.property_type || rawEntities.type || "",
        city: rawEntities.city || rawEntities.location || "",
        locality: rawEntities.locality || "",
        budget: rawEntities.budget || "",
        bhk: rawEntities.bhk || "",
        contact: rawEntities.contact || extractPhone(message) || "",
        name: rawEntities.name || "",
        details: rawEntities.details || "",
        raw_text: message
      };
    }

    const budgetNum = parseBudget(entities.budget);
    if (budgetNum) entities.budget = budgetNum;

    const category = mapToIntentCategory(intentRaw, message);
    const missing = Array.isArray(parsed.missing) ? parsed.missing : [];
    const language = parsed.language || detectLanguageByScript(message);

    return { 
      intent: intentRaw, 
      category, 
      entities, 
      missing, 
      language,
      confidence: 0.9
    };
  } catch (err) {
    console.error("classify error:", err?.message || err);
    const fb = fallbackDetectIntent(message) || "unknown";
    const category = fb === "housing" ? "buy_house" : "unknown";
    
    return {
      intent: "error",
      category: category,
      entities: { 
        raw_text: message, 
        contact: extractPhone(message) 
      },
      missing: [],
      language: detectLanguageByScript(message),
      confidence: 0.3
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

// -----------------------------
// Lightweight Intent Helpers
// -----------------------------

/**
 * Heuristic intent context detector used by flows that don't need full LLM classify.
 * Returns: 'offer' (user offering), 'find' (user looking for), or null
 */
function detectIntentContext(text = "") {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  // Job-seeking high priority
  if (/looking for.*job|need.*job|searching for.*job|job search|seeking.*job|want.*job|employment|naukri/i.test(lower)) {
    return 'find';
  }

  // Offer patterns
  if (/\b(i('?m| am) (a |an )?)\b|\bi have\b|\bi provide\b|\bi offer\b|\bavailable\b|\bhiring\b|\bfor hire\b|\bwe are hiring\b|\bcontact me\b/i.test(lower)) {
    return 'offer';
  }

  // generic 'looking for' without job-specific keywords
  if (/looking for|searching for|need (a |an )?|want (a |an )?|i am looking for|i'm looking for|help me find/i.test(lower)) {
    // If it mentions job keywords, classify as find (above). Otherwise classify as 'find' as well.
    return 'find';
  }

  return null;
}

/**
 * Quick heuristic to decide if the user is offering services.
 * Returns boolean.
 */
function isUserOfferingServices(text = "") {
  if (!text) return false;
  const lower = text.toLowerCase();
  return /\b(i('?m| am) (a |an )?)\b|\bi provide\b|\bi offer\b|\bavailable\b|\bhiring\b|\bfor sale\b|\bfor rent\b|\bi sell\b/i.test(lower);
}


async function generateFollowUpQuestion({ missing = [], entities = {}, language = "en" } = {}) {
  if (!Array.isArray(missing) || missing.length === 0) return "";
  
  // ✅ UPDATED: Different questions for urban help vs property
  const isUrbanHelp = entities.category || entities.service_category;
  
  const prompt = `
You are a concise, polite WhatsApp assistant that asks ONE short follow-up question.
User language hint: ${language}
User partial query (extracted): ${JSON.stringify(entities)}
Missing refinements: ${JSON.stringify(missing)}
${isUrbanHelp ? 'This is about urban help services.' : 'This is about property listing.'}
Write ONE short natural question (in user's language) that invites optional clarification — do NOT demand or make it sound mandatory.
Return only the question (single line).
  `.trim();
  
  try {
    const res = await askAI(prompt, { temperature: 0.2, max_tokens: 80 });
    return res ? res.toString().trim().split("\n")[0] : "";
  } catch (err) {
    console.warn("generateFollowUpQuestion fallback:", err?.message || err);
    // fallback simple question
    if (isUrbanHelp) {
      if (missing.includes("category") || missing.includes("service_category")) {
        return "What type of service do you need?";
      }
      if (missing.includes("location") || missing.includes("service_location")) {
        return "Where do you need the service?";
      }
    } else {
      if (missing.includes("city")) return "Which city or area are you looking in?";
      if (missing.includes("budget")) return "Do you have a budget range in mind?";
    }
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

// ✅ ADDED: Generate urban help reply
async function generateUrbanHelpReply({ entities = {}, providers = [], language = "en", maxResults = 5 } = {}) {
  const small = providers.slice(0, maxResults).map(p => ({
    name: p.name || p.service_type || "Service Provider",
    service: p.category || p.service || "",
    location: p.location || p.area || "",
    rating: p.rating || "",
    experience: p.experience || "",
    contact: p.contact || "",
    availability: p.availability || ""
  }));
  
  const prompt = `
You are a helpful urban help services assistant composing a WhatsApp response in the user's language (${language}).
User query (extracted): ${JSON.stringify(entities)}
Service providers found (JSON): ${JSON.stringify(small, null, 2)}
Task:
- Write a concise conversational reply in the user's language.
- Confirm the service type and location requested.
- Summarize the available service providers (numbered) with name/service/rating/contact.
- Be polite and helpful.
- IMPORTANT: Do NOT invent or change provider data.
Return only the message text.
  `.trim();
  
  try {
    const out = await askAI(prompt, { temperature: 0.2, max_tokens: 500 });
    return out ? out.toString().trim() : "";
  } catch (err) {
    console.warn("generateUrbanHelpReply fallback:", err?.message || err);
    // fallback to simple summary
    return small.map((s, i) => 
      `${i+1}. ${s.name} (${s.service})\nLocation: ${s.location}\nRating: ${s.rating || "N/A"}\nContact: ${s.contact || "Contact not available"}`
    ).join("\n\n");
  }
}

module.exports = {
  askAI,
  classify,
  searchListings,
  generateFollowUpQuestion,
  generatePropertyReply,
  generateUrbanHelpReply, // ✅ NEW: Urban help reply generator
  detectLanguageByScript,
  parseBudget,
  extractPhone,
  normalizeText,
  isUrbanHelpRequest, // ✅ NEW: Helper function
  extractUrbanHelpEntities, // ✅ NEW: Urban help entity extractor
  // Export lightweight helpers for flows that require quick intent checks
  detectIntentContext,
  isUserOfferingServices
};