// src/flows/sell.flow.js
/**
 * handleSell(text, session)
 * This flow requests listing details from seller, and guides them to use the Post format
 */
function handleSell(text, session) {
  // If seller already included listing-like info (detect a "post:" pattern), redirect to post handler
  if (/^post[:\s]/i.test(text) || text.toLowerCase().includes("post:")) {
    return {
      reply: { type: "text", text: { body: "Thanks — I see a Post command. Please send in this format:\nPost: <Property Type>, <Location>, <Price>, <Contact>\nExample: Post: 2BHK, Noida, 15000, 9876543210" } },
      nextSession: { ...session, step: "await_post" }
    };
  }

  // Otherwise ask user for the expected format
  return {
    reply: { type: "text", text: { body: "To post your property, please share details in this format:\nPost: <Property Type>, <Location>, <Price>, <Contact>\nExample: Post: 2BHK, Andheri, 25000, 9876543210" } },
    nextSession: { ...session, step: "await_post" }
  };
}

module.exports = { handleSell };
