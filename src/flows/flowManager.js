// src/flows/flowManager.js
const messageParser = require("../templates/messageParser");
const housingFlow = require("./housingFlow");
const commandRouter = require("../bots/commandRouter");

/**
 * processMessage(text, session, userId)
 * Returns { reply, nextSession }
 */
async function processMessage(text, session = {}, userId) {
  try {
    // 0. commands (explicit)
    const cmd = commandRouter.parseCommand(text);
    if (cmd) {
      const { reply, nextSession } = await commandRouter.handle(cmd, session, userId);
      return { reply, nextSession };
    }

    // 1. AI parse
    const { intent, entities } = await messageParser.parseMessage(text);

    console.log("flowManager -> intent:", intent, "entities:", entities);

    // 2. Route
    switch (intent) {
      case "buy_house":
      case "browse_housing":
        return await housingFlow.startOrContinue("buy", text, session, entities, userId);

      case "sell_house":
        return await housingFlow.startOrContinue("sell", text, session, entities, userId);

      case "post_listing":
        return await housingFlow.startOrContinue("post", text, session, entities, userId);

      default:
        // unknown: provide help / menu
        return {
          reply: {
            type: "text",
            text: { body: "I can help you with housing — say things like:\n• \"1BHK in Noida under 15k\"\n• \"Post: 2BHK, Pune, 25k, 98765xxxx\"\n• \"Show me flats in Gurgaon\"" }
          },
          nextSession: { ...session, step: "start" }
        };
    }
  } catch (err) {
    console.error("flowManager error:", err?.message || err);
    return {
      reply: { type: "text", text: { body: "Sorry, something went wrong. Please try again." } },
      nextSession: session
    };
  }
}

module.exports = { processMessage };
