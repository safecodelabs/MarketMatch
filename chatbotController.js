// ========================================
// IMPORTS - UPDATED WITH VOICE SUPPORT
// ========================================
const commandRouter = require("./src/bots/commandRouter");
const voiceService = require("./src/services/voiceService"); // NEW: Voice service

// ✅ UPDATED: Added new session functions
const { 
  getSession, 
  saveSession, 
  clearFlowData,
  clearSavedListingsFlow,
  initSavedListingsFlow,
  updateSavedListingsSession,
  isInSavedListingsFlow 
} = require("./utils/sessionStore");

// ✅ UPDATED: Added Saved Listings functions
const { 
  getUserProfile, 
  saveUserLanguage,
  getTopListings,
  getUserListings,
  getListingById,
  deleteListing,
  updateListing,
  saveListingToUser,
  removeSavedListing,
  getUserSavedListings,
  isListingSaved,
  searchListingsByCriteria // NEW: For voice search results
} = require("./database/firestore");

// ✅ UPDATED: Added sendSavedListingCard
const { 
    sendMessage, 
    sendList, 
    sendReplyButtons, 
    sendListingCard,
    sendSavedListingCard,
    sendInteractiveButtons // NEW: For voice confirmation
} = require("./src/services/messageService"); 
const { db } = require("./database/firestore");

// ✅ ADDED: Environment variables for Flow
const WHATSAPP_FLOW_ID = process.env.WHATSAPP_FLOW_ID;
const FLOW_MODE = process.env.FLOW_MODE || "draft"; // "draft" for testing, "published" for production

// ========================================
// VALIDATE FLOW CONFIGURATION
// ========================================
function validateFlowConfig() {
  console.log("🔧 [CONFIG] Validating Flow configuration...");
  
  if (!WHATSAPP_FLOW_ID) {
    console.warn("⚠️ [CONFIG] WHATSAPP_FLOW_ID is not configured!");
    console.warn("⚠️ [CONFIG] Please set WHATSAPP_FLOW_ID environment variable in Railway.");
    return false;
  }
  
  if (FLOW_MODE !== "draft" && FLOW_MODE !== "published") {
    console.warn("⚠️ [CONFIG] FLOW_MODE should be 'draft' or 'published'");
    return false;
  }
  
  console.log(`✅ [CONFIG] Flow configured: ID=${WHATSAPP_FLOW_ID}, Mode=${FLOW_MODE}`);
  return true;
}

// Validate on import
validateFlowConfig();

// ========================================
// VOICE MESSAGE HANDLING FUNCTIONS
// ========================================

/**
 * Handle incoming voice messages
 * @param {String} sender - User phone number
 * @param {Object} metadata - Message metadata with voice info
 * @param {Object} client - WhatsApp client
 * @returns {Promise<Object>} Updated session
 */
async function handleVoiceMessage(sender, metadata, client) {
  try {
    console.log("🎤 [VOICE] Processing voice message from:", sender);
    
    // Check if it's a voice message
    if (!voiceService.isVoiceMessage(metadata)) {
      console.log("🎤 [VOICE] Not a voice message");
      return null;
    }
    
    // Get session
    let session = (await getSession(sender)) || { 
      step: "start",
      isInitialized: false,
      awaitingLang: false
    };
    
    // Update session to show we're processing voice
    session.step = "processing_voice";
    await saveSession(sender, session);
    
    // Send processing message
    await sendMessage(sender, "🎤 Processing your voice message... Please wait a moment.");
    
    // Get media URL from metadata
    const mediaUrl = metadata.body || metadata.mediaUrl;
    if (!mediaUrl) {
      await sendMessage(sender, "❌ Could not access the voice message. Please try sending it again.");
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    // Process the voice message
    const processingResult = await voiceService.processVoiceMessage(
      { from: sender, id: metadata.id || Date.now().toString() },
      mediaUrl,
      client
    );
    
    if (!processingResult.success) {
      await sendMessage(sender, `❌ Error processing voice: ${processingResult.error}\n\nPlease try again or type your request.`);
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    // Handle the intent with confirmation buttons
    await voiceService.handleIntentConfirmation(processingResult, client);
    
    // Store voice processing context in session
    session.voiceContext = {
      originalTranscription: processingResult.transcription,
      intent: processingResult.intent,
      entities: processingResult.entities,
      confidence: processingResult.confidence,
      timestamp: Date.now()
    };
    session.step = "awaiting_voice_confirmation";
    
    await saveSession(sender, session);
    return session;
    
  } catch (error) {
    console.error("🎤 [VOICE] Error handling voice message:", error);
    await sendMessage(sender, "❌ Sorry, I couldn't process your voice message. Please try typing your request.");
    return null;
  }
}

/**
 * Handle voice intent confirmation responses
 * @param {String} sender - User phone number
 * @param {String} response - User's response (button click)
 * @param {Object} session - Current session
 * @returns {Promise<Object>} Updated session
 */
async function handleVoiceConfirmation(sender, response, session) {
  try {
    console.log("🎤 [VOICE] Handling confirmation response:", response);
    
    const voiceContext = session.voiceContext;
    if (!voiceContext) {
      await sendMessage(sender, "❌ Voice context lost. Please start over.");
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    const { intent, entities, originalTranscription } = voiceContext;
    
    if (response.startsWith("confirm_")) {
      // User confirmed - proceed with the intent
      const confirmedIntent = response.replace("confirm_", "");
      
      if (confirmedIntent === intent) {
        await sendMessage(sender, `✅ Got it! Processing: "${originalTranscription}"`);
        await executeVoiceIntent(sender, intent, entities, session);
      } else {
        await sendMessage(sender, "❌ Intent mismatch. Please try again.");
        session.step = "menu";
      }
      
    } else if (response === "try_again") {
      // User wants to try voice again
      await sendMessage(sender, "🔄 Please send your voice message again.");
      session.step = "awaiting_voice";
      delete session.voiceContext;
      
    } else if (response === "use_buttons") {
      // User wants to use buttons instead
      await sendMessage(sender, "📋 Switching to menu options...");
      session.step = "menu";
      delete session.voiceContext;
      await sendMainMenuViaService(sender);
      
    } else {
      await sendMessage(sender, "I didn't understand that response. Please use the buttons provided.");
      // Show confirmation buttons again
      await voiceService.sendConfirmationButtons(
        { from: sender },
        null, // client not needed for re-sending
        intent,
        entities,
        originalTranscription
      );
    }
    
    await saveSession(sender, session);
    return session;
    
  } catch (error) {
    console.error("🎤 [VOICE] Error handling confirmation:", error);
    await sendMessage(sender, "❌ Error processing your response. Please try again.");
    session.step = "menu";
    await saveSession(sender, session);
    return session;
  }
}

/**
 * Execute the confirmed voice intent
 * @param {String} sender - User phone number
 * @param {String} intent - Extracted intent
 * @param {Object} entities - Extracted entities
 * @param {Object} session - Current session
 */
async function executeVoiceIntent(sender, intent, entities, session) {
  console.log("🎤 [VOICE] Executing intent:", intent, "with entities:", entities);
  
  switch (intent) {
    case "buy_property":
    case "rent_property":
    case "search_listing":
      await handleVoiceSearch(sender, intent, entities, session);
      break;
      
    case "post_listing":
      await sendMessage(sender, "🎤 Voice listing post detected. Switching to listing form...");
      await handlePostListingFlow(sender);
      break;
      
    case "view_listing":
      await sendMessage(sender, "🎤 To view specific listing details, please use the 'View Listings' option from the menu.");
      session.step = "menu";
      await sendMainMenuViaService(sender);
      break;
      
    case "contact_agent":
      await sendMessage(sender, "🎤 For contacting agents, please use the contact information provided in individual listings.");
      session.step = "menu";
      await sendMainMenuViaService(sender);
      break;
      
    default:
      await sendMessage(sender, "🎤 I understood your request but need more details. Please use the menu options.");
      session.step = "menu";
      await sendMainMenuViaService(sender);
      break;
  }
  
  // Clear voice context after execution
  delete session.voiceContext;
  await saveSession(sender, session);
}

/**
 * Handle voice-based property search
 * @param {String} sender - User phone number
 * @param {String} intent - Search intent (buy/rent)
 * @param {Object} entities - Search criteria
 * @param {Object} session - Current session
 */
async function handleVoiceSearch(sender, intent, entities, session) {
  try {
    console.log("🎤 [VOICE SEARCH] Searching with criteria:", entities);
    
    // Build search criteria from entities
    const searchCriteria = {
      type: intent === "buy_property" ? "Sale" : "Rent",
      location: entities.location || null,
      bedrooms: entities.bedrooms || null,
      maxPrice: entities.budget ? parseBudgetToNumber(entities.budget) : null
    };
    
    await sendMessage(sender, `🔍 Searching for ${intent === 'buy_property' ? 'properties to buy' : 'properties to rent'}...`);
    
    // Search listings
    const listings = await searchListingsByCriteria(searchCriteria);
    
    if (!listings || listings.length === 0) {
      await sendMessage(
        sender,
        `❌ No listings found for your criteria.\n\n` +
        `Try adjusting your search:\n` +
        `• Different location\n` +
        `• Different budget\n` +
        `• Fewer bedrooms\n\n` +
        `Or use the "View Listings" option to browse all available properties.`
      );
      session.step = "menu";
      await saveSession(sender, session);
      return;
    }
    
    // Show top 3 listings as requested
    const topListings = listings.slice(0, 3);
    
    await sendMessage(
      sender,
      `✅ Found ${listings.length} properties. Here are the top ${topListings.length}:`
    );
    
    // Send each listing
    for (let i = 0; i < topListings.length; i++) {
      const listing = topListings[i];
      await sendListingCard(
        sender, 
        { 
          id: listing.id,
          title: listing.title || listing.type || "Property",
          location: listing.location || "Not specified",
          price: listing.price || "N/A",
          bedrooms: listing.bhk || "N/A",
          property_type: listing.type || "Property",
          description: listing.description || "No description",
          contact: listing.contact || "Contact not provided"
        }, 
        i, 
        topListings.length
      );
      
      // Small delay between cards
      if (i < topListings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Update session for listing browsing
    session.step = "awaiting_listing_action";
    session.housingFlow = {
      currentIndex: 0,
      listingData: {
        listings: topListings,
        totalCount: topListings.length
      }
    };
    
    await saveSession(sender, session);
    
    // Ask if user wants to see more or search differently
    await sendReplyButtons(
      sender,
      "Would you like to:",
      [
        { id: "voice_see_more", title: "🔍 See More Listings" },
        { id: "voice_refine_search", title: "🎤 Refine Search" },
        { id: "voice_main_menu", title: "🏠 Main Menu" }
      ],
      "Search Options"
    );
    
  } catch (error) {
    console.error("🎤 [VOICE SEARCH] Error:", error);
    await sendMessage(
      sender,
      "❌ Error searching for properties. Please try the 'View Listings' option from the menu."
    );
    session.step = "menu";
    await saveSession(sender, session);
  }
}

/**
 * Parse budget string to number
 * @param {String} budget - Budget string (e.g., "₹50 Lakh", "1.2 Crore")
 * @returns {Number} Budget in numeric format
 */
function parseBudgetToNumber(budget) {
  if (!budget) return null;
  
  const budgetStr = budget.toString().toLowerCase();
  
  // Extract number
  const numberMatch = budgetStr.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) return null;
  
  const number = parseFloat(numberMatch[1]);
  
  // Check for lakh/crore
  if (budgetStr.includes('lakh') || budgetStr.includes('lac')) {
    return number * 100000; // Convert lakh to actual number
  } else if (budgetStr.includes('crore') || budgetStr.includes('cr')) {
    return number * 10000000; // Convert crore to actual number
  }
  
  return number; // Assume it's already in correct format
}

/**
 * Handle voice search option responses
 */
async function handleVoiceSearchOptions(sender, msg, session) {
  switch (msg) {
    case "voice_see_more":
      // Show next set of listings
      const listings = session.housingFlow?.listingData?.listings || [];
      const allListings = await searchListingsByCriteria(session.voiceContext?.entities || {});
      
      if (allListings && allListings.length > listings.length) {
        // Show next 3 listings
        const nextIndex = listings.length;
        const nextListings = allListings.slice(nextIndex, nextIndex + 3);
        
        for (let i = 0; i < nextListings.length; i++) {
          const listing = nextListings[i];
          await sendListingCard(sender, listing, i, nextListings.length);
          if (i < nextListings.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Update session with combined listings
        session.housingFlow.listingData.listings = [...listings, ...nextListings];
        session.housingFlow.listingData.totalCount = session.housingFlow.listingData.listings.length;
        
        await saveSession(sender, session);
      } else {
        await sendMessage(sender, "🎤 That's all the listings matching your criteria!");
      }
      break;
      
    case "voice_refine_search":
      await sendMessage(
        sender,
        "🎤 Please send another voice message with your refined search criteria.\n\n" +
        "Examples:\n" +
        "• 'Change to 3BHK'\n" +
        "• 'Budget 80 lakhs'\n" +
        "• 'In Gurgaon instead'"
      );
      session.step = "awaiting_voice";
      delete session.voiceContext;
      break;
      
    case "voice_main_menu":
      session.step = "menu";
      delete session.voiceContext;
      delete session.housingFlow;
      await saveSession(sender, session);
      await sendMainMenuViaService(sender);
      break;
  }
  
  return session;
}

// ========================================
// ENHANCED FLOW SUBMISSION HANDLER
// ========================================
async function handleFlowSubmission(metadata, sender) {
  console.log("🔍 [FLOW DEBUG] Checking for flow submission...");
  console.log("🔍 [FLOW DEBUG] Metadata type:", metadata?.type);
  console.log("🔍 [FLOW DEBUG] Interactive type:", metadata?.interactive?.type);
  
  if (metadata?.type === "interactive" && metadata?.interactive?.type === "flow_submission") {
    console.log("✅ [FLOW] Flow submission detected!");
    console.log("🔧 [FLOW] Using Flow ID from env:", WHATSAPP_FLOW_ID);
    
    try {
      const data = metadata.interactive.data;
      const flowReply = metadata.interactive.flow_reply;
      
      console.log("📋 [FLOW] Received data:", JSON.stringify(data, null, 2));
      console.log("📋 [FLOW] Flow reply:", JSON.stringify(flowReply, null, 2));
      
      // Extract data from flow submission
      // Map Flow field names to our database field names
      const listingData = {
        user: sender,
        title: data.title || data.Title || data.property_title || "Untitled Property",
        type: data.listingType || data.property_type || data.type || data.Property_Type || "Property",
        bhk: data.bhk || data.BHK || data.bedrooms || "N/A",
        location: data.location || data.Location || data.property_location || "Location not specified",
        price: parseFloat(data.price || data.Price || data.monthly_rent || data.monthly_price || 0),
        contact: data.contact || data.Contact || data.phone || data.Phone || "Not provided",
        description: data.description || data.Description || data.additional_details || data.details || "No description provided",
        createdAt: Date.now(),
        timestamp: Date.now()
      };
      
      // Clean and validate the data
      if (!listingData.title || listingData.title === "Untitled Property") {
        throw new Error("Title is required");
      }
      
      if (!listingData.location || listingData.location === "Location not specified") {
        throw new Error("Location is required");
      }
      
      if (!listingData.price || listingData.price <= 0) {
        throw new Error("Valid price is required");
      }
      
      console.log("🏡 [FLOW] Processed listing data:", listingData);
      
      // Save to Firestore
      const docRef = await db.collection("listings").add(listingData);
      console.log("💾 [FLOW] Listing saved with ID:", docRef.id);
      
      // Send success message with details
      const successMessage = 
`🎉 *Listing Posted Successfully!*

📋 *Details:*
*Title:* ${listingData.title}
*Type:* ${listingData.type}
*Location:* ${listingData.location}
*Price:* ₹${listingData.price.toLocaleString('en-IN')}
*Contact:* ${listingData.contact}
${listingData.description ? `*Description:* ${listingData.description}` : ''}

Your listing is now live and visible to all users!`;

      await sendMessage(sender, successMessage);
      
      // Update session
      const session = await getSession(sender);
      session.step = "menu";
      await saveSession(sender, session);
      
      // Send main menu
      await sendMainMenuViaService(sender);
      
      return true;
      
    } catch (error) {
      console.error("❌ [FLOW] Error processing flow submission:", error);
      await sendMessage(
        sender,
        `❌ Sorry, there was an error saving your listing: ${error.message}\n\nPlease try again or use the text format.`
      );
      return true; // Still return true to indicate flow was handled
    }
  }
  
  // Also check for flow completion
  if (metadata?.type === "interactive" && metadata?.interactive?.type === "flow_completion") {
    console.log("✅ [FLOW] Flow completion detected");
    return true;
  }
  
  console.log("❌ [FLOW] Not a flow submission or completion");
  return false;
}

// ========================================
// POST LISTING VIA WHATSAPP FLOW
// ========================================
async function handlePostListingFlow(sender) {
  try {
    console.log(`📋 [FLOW] Sending Post Listing Flow to ${sender}`);
    
    // Validate configuration first
    if (!validateFlowConfig()) {
      throw new Error("Flow configuration is invalid. Check environment variables in Railway.");
    }
    
    // Get Flow ID from environment variables
    const FLOW_ID = WHATSAPP_FLOW_ID;
    
    console.log(`🔧 [FLOW] Using Flow ID: ${FLOW_ID}, Mode: ${FLOW_MODE}`);
    
    // Generate a unique flow token
    const flowToken = `flow_token_${Date.now()}_${sender.replace(/[^0-9]/g, '')}`;
    
    const flowPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: sender,
      type: "interactive",
      interactive: {
        type: "flow",
        header: {
          type: "text",
          text: "🏡 Post New Listing"
        },
        body: {
          text: "Fill out this form to list your property. All fields are required."
        },
        footer: {
          text: "MarketMatch AI"
        },
        action: {
          name: "flow",
          parameters: {
            mode: FLOW_MODE, // "draft" or "published"
            flow_message_version: "3",
            flow_token: flowToken,
            flow_id: FLOW_ID,
            flow_cta: "Create Listing" // ✅ ADD THIS LINE - CRITICAL!
          }
        }
      }
    };

    // ✅ ADDITIONAL: If using published mode, you might need flow_action
    if (FLOW_MODE === "published") {
      flowPayload.interactive.action.parameters.flow_action = "navigate";
      flowPayload.interactive.action.parameters.flow_action_payload = {
        screen: "WELCOME_SCREEN" // Make sure this matches your Flow's starting screen ID
      };
    }

    console.log(`📤 [FLOW] Sending flow with ID: ${FLOW_ID}`);
    console.log(`📤 [FLOW] Payload:`, JSON.stringify(flowPayload, null, 2));
    
    // Use sendMessage function
    await sendMessage(sender, flowPayload);
    
    // Update session
    const session = await getSession(sender);
    session.step = "awaiting_flow_submission";
    session.flowToken = flowToken; // Store for reference
    await saveSession(sender, session);
    
    console.log(`✅ [FLOW] Flow sent successfully to ${sender} with token: ${flowToken}`);
    
  } catch (error) {
    console.error("❌ [FLOW] Error sending flow:", error);
    
    // Fallback to text input if flow fails
    await sendMessage(
      sender,
      "❌ Unable to load the listing form right now.\n\n" +
      "Please send listing details in this format:\n" +
      "*Example:* `2BHK Apartment, Noida Sector 52, 15000, +9199XXXXXXXX, Furnished`\n\n" +
      "*Format:* Title, Location, Price, Contact, Description"
    );
    
    const session = await getSession(sender);
    session.step = "awaiting_post_details";
    await saveSession(sender, session);
  }
}

// ========================================
// FALLBACK: TEXT-BASED LISTING PARSING (IMPROVED)
// ========================================
async function handleTextListingInput(sender, text, session) {
  try {
    console.log(`📝 [TEXT LISTING] Processing text input: ${text}`);
    
    // Split by commas or newlines
    const parts = text.split(/[,|\n]/).map(part => part.trim()).filter(part => part);
    
    if (parts.length < 4) {
      throw new Error("Please provide at least: Title, Location, Price, and Contact");
    }
    
    // Try to identify fields intelligently
    const listingData = {
      user: sender,
      title: parts[0], // First part is usually title
      location: null,
      price: null,
      contact: null,
      type: "Property", // Default
      description: []
    };
    
    // Analyze each part
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      // Check for price (contains numbers)
      const priceMatch = part.match(/(\d+[,\d]*)/);
      if (priceMatch && !listingData.price) {
        listingData.price = parseInt(priceMatch[1].replace(/,/g, ''));
        continue;
      }
      
      // Check for phone number
      if (part.match(/[+0-9]{10,}/) && !listingData.contact) {
        listingData.contact = part;
        continue;
      }
      
      // Check for BHK/type
      if (part.match(/\b(1RK|1BHK|2BHK|3BHK|4BHK|PG|Villa|Apartment|House|Flat)\b/i) && !listingData.type) {
        listingData.type = part;
        continue;
      }
      
      // If we haven't set location yet and this doesn't look like contact/price
      if (!listingData.location && !part.match(/[+0-9]{10,}/) && !priceMatch) {
        listingData.location = part;
        continue;
      }
      
      // Everything else goes to description
      listingData.description.push(part);
    }
    
    // Validate required fields
    if (!listingData.title) throw new Error("Title is required");
    if (!listingData.location) throw new Error("Location is required");
    if (!listingData.price || listingData.price <= 0) throw new Error("Valid price is required");
    if (!listingData.contact) throw new Error("Contact number is required");
    
    // Set description
    listingData.description = listingData.description.join(", ") || "No additional details";
    listingData.createdAt = Date.now();
    
    // Save to database
    await db.collection("listings").add(listingData);
    
    const successMessage = 
`🎉 *Listing Posted Successfully!*

📋 *Details:*
*Title:* ${listingData.title}
*Location:* ${listingData.location}
*Type:* ${listingData.type}
*Price:* ₹${listingData.price.toLocaleString('en-IN')}
*Contact:* ${listingData.contact}
${listingData.description ? `*Description:* ${listingData.description}` : ''}`;
    
    await sendMessage(sender, successMessage);
    
    // Reset to menu
    session.step = "menu";
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
    
    return true;
    
  } catch (error) {
    console.error("❌ [TEXT LISTING] Error:", error);
    await sendMessage(
      sender,
      `❌ Error: ${error.message}\n\n` +
      "Please use this format:\n" +
      "*Example:* `2BHK Apartment, Noida Sector 52, 15000, +9199XXXXXXXX, Furnished`\n\n" +
      "*Or try:* /flow for the form interface"
    );
    return false;
  }
}

// ========================================
// LIST MESSAGE DATA
// ========================================
const LANG_ROWS = [
  { id: "lang_en", title: "English" },
  { id: "lang_hi", title: "हिंदी (Hindi)" },
  { id: "lang_ta", title: "தமிழ் (Tamil)" },
  { id: "lang_gu", title: "ગુજરાતી (Gujarati)" },
  { id: "lang_kn", title: "ಕನ್ನಡ (Kannada)" },
];

const MENU_ROWS = [
  { 
    id: "view_listings", 
    title: "View Listings", 
    description: "Browse available homes, apartments, or properties for rent or sale." 
  },
  { 
    id: "post_listing", 
    title: "Post Listing", 
    description: "Publish your home or property to attract potential buyers or renters." 
  },
  { 
    id: "manage_listings", 
    title: "Manage Listings", 
    description: "Edit, update, or remove your property listings." 
  },
  { 
    id: "saved_listings", 
    title: "Saved Listings", 
    description: "View and manage properties you've saved for later." 
  },
  { 
    id: "change_language", 
    title: "Change Language", 
    description: "Switch the app's interface to your preferred language." 
  },
];

// ========================================
// SEND LIST HELPERS
// ========================================
async function sendLanguageListViaService(to) {
  const sections = [{ title: "Available languages", rows: LANG_ROWS }];
  return sendList(
    to,
    "🌐 Select your preferred language",
    "Choose one option from below:",
    "Select Language",
    sections
  );
}

async function sendMainMenuViaService(to) {
  const sections = [{ title: "Menu", rows: MENU_ROWS }];
  return sendList(
    to,
    "🏡 MarketMatch AI",
    "Choose an option:",
    "Select an option",
    sections
  );
}

// ========================================
// PARSE LANGUAGE TYPED INPUT
// ========================================
function parseLangFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  if (lower.startsWith("lang_")) return lower.split("lang_")[1];

  if (lower.includes("english")) return "en";
  if (lower.includes("hindi") || lower === "hi") return "hi";
  if (lower.includes("tamil") || lower === "ta") return "ta";
  if (lower.includes("gujarati") || lower === "gu") return "gu";
  if (lower.includes("kannada") || lower === "kn") return "kn";

  return null;
}

// ========================================
// START/CONTINUE LISTING FLOW - EXTREME DEBUG VERSION
// ========================================
async function handleShowListings(sender, session) {
  console.log("🎯 [EXTREME DEBUG] handleShowListings ENTERED");
  
  try {
    let { listings, totalCount } = session.housingFlow.listingData || {};

    if (!listings) {
      console.log("🎯 [EXTREME DEBUG] Fetching fresh listings...");
      const result = await getTopListings();
      listings = result.listings;
      totalCount = result.totalCount;
      
      if (!listings || listings.length === 0) {
        console.log("🎯 [EXTREME DEBUG] NO LISTINGS FOUND");
        await sendMessage(sender, "No listings available right now.");
        return;
      }

      session.step = "awaiting_listing_action";
      session.housingFlow.currentIndex = 0;
      session.housingFlow.listingData = { listings, totalCount };
      await saveSession(sender, session);
    }
    
    const currentIndex = session.housingFlow.currentIndex || 0;
    const listing = listings[currentIndex];
    
    if (!listing) {
      await sendMessage(sender, "You've seen all the available listings!");
      session.step = "menu";
      delete session.housingFlow.listingData;
      delete session.housingFlow.currentIndex;
      await saveSession(sender, session);
      return;
    }

    try {
      await sendListingCard(
        sender, 
        { 
          id: listing.id,
          title: listing.title || listing.type || "Property",
          location: listing.location || "Not specified",
          price: listing.price || "N/A",
          bedrooms: listing.bhk || "N/A",
          property_type: listing.type || "Property",
          description: listing.description || "No description",
          contact: listing.contact || "Contact not provided"
        }, 
        currentIndex, 
        totalCount
      );
    } catch (cardError) {
      console.error("🎯 [EXTREME DEBUG] sendListingCard FAILED:", cardError.message);
      
      const fallbackText = 
`🏡 Listing ${currentIndex + 1}/${totalCount}
${listing.title || listing.type || "Property"}

📍 ${listing.location || "Location not specified"}
💰 ${listing.price || "Price on request"}
🛏️ ${listing.bhk || "N/A"} BHK

Reply "next" for next listing.`;
      
      await sendMessage(sender, fallbackText);
    }

  } catch (err) {
    console.error("🎯 [EXTREME DEBUG] FATAL ERROR in handleShowListings:", err);
    await sendMessage(sender, "❌ Error fetching listings.");
  }
}

// ========================================
// HANDLE SAVED LISTINGS
// ========================================
async function handleSavedListings(sender) {
  try {
    const savedListings = await getUserSavedListings(sender);

    if (!savedListings || savedListings.length === 0) {
      return sendMessage(
        sender, 
        "You haven't saved any listings yet.\n\n" +
        "To save a listing:\n" +
        "1. Go to *View Listings*\n" +
        "2. Browse properties\n" +
        "3. Tap the *❤️ Save* button on any listing"
      );
    }

    const listingRows = savedListings.map((listing, index) => {
      const shortTitle = listing.title && listing.title.length > 25 
        ? listing.title.substring(0, 25) + '...' 
        : listing.title || 'Untitled Property';
      
      return {
        id: `saved_${listing.id}`,
        title: `${index + 1}. ${shortTitle} - ₹${listing.price ? listing.price.toLocaleString('en-IN') : "N/A"}`,
        description: `📍 ${listing.location || 'Location not specified'} | 🏠 ${listing.type || listing.listingType || 'Property'}`
      };
    });

    const sections = [{
      title: `Your Saved Listings (${savedListings.length})`,
      rows: listingRows
    }];

    await sendList(
      sender,
      "❤️ Saved Listings",
      "Select a listing to view or remove:",
      "Select Listing",
      sections
    );

    const session = await getSession(sender);
    session.step = "viewing_saved_listings";
    session.savedListingsFlow = {
      listings: savedListings.reduce((acc, listing) => {
        acc[listing.id] = listing;
        return acc;
      }, {}),
      step: "awaiting_selection"
    };
    await saveSession(sender, session);

  } catch (err) {
    console.error("Error in handleSavedListings:", err);
    await sendMessage(sender, "❌ Unable to fetch your saved listings right now.");
  }
}

// ========================================
// HANDLE SAVED LISTING SELECTION
// ========================================
async function handleSavedListingSelection(sender, selectedId, session) {
  const listingId = selectedId.replace('saved_', '');
  const listing = session.savedListingsFlow?.listings?.[listingId];

  if (!listing) {
    await sendMessage(sender, "❌ Saved listing not found. Please try again.");
    await handleSavedListings(sender);
    return;
  }

  session.savedListingsFlow.selectedId = listingId;
  session.savedListingsFlow.selectedListing = listing;
  session.savedListingsFlow.step = "awaiting_action";

  const listingText = 
`📋 Saved Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this saved listing?`;

  await sendReplyButtons(
    sender,
    listingText,
    [
      { id: `remove_saved_${listingId}`, title: "🗑️ Remove from Saved" },
      { id: `contact_saved_${listingId}`, title: "📞 Contact Owner" },
      { id: "back_saved", title: "⬅️ Back to Saved List" }
    ],
    "Saved Listing Details"
  );

  await saveSession(sender, session);
}

// ========================================
// HANDLE REMOVE SAVED LISTING
// ========================================
async function handleRemoveSavedListing(sender, session) {
  const listingId = session.savedListingsFlow?.selectedId;
  const listing = session.savedListingsFlow?.selectedListing;

  if (!listingId || !listing) {
    await sendMessage(sender, "❌ No saved listing selected.");
    await handleSavedListings(sender);
    return;
  }

  try {
    const result = await removeSavedListing(sender, listingId);
    
    if (result && result.success === true) {
      await sendMessage(
        sender,
        `✅ Listing "${listing.title || 'Untitled'}" has been removed from your saved listings.`
      );

      // Clear saved listings flow data
      delete session.savedListingsFlow;
      session.step = "menu";
      await saveSession(sender, session);

      // Show main menu
      await sendMainMenuViaService(sender);
    } else {
      await sendMessage(sender, `❌ Failed to remove saved listing: ${result?.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error("Error in remove saved listing operation:", err);
    await sendMessage(sender, "❌ Error removing saved listing. Please try again.");
  }
}

// ========================================
// MANAGE USER LISTINGS
// ========================================
async function handleManageListings(sender) {
  try {
    const listings = await getUserListings(sender); 

    if (!listings || listings.length === 0) {
      return sendMessage(sender, "You haven't posted any listings yet. Select *Post Listing* from the menu to add one!");
    }

    const listingRows = listings.map((l, i) => {
      const shortTitle = l.title && l.title.length > 25 
        ? l.title.substring(0, 25) + '...' 
        : l.title || 'Untitled Property';
      
      return {
        id: `listing_${l.id}`,
        title: `${shortTitle} - ₹${l.price ? l.price.toLocaleString('en-IN') : "N/A"}`,
        description: `📍 ${l.location || 'Location not specified'} | 🏠 ${l.type || l.listingType || 'Property'}`
      };
    });

    const sections = [{
      title: `Your Listings (${listings.length})`,
      rows: listingRows
    }];

    await sendList(
      sender,
      "🏡 Manage Your Listings",
      "Select a listing to delete or edit:",
      "Select Listing",
      sections
    );

    const session = await getSession(sender);
    session.step = "managing_listings";
    session.manageListings = {
      listings: listings.reduce((acc, listing) => {
        acc[listing.id] = listing;
        return acc;
      }, {}),
      step: "awaiting_selection"
    };
    await saveSession(sender, session);

  } catch (err) {
    console.error("Error in handleManageListings:", err);
    await sendMessage(sender, "❌ Unable to fetch your listings right now.");
  }
}

// ========================================
// HANDLE LISTING SELECTION FOR DELETE/EDIT
// ========================================
async function handleListingSelection(sender, selectedId, session) {
  const listingId = selectedId.replace('listing_', '');
  const listing = session.manageListings?.listings?.[listingId];

  if (!listing) {
    await sendMessage(sender, "❌ Listing not found. Please try again.");
    await handleManageListings(sender);
    return;
  }

  session.manageListings.selectedId = listingId;
  session.manageListings.selectedListing = listing;
  session.manageListings.step = "awaiting_action";

  const listingText = 
`📋 Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this listing?`;

  await sendReplyButtons(
    sender,
    listingText,
    [
      { id: `delete_${listingId}`, title: "🗑️ Delete Listing" },
      { id: `edit_${listingId}`, title: "✏️ Edit Listing" },
      { id: "cancel_manage", title: "⬅️ Back to List" }
    ],
    "Listing Details"
  );

  await saveSession(sender, session);
}

// ========================================
// HANDLE DELETE CONFIRMATION
// ========================================
async function handleDeleteListing(sender, session) {
  const listingId = session.manageListings?.selectedId;
  const listing = session.manageListings?.selectedListing;

  if (!listingId || !listing) {
    await sendMessage(sender, "❌ No listing selected for deletion.");
    await handleManageListings(sender);
    return;
  }

  console.log(`🔍 [CONTROLLER] Deleting listing: ${listingId}`);
  console.log(`🔍 [CONTROLLER] Listing title: ${listing.title || 'Untitled'}`);

  try {
    const result = await deleteListing(listingId);
    
    console.log(`🔍 [CONTROLLER] Delete result:`, result);
    
    if (result && result.success === true) {
      await sendMessage(
        sender,
        `✅ Listing "${listing.title || 'Untitled'}" has been deleted successfully!`
      );

      // Clear flow data
      await clearFlowData(sender);
      
      // Get fresh session and reset to menu
      const newSession = await getSession(sender);
      if (newSession) {
        newSession.step = "menu";
        delete newSession.manageListings;
        delete newSession.editFlow;
        await saveSession(sender, newSession);
      }

      // Show main menu
      await sendMainMenuViaService(sender);
    } else {
      console.error(`❌ [CONTROLLER] Delete failed, result:`, result);
      await sendMessage(sender, `❌ Failed to delete listing: ${result?.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error("❌ [CONTROLLER] Error in delete operation:", err);
    await sendMessage(sender, "❌ Error deleting listing. Please try again.");
  }
}

// ========================================
// HANDLE EDIT LISTING
// ========================================
async function handleEditListing(sender, session) {
  const listing = session.manageListings?.selectedListing;

  if (!listing) {
    await sendMessage(sender, "❌ No listing selected for editing.");
    await handleManageListings(sender);
    return;
  }

  session.editFlow = {
    listingId: session.manageListings.selectedId,
    original: listing,
    step: "awaiting_field_selection",
    updatedFields: {}
  };

  await sendReplyButtons(
    sender,
    `✏️ Edit Listing: ${listing.title || 'Untitled'}\n\nSelect which field you want to edit:`,
    [
      { id: "edit_title", title: "📝 Title" },
      { id: "edit_location", title: "📍 Location" },
      { id: "edit_price", title: "💰 Price" },
      { id: "edit_type", title: "🏠 Property Type" },
      { id: "edit_bhk", title: "🛏️ BHK" },
      { id: "edit_contact", title: "📞 Contact" },
      { id: "edit_description", title: "📄 Description" },
      { id: "edit_cancel", title: "❌ Cancel Edit" }
    ],
    "Edit Listing"
  );

  await saveSession(sender, session);
}

// ========================================
// HANDLE FIELD EDITING
// ========================================
async function handleFieldEdit(sender, field, session) {
  session.editFlow.editingField = field;
  session.editFlow.step = "awaiting_field_value";
  
  const fieldLabels = {
    "edit_title": "title",
    "edit_location": "location",
    "edit_price": "price",
    "edit_type": "type",
    "edit_bhk": "bhk",
    "edit_contact": "contact",
    "edit_description": "description"
  };

  const fieldName = fieldLabels[field];
  const currentValue = session.editFlow.original[fieldName] || 'Not set';

  await sendMessage(
    sender,
    `Current ${fieldName}: *${currentValue}*\n\nPlease send the new value:`
  );

  await saveSession(sender, session);
}

// ========================================
// UPDATE EDITED FIELD
// ========================================
async function updateFieldValue(sender, newValue, session) {
  const field = session.editFlow.editingField;
  const fieldLabels = {
    "edit_title": "title",
    "edit_location": "location",
    "edit_price": "price",
    "edit_type": "type",
    "edit_bhk": "bhk",
    "edit_contact": "contact",
    "edit_description": "description"
  };

  const fieldName = fieldLabels[field];
  
  if (field === "edit_price") {
    const numValue = parseInt(newValue.replace(/[^\d]/g, ''));
    if (!isNaN(numValue)) {
      session.editFlow.updatedFields[fieldName] = numValue;
    } else {
      session.editFlow.updatedFields[fieldName] = newValue;
    }
  } else {
    session.editFlow.updatedFields[fieldName] = newValue;
  }

  session.editFlow.step = "awaiting_field_selection";

  await sendReplyButtons(
    sender,
    `✅ ${fieldName} updated! Do you want to edit another field?`,
    [
      { id: "edit_another", title: "✏️ Edit Another Field" },
      { id: "save_edits", title: "💾 Save All Changes" },
      { id: "cancel_edits", title: "❌ Discard Changes" }
    ],
    "Edit Field"
  );

  await saveSession(sender, session);
}

// ========================================
// SAVE ALL EDITS
// ========================================
async function saveAllEdits(sender, session) {
  const listingId = session.editFlow.listingId;
  const updates = session.editFlow.updatedFields;

  if (Object.keys(updates).length === 0) {
    await sendMessage(sender, "❌ No changes were made.");
    await handleManageListings(sender);
    return;
  }

  try {
    const result = await updateListing(listingId, updates);
    
    if (result.success) {
      await sendMessage(
        sender,
        `✅ Listing updated successfully!\n\nChanges made:\n${Object.entries(updates)
          .map(([key, value]) => `• ${key}: ${value}`)
          .join('\n')}`
      );

      await clearFlowData(sender);
      const newSession = await getSession(sender);
      newSession.step = "menu";
      await saveSession(sender, newSession);

      await sendMainMenuViaService(sender);
    } else {
      await sendMessage(sender, "❌ Failed to update listing. Please try again.");
    }
  } catch (err) {
    console.error("Error updating listing:", err);
    await sendMessage(sender, "❌ Failed to update listing. Please try again.");
  }
}

// ========================================
// MAIN CONTROLLER - UPDATED WITH VOICE SUPPORT
// ========================================
async function handleIncomingMessage(sender, text = "", metadata = {}, client = null) {
  console.log("🔍 [CONTROLLER DEBUG] === START handleIncomingMessage ===");
  console.log("🔍 [CONTROLLER DEBUG] Input - sender:", sender);
  console.log("🔍 [CONTROLLER DEBUG] Input - text:", text);
  console.log("🔍 [CONTROLLER DEBUG] Input - metadata type:", metadata?.type);
  
  if (!sender) return;

  // ===========================
  // 0) PRIORITY: CHECK FOR VOICE MESSAGES
  // ===========================
  if (client && voiceService.isVoiceMessage(metadata)) {
    console.log("🎤 [VOICE] Detected voice message");
    return await handleVoiceMessage(sender, metadata, client);
  }

  // ===========================
  // 1) PRIORITY: CHECK FLOW SUBMISSION
  // ===========================
  const flowHandled = await handleFlowSubmission(metadata, sender);
  if (flowHandled) {
    const session = await getSession(sender);
    return session;
  }

  let replyId = null;
  
  if (metadata?.interactive?.type === "list_reply") {
    replyId = metadata.interactive.list_reply.id;
  } else if (metadata?.interactive?.type === "button_reply") {
    replyId = metadata.interactive.button_reply.id;
  }
  
  console.log("🔍 [CONTROLLER DEBUG] replyId:", replyId);
  
  const msg = String(replyId || text || "").trim();
  const lower = msg.toLowerCase();
  
  console.log("🔍 [CONTROLLER DEBUG] processed msg:", msg);
  console.log("🔍 [CONTROLLER DEBUG] processed lower:", lower);

  // Get session
  let session = (await getSession(sender)) || { 
    step: "start",
    housingFlow: { 
      step: "start", 
      data: {},
      currentIndex: 0, 
      listingData: null
    },
    isInitialized: false
  };

  console.log("🔍 [CONTROLLER DEBUG] Session state:", JSON.stringify(session, null, 2));
  console.log("🔍 [CONTROLLER DEBUG] Session step:", session.step);

  // ===========================
  // 2) CHECK FOR VOICE CONFIRMATION RESPONSES
  // ===========================
  if (session.step === "awaiting_voice_confirmation" && replyId) {
    console.log("🎤 [VOICE] Processing confirmation response");
    return await handleVoiceConfirmation(sender, msg, session);
  }

  // ===========================
  // 3) CHECK FOR VOICE SEARCH OPTIONS
  // ===========================
  if (msg.startsWith("voice_")) {
    return await handleVoiceSearchOptions(sender, msg, session);
  }

  const user = await getUserProfile(sender);
  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(lower);
  const isNewUser = !user && !session.isInitialized;

  // ===========================
  // 4) NEW USER INTRO
  // ===========================
  if (isGreeting && isNewUser) {
    await sendMessage(
      sender,
      "👋 *Welcome to MarketMatch AI!* \n\nI'm your personal assistant for:\n🏠 Rentals\n🏢 Real Estate\n👤 PG / Flatmates\n🧹 Home Services\n\nLet's begin by choosing your preferred language."
    );

    await sendLanguageListViaService(sender);

    session.isInitialized = true;
    session.housingFlow.awaitingLangSelection = true;
    session.step = "awaiting_language";
    await saveSession(sender, session);
    return session;
  }

  // ===========================
  // 5) EXISTING USER GREETING
  // ===========================
  if (isGreeting && !isNewUser) {
    session.housingFlow.listingData = null;
    session.housingFlow.currentIndex = 0;
    session.step = "menu";
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
    return session;
  }

  // ===========================
  // 6) LANGUAGE SELECTION
  // ===========================
  if (session.housingFlow?.awaitingLangSelection) {
    const parsed = parseLangFromText(msg);

    if (parsed) {
      try {
        await saveUserLanguage(sender, parsed);
      } catch (err) {
        console.warn("saveUserLanguage error:", err);
      }

      session.housingFlow.awaitingLangSelection = false;
      session.step = "menu";
      await saveSession(sender, session);

      await sendMainMenuViaService(sender);
      return session;
    } else {
      await sendMessage(sender, "Please select a language 👇");
      await sendLanguageListViaService(sender);
      return session;
    }
  }
  
  // ==========================================
  // 7) MANAGE LISTINGS INTERACTIVE HANDLING
  // ==========================================
  
  // Handle listing selection from manage listings
  if (msg.startsWith("listing_") && (session.step === "managing_listings" || session.manageListings)) {
    console.log("🔍 [CONTROLLER] Listing selected for management:", msg);
    await handleListingSelection(sender, msg, session);
    return session;
  }
  
  // ==========================================
  // 8) DELETE FLOW HANDLING
  // ==========================================
  
  // Handle delete button click (shows confirmation)
  if (msg.startsWith("delete_") && session.manageListings?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Delete button clicked:", msg);
    
    // Show confirmation before deleting
    await sendReplyButtons(
      sender,
      "⚠️ Are you sure you want to delete this listing?\nThis action cannot be undone.",
      [
        { id: "confirm_delete", title: "✅ Yes, Delete" },
        { id: "cancel_delete", title: "❌ No, Keep It" }
      ],
      "Confirm Delete"
    );
    
    session.manageListings.step = "confirming_delete";
    await saveSession(sender, session);
    return session;
  }
  
  // Handle delete confirmation (YES button)
  if (msg === "confirm_delete" && session.manageListings?.step === "confirming_delete") {
    console.log("🔍 [CONTROLLER] Confirm delete action");
    await handleDeleteListing(sender, session);
    return session;
  }
  
  // Handle delete cancellation (NO button)
  if (msg === "cancel_delete" && session.manageListings?.step === "confirming_delete") {
    console.log("🔍 [CONTROLLER] Cancel delete action");
    
    const listingId = session.manageListings?.selectedId;
    const listing = session.manageListings?.selectedListing;
    
    if (listing) {
      session.manageListings.step = "awaiting_action";
      await saveSession(sender, session);
      
      const listingText = 
`📋 Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this listing?`;

      await sendReplyButtons(
        sender,
        listingText,
        [
          { id: `delete_${listingId}`, title: "🗑️ Delete Listing" },
          { id: `edit_${listingId}`, title: "✏️ Edit Listing" },
          { id: "cancel_manage", title: "⬅️ Back to List" }
        ],
        "Listing Details"
      );
    }
    return session;
  }
  
  // ==========================================
  // 9) EDIT FLOW HANDLING
  // ==========================================
  
  // Handle edit button click (starts edit flow)
  if (msg.startsWith("edit_") && session.manageListings?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Edit button clicked:", msg);
    
    const listingId = msg.replace('edit_', '');
    console.log("🔍 [CONTROLLER] Extracted listing ID:", listingId);
    console.log("🔍 [CONTROLLER] Selected listing ID:", session.manageListings?.selectedId);
    
    // Verify this is the correct listing
    if (listingId === session.manageListings?.selectedId) {
      console.log("🔍 [CONTROLLER] Starting edit flow for listing:", listingId);
      
      session.editFlow = {
        listingId: session.manageListings.selectedId,
        original: session.manageListings.selectedListing,
        step: "awaiting_field_selection",
        updatedFields: {}
      };
      session.manageListings.step = "editing";
      await saveSession(sender, session);

      await sendReplyButtons(
        sender,
        `✏️ Edit Listing: ${session.manageListings.selectedListing.title || 'Untitled'}\n\nSelect which field you want to edit:`,
        [
          { id: "edit_title", title: "📝 Title" },
          { id: "edit_location", title: "📍 Location" },
          { id: "edit_price", title: "💰 Price" },
          { id: "edit_type", title: "🏠 Property Type" },
          { id: "edit_bhk", title: "🛏️ BHK" },
          { id: "edit_contact", title: "📞 Contact" },
          { id: "edit_description", title: "📄 Description" },
          { id: "edit_cancel", title: "❌ Cancel Edit" }
        ],
        "Edit Listing"
      );
    } else {
      console.error("❌ [CONTROLLER] Listing ID mismatch");
      await sendMessage(sender, "❌ Unable to edit listing. Please try again.");
    }
    return session;
  }
  
  // ==========================================
  // 10) EDIT FIELD SELECTION HANDLING
  // ==========================================
  
  // Handle edit flow field selection
  if (session.editFlow?.step === "awaiting_field_selection") {
    console.log("🔍 [CONTROLLER] In edit flow field selection");
    
    if (msg.startsWith("edit_") && msg !== "edit_cancel" && msg !== "edit_another") {
      console.log("🔍 [CONTROLLER] Field selected for editing:", msg);
      await handleFieldEdit(sender, msg, session);
      return session;
    }
    
    if (msg === "edit_cancel") {
      console.log("🔍 [CONTROLLER] Edit cancelled");
      delete session.editFlow;
      session.manageListings.step = "awaiting_action";
      await saveSession(sender, session);
      
      const listing = session.manageListings.selectedListing;
      if (listing) {
        const listingText = 
`📋 Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this listing?`;

        await sendReplyButtons(
          sender,
          listingText,
          [
            { id: `delete_${session.manageListings.selectedId}`, title: "🗑️ Delete Listing" },
            { id: `edit_${session.manageListings.selectedId}`, title: "✏️ Edit Listing" },
            { id: "cancel_manage", title: "⬅️ Back to List" }
          ],
          "Listing Details"
        );
      }
      return session;
    }
    
    if (msg === "edit_another") {
      console.log("🔍 [CONTROLLER] Edit another field");
      const listing = session.manageListings.selectedListing;
      await sendReplyButtons(
        sender,
        `✏️ Edit Listing: ${listing.title || 'Untitled'}\n\nSelect which field you want to edit:`,
        [
          { id: "edit_title", title: "📝 Title" },
          { id: "edit_location", title: "📍 Location" },
          { id: "edit_price", title: "💰 Price" },
          { id: "edit_type", title: "🏠 Property Type" },
          { id: "edit_bhk", title: "🛏️ BHK" },
          { id: "edit_contact", title: "📞 Contact" },
          { id: "edit_description", title: "📄 Description" },
          { id: "edit_cancel", title: "❌ Cancel Edit" }
        ],
        "Edit Listing"
      );
      return session;
    }
    
    if (msg === "save_edits") {
      console.log("🔍 [CONTROLLER] Saving edits");
      await saveAllEdits(sender, session);
      return session;
    }
    
    if (msg === "cancel_edits") {
      console.log("🔍 [CONTROLLER] Discarding edits");
      delete session.editFlow;
      session.manageListings.step = "awaiting_action";
      await saveSession(sender, session);
      
      const listing = session.manageListings.selectedListing;
      if (listing) {
        const listingText = 
`📋 Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this listing?`;

        await sendReplyButtons(
          sender,
          listingText,
          [
            { id: `delete_${session.manageListings.selectedId}`, title: "🗑️ Delete Listing" },
            { id: `edit_${session.manageListings.selectedId}`, title: "✏️ Edit Listing" },
            { id: "cancel_manage", title: "⬅️ Back to List" }
          ],
          "Listing Details"
        );
      }
      return session;
    }
  }
  
  // ==========================================
  // 11) EDIT FIELD VALUE INPUT (TEXT-BASED)
  // ==========================================
  if (session.editFlow?.step === "awaiting_field_value" && text) {
    console.log("🔍 [CONTROLLER] Field value received:", text);
    await updateFieldValue(sender, text, session);
    return session;
  }
  
  // ==========================================
  // 12) CANCEL MANAGE (Back button)
  // ==========================================
  if (msg === "cancel_manage" && session.manageListings?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Back to listing list");
    await handleManageListings(sender);
    return session;
  }
  
  // ==========================================
  // 13) SAVED LISTINGS INTERACTIVE HANDLING
  // ==========================================

  // Handle saved listing selection
  if (msg.startsWith("saved_") && session.savedListingsFlow?.step === "awaiting_selection") {
    console.log("🔍 [CONTROLLER] Saved listing selected:", msg);
    await handleSavedListingSelection(sender, msg, session);
    return session;
  }

  // Handle remove saved button click
  if (msg.startsWith("remove_saved_") && session.savedListingsFlow?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Remove saved button clicked:", msg);
    
    // Show confirmation
    await sendReplyButtons(
      sender,
      "⚠️ Remove this listing from your saved list?",
      [
        { id: "confirm_remove_saved", title: "✅ Yes, Remove" },
        { id: "cancel_remove_saved", title: "❌ No, Keep It" }
      ],
      "Confirm Remove"
    );
    
    session.savedListingsFlow.step = "confirming_remove";
    await saveSession(sender, session);
    return session;
  }

  // Handle remove confirmation
  if (msg === "confirm_remove_saved" && session.savedListingsFlow?.step === "confirming_remove") {
    console.log("🔍 [CONTROLLER] Confirm remove saved action");
    await handleRemoveSavedListing(sender, session);
    return session;
  }

  // Handle remove cancellation
  if (msg === "cancel_remove_saved" && session.savedListingsFlow?.step === "confirming_remove") {
    console.log("🔍 [CONTROLLER] Cancel remove saved action");
    session.savedListingsFlow.step = "awaiting_action";
    await saveSession(sender, session);
    
    const listing = session.savedListingsFlow.selectedListing;
    if (listing) {
      const listingText = 
`📋 Saved Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this saved listing?`;

      await sendReplyButtons(
        sender,
        listingText,
        [
          { id: `remove_saved_${session.savedListingsFlow.selectedId}`, title: "🗑️ Remove from Saved" },
          { id: `contact_saved_${session.savedListingsFlow.selectedId}`, title: "📞 Contact Owner" },
          { id: "back_saved", title: "⬅️ Back to Saved List" }
        ],
        "Saved Listing Details"
      );
    }
    return session;
  }

  // Handle contact owner
  if (msg.startsWith("contact_saved_") && session.savedListingsFlow?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Contact owner button clicked");
    const listingId = msg.replace('contact_saved_', '');
    const listing = session.savedListingsFlow.selectedListing;
    
    if (listing && listing.contact) {
      await sendMessage(
        sender,
        `📞 Contact the owner of "${listing.title || 'Untitled'}":\n\n` +
        `*Contact:* ${listing.contact}\n\n` +
        `You can call or message them directly.`
      );
    } else {
      await sendMessage(sender, "❌ Contact information is not available for this listing.");
    }
    
    // Show the listing details again
    const listingText = 
`📋 Saved Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this saved listing?`;

    await sendReplyButtons(
      sender,
      listingText,
      [
        { id: `remove_saved_${session.savedListingsFlow.selectedId}`, title: "🗑️ Remove from Saved" },
        { id: `contact_saved_${session.savedListingsFlow.selectedId}`, title: "📞 Contact Owner" },
        { id: "back_saved", title: "⬅️ Back to Saved List" }
      ],
      "Saved Listing Details"
    );
    return session;
  }

  // Handle back to saved list
  if (msg === "back_saved" && session.savedListingsFlow?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Back to saved list");
    await handleSavedListings(sender);
    return session;
  }
  
  // ==========================================
  // 14) TEXT-BASED LISTING INPUT (FALLBACK)
  // ==========================================
  if (session.step === "awaiting_post_details" && text) {
    console.log("📝 [CONTROLLER] Processing text-based listing input");
    await handleTextListingInput(sender, text, session);
    return session;
  }
  
  // ==========================================
  // 15) INTERACTIVE LISTING ACTIONS
  // ==========================================
  if (session.step === "awaiting_listing_action" && replyId) {
    console.log(`🔄 Handling listing action: ${msg}`);
    
    const listingData = session.housingFlow.listingData;
    const currentIndex = session.housingFlow.currentIndex;
    const currentListing = listingData?.listings?.[currentIndex];
    
    if (!currentListing) {
      console.log("❌ Lost track of current listing, resetting to menu");
      await sendMessage(sender, "Sorry, I lost track of the current listing. Please try searching again.");
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    if (msg === "NEXT_LISTING") {
      console.log("⏭️ Next button clicked");
      
      const listingData = session.housingFlow.listingData;
      if (!listingData || !listingData.listings) {
        await sendMessage(sender, "No listings data found. Please search again.");
        session.step = "menu";
        await saveSession(sender, session);
        return session;
      }
      
      const totalListings = listingData.listings.length;
      let currentIndex = session.housingFlow.currentIndex || 0;
      
      currentIndex++;
      
      if (currentIndex >= totalListings) {
        currentIndex = 0;
        await sendMessage(sender, "🔄 You've seen all listings! Starting from the first one again.");
      }
      
      session.housingFlow.currentIndex = currentIndex;
      await saveSession(sender, session);
      
      await handleShowListings(sender, session);
      return session;
    }
    
    if (msg.startsWith("VIEW_DETAILS_")) {
      console.log("📄 View details button clicked");
      await sendMessage(
        sender, 
        `*Full Details for ${currentListing.title || 'Property'}*\n\n` +
        `*Description:*\n${currentListing.description || "No full description provided."}\n\n` +
        `*Contact:* ${currentListing.contact || "N/A"}\n` +
        `*Location:* ${currentListing.location || "N/A"}\n` +
        `*Price:* ${currentListing.price || "Price on request"}`
      );
      await handleShowListings(sender, session); 
      return session;
    }
    
    if (msg.startsWith("SAVE_LISTING_")) {
      console.log("💾 Save button clicked");
      const listingId = msg.replace('SAVE_LISTING_', '');
      
      // Save the listing to user's saved listings
      const result = await saveListingToUser(sender, listingId);
      
      if (result.success) {
        await sendMessage(
          sender, 
          `✅ Listing *${currentListing.title || 'Property'}* has been saved to your favorites! ❤️\n\n` +
          `You can view all your saved listings from the main menu.`
        );
      } else if (result.error === 'Listing already saved') {
        await sendMessage(sender, `⚠️ This listing is already in your saved listings.`);
      } else {
        await sendMessage(sender, `❌ Could not save the listing. Please try again.`);
      }
      
      await handleShowListings(sender, session);
      return session;
    }
    
    await sendMessage(sender, "Action unrecognized. Please select a button from the card.");
    await handleShowListings(sender, session); 
    return session;
  }

  // ===========================
  // 16) MENU COMMAND HANDLING
  // ===========================
  switch (lower) {
    case "view_listings":
      console.log("🏠 Menu: View Listings selected");
      session.step = "awaiting_listing_action"; 
      await saveSession(sender, session);
      await handleShowListings(sender, session); 
      return session;

    case "post_listing":
      console.log("📝 Menu: Post Listing selected");
      // Use WhatsApp Flow for posting
      await handlePostListingFlow(sender);
      return session; // Return early since handlePostListingFlow handles session

    case "manage_listings":
      console.log("⚙️ Menu: Manage Listings selected");
      await handleManageListings(sender);
      return session; // Return early since handleManageListings handles session

    case "saved_listings":
      console.log("❤️ Menu: Saved Listings selected");
      await handleSavedListings(sender);
      return session; // Return early since handleSavedListings handles session

    case "change_language":
      console.log("🌐 Menu: Change Language selected");
      session.housingFlow.awaitingLangSelection = true;
      session.step = "awaiting_language";
      await saveSession(sender, session);
      await sendLanguageListViaService(sender);
      return session;

    case "voice_note":
    case "voice":
    case "speak":
      await sendMessage(
        sender,
        "🎤 *Voice Message Mode*\n\n" +
        "You can now send a voice message in any language!\n\n" +
        "Examples:\n" +
        "• 'I'm looking for a 2BHK in Noida'\n" +
        "• 'I want to rent a house in Delhi'\n" +
        "• 'Show me properties under 50 lakhs'\n\n" +
        "Just tap and hold the microphone button and speak your request!"
      );
      session.step = "awaiting_voice";
      await saveSession(sender, session);
      return session;

    default:
      // Default: show menu
      console.log(`❓ Unknown command: ${lower}, showing menu`);
      await sendMessage(sender, "I didn't understand that. Choose an option or type *hi* to restart.");
      await sendMainMenuViaService(sender);
      session.step = "menu";
      break;
  }

  await saveSession(sender, session);
  return session;
}

// ========================================
module.exports = {
  handleIncomingMessage,
  handleShowListings,
  handleManageListings,
  handleSavedListings,
  handlePostListingFlow, // Export for testing
  handleFlowSubmission, // Export for testing
  handleVoiceMessage, // NEW: Export for testing
  handleVoiceConfirmation // NEW: Export for testing
};