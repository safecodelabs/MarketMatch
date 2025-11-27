const { startOrContinue } = require('../flows/housingFlow');
const { generateFollowUpQuestion } = require('../ai/aiEngine');
const { getString } = require('../utils/languageStrings');

/**
 * Handle explicit commands
 */
async function handle(cmd, session = {}, userId, language = "en") {
  switch (cmd) {
    case "menu":
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "menu") }
        },
        nextSession: { ...session, step: "start" }
      };

    case "restart":
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "restart") }
        },
        nextSession: {
          ...session,
          step: "start",
          housingFlow: { step: "start", data: {} }
        }
      };

    case "listings":
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "listings") }
        },
        nextSession: { ...session, step: "start" }
      };

    case "post_command": {
      const postSession = await startOrContinue("post", "", session.housingFlow || {}, {}, userId);
      const question = await generateFollowUpQuestion({
        missing: postSession.missing || [],
        entities: postSession.data || {},
        language
      });

      return {
        reply: {
          type: "text",
          text: { body: question || getString(language, "postPrompt") }
        },
        nextSession: { ...session, housingFlow: postSession }
      };
    }

    case "buy": {
      const buySession = await startOrContinue("buy", "", session.housingFlow || {}, {}, userId);
      const buyQuestion = await generateFollowUpQuestion({
        missing: buySession.missing || [],
        entities: buySession.data || {},
        language
      });

      return {
        reply: {
          type: "text",
          text: { body: buyQuestion || getString(language, "buyPrompt") }
        },
        nextSession: { ...session, housingFlow: buySession }
      };
    }

    case "sell": {
      const sellSession = await startOrContinue("sell", "", session.housingFlow || {}, {}, userId);
      const sellQuestion = await generateFollowUpQuestion({
        missing: sellSession.missing || [],
        entities: sellSession.data || {},
        language
      });

      return {
        reply: {
          type: "text",
          text: { body: sellQuestion || getString(language, "sellPrompt") }
        },
        nextSession: { ...session, housingFlow: sellSession }
      };
    }

    default:
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "unknownCommand") }
        },
        nextSession: session
      };
  }
}

/**
 * Map text to command
 */
function parseCommand(text) {
  if (!text || !text.trim()) return null;
  const t = text.trim().toLowerCase();

  if (t === "menu") return "menu";
  if (t === "restart") return "restart";
  if (t === "listings" || t === "show listings") return "listings";
  if (/^post[:\s]/i.test(t)) return "post_command";
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";

  return null;
}

module.exports = { parseCommand, handle };
