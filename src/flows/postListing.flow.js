// src/flows/postListing.flow.js
const { addHousingLead } = require("../../utils/sheets");

/**
 * handlePost(text, session)
 * Expects text like:
 * "Post: 2BHK, Noida sector 62, 15000, 9876543210, Owner name, description..."
 */
async function handlePost(text, session) {
  // try to parse post
  const body = text.replace(/^post[:\s]*/i, "").trim();
  const parts = body.split(",").map(s => s.trim()).filter(Boolean);

  if (parts.length < 4) {
    return {
      reply: { type: "text", text: { body: "Format not recognized. Please send:\nPost: <Type>, <Location>, <Price>, <Contact>\nExample: Post: 1BHK, Noida, 15000, 9876543210" } },
      nextSession: { ...session, step: "await_post" }
    };
  }

  // Map parts to fields (flexible)
  const property_type = parts[0];
  const location = parts[1];
  const price = parts[2];
  const contact = parts[3];
  const name = parts[4] || "";
  const description = parts.slice(5).join(", ") || "";

  // Build lead object (id can be timestamp)
  const lead = {
    id: `lead_${Date.now()}`,
    name: name || "Owner",
    location,
    property_type,
    price,
    contact,
    description
  };

  try {
    await addHousingLead(lead);
    return {
      reply: { type: "text", text: { body: "✅ Your listing has been posted successfully. Thank you!" } },
      nextSession: { ...session, step: "done" }
    };
  } catch (err) {
    console.error("Failed to save listing:", err?.message || err);
    return {
      reply: { type: "text", text: { body: "❌ Couldn't save your listing. Please try again later." } },
      nextSession: { ...session, step: "error" }
    };
  }
}

module.exports = { handlePost };
