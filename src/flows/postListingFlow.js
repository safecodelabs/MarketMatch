// File: /core/flows/whatsappFlows/postListingFlow.js
const axios = require("axios");
const PostingService = require("../services/posting-service");

async function sendListingFlow(to) {
  return axios.post(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "flow",
        header: {
          type: "text",
          text: "📝 Create a New Listing"
        },
        body: {
          text: "Fill out this form to post your property or service. Tap 'Start' to begin."
        },
        footer: {
          text: "You can also type directly in the chat!"
        },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: process.env.FLOW_TOKEN || "flow_token_placeholder",
            flow_id: process.env.WHATSAPP_FLOW_ID,
            flow_cta: "Start Form",
            flow_action: "navigate",
            flow_action_payload: {
              screen: "CATEGORY_SELECTION",
              data: {}
            }
          }
        }
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// New function to handle flow completion
async function handleFlowCompletion(sender, flowData, client) {
  try {
    console.log("📝 [FLOW] Processing completed flow data:", flowData);
    
    const postingService = new PostingService(sender);
    
    // Extract data from flow
    const category = flowData.category || 'housing';
    const intent = flowData.intent || 'offer';
    
    // Create draft from flow data
    const draft = await postingService.draftManager.createDraft(sender, category, intent);
    
    // Update draft with flow data
    if (flowData.fields) {
      for (const [field, value] of Object.entries(flowData.fields)) {
        if (value) {
          await postingService.draftManager.updateDraftField(draft.id, field, value);
        }
      }
    }
    
    // Get next question
    const nextQuestion = await postingService.getNextQuestion(draft.id);
    
    // Update session
    const SessionManager = require("../../../database/session-manager");
    const sessionManager = new SessionManager(sender);
    await sessionManager.updateSession({
      mode: 'posting',
      category: category,
      draftId: draft.id,
      expectedField: null
    });
    
    // Send first question
    await client.sendMessage(sender, nextQuestion);
    
    return { success: true };
    
  } catch (error) {
    console.error("❌ [FLOW] Error processing completion:", error);
    return { success: false, error: error.message };
  }
}

// Alternative text-based posting
async function handleTextPosting(sender, message, client) {
  try {
    const postingService = new PostingService(sender);
    const result = await postingService.processMessage(message);
    
    if (result.type === 'question' || result.type === 'confirmation') {
      await client.sendMessage(sender, result.response);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("❌ [TEXT POSTING] Error:", error);
    return false;
  }
}

module.exports = { 
  sendListingFlow, 
  handleFlowCompletion,
  handleTextPosting 
};