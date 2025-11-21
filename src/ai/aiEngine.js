// src/ai/aiEngine.js
require("dotenv").config();
const Groq = require("groq-sdk");
const { detectIntent } = require("../../utils/messageUtils"); // fallback simple intent detector

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// low-level wrapper to call Groq
async function askAI(prompt) {
  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.error("AI call failed:", err?.message || err);
    throw err;
  }
}

/**
 * classify(msg)
 * Returns standardized intent + entities:
 * { intent: "buy_house"|"sell_house"|"post_listing"|"browse_housing"|"unknown", entities: {...} }
 */
async function classify(message) {
  // guard
  if (!message || !message.trim()) {
    return { intent: "unknown", entities: {} };
  }

  // prompt — request JSON only
  const prompt = `
You are an assistant that extracts intent and entities from a short user message for a housing marketplace chatbot.
Accept message (may be in English or a local language) and return ONLY valid JSON with keys:
{
  "intent": "<buy_house|sell_house|post_listing|browse_housing|unknown>",
  "entities": {
    "property_type": "",   // e.g. 1BHK / 2BHK / room / studio / house / apartment
    "location": "",        // city or locality
    "budget": "",          // numeric or text (e.g., "15000" or "15k")
    "contact": "",         // phone number if present
    "name": "",            // seller name if present
    "details": ""          // free-form extra details
  }
}
Message: """${message.replace(/`/g, "'")}"""
  `.trim();

  try {
    const raw = await askAI(prompt);

    // attempt to parse raw as JSON (strip markdown code fences if present)
    const cleaned = raw.replace(/```json|```/gi, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      // normalize intent names to our internal set
      let intent = (parsed.intent || "").toString().toLowerCase();
      if (intent.includes("buy") || intent.includes("rent")) intent = "buy_house";
      else if (intent.includes("sell") || intent.includes("post")) intent = intent.includes("post") ? "post_listing" : "sell_house";
      else if (intent.includes("browse") || intent.includes("view") || intent.includes("list")) intent = "browse_housing";
      else intent = intent === "unknown" ? "unknown" : intent;

      return { intent, entities: parsed.entities || {} };
    } catch (jsonErr) {
      console.warn("AI returned non-JSON or parse failed, falling back:", jsonErr?.message || jsonErr);
      // fallback: use simple keyword detector from messageUtils
      const fallback = detectIntent(message) || "unknown";
      // map fallback to our intent names
      let mapped = "unknown";
      if (fallback === "housing") mapped = "browse_housing";
      return { intent: mapped, entities: {} };
    }
  } catch (err) {
    console.error("AI classify error:", err?.message || err);
    // on any error, fallback to keyword detection
    const fallback = detectIntent(message) || "unknown";
    let mapped = "unknown";
    if (fallback === "housing") mapped = "browse_housing";
    return { intent: mapped, entities: {} };
  }
}

module.exports = { askAI, classify };
