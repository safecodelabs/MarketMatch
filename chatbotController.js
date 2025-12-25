// ========================================
// IMPORTS - UPDATED WITH VOICE SUPPORT & URBAN HELP
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
  searchListingsByCriteria, // NEW: For voice search results
  // ✅ ADDED: Urban Help Functions
  searchUrbanHelp,
  addUrbanHelpProvider,
  getProviderById,
  updateProviderAvailability,
  addUserRequest
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

// ✅ ADDED: Multi-language support for urban help
const multiLanguage = require("./utils/multiLanguage");

// ========================================
// GLOBAL CLIENT HANDLING (NEW)
// ========================================
let globalWhatsAppClient = null;

/**
 * Set the global WhatsApp client
 * @param {Object} client - WhatsApp client instance
 */
function setWhatsAppClient(client) {
  globalWhatsAppClient = client;
  console.log("✅ [CONTROLLER] WhatsApp client set globally");
}

/**
 * Get the effective client (use passed client or global)
 * @param {Object} client - Passed client
 * @returns {Object} Effective client
 */
function getEffectiveClient(client) {
  const effectiveClient = client || globalWhatsAppClient;
  
  if (!effectiveClient) {
    console.error("❌ [CONTROLLER] No WhatsApp client available!");
    console.error("❌ [CONTROLLER] Client passed:", !!client);
    console.error("❌ [CONTROLLER] Global client:", !!globalWhatsAppClient);
  } else {
    console.log("✅ [CONTROLLER] Client available, has sendMessage:", 
                typeof effectiveClient.sendMessage === 'function');
  }
  
  return effectiveClient;
}

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
// URBAN HELP CONFIGURATION
// ========================================
const URBAN_HELP_CATEGORIES = {
  'electrician': { 
    name: 'Electrician',
    emoji: '🔧',
    keywords: ['electrician', 'wiring', 'electrical', 'fuse', 'light', 'switch']
  },
  'plumber': { 
    name: 'Plumber', 
    emoji: '🚰',
    keywords: ['plumber', 'pipe', 'water', 'leak', 'tap', 'bathroom', 'toilet']
  },
  'maid': { 
    name: 'Maid/Househelp', 
    emoji: '🧹',
    keywords: ['maid', 'househelp', 'cleaning', 'cook', 'naukrani', 'housekeeping']
  },
  'carpenter': { 
    name: 'Carpenter', 
    emoji: '🔨',
    keywords: ['carpenter', 'woodwork', 'furniture', 'repair', 'door', 'window']
  },
  'cleaner': { 
    name: 'Cleaner', 
    emoji: '🧼',
    keywords: ['cleaner', 'cleaning', 'deep clean', 'house cleaning']
  },
  'technician': { 
    name: 'Technician', 
    emoji: '🔩',
    keywords: ['technician', 'ac repair', 'appliance repair', 'tv repair']
  },
  'driver': { 
    name: 'Driver', 
    emoji: '🚗',
    keywords: ['driver', 'chauffeur', 'car driver', 'permanent driver']
  },
  'painter': { 
    name: 'Painter', 
    emoji: '🎨',
    keywords: ['painter', 'painting', 'wall', 'color', 'house painting']
  }
};

// ========================================
// VOICE MESSAGE HANDLING FUNCTIONS - UPDATED FOR URBAN HELP
// ========================================

/**
 * Handle incoming voice messages for urban help
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
    
    // Get effective client
    const effectiveClient = getEffectiveClient(client);
    if (!effectiveClient) {
      await sendMessage(sender, "❌ WhatsApp client not available. Please try again.");
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
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
    
    // Process the voice message with urban help intent extraction
    const processingResult = await voiceService.processVoiceMessage(
      { from: sender, id: metadata.id || Date.now().toString() },
      mediaUrl,
      effectiveClient
    );
    
    if (!processingResult.success) {
      await sendMessage(sender, `❌ Error processing voice: ${processingResult.error}\n\nPlease try again or type your request.`);
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    // Check if this is an urban help request
    if (processingResult.intent === 'urban_help_request' || 
        processingResult.entities?.category ||
        isUrbanHelpRequest(processingResult.transcription)) {
      
      await handleUrbanHelpVoiceIntent(sender, session, processingResult, effectiveClient);
      
    } else {
      // Handle existing property-related intents
      await voiceService.handleIntentConfirmation(
        sender,
        session,
        processingResult.transcription,
        processingResult.intent,
        processingResult.confidence,
        effectiveClient
      );
      
      // Store voice processing context in session
      session.voiceContext = {
        originalTranscription: processingResult.transcription,
        intent: processingResult.intent,
        entities: processingResult.entities,
        confidence: processingResult.confidence,
        timestamp: Date.now()
      };
      session.step = "awaiting_voice_confirmation";
    }
    
    await saveSession(sender, session);
    return session;
    
  } catch (error) {
    console.error("🎤 [VOICE] Error handling voice message:", error);
    await sendMessage(sender, "❌ Sorry, I couldn't process your voice message. Please try typing your request.");
    return null;
  }
}

/**
 * Check if transcription is an urban help request
 */
function isUrbanHelpRequest(transcription) {
  const lowerText = transcription.toLowerCase();
  
  // Check for urban help keywords
  const urbanHelpKeywords = [
    'electrician', 'plumber', 'maid', 'carpenter', 'cleaner', 
    'technician', 'driver', 'painter', 'naukrani', 'househelp',
    'service', 'repair', 'chahiye', 'required', 'needed'
  ];
  
  return urbanHelpKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Handle urban help voice intent
 */
async function handleUrbanHelpVoiceIntent(sender, session, processingResult, client) {
  const { transcription, entities, confidence } = processingResult;
  
  // Get user language
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  
  // Check for missing information
  const missingInfo = checkMissingUrbanHelpInfo(entities);
  
  if (missingInfo.length > 0) {
    // Ask for missing information
    await askForMissingUrbanHelpInfo(sender, entities, missingInfo, userLang, client);
    
    session.urbanHelpContext = {
      transcription: transcription,
      entities: entities,
      missingInfo: missingInfo,
      step: "awaiting_missing_info"
    };
    session.step = "awaiting_urban_help_info";
    
  } else if (confidence < 0.7) {
    // Low confidence - ask for clarification
    await sendMessage(sender, 
      multiLanguage.getMessage(userLang, 'not_understood') + 
      `\n\nI heard: "*${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}*"`,
      client
    );
    
    await sendInteractiveButtons(
      client,
      sender,
      "Is this what you need?",
      [
        { id: `confirm_urban_help_${entities.category || 'general'}`, text: '✅ Yes, correct' },
        { id: 'try_again_urban', text: '🔄 Try again' },
        { id: 'type_instead', text: '📝 Type instead' }
      ]
    );
    
    session.urbanHelpContext = {
      transcription: transcription,
      entities: entities,
      step: "awaiting_clarification"
    };
    session.step = "awaiting_urban_help_clarification";
    
  } else {
    // Good confidence - show confirmation
    await sendUrbanHelpConfirmation(sender, transcription, entities, userLang, client);
    
    session.urbanHelpContext = {
      transcription: transcription,
      entities: entities,
      step: "awaiting_confirmation"
    };
    session.step = "awaiting_urban_help_confirmation";
  }
}

/**
 * Check for missing urban help information
 */
function checkMissingUrbanHelpInfo(entities) {
  const missing = [];
  
  // Category is always required
  if (!entities.category) {
    missing.push('category');
  }
  
  // Location is required for all services
  if (!entities.location) {
    missing.push('location');
  }
  
  return missing;
}

/**
 * Ask for missing urban help information
 */
async function askForMissingUrbanHelpInfo(sender, entities, missingInfo, userLang, client) {
  let message = '';
  let buttons = [];
  
  if (missingInfo.includes('category')) {
    message = multiLanguage.getMessage(userLang, 'ask_category') || 
             "What type of service do you need?";
    
    // Show top 4 categories as buttons
    const topCategories = ['electrician', 'plumber', 'maid', 'cleaner'];
    buttons = topCategories.map(category => ({
      id: `category_${category}`,
      text: `${URBAN_HELP_CATEGORIES[category].emoji} ${URBAN_HELP_CATEGORIES[category].name}`
    }));
    
    buttons.push({ id: 'other_category', text: 'Other Service' });
    
  } else if (missingInfo.includes('location')) {
    const categoryName = URBAN_HELP_CATEGORIES[entities.category]?.name || 'service';
    message = multiLanguage.getMessage(userLang, 'ask_location', { category: categoryName }) ||
             `Where do you need the ${categoryName}?`;
    
    buttons = [
      { id: 'location_noida', text: '📍 Noida' },
      { id: 'location_gurgaon', text: '📍 Gurgaon' },
      { id: 'location_delhi', text: '📍 Delhi' },
      { id: 'type_location', text: '📝 Type location' }
    ];
  }
  
  await sendInteractiveButtons(client, sender, message, buttons);
}

/**
 * Send urban help confirmation
 */
async function sendUrbanHelpConfirmation(sender, transcription, entities, userLang, client) {
  const category = entities.category || 'service';
  const categoryName = URBAN_HELP_CATEGORIES[category]?.name || 'Service';
  const location = entities.location || 'your area';
  
  let confirmationText = '';
  
  if (userLang === 'hi') {
    confirmationText = `मैंने समझा: "*${transcription}"*\n\n` +
                      `आपको *${location}* में *${categoryName}* चाहिए।\n\n` +
                      `क्या यह सही है?`;
  } else if (userLang === 'ta') {
    confirmationText = `நான் புரிந்து கொண்டேன்: "*${transcription}"*\n\n` +
                      `உங்களுக்கு *${location}*-ல் *${categoryName}* தேவை.\n\n` +
                      `இது சரியானதா?`;
  } else {
    confirmationText = `I understood: "*${transcription}"*\n\n` +
                      `You need a *${categoryName}* in *${location}*.\n\n` +
                      `Is this correct?`;
  }
  
  const buttons = [
    { id: `confirm_urban_${category}`, text: '✅ Yes, find service' },
    { id: 'try_again_urban', text: '🔄 Try again' },
    { id: 'modify_details', text: '✏️ Modify details' }
  ];
  
  await sendInteractiveButtons(client, sender, confirmationText, buttons);
}

/**
 * Handle urban help confirmation response
 */
async function handleUrbanHelpConfirmation(sender, response, session, client) {
  const urbanContext = session.urbanHelpContext;
  
  if (!urbanContext) {
    await sendMessage(sender, "❌ Session expired. Please start over.");
    session.step = "menu";
    await saveSession(sender, session);
    return session;
  }
  
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  
  if (response.startsWith('confirm_urban_')) {
    // User confirmed - search for service providers
    await sendMessage(sender, 
      multiLanguage.getMessage(userLang, 'searching', {
        category: URBAN_HELP_CATEGORIES[urbanContext.entities.category]?.name || 'Service',
        location: urbanContext.entities.location || 'your area'
      }) || `🔍 Searching for ${urbanContext.entities.category} in ${urbanContext.entities.location}...`,
      client
    );
    
    await executeUrbanHelpSearch(sender, urbanContext.entities, session, client, userLang);
    
  } else if (response === 'try_again_urban') {
    await sendMessage(sender, "🔄 Please send your request again.");
    delete session.urbanHelpContext;
    session.step = "awaiting_voice";
    
  } else if (response === 'modify_details') {
    await sendMessage(sender, "✏️ What would you like to change? Please send your updated request.");
    delete session.urbanHelpContext;
    session.step = "awaiting_urban_help_text";
    
  } else if (response.startsWith('category_')) {
    // User selected a category
    const category = response.replace('category_', '');
    urbanContext.entities.category = category;
    
    // Check if location is still missing
    if (!urbanContext.entities.location) {
      await askForMissingUrbanHelpInfo(sender, urbanContext.entities, ['location'], userLang, client);
      session.step = "awaiting_urban_help_info";
    } else {
      // We have both category and location, show confirmation
      await sendUrbanHelpConfirmation(sender, urbanContext.transcription, urbanContext.entities, userLang, client);
      session.step = "awaiting_urban_help_confirmation";
    }
    
    await saveSession(sender, session);
    
  } else if (response.startsWith('location_')) {
    // User selected a location
    const location = response.replace('location_', '');
    urbanContext.entities.location = location.charAt(0).toUpperCase() + location.slice(1);
    
    // Show confirmation with both category and location
    await sendUrbanHelpConfirmation(sender, urbanContext.transcription, urbanContext.entities, userLang, client);
    session.step = "awaiting_urban_help_confirmation";
    await saveSession(sender, session);
  }
  
  return session;
}

/**
 * Execute urban help search
 */
async function executeUrbanHelpSearch(sender, entities, session, client, userLang) {
  try {
    const { category, location } = entities;
    
    // Search for service providers
    const results = await searchUrbanHelp(category, location, {
      immediate: entities.timing === 'immediate',
      minRating: 4.0
    });
    
    if (results && results.length > 0) {
      // Format and send results
      const resultsMessage = formatUrbanHelpResults(results, userLang);
      await sendMessage(sender, resultsMessage, client);
      
      // Add to user requests
      await addUserRequest(sender, {
        category: category,
        location: location,
        status: 'matched',
        matchedProviders: results.map(r => r.id).slice(0, 3),
        timestamp: Date.now()
      });
      
    } else {
      // No results found
      const noResultsMessage = multiLanguage.getMessage(userLang, 'no_results_found', {
        category: URBAN_HELP_CATEGORIES[category]?.name || 'Service',
        location: location
      }) || `Sorry, no ${category} found in ${location}. I'll notify you when one becomes available.`;
      
      await sendMessage(sender, noResultsMessage, client);
      
      // Add to user requests as pending
      await addUserRequest(sender, {
        category: category,
        location: location,
        status: 'pending',
        timestamp: Date.now()
      });
    }
    
    // Send follow-up
    const followUpText = "\n\nNeed another service? Send another voice message or type 'help'.";
    await sendMessage(sender, followUpText, client);
    
    // Clear context and return to menu
    delete session.urbanHelpContext;
    session.step = "menu";
    await saveSession(sender, session);
    
  } catch (error) {
    console.error("Error in urban help search:", error);
    const errorMessage = multiLanguage.getMessage(userLang, 'search_error') ||
                         "Sorry, I encountered an error while searching. Please try again.";
    await sendMessage(sender, errorMessage, client);
    
    delete session.urbanHelpContext;
    session.step = "menu";
    await saveSession(sender, session);
  }
}

/**
 * Format urban help results
 */
function formatUrbanHelpResults(results, userLang) {
  const category = results[0]?.category || 'service';
  const categoryName = URBAN_HELP_CATEGORIES[category]?.name || 'Service';
  
  let message = `✅ ${multiLanguage.getMessage(userLang, 'results_found', {
    count: results.length,
    category: categoryName,
    location: results[0]?.location || 'area'
  }) || `Found ${results.length} ${categoryName}(s):`}\n\n`;
  
  results.slice(0, 5).forEach((provider, index) => {
    message += `*${index + 1}. ${provider.name || 'Service Provider'}*\n`;
    
    if (provider.rating) {
      message += `   ⭐ ${provider.rating}/5\n`;
    }
    
    if (provider.experience) {
      message += `   📅 ${provider.experience} experience\n`;
    }
    
    if (provider.contact) {
      message += `   📞 ${provider.contact}\n`;
    }
    
    if (provider.availability) {
      message += `   🕒 ${provider.availability}\n`;
    }
    
    if (provider.rate) {
      message += `   💰 ${provider.rate}\n`;
    }
    
    message += '\n';
  });
  
  if (results.length > 5) {
    message += `... and ${results.length - 5} more ${categoryName}(s) available.\n`;
  }
  
  return message;
}

// ========================================
// EXISTING VOICE HANDLING FUNCTIONS (KEPT AS IS)
// ========================================

/**
 * Handle voice intent confirmation responses
 * @param {String} sender - User phone number
 * @param {String} response - User's response (button click)
 * @param {Object} session - Current session
 * @param {Object} client - WhatsApp client
 * @returns {Promise<Object>} Updated session
 */
async function handleVoiceConfirmation(sender, response, session, client) {
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
    
    // Get effective client
    const effectiveClient = getEffectiveClient(client);
    if (!effectiveClient) {
      await sendMessage(sender, "❌ WhatsApp client not available. Please try again.");
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    if (response.startsWith("confirm_")) {
      // User confirmed - proceed with the intent
      const confirmedIntent = response.replace("confirm_", "");
      
      if (confirmedIntent === intent) {
        await sendMessage(sender, `✅ Got it! Processing: "${originalTranscription}"`);
        await executeVoiceIntent(sender, intent, entities, session, effectiveClient);
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
        effectiveClient, // client
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
 * @param {Object} client - WhatsApp client
 */
async function executeVoiceIntent(sender, intent, entities, session, client) {
  console.log("🎤 [VOICE] Executing intent:", intent, "with entities:", entities);
  
  switch (intent) {
    case "buy_property":
    case "rent_property":
    case "search_listing":
      await handleVoiceSearch(sender, intent, entities, session, client);
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
 * @param {Object} client - WhatsApp client
 */
async function handleVoiceSearch(sender, intent, entities, session, client) {
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
    
    // Get effective client
    const effectiveClient = getEffectiveClient(client);
    if (!effectiveClient) {
      await sendMessage(sender, "❌ WhatsApp client not available.");
      return;
    }
    
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
async function handleVoiceSearchOptions(sender, msg, session, client) {
  const effectiveClient = getEffectiveClient(client);
  
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
// UPDATED MENU ROWS WITH URBAN HELP
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
    title: "🏠 View Listings", 
    description: "Browse available homes, apartments, or properties for rent or sale." 
  },
  { 
    id: "post_listing", 
    title: "📝 Post Listing", 
    description: "Publish your home or property to attract potential buyers or renters." 
  },
  { 
    id: "manage_listings", 
    title: "⚙️ Manage Listings", 
    description: "Edit, update, or remove your property listings." 
  },
  { 
    id: "saved_listings", 
    title: "❤️ Saved Listings", 
    description: "View and manage properties you've saved for later." 
  },
  { 
    id: "urban_help", 
    title: "🔧 Urban Help Services", 
    description: "Find electricians, plumbers, maids, carpenters & other services." 
  },
  { 
    id: "change_language", 
    title: "🌐 Change Language", 
    description: "Switch the app's interface to your preferred language." 
  },
];

// ========================================
// URBAN HELP TEXT HANDLER
// ========================================
async function handleUrbanHelpTextRequest(sender, text, session, client) {
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  
  // Extract category and location from text
  const extractedInfo = extractUrbanHelpFromText(text);
  
  if (!extractedInfo.category) {
    // Ask for category
    await sendInteractiveButtons(
      client,
      sender,
      "What type of service do you need?",
      Object.entries(URBAN_HELP_CATEGORIES).slice(0, 4).map(([id, data]) => ({
        id: `text_category_${id}`,
        text: `${data.emoji} ${data.name}`
      }))
    );
    
    session.urbanHelpContext = {
      text: text,
      step: "awaiting_category"
    };
    session.step = "awaiting_urban_help_category";
    
  } else if (!extractedInfo.location) {
    // Ask for location
    await sendMessage(sender, 
      `Where do you need the ${URBAN_HELP_CATEGORIES[extractedInfo.category]?.name || 'service'}?`,
      client
    );
    
    session.urbanHelpContext = {
      ...extractedInfo,
      step: "awaiting_location"
    };
    session.step = "awaiting_urban_help_location";
    
  } else {
    // We have both, show confirmation
    await sendUrbanHelpConfirmation(sender, text, extractedInfo, userLang, client);
    
    session.urbanHelpContext = {
      ...extractedInfo,
      text: text,
      step: "awaiting_confirmation"
    };
    session.step = "awaiting_urban_help_confirmation";
  }
  
  await saveSession(sender, session);
}

/**
 * Extract urban help info from text
 */
function extractUrbanHelpFromText(text) {
  const lowerText = text.toLowerCase();
  const result = {
    category: null,
    location: null,
    timing: null
  };
  
  // Extract category
  for (const [category, data] of Object.entries(URBAN_HELP_CATEGORIES)) {
    if (data.keywords.some(keyword => lowerText.includes(keyword))) {
      result.category = category;
      break;
    }
  }
  
  // Extract location
  const locations = ['noida', 'gurgaon', 'delhi', 'gurugram', 'greater noida', 'ghaziabad', 'faridabad'];
  for (const location of locations) {
    if (lowerText.includes(location)) {
      result.location = location.charAt(0).toUpperCase() + location.slice(1);
      break;
    }
  }
  
  // Extract timing
  if (lowerText.includes('now') || lowerText.includes('immediate') || lowerText.includes('urgent')) {
    result.timing = 'immediate';
  } else if (lowerText.includes('tomorrow') || lowerText.includes('next week')) {
    result.timing = 'future';
  }
  
  return result;
}

// ========================================
// UPDATED MAIN CONTROLLER - WITH URBAN HELP SUPPORT AND VOICE CONFIRMATION FLOW
// ========================================
async function handleIncomingMessage(sender, text = "", metadata = {}, client = null) {
  console.log("🔍 [CONTROLLER DEBUG] === START handleIncomingMessage ===");
  console.log("🔍 [CONTROLLER DEBUG] Input - sender:", sender);
  console.log("🔍 [CONTROLLER DEBUG] Input - text:", text);
  console.log("🔍 [CONTROLLER DEBUG] Input - metadata type:", metadata?.type);
  
  // Get effective client (use passed client or global)
  const effectiveClient = getEffectiveClient(client);
  if (!effectiveClient) {
    console.error("❌ [CONTROLLER] No WhatsApp client available to process message!");
    return;
  }
  
  console.log("🔍 [CONTROLLER DEBUG] Effective client available:", !!effectiveClient);
  
  if (!sender) return;

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

  // ===========================
  // 0) PRIORITY: CHECK FOR VOICE MESSAGES - UPDATED WITH SIMPLE CONFIRMATION FLOW AND ACCESS TOKEN ERROR HANDLING
  // ===========================
  if (metadata?.type === "audio" || metadata?.type === "voice" || text === 'voice_note') {
    console.log("🎤 [VOICE] Audio message detected");
    
    // Get session
    let session = (await getSession(sender)) || { 
      step: "start",
      isInitialized: false,
      awaitingLang: false,
      state: 'initial'
    };
    
    // Check if we have audio URL from metadata
    const audioUrl = metadata.audio?.url || metadata.url || metadata.audioMetadata?.url || metadata.voice?.url;
    
    if (!audioUrl) {
      console.error("🎤 [VOICE] No audio URL found");
      await sendMessage(sender, "❌ Could not access the voice message. Please try sending it again.");
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      return session;
    }
    
    console.log("🎤 [VOICE] Processing audio URL:", audioUrl.substring(0, 100) + "...");
    
    // Send processing message
    await sendMessage(sender, "🎤 Processing your voice message...");
    
    try {
      // 1. Process voice for transcription ONLY
      const voiceResult = await voiceService.processVoiceMessage(
        { 
          from: sender, 
          id: metadata.id || Date.now().toString(),
          body: audioUrl
        },
        audioUrl,
        effectiveClient
      );
      
      if (!voiceResult.success) {
        // Check if it's an access token error
        if (voiceResult.error && voiceResult.error.includes('access token')) {
          await sendMessage(sender, 
            "❌ Voice processing is temporarily unavailable. Please type your request instead."
          );
        } else {
          await sendMessage(sender, 
            voiceResult.error || "Could not process voice message. Please try again or type your request."
          );
        }
        session.step = "menu";
        session.state = 'initial';
        await saveSession(sender, session);
        return session;
      }
      
      // 2. Store transcription in session
      session.rawTranscription = voiceResult.transcription;
      session.state = 'awaiting_confirmation';
      session.step = 'awaiting_confirmation';
      session.timestamp = Date.now();
      await saveSession(sender, session);
      
      // 3. Send confirmation message with EXACT transcription
      const userLang = multiLanguage.getUserLanguage(sender) || 'en';
      
      let confirmationMessage = '';
      if (userLang === 'hi') {
        confirmationMessage = `🎤 मैंने सुना: "*${voiceResult.transcription}"*\n\nक्या यह सही है?`;
      } else if (userLang === 'ta') {
        confirmationMessage = `🎤 நான் கேட்டேன்: "*${voiceResult.transcription}"*\n\nஇது சரியானதா?`;
      } else {
        confirmationMessage = `🎤 I heard: "*${voiceResult.transcription}"*\n\nIs this correct?`;
      }
      
      // Send with interactive buttons
      await sendInteractiveButtons(
        effectiveClient,
        sender,
        confirmationMessage,
        [
          { id: 'confirm_yes', text: '✅ Yes' },
          { id: 'try_again', text: '🔄 No' },
          { id: 'type_instead', text: '📝 Type' }
        ]
      );
      
      await saveSession(sender, session);
      return session;
      
    } catch (error) {
      console.error("🎤 [VOICE] Error processing voice:", error);
      
      // Provide helpful error message
      let errorMessage = "❌ Sorry, I couldn't process your voice. ";
      
      if (error.message.includes('access token') || error.message.includes('WHATSAPP_ACCESS_TOKEN')) {
        errorMessage += "Voice processing is temporarily unavailable. ";
      }
      
      errorMessage += "Please type your request.";
      
      await sendMessage(sender, errorMessage);
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      return session;
    }
  }

  // Get session
  let session = (await getSession(sender)) || { 
    step: "start",
    state: 'initial',
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
  console.log("🔍 [CONTROLLER DEBUG] Session state:", session.state);

  // ===========================
  // ✅ ADDED: CHECK FOR VOICE CONFIRMATION BUTTON CLICKS
  // ===========================
  if (replyId && (replyId.startsWith('confirm_') || replyId.startsWith('try_again') || replyId.startsWith('type_instead'))) {
    console.log(`🎤 [VOICE BUTTON] Detected voice confirmation button: ${replyId}`);
    
    // Get the user language
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';
    
    // Handle the button click based on session state
    if (session.state === 'awaiting_confirmation' || session.step === 'awaiting_confirmation') {
      console.log(`🎤 [VOICE BUTTON] Processing confirmation for session state: ${session.state}`);
      
      // Map button IDs to actions
      let action = '';
      if (replyId.includes('confirm_') || replyId === 'confirm_yes') {
        action = 'confirm_yes';
      } else if (replyId.includes('try_again') || replyId === 'try_again') {
        action = 'try_again';
      } else if (replyId.includes('type_instead') || replyId === 'type_instead') {
        action = 'type_instead';
      }
      
      // Process the action
      switch(action) {
        case 'confirm_yes':
          // User confirmed transcription is correct
          const confirmedText = session.rawTranscription;
          
          if (!confirmedText) {
            await sendMessage(sender, "❌ No transcription found. Please try again.");
            session.state = 'initial';
            session.step = 'menu';
            await saveSession(sender, session);
            await sendMainMenuViaService(sender);
            return session;
          }
          
          await sendMessage(sender, `✅ Perfect! You said: *"${confirmedText}"*\n\nLet me help you with that...`);
          
          // Check if it's an urban help request
          if (isUrbanHelpRequest(confirmedText)) {
            // Extract urban help info
            const extractedInfo = extractUrbanHelpFromText(confirmedText);
            
            if (extractedInfo.category && extractedInfo.location) {
              // We have both category and location, search immediately
              await executeUrbanHelpSearch(sender, extractedInfo, session, effectiveClient, userLang);
            } else {
              // Need more info
              await handleUrbanHelpTextRequest(sender, confirmedText, session, effectiveClient);
            }
          } else {
            // Process property-related intent
            await voiceService.extractIntentAfterConfirmation(sender, confirmedText, session, effectiveClient);
          }
          
          // Reset session
          session.state = 'initial';
          delete session.rawTranscription;
          session.step = 'menu';
          await saveSession(sender, session);
          break;
          
        case 'try_again':
          // User wants to try again
          await sendMessage(sender, "🔄 No problem! Please send your voice message again.");
          session.state = 'initial';
          session.step = 'menu';
          delete session.rawTranscription;
          await saveSession(sender, session);
          break;
          
        case 'type_instead':
          // User wants to type
          await sendMessage(sender, "📝 Please type what you're looking for:");
          session.state = 'awaiting_text_input';
          session.step = 'awaiting_text_input';
          delete session.rawTranscription;
          await saveSession(sender, session);
          break;
      }
      
      await saveSession(sender, session);
      return session;
    }
  }

  // ===========================
  // ✅ ADDED: ALSO CHECK FOR TEXT RESPONSES TO VOICE CONFIRMATION
  // ===========================
  if (text && (session.state === 'awaiting_confirmation' || session.step === 'awaiting_confirmation')) {
    console.log(`🎤 [VOICE TEXT] Processing text response to voice confirmation: "${text}"`);
    
    const lowerText = text.toLowerCase().trim();
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';
    
    if (lowerText.includes('yes') || lowerText.includes('y') || lowerText.includes('correct') || 
        lowerText.includes('✅') || lowerText.includes('हां') || lowerText.includes('ஆம்')) {
      // User confirmed transcription is correct
      const confirmedText = session.rawTranscription;
      
      if (!confirmedText) {
        await sendMessage(sender, "❌ No transcription found. Please try again.");
        session.state = 'initial';
        session.step = 'menu';
        await saveSession(sender, session);
        await sendMainMenuViaService(sender);
        return session;
      }
      
      await sendMessage(sender, `✅ Perfect! You said: *"${confirmedText}"*\n\nLet me help you with that...`);
      
      // Check if it's an urban help request
      if (isUrbanHelpRequest(confirmedText)) {
        // Extract urban help info
        const extractedInfo = extractUrbanHelpFromText(confirmedText);
        
        if (extractedInfo.category && extractedInfo.location) {
          // We have both category and location, search immediately
          await executeUrbanHelpSearch(sender, extractedInfo, session, effectiveClient, userLang);
        } else {
          // Need more info
          await handleUrbanHelpTextRequest(sender, confirmedText, session, effectiveClient);
        }
      } else {
        // Process property-related intent
        await voiceService.extractIntentAfterConfirmation(sender, confirmedText, session, effectiveClient);
      }
      
      // Reset session
      session.state = 'initial';
      delete session.rawTranscription;
      session.step = 'menu';
      await saveSession(sender, session);
      
    } else if (lowerText.includes('no') || lowerText.includes('n') || lowerText.includes('try again') || 
               lowerText.includes('🔄') || lowerText.includes('नहीं') || lowerText.includes('இல்லை')) {
      // User wants to try again
      await sendMessage(sender, "🔄 No problem! Please send your voice message again.");
      session.state = 'initial';
      session.step = 'menu';
      delete session.rawTranscription;
      await saveSession(sender, session);
      
    } else if (lowerText.includes('type') || lowerText.includes('📝') || 
               lowerText.includes('टाइप') || lowerText.includes('தட்டச்சு')) {
      // User wants to type
      await sendMessage(sender, "📝 Please type what you're looking for:");
      session.state = 'awaiting_text_input';
      session.step = 'awaiting_text_input';
      delete session.rawTranscription;
      await saveSession(sender, session);
      
    } else {
      // Unexpected response - remind user of options
      let errorMessage = '';
      if (userLang === 'hi') {
        errorMessage = "कृपया जवाब दें:\n✅ *हां* - अगर सही है\n🔄 *नहीं* - फिर से कोशिश करें\n📝 *टाइप करें* - टाइप करके भेजें";
      } else if (userLang === 'ta') {
        errorMessage = "தயவு செய்து பதிலளிக்கவும்:\n✅ *ஆம்* - சரியானது என்றால்\n🔄 *இல்லை* - மீண்டும் முயற்சிக்கவும்\n📝 *தட்டச்சு செய்யவும்* - தட்டச்சு செய்து அனுப்பவும்";
      } else {
        errorMessage = "Please reply with:\n✅ *Yes* - if I heard correctly\n🔄 *No* - to try again\n📝 *Type* - to type instead";
      }
      
      await sendMessage(sender, errorMessage);
    }
    
    await saveSession(sender, session);
    return session;
  }

  // ===========================
  // 1) PRIORITY: CHECK FLOW SUBMISSION
  // ===========================
  const flowHandled = await handleFlowSubmission(metadata, sender);
  if (flowHandled) {
    const session = await getSession(sender);
    return session;
  }

  // ===========================
  // 2) CHECK FOR URBAN HELP CONFIRMATION RESPONSES
  // ===========================
  if (session.step.startsWith("awaiting_urban_help_") && replyId) {
    console.log("🔧 [URBAN HELP] Processing response:", msg);
    return await handleUrbanHelpConfirmation(sender, msg, session, effectiveClient);
  }

  // ===========================
  // 3) CHECK FOR VOICE CONFIRMATION RESPONSES (OLD FLOW)
  // ===========================
  if (session.step === "awaiting_voice_confirmation" && replyId) {
    console.log("🎤 [VOICE] Processing confirmation response");
    return await handleVoiceConfirmation(sender, msg, session, effectiveClient);
  }

  // ===========================
  // 4) CHECK FOR VOICE SEARCH OPTIONS
  // ===========================
  if (msg.startsWith("voice_")) {
    return await handleVoiceSearchOptions(sender, msg, session, effectiveClient);
  }

  const user = await getUserProfile(sender);
  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(lower);
  const isNewUser = !user && !session.isInitialized;

  // ===========================
  // 5) NEW USER INTRO
  // ===========================
  if (isGreeting && isNewUser) {
    await sendMessage(
      sender,
      "👋 *Welcome to MarketMatch AI!* \n\nI'm your personal assistant for:\n🏠 Rentals & Real Estate\n🔧 Urban Help Services\n👤 PG / Flatmates\n\nLet's begin by choosing your preferred language."
    );

    await sendLanguageListViaService(sender);

    session.isInitialized = true;
    session.housingFlow.awaitingLangSelection = true;
    session.step = "awaiting_language";
    await saveSession(sender, session);
    return session;
  }

  // ===========================
  // 6) EXISTING USER GREETING
  // ===========================
  if (isGreeting && !isNewUser) {
    session.housingFlow.listingData = null;
    session.housingFlow.currentIndex = 0;
    session.step = "menu";
    session.state = 'initial';
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
    return session;
  }

  // ===========================
  // 7) LANGUAGE SELECTION
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
      session.state = 'initial';
      await saveSession(sender, session);

      await sendMainMenuViaService(sender);
      return session;
    } else {
      await sendMessage(sender, "Please select a language 👇");
      await sendLanguageListViaService(sender);
      return session;
    }
  }
  
  // ===========================
  // 8) URBAN HELP TEXT INPUT
  // ===========================
  if (session.step === "awaiting_urban_help_text" && text) {
    console.log("🔧 [URBAN HELP] Processing text input:", text);
    await handleUrbanHelpTextRequest(sender, text, session, effectiveClient);
    return session;
  }
  
  // ===========================
  // 9) TEXT INPUT AFTER VOICE CONFIRMATION
  // ===========================
  if (session.state === 'awaiting_text_input' && text) {
    console.log("📝 [TEXT INPUT] Processing text after voice fallback:", text);
    
    // Check if it's an urban help request
    if (isUrbanHelpRequest(text)) {
      await handleUrbanHelpTextRequest(sender, text, session, effectiveClient);
    } else {
      // Process as property-related request
      await sendMessage(sender, `🔍 Processing your request: *"${text}"*`);
      
      // Try to extract intent from text
      const processingResult = {
        transcription: text,
        intent: null,
        entities: {},
        confidence: 1.0
      };
      
      // Check for property keywords
      if (text.toLowerCase().includes('buy') || text.toLowerCase().includes('purchase') || text.toLowerCase().includes('sale')) {
        processingResult.intent = 'buy_property';
      } else if (text.toLowerCase().includes('rent') || text.toLowerCase().includes('lease')) {
        processingResult.intent = 'rent_property';
      } else if (text.toLowerCase().includes('post') || text.toLowerCase().includes('list') || text.toLowerCase().includes('sell')) {
        processingResult.intent = 'post_listing';
      } else if (text.toLowerCase().includes('view') || text.toLowerCase().includes('see') || text.toLowerCase().includes('browse')) {
        processingResult.intent = 'view_listing';
      }
      
      if (processingResult.intent) {
        await sendMessage(sender, `✅ I understand you want to ${processingResult.intent.replace('_', ' ')}.`);
        await executeVoiceIntent(sender, processingResult.intent, processingResult.entities, session, effectiveClient);
      } else {
        await sendMessage(sender, "🤔 I'm not sure what you're looking for. Please use the menu options below.");
        await sendMainMenuViaService(sender);
      }
    }
    
    // Reset session
    session.state = 'initial';
    session.step = 'menu';
    await saveSession(sender, session);
    return session;
  }
  
  // ===========================
  // 10) URBAN HELP CATEGORY SELECTION
  // ===========================
  if (msg.startsWith("text_category_") && session.step === "awaiting_urban_help_category") {
    const category = msg.replace("text_category_", "");
    const urbanContext = session.urbanHelpContext || {};
    
    urbanContext.category = category;
    urbanContext.step = "awaiting_location";
    
    await sendMessage(sender, 
      `Where do you need the ${URBAN_HELP_CATEGORIES[category]?.name || 'service'}?`,
      effectiveClient
    );
    
    session.urbanHelpContext = urbanContext;
    session.step = "awaiting_urban_help_location";
    await saveSession(sender, session);
    return session;
  }
  
  // ===========================
  // 11) URBAN HELP LOCATION INPUT
  // ===========================
  if (session.step === "awaiting_urban_help_location" && text) {
    const urbanContext = session.urbanHelpContext || {};
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';
    
    urbanContext.location = text;
    urbanContext.step = "awaiting_confirmation";
    
    await sendUrbanHelpConfirmation(sender, urbanContext.text || text, urbanContext, userLang, effectiveClient);
    
    session.urbanHelpContext = urbanContext;
    session.step = "awaiting_urban_help_confirmation";
    await saveSession(sender, session);
    return session;
  }
  
  // ==========================================
  // 12) MANAGE LISTINGS INTERACTIVE HANDLING
  // ==========================================
  
  // Handle listing selection from manage listings
  if (msg.startsWith("listing_") && (session.step === "managing_listings" || session.manageListings)) {
    console.log("🔍 [CONTROLLER] Listing selected for management:", msg);
    await handleListingSelection(sender, msg, session);
    return session;
  }
  
  // ==========================================
  // 13) DELETE FLOW HANDLING
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
  // 14) EDIT FLOW HANDLING
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
  // 15) EDIT FIELD SELECTION HANDLING
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
  // 16) EDIT FIELD VALUE INPUT (TEXT-BASED)
  // ==========================================
  if (session.editFlow?.step === "awaiting_field_value" && text) {
    console.log("🔍 [CONTROLLER] Field value received:", text);
    await updateFieldValue(sender, text, session);
    return session;
  }
  
  // ==========================================
  // 17) CANCEL MANAGE (Back button)
  // ==========================================
  if (msg === "cancel_manage" && session.manageListings?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Back to listing list");
    await handleManageListings(sender);
    return session;
  }
  
  // ==========================================
  // 18) SAVED LISTINGS INTERACTIVE HANDLING
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
  // 19) TEXT-BASED LISTING INPUT (FALLBACK)
  // ==========================================
  if (session.step === "awaiting_post_details" && text) {
    console.log("📝 [CONTROLLER] Processing text-based listing input");
    await handleTextListingInput(sender, text, session);
    return session;
  }
  
  // ==========================================
  // 20) INTERACTIVE LISTING ACTIONS
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
      session.state = 'initial';
      await saveSession(sender, session);
      return session;
    }
    
    if (msg === "NEXT_LISTING") {
      console.log("⏭️ Next button clicked");
      
      const listingData = session.housingFlow.listingData;
      if (!listingData || !listingData.listings) {
        await sendMessage(sender, "No listings data found. Please search again.");
        session.step = "menu";
        session.state = 'initial';
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
  // 21) MENU COMMAND HANDLING
  // ===========================
  switch (lower) {
    case "view_listings":
      console.log("🏠 Menu: View Listings selected");
      session.step = "awaiting_listing_action"; 
      session.state = 'initial';
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

    case "urban_help":
    case "services":
    case "help":
    case "service":
      console.log("🔧 Menu: Urban Help selected");
      await handleUrbanHelpMenu(sender, session, effectiveClient);
      return session;

    case "change_language":
      console.log("🌐 Menu: Change Language selected");
      session.housingFlow.awaitingLangSelection = true;
      session.step = "awaiting_language";
      session.state = 'initial';
      await saveSession(sender, session);
      await sendLanguageListViaService(sender);
      return session;

    case "voice_note":
    case "voice":
    case "speak":
      console.log("🎤 Menu: Voice note command received");
      
      // Check if we have audio metadata (coming from webhook with voice message)
      if (metadata?.audioMetadata?.url) {
        console.log("🎤 Found audio metadata, processing voice message...");
        
        const audioUrl = metadata.audioMetadata.url;
        await sendMessage(sender, "🎤 Processing your voice message...");
        
        try {
          const processingResult = await voiceService.processVoiceMessage(
            { 
              from: sender, 
              id: metadata.id || Date.now().toString(),
              body: audioUrl
            },
            audioUrl,
            effectiveClient
          );
          
          if (processingResult.success) {
            // Store transcription in session for confirmation
            session.rawTranscription = processingResult.transcription;
            session.state = 'awaiting_confirmation';
            session.step = 'awaiting_confirmation';
            session.timestamp = Date.now();
            await saveSession(sender, session);
            
            // Send confirmation with EXACT transcription
            const userLang = multiLanguage.getUserLanguage(sender) || 'en';
            
            let confirmationMessage = '';
            if (userLang === 'hi') {
              confirmationMessage = `🎤 मैंने सुना: "*${processingResult.transcription}"*\n\nक्या यह सही है?`;
            } else if (userLang === 'ta') {
              confirmationMessage = `🎤 நான் கேட்டேன்: "*${processingResult.transcription}"*\n\nஇது சரியானதா?`;
            } else {
              confirmationMessage = `🎤 I heard: "*${processingResult.transcription}"*\n\nIs this correct?`;
            }
            
            // Send with interactive buttons
            await sendInteractiveButtons(
              effectiveClient,
              sender,
              confirmationMessage,
              [
                { id: 'confirm_yes', text: '✅ Yes' },
                { id: 'try_again', text: '🔄 No' },
                { id: 'type_instead', text: '📝 Type' }
              ]
            );
            
          } else {
            // Check if it's an access token error
            if (processingResult.error && processingResult.error.includes('access token')) {
              await sendMessage(sender, 
                "❌ Voice processing is temporarily unavailable. Please type your request instead."
              );
            } else {
              await sendMessage(sender, `❌ ${processingResult.error}`);
            }
            session.step = "menu";
            session.state = 'initial';
            await saveSession(sender, session);
          }
        } catch (error) {
          console.error("🎤 Voice processing error:", error);
          
          // Provide helpful error message
          let errorMessage = "❌ Couldn't process voice. ";
          
          if (error.message.includes('access token') || error.message.includes('WHATSAPP_ACCESS_TOKEN')) {
            errorMessage += "Voice processing is temporarily unavailable. ";
          }
          
          errorMessage += "Please type your request.";
          
          await sendMessage(sender, errorMessage);
          session.step = "menu";
          session.state = 'initial';
          await saveSession(sender, session);
        }
      } else {
        // No audio metadata - user typed "voice" command
        await sendMessage(
          sender,
          "🎤 *Voice Message Mode*\n\n" +
          "You can now send a voice message in any language!\n\n" +
          "*Examples:*\n" +
          "• 'I'm looking for a 2BHK in Noida'\n" +
          "• 'मुझे नोएडा में इलेक्ट्रीशियन चाहिए'\n" +
          "• 'Need a plumber in Gurgaon'\n" +
          "• 'मेड चाहिए दिल्ली में'\n\n" +
          "Just tap and hold the microphone button and speak your request!"
        );
        session.step = "awaiting_voice";
        session.state = 'initial';
        await saveSession(sender, session);
      }
      
      return session;

    default:
      // Check if text contains urban help keywords
      if (isUrbanHelpRequest(text)) {
        console.log("🔧 [URBAN HELP] Text request detected");
        await handleUrbanHelpTextRequest(sender, text, session, effectiveClient);
        return session;
      }
      
      // Default: show menu
      console.log(`❓ Unknown command: ${lower}, showing menu`);
      await sendMessage(sender, "I didn't understand that. Choose an option or type *hi* to restart.");
      await sendMainMenuViaService(sender);
      session.step = "menu";
      session.state = 'initial';
      break;
  }

  await saveSession(sender, session);
  return session;
}

/**
 * Handle urban help menu selection
 */
async function handleUrbanHelpMenu(sender, session, client) {
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  
  let message = "";
  
  if (userLang === 'hi') {
    message = `🔧 *शहरी सहायता सेवाएं*\n\n` +
              `निम्नलिखित सेवाएं उपलब्ध हैं:\n\n` +
              `🔧 इलेक्ट्रीशियन - वायरिंग, स्विच, विद्युत मरम्मत\n` +
              `🚰 प्लंबर - पाइप लीक, बाथरूम फिटिंग, पानी की समस्या\n` +
              `🧹 नौकरानी/हाउसहेल्प - सफाई, खाना पकाना, घरेलू मदद\n` +
              `🔨 बढ़ई - फर्नीचर, दरवाजे, खिड़कियों की मरम्मत\n` +
              `🧼 क्लीनर - गहरी सफाई, घर की सफाई\n` +
              `🔩 टेक्निशियन - एसी मरम्मत, उपकरण सर्विसिंग\n` +
              `🚗 ड्राइवर - कार ड्राइवर, चालक सेवाएं\n` +
              `🎨 पेंटर - घर पेंटिंग, दीवार रंग\n\n` +
              `बस मुझे बताएं कि आपको क्या चाहिए!`;
  } else if (userLang === 'ta') {
    message = `🔧 *நகர்ப்புற உதவி சேவைகள்*\n\n` +
              `பின்வரும் சேவைகள் கிடைக்கின்றன:\n\n` +
              `🔧 மின்தொழிலாளி - வயரிங், சுவிட்சுகள், மின் பழுதுபார்ப்பு\n` +
              `🚰 குழாய்த் தொழிலாளி - குழாய் கசிவு, குளியலறை பொருத்துதல், நீர் சிக்கல்கள்\n` +
              `🧹 வேலைக்காரி/வீட்டு உதவி - சுத்தம், சமையல், வீட்டு உதவி\n` +
              `🔨 தச்சர் - தளபாடங்கள், கதவுகள், சன்னல்கள் பழுதுபார்ப்பு\n` +
              `🧼 சுத்தம் செய்பவர் - ஆழமான சுத்தம், வீட்டு சுத்தம்\n` +
              `🔩 தொழில்நுட்ப வல்லுநர் - ஏசி பழுதுபார்ப்பு, சாதன சேவை\n` +
              `🚗 ஓட்டுநர் - கார் ஓட்டுநர், சாரதி சேவைகள்\n` +
              `🎨 ஓவியர் - வீட்டு ஓவியம், சுவர் வண்ணம்\n\n` +
              `உங்களுக்கு என்ன தேவை என்று சொல்லுங்கள்!`;
  } else {
    message = `🔧 *Urban Help Services*\n\n` +
              `Available services:\n\n` +
              `🔧 Electrician - Wiring, switches, electrical repairs\n` +
              `🚰 Plumber - Pipe leaks, bathroom fittings, water issues\n` +
              `🧹 Maid/Househelp - Cleaning, cooking, domestic help\n` +
              `🔨 Carpenter - Furniture, doors, windows repair\n` +
              `🧼 Cleaner - Deep cleaning, house cleaning\n` +
              `🔩 Technician - AC repair, appliance servicing\n` +
              `🚗 Driver - Car driver, chauffeur services\n` +
              `🎨 Painter - House painting, wall colors\n\n` +
              `Just tell me what you need!`;
  }
  
  await sendMessage(sender, message, client);
  
  await sendInteractiveButtons(
    client,
    sender,
    "How would you like to proceed?",
    [
      { id: 'urban_voice', text: '🎤 Send Voice Message' },
      { id: 'urban_type', text: '📝 Type Request' },
      { id: 'main_menu', text: '🏠 Main Menu' }
    ]
  );
  
  session.step = "awaiting_urban_help_choice";
  session.state = 'initial';
  await saveSession(sender, session);
}

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
// HANDLE SHOW LISTINGS FUNCTION - ADDED TO FIX ERROR
// ========================================
/**
 * Handle showing listings to the user
 */
async function handleShowListings(sender, session) {
  console.log("🏠 [LISTINGS] Handling show listings");
  
  try {
    const effectiveClient = getEffectiveClient();
    
    if (!effectiveClient) {
      await sendMessage(sender, "❌ WhatsApp client not available. Please try again.");
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      return session;
    }
    
    // Get user's saved preferences if any
    const userProfile = await getUserProfile(sender);
    const userLang = userProfile?.language || 'en';
    
    // Check if we have listing data in session
    const listingData = session.housingFlow?.listingData;
    let currentIndex = session.housingFlow?.currentIndex || 0;
    
    if (!listingData || !listingData.listings || listingData.listings.length === 0) {
      // No listing data in session, fetch top listings
      await sendMessage(sender, "🔍 Fetching available listings...");
      
      const topListings = await getTopListings(10); // Get top 10 listings
      
      if (!topListings || topListings.length === 0) {
        await sendMessage(
          sender,
          "📭 No listings available at the moment.\n\n" +
          "Try posting a listing or check back later!"
        );
        
        session.step = "menu";
        session.state = 'initial';
        await saveSession(sender, session);
        await sendMainMenuViaService(sender);
        return session;
      }
      
      // Store in session
      session.housingFlow = {
        currentIndex: 0,
        listingData: {
          listings: topListings,
          totalCount: topListings.length
        }
      };
      
      currentIndex = 0;
      await saveSession(sender, session);
    }
    
    // Get current listing
    const listings = session.housingFlow.listingData.listings;
    const totalListings = session.housingFlow.listingData.totalCount;
    
    if (currentIndex >= totalListings) {
      currentIndex = 0;
      session.housingFlow.currentIndex = 0;
      await saveSession(sender, session);
    }
    
    const currentListing = listings[currentIndex];
    
    if (!currentListing) {
      await sendMessage(sender, "❌ Could not load listing details. Please try again.");
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      await sendMainMenuViaService(sender);
      return session;
    }
    
    // Check if listing is already saved
    const isSaved = await isListingSaved(sender, currentListing.id);
    
    // Send listing card
    await sendListingCard(
      sender,
      {
        id: currentListing.id,
        title: currentListing.title || currentListing.type || "Property",
        location: currentListing.location || "Location not specified",
        price: currentListing.price || "Price on request",
        bedrooms: currentListing.bhk || currentListing.bedrooms || "N/A",
        property_type: currentListing.type || currentListing.propertyType || "Property",
        description: currentListing.description || "No description available",
        contact: currentListing.contact || currentListing.phone || "Contact not provided",
        isSaved: isSaved
      },
      currentIndex,
      totalListings
    );
    
    // Update session
    session.step = "awaiting_listing_action";
    await saveSession(sender, session);
    
    return session;
    
  } catch (error) {
    console.error("❌ [LISTINGS] Error in handleShowListings:", error);
    await sendMessage(sender, "❌ Sorry, I couldn't load the listings. Please try again.");
    
    session.step = "menu";
    session.state = 'initial';
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
    
    return session;
  }
}

// ========================================
// HANDLE MANAGE LISTINGS FUNCTION - ADDED TO FIX ERROR
// ========================================
async function handleManageListings(sender) {
  console.log("⚙️ [MANAGE LISTINGS] Handling manage listings");
  
  try {
    const effectiveClient = getEffectiveClient();
    
    if (!effectiveClient) {
      await sendMessage(sender, "❌ WhatsApp client not available. Please try again.");
      return;
    }
    
    // Fetch user's listings
    await sendMessage(sender, "📋 Fetching your listings...");
    
    const userListings = await getUserListings(sender);
    
    if (!userListings || userListings.length === 0) {
      await sendMessage(
        sender,
        "📭 You don't have any active listings.\n\n" +
        "To post a listing, select '📝 Post Listing' from the main menu."
      );
      
      await sendMainMenuViaService(sender);
      return;
    }
    
    // Format listings for display
    const listingRows = userListings.slice(0, 10).map((listing, index) => ({
      id: `listing_${listing.id}`,
      title: `📋 ${listing.title || 'Untitled Listing'}`,
      description: `📍 ${listing.location || 'No location'} | 💰 ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}`
    }));
    
    // Create sections for the list
    const sections = [{
      title: `Your Listings (${userListings.length})`,
      rows: listingRows
    }];
    
    // Send listings as interactive list
    await sendList(
      sender,
      "📋 Your Listings",
      "Select a listing to manage:",
      "Manage Listings",
      sections
    );
    
    // Update session
    const session = await getSession(sender);
    if (session) {
      session.manageListings = {
        step: "awaiting_selection",
        listings: userListings
      };
      session.step = "managing_listings";
      session.state = 'initial';
      await saveSession(sender, session);
    }
    
  } catch (error) {
    console.error("❌ [MANAGE LISTINGS] Error:", error);
    await sendMessage(sender, "❌ Sorry, I couldn't load your listings. Please try again.");
    
    await sendMainMenuViaService(sender);
  }
}

// ========================================
// HANDLE SAVED LISTINGS FUNCTION - ADDED TO FIX ERROR
// ========================================
async function handleSavedListings(sender) {
  console.log("❤️ [SAVED LISTINGS] Handling saved listings");
  
  try {
    const effectiveClient = getEffectiveClient();
    
    if (!effectiveClient) {
      await sendMessage(sender, "❌ WhatsApp client not available. Please try again.");
      return;
    }
    
    // Fetch user's saved listings
    await sendMessage(sender, "💾 Loading your saved listings...");
    
    const savedListings = await getUserSavedListings(sender);
    
    if (!savedListings || savedListings.length === 0) {
      await sendMessage(
        sender,
        "📭 You haven't saved any listings yet.\n\n" +
        "Browse listings and tap the ❤️ button to save them for later!"
      );
      
      await sendMainMenuViaService(sender);
      return;
    }
    
    // Format saved listings for display
    const savedRows = savedListings.slice(0, 10).map((listing, index) => ({
      id: `saved_${listing.id}`,
      title: `❤️ ${listing.title || 'Saved Listing'}`,
      description: `📍 ${listing.location || 'No location'} | 💰 ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}`
    }));
    
    // Create sections for the list
    const sections = [{
      title: `Saved Listings (${savedListings.length})`,
      rows: savedRows
    }];
    
    // Send saved listings as interactive list
    await sendList(
      sender,
      "❤️ Your Saved Listings",
      "Select a listing to view details:",
      "Saved Listings",
      sections
    );
    
    // Update session
    const session = await getSession(sender);
    if (session) {
      session.savedListingsFlow = {
        step: "awaiting_selection",
        listings: savedListings
      };
      session.step = "viewing_saved_listings";
      session.state = 'initial';
      await saveSession(sender, session);
    }
    
  } catch (error) {
    console.error("❌ [SAVED LISTINGS] Error:", error);
    await sendMessage(sender, "❌ Sorry, I couldn't load your saved listings. Please try again.");
    
    await sendMainMenuViaService(sender);
  }
}

// ========================================
// HANDLE LISTING SELECTION FUNCTION - ADDED TO SUPPORT MANAGE LISTINGS
// ========================================
async function handleListingSelection(sender, msg, session) {
  console.log("🔍 [MANAGE LISTINGS] Handling listing selection");
  
  try {
    const listingId = msg.replace('listing_', '');
    console.log("🔍 [MANAGE LISTINGS] Selected listing ID:", listingId);
    
    // Get the selected listing
    const userListings = session.manageListings?.listings || [];
    const selectedListing = userListings.find(listing => listing.id === listingId);
    
    if (!selectedListing) {
      await sendMessage(sender, "❌ Listing not found. Please try again.");
      await handleManageListings(sender);
      return;
    }
    
    // Store selected listing in session
    session.manageListings.selectedId = listingId;
    session.manageListings.selectedListing = selectedListing;
    session.manageListings.step = "awaiting_action";
    await saveSession(sender, session);
    
    // Display listing details with action buttons
    const listingText = 
`📋 Listing Details:
*Title:* ${selectedListing.title || 'Untitled'}
*Location:* ${selectedListing.location || 'Not specified'}
*Type:* ${selectedListing.type || selectedListing.listingType || 'Property'}
*BHK:* ${selectedListing.bhk || 'N/A'}
*Price:* ₹${selectedListing.price ? selectedListing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${selectedListing.contact || 'Not provided'}
*Description:* ${selectedListing.description || 'No description'}

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
    
  } catch (error) {
    console.error("❌ [MANAGE LISTINGS] Error in selection:", error);
    await sendMessage(sender, "❌ Error loading listing details. Please try again.");
    await handleManageListings(sender);
  }
}

// ========================================
// HANDLE DELETE LISTING FUNCTION - ADDED TO SUPPORT MANAGE LISTINGS
// ========================================
async function handleDeleteListing(sender, session) {
  console.log("🗑️ [MANAGE LISTINGS] Handling delete listing");
  
  try {
    const listingId = session.manageListings?.selectedId;
    const listing = session.manageListings?.selectedListing;
    
    if (!listingId || !listing) {
      await sendMessage(sender, "❌ Could not find listing to delete.");
      await handleManageListings(sender);
      return;
    }
    
    // Delete the listing
    const result = await deleteListing(sender, listingId);
    
    if (result.success) {
      await sendMessage(
        sender,
        `✅ Listing *${listing.title || 'Untitled'}* has been deleted successfully.`
      );
      
      // Clear session data
      delete session.manageListings;
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      
      await sendMainMenuViaService(sender);
    } else {
      await sendMessage(
        sender,
        `❌ Failed to delete listing: ${result.error || 'Unknown error'}`
      );
      
      // Show listing details again
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
    
  } catch (error) {
    console.error("❌ [MANAGE LISTINGS] Error deleting:", error);
    await sendMessage(sender, "❌ Error deleting listing. Please try again.");
    await handleManageListings(sender);
  }
}

// ========================================
// HANDLE SAVED LISTING SELECTION FUNCTION - ADDED TO SUPPORT SAVED LISTINGS
// ========================================
async function handleSavedListingSelection(sender, msg, session) {
  console.log("🔍 [SAVED LISTINGS] Handling saved listing selection");
  
  try {
    const listingId = msg.replace('saved_', '');
    console.log("🔍 [SAVED LISTINGS] Selected listing ID:", listingId);
    
    // Get the selected saved listing
    const savedListings = session.savedListingsFlow?.listings || [];
    const selectedListing = savedListings.find(listing => listing.id === listingId);
    
    if (!selectedListing) {
      await sendMessage(sender, "❌ Saved listing not found. Please try again.");
      await handleSavedListings(sender);
      return;
    }
    
    // Store selected saved listing in session
    session.savedListingsFlow.selectedId = listingId;
    session.savedListingsFlow.selectedListing = selectedListing;
    session.savedListingsFlow.step = "awaiting_action";
    await saveSession(sender, session);
    
    // Display saved listing details with action buttons
    const listingText = 
`📋 Saved Listing Details:
*Title:* ${selectedListing.title || 'Untitled'}
*Location:* ${selectedListing.location || 'Not specified'}
*Type:* ${selectedListing.type || selectedListing.listingType || 'Property'}
*BHK:* ${selectedListing.bhk || 'N/A'}
*Price:* ₹${selectedListing.price ? selectedListing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${selectedListing.contact || 'Not provided'}
*Description:* ${selectedListing.description || 'No description'}

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
    
  } catch (error) {
    console.error("❌ [SAVED LISTINGS] Error in selection:", error);
    await sendMessage(sender, "❌ Error loading saved listing details. Please try again.");
    await handleSavedListings(sender);
  }
}

// ========================================
// HANDLE REMOVE SAVED LISTING FUNCTION - ADDED TO SUPPORT SAVED LISTINGS
// ========================================
async function handleRemoveSavedListing(sender, session) {
  console.log("🗑️ [SAVED LISTINGS] Handling remove saved listing");
  
  try {
    const listingId = session.savedListingsFlow?.selectedId;
    const listing = session.savedListingsFlow?.selectedListing;
    
    if (!listingId || !listing) {
      await sendMessage(sender, "❌ Could not find saved listing to remove.");
      await handleSavedListings(sender);
      return;
    }
    
    // Remove the listing from saved
    const result = await removeSavedListing(sender, listingId);
    
    if (result.success) {
      await sendMessage(
        sender,
        `✅ Listing *${listing.title || 'Untitled'}* has been removed from your saved list.`
      );
      
      // Clear session data
      delete session.savedListingsFlow;
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      
      await sendMainMenuViaService(sender);
    } else {
      await sendMessage(
        sender,
        `❌ Failed to remove listing: ${result.error || 'Unknown error'}`
      );
      
      // Show saved listing details again
      session.savedListingsFlow.step = "awaiting_action";
      await saveSession(sender, session);
      
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
    }
    
  } catch (error) {
    console.error("❌ [SAVED LISTINGS] Error removing:", error);
    await sendMessage(sender, "❌ Error removing saved listing. Please try again.");
    await handleSavedListings(sender);
  }
}

// ========================================
// PLACEHOLDER FUNCTIONS FOR MISSING IMPLEMENTATIONS
// ========================================

/**
 * Handle post listing flow - PLACEHOLDER
 */
async function handlePostListingFlow(sender) {
  console.log("📝 [POST LISTING] Placeholder - function not fully implemented");
  await sendMessage(sender, "The post listing feature is currently unavailable. Please try again later.");
  
  // Update session
  const session = await getSession(sender);
  if (session) {
    session.step = "menu";
    session.state = 'initial';
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
  }
}

/**
 * Handle flow submission - PLACEHOLDER
 */
async function handleFlowSubmission(metadata, sender) {
  console.log("🌊 [FLOW] Placeholder - flow submission not implemented");
  return false;
}

/**
 * Handle field edit - PLACEHOLDER
 */
async function handleFieldEdit(sender, msg, session) {
  console.log("✏️ [EDIT] Placeholder - field edit not implemented");
  await sendMessage(sender, "The edit feature is currently unavailable. Please try again later.");
  
  session.manageListings.step = "awaiting_action";
  await saveSession(sender, session);
  
  const listing = session.manageListings.selectedListing;
  const listingId = session.manageListings.selectedId;
  
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

/**
 * Update field value - PLACEHOLDER
 */
async function updateFieldValue(sender, text, session) {
  console.log("✏️ [UPDATE] Placeholder - update field not implemented");
  await sendMessage(sender, "The update feature is currently unavailable. Please try again later.");
  
  delete session.editFlow;
  session.manageListings.step = "awaiting_action";
  await saveSession(sender, session);
  
  const listing = session.manageListings.selectedListing;
  const listingId = session.manageListings.selectedId;
  
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

/**
 * Save all edits - PLACEHOLDER
 */
async function saveAllEdits(sender, session) {
  console.log("💾 [SAVE] Placeholder - save edits not implemented");
  await sendMessage(sender, "The save edits feature is currently unavailable. Please try again later.");
  
  delete session.editFlow;
  session.manageListings.step = "awaiting_action";
  await saveSession(sender, session);
  
  const listing = session.manageListings.selectedListing;
  const listingId = session.manageListings.selectedId;
  
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

/**
 * Handle text listing input - PLACEHOLDER
 */
async function handleTextListingInput(sender, text, session) {
  console.log("📝 [TEXT LISTING] Placeholder - text listing input not implemented");
  await sendMessage(sender, "The text listing input feature is currently unavailable. Please use the menu options.");
  
  session.step = "menu";
  session.state = 'initial';
  await saveSession(sender, session);
  await sendMainMenuViaService(sender);
}

// ========================================
// MODULE EXPORTS
// ========================================
module.exports = {
  handleIncomingMessage,
  handleShowListings,
  handleManageListings,
  handleSavedListings,
  handlePostListingFlow,
  handleFlowSubmission,
  handleVoiceMessage,
  handleVoiceConfirmation,
  setWhatsAppClient,
  getEffectiveClient,
  // ✅ ADDED: Urban Help functions
  handleUrbanHelpConfirmation,
  executeUrbanHelpSearch,
  // ✅ ADDED: Helper functions for manage and saved listings
  handleListingSelection,
  handleDeleteListing,
  handleSavedListingSelection,
  handleRemoveSavedListing,
  // ✅ ADDED: Placeholder functions for missing implementations
  handleFieldEdit,
  updateFieldValue,
  saveAllEdits,
  handleTextListingInput
};