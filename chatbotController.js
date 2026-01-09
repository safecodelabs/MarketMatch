// ========================================
// IMPORTS - UPDATED WITH VOICE SUPPORT & URBAN HELP & POSTING SYSTEM
// ========================================
const commandRouter = require("./src/bots/commandRouter");
const voiceService = require("./src/services/voiceService");

// ✅ FIXED: Correct path to posting-service
const PostingService = require("./src/services/posting-service");

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
  searchListingsByCriteria,
  // ✅ ADDED: Urban Help Functions
  searchUrbanServices,
  addUrbanHelpProvider,
  getProviderById,
  updateProviderAvailability,
  addUserRequest,
  updateRequestStatus
} = require("./database/firestore");

// ✅ UPDATED: Added sendSavedListingCard
const { 
  sendMessageWithClient,
  sendList, 
  sendReplyButtons, 
  sendListingCard,
  sendSavedListingCard,
  sendInteractiveButtonsWithClient
} = require("./src/services/messageService");

// ✅ ADDED: Environment variables for Flow
const WHATSAPP_FLOW_ID = process.env.WHATSAPP_FLOW_ID;
const FLOW_MODE = process.env.FLOW_MODE || "draft"; // "draft" for testing, "published" for production

// ✅ ADDED: Multi-language support for urban help
const multiLanguage = require("./utils/multiLanguage");

// ✅ REFACTOR: urban help flow moved to its own module
const urbanHelpFlow = require('./src/flows/urbanHelpFlow');

// ✅ REFACTOR: job flow for posting and seeker flows
const jobFlow = require('./src/flows/jobFlow');

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
// INTENT CONTEXT DETECTION (NEW) - CRITICAL FIX - UPDATED
// ========================================

/**
 * Detect if user is OFFERING or LOOKING FOR services - IMPROVED VERSION
 * @param {String} text - User's message
 * @returns {String|null} 'offer', 'find', or null
 */
function detectIntentContext(text) {
  if (!text || typeof text !== 'string') return null;
  
  const lower = text.toLowerCase();
  
  // QUICK CHECK: detect structured postings (role/location/salary/contact). Treat as OFFER by default
  const structuredPostPatterns = [ /\brole\s*[:\-]/i, /\blocation\s*[:\-]/i, /salary\b/i, /salary\s*&\s*benefits/i, /contact\s*[-:]/i, /selection rounds/i ];
  if (structuredPostPatterns.some(re => re.test(lower))) {
    console.log('🔍 [CONTEXT DETECTION] Structured posting pattern detected');
    return 'offer';
  }

  // FIRST: Check for JOB SEEKING patterns (HIGH PRIORITY)
  const jobSeekingPatterns = [
    /looking for.*job/i,
    /need.*job/i,
    /searching for.*job/i,
    /job search/i,
    /seeking.*job/i,
    /want.*job/i,
    /employment opportunity/i,
    /mujhe job/i,
    /job chahiye/i,
    /naukri/i,
    /kaam khoj/i,
    /kaam dund/i,
    /employment/i
  ];
  
  // Check for job seeking first
  if (jobSeekingPatterns.some(pattern => pattern.test(lower))) {
    console.log(`🔍 [CONTEXT DETECTION] Job seeking pattern detected`);
    return 'job_search';
  }
  
  // Check for "looking for" patterns (but exclude job-related)
  const lookingForPatterns = [
    /looking for/i,
    /searching for/i,
    // more specific "need" and "want" patterns to avoid false positives like "need minimum 6 months experience"
    /need\s+.*(job|work|employment|service|help|position)/i,
    /want\s+.*(job|work|employment|service|help|position)/i,
    /require\s+.*(job|service|help|position)/i,
    /find\s+.*(job|work|service|help|position)/i,
    /i need\s+.*(job|work|service|help|position)/i,
    /i want\s+.*(job|work|service|help|position)/i,
    /i require\s+.*(job|work|service|help|position)/i,
    /i am looking for/i,
    /i'm looking for/i,
    /help me find/i,
    /where can i find/i,
    /how to get/i,
    /where to get/i,
    /i need help finding/i,
    /chahiye/i,
    /mujhe/i,
    /karwana/i,
    /karane/i,
    /sahayata/i
  ];
  
  // Check for "looking for" patterns (but exclude jobs already caught)
  if (lookingForPatterns.some(pattern => pattern.test(lower)) && !/job|naukri|employment/i.test(lower)) {
    console.log(`🔍 [CONTEXT DETECTION] CLEAR "looking for" pattern detected`);
    return 'find';
  }
  
  // OFFERING patterns (I am/I'm/I have) - USER IS POSTING THEIR SERVICES
  const offeringPatterns = [
    /i('?m| am) (a |an )?/i,
    /i have (a |an )?/i,
    /i provide/i,
    /i offer/i,
    /available/i,
    /looking to provide/i,
    /i can provide/i,
    /i do/i,
    /i work as/i,
    /i am available/i,
    /contact me for/i,
    /call me for/i,
    /message me for/i,
    /whatsapp me for/i,
    /i sell/i,
    /i am selling/i,
    /for sale/i,
    /for rent/i,
    /available for/i,
    /service provided/i,
    /services available/i,
    /rent out/i,
    /available for rent/i,
    /hire me/i,
    /i am expert/i,
    /professional/i,
    /experienced/i
  ];
  
  // Additional LOOKING patterns (lower priority)
  const otherLookingPatterns = [
    /show me/i,
    /give me/i,
    /get me/i,
    /i want to buy/i,
    /i want to purchase/i,
    /i want to hire/i,
    /i want to book/i,
    /need to hire/i,
    /want to hire/i,
    /looking to hire/i,
    /need to buy/i,
    /want to buy/i,
    /looking to buy/i
  ];
  
  if (offeringPatterns.some(pattern => pattern.test(lower))) {
    return 'offer'; // User is offering services/goods
  }
  
  if (otherLookingPatterns.some(pattern => pattern.test(lower))) {
    return 'find'; // User is looking for services/goods
  }
  
  return null; // Can't determine
}

// Quick check for offering services (for simple detection) - UPDATED
function isUserOfferingServices(text) {
  if (!text || typeof text !== 'string') return false;
  
  const lowerText = text.toLowerCase();
  
  // CRITICAL: Only treat explicit "looking for" / "searching for" as NOT offering.
  // Avoid treating generic words like "need" or "want" in other contexts (e.g. "need minimum 6 months") as NOT offering.
  if (lowerText.includes('looking for') || lowerText.includes('searching for')) {
    console.log(`🔍 [OFFERING CHECK] Contains "looking for" keywords - NOT offering`);
    return false;
  }
  
  // Check for offering patterns (include 'for rent' / 'rent out' for property posts)
  const offeringPatterns = [
    /i('?m| am) (a |an )?/i,
    /i have (a |an )?/i,
    /i provide/i,
    /i offer/i,
    /available/i,
    /for rent/i,
    /rent out/i
  ];
  
  const hasPattern = offeringPatterns.some(pattern => pattern.test(lowerText));
  
  // Additional quick check: '2bhk for rent', '1 bhk for rent' etc. -> offering
  const bhkForRentPattern = /(\b\d+\s?bhk\b).*(for rent|for lease|rent out)|\b\d+\s?bhk\s?for rent\b/i;
  if (bhkForRentPattern.test(lowerText)) {
    return true;
  }
  
  if (hasPattern) {
    // Double-check it's not actually a "looking for" disguised as "I'm"
    // Example: "I'm looking for" vs "I'm a plumber"
    if (lowerText.includes('looking for') || lowerText.includes('searching for')) {
      return false;
    }
    
    // Check if it's followed by a profession/service
    const professionMatch = lowerText.match(/i('?m| am| have) (a |an )?([a-z]+)/i);
    if (professionMatch) {
      const profession = professionMatch[3];
      const serviceKeywords = ['electrician', 'plumber', 'maid', 'cook', 'cleaner', 'carpenter',
                               'painter', 'driver', 'technician', 'mason', 'contractor', 'labour',
                               'worker', 'service', 'services', 'repair', 'installer', 'fitter',
                               'welder', 'mechanic', 'technician', 'ac repair', 'appliance repair',
                               'househelp', 'naukrani', 'ayah', 'babysitter', 'caretaker', 'gardener',
                               'security', 'guard', 'watchman', 'delivery', 'packer', 'mover'];
      
      // If it's a service profession, it's likely an offering
      if (serviceKeywords.some(keyword => profession.includes(keyword))) {
        return true;
      }
    }
    
    return hasPattern;
  }
  
  return false;
}

// =============================
// Detect structured job postings
// =============================
function isStructuredJobPost(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  // Detect phone/contact
  const hasPhone = /(?:\+?\d{1,3}[-\s.]*)?(?:\d{10}|\d{3}[-\s.]\d{3}[-\s.]\d{4})/.test(text);

  // Key posting indicators
  const indicators = [
    /hiring\b/i,
    /vacanc(?:y|ies)\b/i,
    /immediate joining/i,
    /requirement/i,
    /require(s)?\b/i,
    /designation\b/i,
    /shift\b/i,
    /ctc\b/i,
    /salary\b/i,
    /perks\b/i,
    /contact\b/i,
    /location\b/i,
    /role\b/i
  ];

  let matches = 0;
  for (const r of indicators) if (r.test(lower)) matches++;

  // Also consider label-style lines: "Role:", "Location:", "Contact -"
  const labelStyle = /^(role|location|salary|contact|eligibility|designation)\s*[:\-]/im.test(text);

  // Heuristic: phone + at least one posting indicator OR at least two posting indicators + label style
  if (hasPhone && matches >= 1) return true;
  if (matches >= 2 && labelStyle) return true;
  if (matches >= 3) return true;

  return false;
}

// ========================================
// UPDATED: URBAN HELP REQUEST DETECTION - FIXED
// ========================================

/**
 * Check if transcription is an urban help request - IMPROVED VERSION
 */
function isUrbanHelpRequest(transcription) {
  if (!transcription || typeof transcription !== 'string') return false;
  
  const lowerText = transcription.toLowerCase();
  
  // Check context first
  const context = detectIntentContext(lowerText);
  const isOffering = isUserOfferingServices(lowerText);
  
  console.log(`🔍 [URBAN HELP CHECK] Text: "${transcription}"`);
  console.log(`🔍 [URBAN HELP CHECK] Context: ${context}, IsOffering: ${isOffering}`);
  
  // If it's an offering, it's NOT an urban help REQUEST (it's a posting)
  if (isOffering || context === 'offer') {
    console.log(`🔍 [URBAN HELP CHECK] This is an OFFERING, not a request`);
    return false;
  }
  
  // Check for REQUEST keywords (user is looking for services)
  const requestKeywords = [
    'need', 'want', 'looking for', 'searching for', 'find',
    'require', 'chahiye', 'mujhe', 'karwana', 'karane',
    'help', 'sahayata', 'required', 'wanted', 'find me',
    'show me', 'where can i find', 'how to get', 'where to get',
    'need to hire', 'want to hire', 'looking to hire', 'need to buy',
    'want to buy', 'looking to buy'
  ];
  
  // Also check for service keywords
  const serviceKeywords = [
    'electrician', 'plumber', 'maid', 'cook', 'cleaner', 'carpenter',
    'painter', 'driver', 'technician', 'mason', 'contractor', 'labour',
    'worker', 'service', 'services', 'repair', 'installer', 'fitter',
    'welder', 'mechanic', 'technician', 'ac repair', 'appliance repair',
    'househelp', 'naukrani', 'ayah', 'babysitter', 'caretaker', 'gardener',
    'security', 'guard', 'watchman', 'delivery', 'packer', 'mover'
  ];
  
  // Check if it contains request keywords AND service keywords
  const hasRequestKeyword = requestKeywords.some(keyword => lowerText.includes(keyword));
  const hasServiceKeyword = serviceKeywords.some(keyword => lowerText.includes(keyword));
  
  // Also check for location indicators
  const locationIndicators = ['in', 'at', 'near', 'around', 'mein', 'पर', 'में'];
  const hasLocationIndicator = locationIndicators.some(indicator => lowerText.includes(indicator));
  
  // It's an urban help request if:
  // 1. User is asking for something (not offering)
  // 2. AND it contains service-related terms
  // 3. OR it contains location indicators (implying they want service at a location)
  const isRequest = (hasRequestKeyword && (hasServiceKeyword || hasLocationIndicator)) || 
                   (context === 'find' && (hasServiceKeyword || hasLocationIndicator));
  
  console.log(`🔍 [URBAN HELP CHECK] Is request: ${isRequest}`);
  return isRequest;
}

// ========================================
// POSTING SERVICE HANDLER - UPDATED
// ========================================
/**
 * Handle posting service messages - UPDATED FOR VOICE INITIATION
 */
async function handlePostingService(sender, message, session, effectiveClient) {
  try {
    console.log("📝 [POSTING SERVICE] Processing message for posting flow");
    console.log("📝 [POSTING SERVICE] Message content:", message);
    console.log("📝 [POSTING SERVICE] Session step:", session?.step);
    console.log("📝 [POSTING SERVICE] Session state:", session?.state);
    
    // Check if user wants to clear draft
    if (message.toLowerCase().includes('clear draft') || message.toLowerCase().includes('start over')) {
      console.log("🔄 User wants to clear draft");
      
      const postingService = new PostingService(sender);
      const existingDraft = await postingService.draftManager.getUserActiveDraft(sender);
      
      if (existingDraft) {
        await postingService.draftManager.deleteDraft(existingDraft.id);
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'draft_cleared'), effectiveClient);
      } else {
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'no_active_draft'), effectiveClient);
      }
      
      return { handled: true, type: 'success' };
    }
    
    if (session.mode === 'posting' && session.draftId) {
      console.log("📝 [POSTING SERVICE] User already in posting mode, continuing session");
      const postingService = new PostingService(sender);
      const result = await postingService.continuePosting(message, session);
      
      // 🎯 CRITICAL FIX: Ensure result has handled property
      if (result && result.shouldHandle !== false) {
        return { 
          handled: true, 
          type: result.type,
          response: result.response,
          buttons: result.buttons
        };
      }
      return { handled: false };
    }

    const postingService = new PostingService(sender);
    
    // Check if this is a voice-initiated offering
    const context = detectIntentContext(message);
    const isOffering = isUserOfferingServices(message);
    
    console.log(`📝 [POSTING SERVICE] Context: ${context}, IsOffering: ${isOffering}`);
    
    // If this is an offering from voice confirmation, start a new listing
    if ((isOffering || context === 'offer') && 
        (session?.state === 'awaiting_confirmation' || session?.step === 'awaiting_confirmation')) {
      console.log("📝 [POSTING SERVICE] Voice-initiated offering detected, starting new listing");
      
      const result = await postingService.startNewListing(message);
      console.log("📝 [POSTING SERVICE] Start new listing result:", result);
      
      if (result && result.shouldHandle !== false) {
        return { 
          handled: true, 
          type: result.type,
          response: result.response,
          buttons: result.buttons
        };
      }
    }
    
    // Otherwise, process normally
    const result = await postingService.processMessage(message);
    
    console.log("📝 [POSTING SERVICE] Result from posting service:", result);
    
    if (result.shouldHandle !== false) {
      return { 
        handled: true, 
        type: result.type,
        response: result.response,
        buttons: result.buttons
      };
    }
    
    console.log("📝 [POSTING SERVICE] Returning handled: false");
    return { handled: false };
    
  } catch (error) {
    console.error("❌ [POSTING SERVICE] Error:", error);
    return { handled: false };
  }
}

// ========================================
// POSTING CONFIRMATION HANDLER - NEW CRITICAL FIX
// ========================================
/**
 * Handle posting confirmation button clicks
 * @param {String} sender - User phone number
 * @param {String} replyId - Button ID (confirm_yes, confirm_no)
 * @param {Object} session - Current session
 * @param {Object} client - WhatsApp client
 * @returns {Promise<Object>} Updated session
 */
async function handlePostingConfirmation(sender, replyId, session, client) {
  console.log(`📝 [POSTING CONFIRMATION] Handling: ${replyId}`);
  
  const postingService = new PostingService(sender);
  
  if (replyId === 'confirm_yes') {
    // Get current draft
    let draftId = session.draftId;
    if (!draftId) {
      console.warn(`📝 [POSTING CONFIRMATION] No draftId in session for ${sender}, looking up active draft`);
      const existingDraft = await postingService.draftManager.getUserActiveDraft(sender);
      if (existingDraft) {
        draftId = existingDraft.id;
        session.draftId = draftId;
        console.log(`📝 [POSTING CONFIRMATION] Found active draft ${draftId}, proceeding to submit`);
      } else {
        // Offer to start a new listing or cancel instead of a blunt 'start over'
        await sendInteractiveButtonsWithClient(
          client,
          sender,
          "I couldn't find a draft to publish. Would you like to start a new listing or cancel?",
          [
            { id: 'start_new_listing', title: '🆕 Start New Listing' },
            { id: 'cancel_draft_conflict', title: '❌ Cancel' }
          ]
        );
        session.step = "menu";
        session.state = 'initial';
        await saveSession(sender, session);
        return session;
      }
    }
    
    // Submit the draft
    const result = await postingService.submitDraft(draftId);
    
    if (result.success) {
      await sendMessageWithClient(
        sender,
        `🎉 Your listing has been published successfully!\n\n` +
        `*Title:* ${result.listing?.title || 'Service Listing'}\n` +
        `*Type:* ${result.listing?.category || 'Service'}\n` +
        `You can view it from the "Manage Listings" option.`,
        client
      );
      
      // Clear session
      session.step = "menu";
      session.state = 'initial';
      delete session.mode;
      delete session.draftId;
      delete session.expectedField;
      await saveSession(sender, session);
      
    } else {
      await sendMessageWithClient(
        sender,
        `❌ Failed to publish listing: ${result.error || 'Unknown error'}`,
        client
      );
    }
    
  } else if (replyId === 'confirm_no') {
    // Cancel the posting
    const draftId = session.draftId;
    if (draftId) {
      await postingService.draftManager.deleteDraft(draftId);
    }
    
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'success_listing_deleted'), client);
    
    session.step = "menu";
    session.state = 'initial';
    delete session.mode;
    delete session.draftId;
    delete session.expectedField;
    await saveSession(sender, session);
  } else if (replyId === 'type_instead') {
    // User chose to type instead of clicking buttons
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'confirm_typed_instructions'), client);
    session.expectedField = 'confirmation';
    session.allowTypedConfirmation = true;
    session.step = 'posting_flow';
    await saveSession(sender, session);
  }
  
  return session;
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
// VOICE MESSAGE HANDLING FUNCTIONS - UPDATED
// ========================================

/**
 * Handle incoming voice messages for urban help
 */
async function handleVoiceMessage(sender, metadata, client) {
  try {
    console.log("🎤 [VOICE] Processing voice message from:", sender);
    console.log("🎤 [VOICE] Metadata:", JSON.stringify(metadata, null, 2));
    
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
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_no_client'));
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    // Send processing message
await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'processing_voice'));
    
    // Get media URL from metadata - IMPROVED EXTRACTION
    const mediaUrl = metadata.body || 
                    metadata.mediaUrl || 
                    metadata.audio?.url || 
                    metadata.voice?.url ||
                    metadata.audioMetadata?.url;
    
    if (!mediaUrl) {
      console.error("🎤 [VOICE] No audio URL found in metadata:", metadata);
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_voice_access'));
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    console.log("🎤 [VOICE] Audio URL found:", mediaUrl.substring(0, 100) + "...");
    
    // Process the voice message with urban help intent extraction
    const processingResult = await voiceService.processVoiceMessage(
      { from: sender, id: metadata.id || Date.now().toString() },
      mediaUrl,
      effectiveClient
    );
    
    if (!processingResult.success) {
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_voice_processing'));
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    // Check if this is an urban help request using IMPROVED detection
    // But DO NOT route to urban-help if the transcription looks like a housing/property search
    const looksLikeHousing = voiceService && typeof voiceService.isHousingRequest === 'function'
        ? voiceService.isHousingRequest(processingResult.transcription)
        : false;

    // If we are in the middle of an urban-help flow awaiting missing information,
    // accept this transcription as the missing piece (e.g., user says "Noida" after being asked)
    if (session && session.urbanHelpContext && (session.urbanHelpContext.step === 'awaiting_missing_info' || session.urbanHelpContext.step === 'awaiting_location' || session.step === 'awaiting_urban_help_info')) {
      const missing = session.urbanHelpContext.missingInfo || [];
      const userLang = multiLanguage.getUserLanguage(sender) || 'en';

      // If location is missing, treat short transcription as the location and optionally auto-search
      if (missing.includes('location')) {
        const locRaw = processingResult.transcription && processingResult.transcription.trim();
        const loc = locRaw || '';
        if (loc) {
          session.urbanHelpContext.entities = session.urbanHelpContext.entities || {};
          session.urbanHelpContext.entities.location = loc;

          // Persist updated context
          await saveSession(sender, session);

          // If the user replied with a short location (likely an implicit confirmation), auto-run the search
          const words = loc.split(/\s+/).filter(Boolean);
          if (words.length <= 4) {
            session.urbanHelpContext.step = 'searching';
            session.step = 'searching_urban_help';

            // Inform user we are searching and then execute the search
            await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'searching', {
              category: session.urbanHelpContext.entities.category || session.urbanHelpContext.category || 'Service',
              location: loc
            }) || `🔍 Searching for ${session.urbanHelpContext.entities.category || 'service'} in ${loc}...`, client);

            await urbanHelpFlow.executeUrbanHelpSearch(sender, session.urbanHelpContext.entities, session, client, userLang);
            return session;
          }

          // Otherwise show confirmation (longer replies may be an updated full request)
          session.urbanHelpContext.step = 'awaiting_confirmation';
          session.step = 'awaiting_urban_help_confirmation';

          await sendUrbanHelpConfirmation(sender, session.urbanHelpContext.transcription || loc, session.urbanHelpContext.entities, userLang, client);
          await saveSession(sender, session);
          return session; // no change here - keep behavior (handled earlier)
        }
      }

      // If category is missing, try extracting it from the transcription
      if (missing.includes('category')) {
        const extracted = extractUrbanHelpFromText(processingResult.transcription || '');
        if (extracted.category) {
          session.urbanHelpContext.entities = session.urbanHelpContext.entities || {};
          session.urbanHelpContext.entities.category = extracted.category;

          // If location still missing, ask for location
          if (!session.urbanHelpContext.entities.location) {
            await askForMissingUrbanHelpInfo(sender, session.urbanHelpContext.entities, ['location'], userLang, client);
            session.urbanHelpContext.step = 'awaiting_location';
            session.step = 'awaiting_urban_help_location';
            await saveSession(sender, session);
            return session;
          } else {
            // We have both, show confirmation
            await sendUrbanHelpConfirmation(sender, session.urbanHelpContext.transcription || processingResult.transcription, session.urbanHelpContext.entities, userLang, client);
            session.urbanHelpContext.step = 'awaiting_confirmation';
            session.step = 'awaiting_urban_help_confirmation';
            await saveSession(sender, session);
            return session;
          }
        } else {
          // Could not extract category from the short transcription, ask again
          await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'ask_category'));
          session.urbanHelpContext.step = 'awaiting_category';
          session.step = 'awaiting_urban_help_category';
          await saveSession(sender, session);
          return session;
        }
      }
    }

    if ((processingResult.intent === 'urban_help_request' || 
        processingResult.entities?.category ||
        isUrbanHelpRequest(processingResult.transcription)) && !looksLikeHousing) {
      
      await urbanHelpFlow.handleUrbanHelpVoiceIntent(sender, session, processingResult, effectiveClient);
      
    } else {
      // Handle existing property-related intents (or housing overrides)
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
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_voice_processing'));
    return null;
  }
}

/**
 * Handle urban help voice intent
 */
async function handleUrbanHelpVoiceIntent(sender, session, processingResult, client) {
  return urbanHelpFlow.handleUrbanHelpVoiceIntent(sender, session, processingResult, client);
}
/**
 * Check for missing urban help information
 */
function checkMissingUrbanHelpInfo(entities) {
  return urbanHelpFlow.checkMissingUrbanHelpInfo(entities);
}

/**
 * Ask for missing urban help information (delegates to flow module)
 */
async function askForMissingUrbanHelpInfo(sender, entities, missingInfo, userLang, client) {
  return urbanHelpFlow.askForMissingUrbanHelpInfo(sender, entities, missingInfo, userLang, client);
}

/**
 * Send urban help confirmation (delegates to flow module)
 */
async function sendUrbanHelpConfirmation(sender, transcription, entities, userLang, client) {
  return urbanHelpFlow.sendUrbanHelpConfirmation(sender, transcription, entities, userLang, client);
}

/**
 * Handle urban help confirmation response
 */
async function handleUrbanHelpConfirmation(sender, response, session, client) {
  const urbanContext = session.urbanHelpContext;
  
  if (!urbanContext) {
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_session_expired'));
    session.step = "menu";
    await saveSession(sender, session);
    return session;
  }
  
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  
  if (response.startsWith('confirm_urban_')) {
    // User confirmed - search for service providers
    await sendMessageWithClient(sender, 
      multiLanguage.getMessage(userLang, 'searching', {
        category: URBAN_HELP_CATEGORIES[urbanContext.entities.category]?.name || 'Service',
        location: urbanContext.entities.location || 'your area'
      }) || `🔍 Searching for ${urbanContext.entities.category} in ${urbanContext.entities.location}...`,
      client
    );
    
    await urbanHelpFlow.executeUrbanHelpSearch(sender, urbanContext.entities, session, client, userLang);
    
  } else if (response === 'try_again_urban') {
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'try_again'));
    delete session.urbanHelpContext;
    session.step = "awaiting_voice";
    
  } else if (response === 'modify_details') {
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'ask_send_updated_request'));
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
 * Execute urban help search - DELEGATES TO flow module
 */
async function executeUrbanHelpSearch(sender, entities, session, client, userLang) {
  return urbanHelpFlow.executeUrbanHelpSearch(sender, entities, session, client, userLang);
}

/**
 * Check missing urban help info - DELEGATES TO flow module
 */
function checkMissingUrbanHelpInfo(entities) {
  return urbanHelpFlow.checkMissingUrbanHelpInfo(entities);
}

/**
 * Ask for missing urban help info - DELEGATES TO flow module
 */
async function askForMissingUrbanHelpInfo(sender, entities, missingInfo, userLang, client) {
  return urbanHelpFlow.askForMissingUrbanHelpInfo(sender, entities, missingInfo, userLang, client);
}

/**
 * Format urban help results - DELEGATES TO flow module
 */
function formatUrbanHelpResults(results, userLang, categoryName = null) {
  return urbanHelpFlow.formatUrbanHelpResults(results, userLang, categoryName);
}

/**
 * Get category display name - DELEGATES TO flow module
 */
function getCategoryDisplayName(category) {
  return urbanHelpFlow.getCategoryDisplayName(category);
}

// ========================================
// POST LISTING FLOW HANDLERS
// ========================================
function getCategoryDisplayName(category) {
  return urbanHelpFlow.getCategoryDisplayName(category);
}

/**
 * Format urban help results
 */
function formatUrbanHelpResults(results, userLang, categoryName = null) {
  return urbanHelpFlow.formatUrbanHelpResults(results, userLang, categoryName);
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
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_voice_context_lost'));
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    const { intent, entities, originalTranscription } = voiceContext;
    
    // Get effective client
    const effectiveClient = getEffectiveClient(client);
    if (!effectiveClient) {
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_no_client'));
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    if (response.startsWith("confirm_")) {
      // User confirmed - proceed with the intent
      const confirmedIntent = response.replace("confirm_", "");
      
      if (confirmedIntent === intent) {
        await sendMessageWithClient(sender, `✅ Got it! Processing: "${originalTranscription}"`);
        await executeVoiceIntent(sender, intent, entities, session, effectiveClient);
      } else {
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'try_again'));
        session.step = "menu";
      }
      
    } else if (response === "try_again") {
      // User wants to try voice again
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'try_again'));
      session.step = "awaiting_voice";
      delete session.voiceContext;
      
    } else if (response === "use_buttons") {
      // User wants to use buttons instead
      await sendMessageWithClient(sender, "📋 Switching to menu options...");
      session.step = "menu";
      delete session.voiceContext;
      await sendMainMenuViaService(sender);
      
    } else {
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'not_understood'));
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
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'try_again'));
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
      await sendMessageWithClient(sender, "🎤 Voice listing post detected. Switching to listing form...");
      await handlePostListingFlow(sender);
      break;
      
    case "view_listing":
      await sendMessageWithClient(sender, "🎤 To view specific listing details, please use the 'View Listings' option from the menu.");
      session.step = "menu";
      await sendMainMenuViaService(sender);
      break;
      
    case "contact_agent":
      await sendMessageWithClient(sender, "🎤 For contacting agents, please use the contact information provided in individual listings.");
      session.step = "menu";
      await sendMainMenuViaService(sender);
      break;
      
    default:
      await sendMessageWithClient(sender, "🎤 I understood your request but need more details. Please use the menu options.");
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
    
    await sendMessageWithClient(sender, `🔍 Searching for ${intent === 'buy_property' ? 'properties to buy' : 'properties to rent'}...`);
    
    // Search listings
    const listings = await searchListingsByCriteria(searchCriteria);
    
    if (!listings || listings.length === 0) {
      await sendMessageWithClient(
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
    
    await sendMessageWithClient(
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
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_no_client'));
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
    await sendMessageWithClient(
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
        await sendMessageWithClient(sender, "🎤 That's all the listings matching your criteria!");
      }
      break;
      
    case "voice_refine_search":
      await sendMessageWithClient(
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
// URBAN HELP TEXT HANDLER - UPDATED WITH OFFERING DETECTION
// ========================================
async function handleUrbanHelpTextRequest(sender, text, session, client) {
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  
  // First check if user is OFFERING services
  const context = detectIntentContext(text);
  const isOffering = isUserOfferingServices(text);
  
  console.log(`🔍 [URBAN HELP TEXT] Context: ${context}, IsOffering: ${isOffering}`);
  
  if (isOffering) {
    // User is OFFERING services → route to posting service
    console.log("🔧 [URBAN HELP TEXT] User is OFFERING services, routing to posting");
    
    let ackMessage = '';
    if (userLang === 'hi') {
      ackMessage = "🔧 मैं देख रहा हूं कि आप सेवाएं प्रदान कर रहे हैं। मैं आपकी पोस्टिंग में मदद करता हूं...";
    } else if (userLang === 'ta') {
      ackMessage = "🔧 நீங்கள் சேவைகளை வழங்குகிறீர்கள் என்று பார்க்கிறேன். உங்கள் இடுகைக்கு உதவுகிறேன்...";
    } else {
      ackMessage = "🔧 I see you're offering services. Let me help you post this...";
    }
    
    await sendMessageWithClient(sender, ackMessage, client);
    
    // Process with posting service
    const postingResult = await handlePostingService(sender, text, session, client);
    if (postingResult.handled) {
      // Update session based on posting result
      if (postingResult.type === 'question' || postingResult.type === 'confirmation') {
        session.step = "posting_flow";
      } else if (postingResult.type === 'success' || postingResult.type === 'cancelled' || postingResult.type === 'error') {
        session.step = "menu";
        session.state = 'initial';
      }
      await saveSession(sender, session);
    }
    return;
  }
  
  // Check if we're continuing a previous urban help session
  if (session.urbanHelpContext && session.urbanHelpContext.category && !session.urbanHelpContext.location) {
    console.log("🔧 [URBAN HELP] Continuing session for location input");
    // User already selected category, now providing location
    session.urbanHelpContext.location = text;
    session.urbanHelpContext.text = session.urbanHelpContext.text || text;
    session.urbanHelpContext.step = "awaiting_confirmation";
    
    await sendUrbanHelpConfirmation(sender, 
      session.urbanHelpContext.text, 
      session.urbanHelpContext, 
      userLang, 
      client
    );
    
    session.step = "awaiting_urban_help_confirmation";
    await saveSession(sender, session);
    return;
  }
  
  // Only proceed with urban help search if user is LOOKING FOR services
  console.log("🔧 [URBAN HELP TEXT] User is LOOKING FOR services");
  
  // Extract category and location from text
  const extractedInfo = extractUrbanHelpFromText(text);
  
  console.log(`🔧 [URBAN HELP] Extracted info:`, extractedInfo);
  
  if (!extractedInfo.category) {
    // Ask for category (show only 3 buttons max!)
    const categories = Object.entries(URBAN_HELP_CATEGORIES).slice(0, 3);
    const buttons = categories.map(([id, data]) => ({
      id: `text_category_${id}`,
      text: `${data.emoji} ${data.name}`
    }));
    
    // Add "Other" option as third button if we have space
    if (buttons.length < 3) {
      buttons.push({ id: 'text_category_other', text: '🔧 Other Service' });
    }
    
    await sendInteractiveButtonsWithClient(
      client,
      sender,
      "What type of service do you need?",
      buttons
    );
    
    session.urbanHelpContext = {
      text: text,
      step: "awaiting_category",
      location: extractedInfo.location || null
    };
    session.step = "awaiting_urban_help_category";
    
  } else if (!extractedInfo.location) {
    // Ask for location - NO BUTTONS, just text
    await sendMessageWithClient(sender, 
      `Where do you need the ${URBAN_HELP_CATEGORIES[extractedInfo.category]?.name || extractedInfo.category}?`,
      client
    );
    
    session.urbanHelpContext = {
      ...extractedInfo,
      step: "awaiting_location"
    };
    session.step = "awaiting_urban_help_location";

    // Persist a pending request so we can update it when location arrives
    try {
      if (typeof addUserRequest === 'function') {
        const pending = await addUserRequest(sender, {
          category: extractedInfo.category || null,
          location: null,
          originalText: extractedInfo.rawText || text,
          note: 'awaiting_location'
        });
        if (pending && pending.success) {
          session.urbanHelpContext.requestId = pending.requestId;
          console.log(`✅ [URBAN HELP] Pending user request saved: ${pending.requestId}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ [URBAN HELP] Could not save pending user request (text flow):', err);
    }
    
  } else {
    // We have both. For text-origin requests, assume user intent is explicit and run search immediately
    session.urbanHelpContext = {
      ...extractedInfo,
      text: text,
      step: "searching"
    };
    session.step = "searching_urban_help";

    // Inform the user we're searching and execute the search
    await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'searching', {
      category: URBAN_HELP_CATEGORIES[extractedInfo.category]?.name || extractedInfo.category || 'Service',
      location: extractedInfo.location || 'your area'
    }) || `🔍 Searching for ${URBAN_HELP_CATEGORIES[extractedInfo.category]?.name || extractedInfo.category || 'service'} in ${extractedInfo.location || 'your area'}...`, client);

    await urbanHelpFlow.executeUrbanHelpSearch(sender, extractedInfo, session, client, userLang);
  }
  
  await saveSession(sender, session);
}

/**
 * Extract urban help info from text - UPDATED WITH CONTEXT DETECTION
 */
function extractUrbanHelpFromText(text) {
  return urbanHelpFlow.extractUrbanHelpFromText(text);
}

// ========================================
// POST LISTING FLOW HANDLERS
// ========================================
/**
 * Handle post listing flow - UPDATED WITH DUAL OPTIONS
 */
async function handlePostListingFlow(sender, session = null, client = null) {
  console.log("📝 [POST LISTING] Offering dual posting options");
  
  const effectiveClient = getEffectiveClient(client);
  if (!effectiveClient) {
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_no_client'));
    return;
  }
  
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  
  let message = '';
  if (userLang === 'hi') {
    message = `📝 *नई लिस्टिंग पोस्ट करें*\n\n` +
              `आप दो तरीकों से पोस्ट कर सकते हैं:\n\n` +
              `1. 📋 *फॉर्म भरें* - एक गाइडेड फॉर्म जहां आप स्टेप बाय स्टेप भर सकते हैं\n` +
              `2. 💬 *चैट में टाइप करें* - बस अपनी लिस्टिंग का विवरण टाइप करें\n\n` +
              `आप कौनसा विकल्प चुनना चाहेंगे?`;
  } else if (userLang === 'ta') {
    message = `📝 *புதிய பட்டியலை இடுகையிடு*\n\n` +
              `நீங்கள் இரண்டு வழிகளில் இடுகையிடலாம்:\n\n` +
              `1. 📋 *படிவத்தை நிரப்பவும்* - ஒரு வழிகாட்டப்பட்ட படிவம்\n` +
              `2. 💬 *அரட்டையில் தட்டச்சு செய்யவும்* - உங்கள் பட்டியல் விவரங்களை தட்டச்சு செய்யவும்\n\n` +
              `நீங்கள் எந்த விருப்பத்தை தேர்வு செய்ய விரும்புகிறீர்கள்?`;
  } else {
    message = `📝 *Post a New Listing*\n\n` +
              `You can post in two ways:\n\n` +
              `1. 📋 *Fill out a form* - A guided step-by-step form\n` +
              `2. 💬 *Type in chat* - Simply type your listing details\n\n` +
              `Which option would you prefer?`;
  }
  
  // Send interactive buttons
  await sendInteractiveButtonsWithClient(
    effectiveClient,
    sender,
    message,
    [
      { id: 'post_form', text: '📋 Use Form' },
      { id: 'post_chat', text: '💬 Type in Chat' },
      { id: 'post_back', text: '⬅️ Back to Menu' }
    ]
  );
  
  // Update session
  if (session) {
    session.postingOptions = true;
    session.step = "awaiting_posting_option";
    await saveSession(sender, session);
  }
}

// ===========================
// ✅ NEW: Handle posting result function
// ===========================
async function handlePostingResult(sender, postingResult, session, effectiveClient) {
  console.log(`📝 [HANDLE POSTING] Handling posting result: ${postingResult.type}`);
  
  switch(postingResult.type) {
    case 'question':
    case 'confirmation':
      await sendMessageWithClient(sender, postingResult.response, effectiveClient);
      session.step = "posting_flow";
      break;
      
    case 'confirmation_with_buttons':
    case 'summary_with_buttons':
      console.log(`📝 [HANDLE POSTING] Sending confirmation with buttons`);
      await sendInteractiveButtonsWithClient(
        effectiveClient,
        sender,
        postingResult.response,
        postingResult.buttons || [
          { id: 'confirm_yes', title: '✅ Yes, Post It' },
          { id: 'confirm_no', title: '❌ No, Cancel' }
        ]
      );
      session.step = "posting_flow";
      session.expectedField = 'confirmation';
      break;
      
    case 'success':
    case 'cancelled':
    case 'error':
      await sendMessageWithClient(sender, postingResult.response, effectiveClient);
      session.step = "menu";
      session.state = 'initial';
      break;
      
    default:
      console.log(`⚠️ [HANDLE POSTING] Unknown posting result type: ${postingResult.type}`);
  }
}

// ========================================
// ✅ NEW: CONFIRMATION HELPER FUNCTIONS
// ========================================
/**
 * Check if text is a confirmation response
 */
function isConfirmationResponse(text) {
  const confirmWords = [
    'yes', 'yeah', 'yep', 'sure', 'correct', 'right', 'ok', 'okay', 
    'proceed', 'go ahead', 'that\'s right', 'exactly', 'perfect',
    'confirm', 'confirmed', 'y', 'ya', 'haan', 'हां', 'ஆம்'
  ];
  
  // Also check for common variations with spaces/special chars
  const normalized = text.replace(/[^a-zA-Z]/g, '').toLowerCase();
  return confirmWords.some(word => 
    text.includes(word) || normalized.includes(word)
  );
}

/**
 * Check if text is a denial response
 */
function isDenialResponse(text) {
  const denyWords = [
    'no', 'nope', 'wrong', 'incorrect', 'not correct', 'try again',
    'nah', 'नहीं', 'இல்லை'
  ];
  
  const normalized = text.replace(/[^a-zA-Z]/g, '').toLowerCase();
  return denyWords.some(word => 
    text.includes(word) || normalized.includes(word)
  );
}

/**
 * Handle the original request that was confirmed
 */
async function handleOriginalRequest(sender, originalText, session, effectiveClient) {
  console.log(`✅ [ORIGINAL REQUEST] Processing: "${originalText}"`);
  
  // CRITICAL: Clear the awaiting confirmation state BEFORE processing
  session.state = 'initial';
  session.step = 'menu';
  delete session.rawTranscription;
  await saveSession(sender, session);
  
  // Now process the original text directly, bypassing confirmation
  // Check if it's an urban help request
  if (isUrbanHelpRequest(originalText)) {
    console.log("🔧 [ORIGINAL REQUEST] Is urban help request");

    // Try to extract both category and location
    const extracted = extractUrbanHelpFromText(originalText);
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';

    if (extracted.category && extracted.location) {
      // We have full info — execute the search directly (skip re-confirmation)
      await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'searching', {
        category: getCategoryDisplayName(extracted.category),
        location: extracted.location
      }) || `🔍 Searching for ${extracted.category} in ${extracted.location}...`, effectiveClient);

      await urbanHelpFlow.executeUrbanHelpSearch(sender, extracted, session, effectiveClient, userLang);
    } else {
      // Partial info — ask for what's missing and persist pending request
      const missing = checkMissingUrbanHelpInfo(extracted);
      await askForMissingUrbanHelpInfo(sender, extracted, missing, userLang, effectiveClient);

      session.urbanHelpContext = {
        transcription: originalText,
        entities: extracted,
        missingInfo: missing,
        step: 'awaiting_missing_info'
      };
      session.step = 'awaiting_urban_help_info';

      try {
        if (typeof addUserRequest === 'function') {
          const pending = await addUserRequest(sender, {
            category: extracted.category || null,
            location: extracted.location || null,
            originalText: originalText,
            note: 'awaiting_missing_info'
          });
          if (pending && pending.success) {
            session.urbanHelpContext.requestId = pending.requestId;
            console.log(`✅ [URBAN HELP] Pending user request saved: ${pending.requestId}`);
          }
        }
      } catch (err) {
        console.warn('⚠️ [URBAN HELP] Could not save pending user request (original request):', err);
      }

      await saveSession(sender, session);
    }

  } else if (isUserOfferingServices(originalText)) {
    console.log("📝 [ORIGINAL REQUEST] Is offering services");
    // Process with posting service
    const postingResult = await handlePostingService(sender, originalText, session, effectiveClient);
    if (postingResult.handled) {
      await handlePostingResult(sender, postingResult, session, effectiveClient);
    }
  } else {
    // Process as property search
    console.log("🏠 [ORIGINAL REQUEST] Is property search");
    await sendMessageWithClient(sender, `🔍 Searching for properties matching: *"${originalText}"*`, effectiveClient);
    
    // Extract search criteria and search...
    const { intent, entities } = await voiceService.extractIntent(originalText, sender);
    await handleVoiceSearch(sender, intent, entities, session, effectiveClient);
  }
}

// ========================================
// UPDATED MAIN CONTROLLER - WITH POSTING SYSTEM, URBAN HELP SUPPORT AND VOICE CONFIRMATION FLOW
// ========================================
async function handleIncomingMessage(sender, text = "", metadata = {}, client = null) {
  console.log("🔍 [CONTROLLER DEBUG] === START handleIncomingMessage ===");
  console.log("🔍 [CONTROLLER DEBUG] Input - sender:", sender);
  console.log("🔍 [CONTROLLER DEBUG] Input - text:", text);
  console.log("🔍 [CONTROLLER DEBUG] Input - metadata:", JSON.stringify(metadata, null, 2));
  console.log("🔍 [CONTROLLER DEBUG] Input - metadata type:", metadata?.type);
  
  // Get effective client (use passed client or global)
  const effectiveClient = getEffectiveClient(client);
  if (!effectiveClient) {
    console.warn("⚠️ [CONTROLLER] No WhatsApp client available; proceeding without client (messages may not be sent)");
  }
  
  console.log("🔍 [CONTROLLER DEBUG] Effective client available:", !!effectiveClient);
  
  if (!sender) return;

  // ===========================
  // ✅ CRITICAL FIX: Get session FIRST, before any checks
  // ===========================
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

  // Load user's preferred language from profile (if saved) and apply to multiLanguage
  try {
    const userProfile = await getUserProfile(sender);
    if (userProfile && userProfile.preferredLanguage) {
      if (multiLanguage.isLanguageSupported(userProfile.preferredLanguage)) {
        multiLanguage.setUserLanguage(sender, userProfile.preferredLanguage);
        session.preferredLanguage = userProfile.preferredLanguage;
        console.log(`🌐 Applied saved preferred language: ${userProfile.preferredLanguage} for ${sender}`);
      }
    }
  } catch (err) {
    console.warn('🌐 Could not load user profile language:', err);
  }
  
  console.log("🔍 [CONTROLLER DEBUG] Session loaded:", session.step, session.state);

  // ===========================
  // ✅ CRITICAL FIX: Declare replyId EARLY
  // ===========================
  let replyId = null;
  
  if (metadata?.interactive?.type === "list_reply") {
    replyId = metadata.interactive.list_reply.id;
  } else if (metadata?.interactive?.type === "button_reply") {
    replyId = metadata.interactive.button_reply.id;
  }
  
  console.log("🔍 [CONTROLLER DEBUG] replyId:", replyId);
  
  // Handle language list replies early
  if (replyId && replyId.startsWith('lang_')) {
    const lang = replyId.split('lang_')[1];
    const languageNames = { en: 'English', hi: 'हिंदी', ta: 'தமிழ்', gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ' };
    try {
      const saved = await saveUserLanguage(sender, lang);
      if (saved) {
        multiLanguage.setUserLanguage(sender, lang);
        session.housingFlow = session.housingFlow || {};
        session.housingFlow.awaitingLangSelection = false;
        session.step = 'menu';
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'language_set', { lang: languageNames[lang] || lang }));
        await saveSession(sender, session);
        await sendMainMenuViaService(sender, lang);
        return session;
      } else {
        await sendMessageWithClient(sender, 'Unsupported language selected.');
        return session;
      }
    } catch (err) {
      console.error('🌐 Error setting language from list reply:', err);
    }
  }

  // Handle Urban Help "Type Request" button (avoid routing to posting service by mistake). This handles both the menu case and
  // the case where a quick urban_help draft was created and the session moved into posting_flow.
  if (replyId && replyId === 'urban_type') {
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';

    // If a posting draft for urban_help exists, remove it to prevent confusion (user wants to type a request, not post)
    try {
      const postingService = new PostingService(sender);
      const existingDraft = await postingService.draftManager.getUserActiveDraft(sender);
      if (existingDraft && existingDraft.category === 'urban_help') {
        console.log('🔧 [URBAN TYPE] Removing existing urban_help draft to switch to typed request');
        await postingService.draftManager.deleteDraft(existingDraft.id);
        // Clear posting session markers
        delete session.mode;
        delete session.draftId;
        session.step = 'menu';
      }
    } catch (err) {
      console.warn('⚠️ [URBAN TYPE] Error checking/removing draft:', err);
    }

    await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'type_instead') || '📝 Please type your request:', effectiveClient);
    session.step = 'awaiting_urban_help_info';
    session.state = 'awaiting_text_input';
    await saveSession(sender, session);
    return session;
  }

  // ===========================
  // PRIORITY ROUTING: If user is mid-way in job seeker flow, route replies directly to jobFlow
  // This avoids misrouting role replies like "customer service" into posting/urban flows
  // ===========================
  if (session.jobSeekerContext && session.jobSeekerContext.step === 'collecting_info') {
    console.log('🔁 [CONTROLLER] Active job seeker flow detected - routing incoming message to jobFlow');
    try {
      await jobFlow.handleJobSeekerReply(sender, text, session, effectiveClient);
      await saveSession(sender, session);
      return session;
    } catch (err) {
      console.warn('⚠️ [CONTROLLER] Error routing to jobFlow:', err);
    }
  }

  // ===========================
  // STRUCTURED JOB POST DETECTION: Save immediately if text contains job-post fields
  // ===========================
  if (isStructuredJobPost(text)) {
    console.log('💼 [STRUCTURED POST] Detected structured job posting - routing to jobFlow.handleJobPosting (save immediately)');
    try {
      await jobFlow.handleJobPosting(sender, text, session, effectiveClient);
      await saveSession(sender, session);
      return session;
    } catch (err) {
      console.warn('⚠️ [CONTROLLER] Error handling structured job post:', err);
    }
  }

  const msg = String(replyId || text || "").trim();
  const lower = msg.toLowerCase();
  
  console.log("🔍 [CONTROLLER DEBUG] processed msg:", msg);
  console.log("🔍 [CONTROLLER DEBUG] processed lower:", lower);
  
  // ===========================
  // ✅ CRITICAL FIX: Check for confirmation response BEFORE anything else
  // ===========================
  if (text && !replyId) {
    const lowerText = text.toLowerCase().trim();
    
    // Check if this is a confirmation response (YES, NO, etc.)
    if (session.state === 'awaiting_confirmation' || session.step === 'awaiting_confirmation') {
      console.log(`✅ [CONFIRMATION FLOW] Processing confirmation: "${text}"`);
      
      if (isConfirmationResponse(lowerText)) {
        console.log(`✅ [CONFIRMATION FLOW] User confirmed: "${text}"`);
        
        // Get the stored transcription from session
        const confirmedText = session.rawTranscription;
        if (!confirmedText) {
          await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'no_previous_request'), effectiveClient);
          session.state = 'initial';
          session.step = 'menu';
          await saveSession(sender, session);
          await sendMainMenuViaService(sender);
          return session;
        }

        // If we are awaiting a missing location as part of an urban-help context,
        // treat the confirmation as the location value instead of reprocessing as a new request.
        if (session.urbanHelpContext && session.urbanHelpContext.missingInfo && session.urbanHelpContext.missingInfo.includes('location')) {
          console.log('🔧 [CONFIRMATION FLOW] Confirmed text is location; completing urban-help search');
          const userLang = multiLanguage.getUserLanguage(sender) || 'en';

          // Update context
          session.urbanHelpContext.entities = session.urbanHelpContext.entities || {};
          session.urbanHelpContext.entities.location = confirmedText;

          // Run search directly
          await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'searching', {
            category: getCategoryDisplayName(session.urbanHelpContext.entities.category) || session.urbanHelpContext.entities.category || 'Service',
            location: confirmedText
          }) || `🔍 Searching for ${session.urbanHelpContext.entities.category} in ${confirmedText}...`, effectiveClient);

          await urbanHelpFlow.executeUrbanHelpSearch(sender, session.urbanHelpContext.entities, session, effectiveClient, userLang);
          return session;
        }
        
        // Process the ORIGINAL request, not the "Yes"
        await sendMessageWithClient(sender, `✅ Perfect! Processing: *"${confirmedText}"*`, effectiveClient);
        
        // Now handle the ORIGINAL request (which was "Looking for 2BHK in Delhi")
        // This should skip confirmation and go straight to processing
        await handleOriginalRequest(sender, confirmedText, session, effectiveClient);
        return session;
      } else if (isDenialResponse(lowerText)) {
        console.log(`❌ [CONFIRMATION FLOW] User denied: "${text}"`);
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'try_again'), effectiveClient);
        session.state = 'initial';
        session.step = 'menu';
        delete session.rawTranscription;
        await saveSession(sender, session);
        return session;
      }
    }
  }

  // ===========================
  // ✅ CRITICAL FIX: Check for button confirmation clicks
  // ===========================
  if (replyId && replyId === 'confirm_yes' && session.state === 'awaiting_confirmation') {
    console.log(`✅ [BUTTON CONFIRMATION] Button click: ${replyId}`);
    
    const confirmedText = session.rawTranscription;
    if (!confirmedText) {
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'no_previous_request'), effectiveClient);
      session.state = 'initial';
      session.step = 'menu';
      await saveSession(sender, session);
      await sendMainMenuViaService(sender);
      return session;
    }

    // If we are awaiting a missing location as part of urban-help, treat this as location
    if (session.urbanHelpContext && session.urbanHelpContext.missingInfo && session.urbanHelpContext.missingInfo.includes('location')) {
      console.log('🔧 [BUTTON CONFIRMATION] Confirmed text treated as location, executing urban help search');
      const userLang = multiLanguage.getUserLanguage(sender) || 'en';

      session.urbanHelpContext.entities = session.urbanHelpContext.entities || {};
      session.urbanHelpContext.entities.location = confirmedText;

      await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'searching', {
        category: getCategoryDisplayName(session.urbanHelpContext.entities.category) || session.urbanHelpContext.entities.category || 'Service',
        location: confirmedText
      }) || `🔍 Searching for ${session.urbanHelpContext.entities.category} in ${confirmedText}...`, effectiveClient);

      await urbanHelpFlow.executeUrbanHelpSearch(sender, session.urbanHelpContext.entities, session, effectiveClient, userLang);
      return session;
    }

    await sendMessageWithClient(sender, `✅ Perfect! Processing: *"${confirmedText}"*`, effectiveClient);
    await handleOriginalRequest(sender, confirmedText, session, effectiveClient);
    return session;
  }

  // ===========================
  // ✅ EMERGENCY FIX: Check for POSTING confirmation button clicks FIRST
  // ===========================
  if (replyId && (replyId.startsWith('confirm_') || replyId === 'type_instead') && 
      (session.mode === 'posting' || session.step === 'posting_flow')) {
    
    console.log(`📝 [POSTING CONFIRMATION FIRST] Detected posting confirmation button: ${replyId}`);
    
    // Handle posting confirmation
    await handlePostingConfirmation(sender, replyId, session, effectiveClient);
    await saveSession(sender, session);
    return session;
  }

// ===========================
// ✅ EMERGENCY FIX: Detect offering vs looking context (IMMEDIATE FIX)
// ===========================
if (text && !replyId) {
  // Get session first
  session = (await getSession(sender)) || { 
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
  
  const lowerText = text.toLowerCase();

  // QUICK GUARD: If message contains the word 'job' but does NOT contain explicit hiring/post signals,
  // treat it as a job-seeker query and route to the job flow (avoids misrouting to posting/urban help)
  const hasJobWord = /\bjob\b/i.test(text);
  const jobPostSignals = /\b(hiring|vacanc(?:y|ies)|immediate joining|apply now|apply immediately|job opening|vacancy:|hiring:|want to hire|need to hire|looking to hire|ctc|salary|perks)\b/i;
  if (hasJobWord && !jobPostSignals.test(text)) {
    console.log('💼 [JOB GUARD] Detected "job" without hiring indicators — routing to job flow');
    try {
      if (session.jobSeekerContext && session.jobSeekerContext.step) {
        await jobFlow.handleJobSeekerReply(sender, text, session, effectiveClient);
      } else {
        await jobFlow.handleJobSeekerStart(sender, session, effectiveClient, text);
      }
      await saveSession(sender, session);
      return session;
    } catch (err) {
      console.warn('⚠️ [JOB GUARD] Error routing job message to jobFlow:', err);
    }
  }
  
  // ✅ CRITICAL FIX: Check for offering FIRST
  const context = detectIntentContext(text);
  const isOffering = isUserOfferingServices(text);
  
  console.log(`🎯 [PRIMARY CHECK] Context: ${context}, IsOffering: ${isOffering}`);
  
  if (isOffering || context === 'offer') {
    console.log("🎯 [PRIMARY] User is OFFERING services, routing to posting service");
    
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';
    let ackMessage = '';
    
    if (userLang === 'hi') {
      ackMessage = "🔧 मैं देख रहा हूं कि आप सेवाएं प्रदान कर रहे हैं। मैं आपकी पोस्टिंग में मदद करता हूं...";
    } else if (userLang === 'ta') {
      ackMessage = "🔧 நீங்கள் சேவைகளை வழங்குகிறீர்கள் என்று பார்க்கிறேன். உங்கள் இடுகைக்கு உதவுகிறேன்...";
    } else {
      ackMessage = "🔧 I see you're offering services. Let me help you post this...";
    }
    
    await sendMessageWithClient(sender, ackMessage, effectiveClient);
    
    // Process with posting service
    const postingResult = await handlePostingService(sender, text, session, effectiveClient);
    console.log("📝 [CONTROLLER] Posting service result:", postingResult);
    
    if (postingResult.handled) {
      await handlePostingResult(sender, postingResult, session, effectiveClient);
      await saveSession(sender, session);
      return session; // ✅ RETURN IMMEDIATELY
    }
    
    await saveSession(sender, session);
  }
  
  // ✅ JOB DETECTION: Posting vs Searching for Jobs
  const jobOfferRE = /\b(hiring|vacancy|vacancies|immediate joining|apply now|apply immediately|job opening|vacancy:|hiring:|want to hire|need to hire|looking to hire)\b/i;
  const jobSearchRE = /(\blooking for.*(job|work|employment|opportunity|position)|need.*(job|work|employment|position)|searching for.*(job|work|employment|position)|job.?search|seeking.*job|i.?m.*looking|want.*job|need.*job|employment opportunity|mujhe job|job chahiye|kaam chahiye|naukri|employment)\b/i;

  if (jobOfferRE.test(text) || detectIntentContext(text) === 'job_offer') {
    console.log('💼 [JOB POST] Detected job posting → routing to jobFlow');
    try {
      await jobFlow.handleJobPosting(sender, text, session, effectiveClient);
    } catch (err) {
      console.warn('⚠️ [JOB POST] Error while handling job posting:', err);
    }
    await saveSession(sender, session);
    return session;
  }

  if (jobSearchRE.test(text) || detectIntentContext(text) === 'job_search') {
    console.log('💼 [JOB SEARCH] Detected job seeker intent → routing to jobFlow');
    if (session.jobSeekerContext && session.jobSeekerContext.step) {
      await jobFlow.handleJobSeekerReply(sender, text, session, effectiveClient);
    } else {
      // Pass the user's original text so we can extract role/location/experience from one message
      await jobFlow.handleJobSeekerStart(sender, session, effectiveClient, text);
    }
    await saveSession(sender, session);
    return session;
  }

  // ✅ ONLY THEN: Check if it's an urban help request (looking for services)
  if (isUrbanHelpRequest(text)) {
    console.log("🔧 [URBAN HELP] Text request detected - user is LOOKING FOR services");
    
    // CRITICAL: DETERMINE CONTEXT AGAIN TO BE SURE
    const recheckContext = detectIntentContext(text);
    const recheckIsOffering = isUserOfferingServices(text);
    
    console.log(`🔍 [CONTEXT RE-CHECK] Context: ${recheckContext}, IsOffering: ${recheckIsOffering}`);
    
    if (recheckIsOffering || recheckContext === 'offer') {
      // Actually it IS an offering - double-check routing
      console.log("🔧 [URBAN HELP CORRECTION] Actually an offering, re-routing to posting");
      
      const userLang = multiLanguage.getUserLanguage(sender) || 'en';
      let ackMessage = '';
      
      if (userLang === 'hi') {
        ackMessage = "🔧 मैं देख रहा हूं कि आप सेवाएं प्रदान कर रहे हैं। मैं आपकी पोस्टिंग में मदद करता हूं...";
      } else if (userLang === 'ta') {
        ackMessage = "🔧 நீங்கள் சேவைகளை வழங்குகிறீர்கள் என்று பார்க்கிறேன். உங்கள் இடுகைக்கு உதவுகிறேன்...";
      } else {
        ackMessage = "🔧 I see you're offering services. Let me help you post this...";
      }
      
      await sendMessageWithClient(sender, ackMessage, effectiveClient);
      
      const postingResult = await handlePostingService(sender, text, session, effectiveClient);
      if (postingResult.handled) {
        await handlePostingResult(sender, postingResult, session, effectiveClient);
        await saveSession(sender, session);
        return session;
      }
    } else {
      // User is genuinely looking for services
      await urbanHelpFlow.handleUrbanHelpTextRequest(sender, text, session, effectiveClient);
      return session; // ✅ RETURN IMMEDIATELY
    }
  }
  
  // ✅ THIRD: Check general posting service for non-urban help requests
  const postingResult = await handlePostingService(sender, text, session, effectiveClient);
  if (postingResult.handled) {
    await handlePostingResult(sender, postingResult, session, effectiveClient);
    await saveSession(sender, session);
    return session; // ✅ RETURN IMMEDIATELY
  }
  
  // Save the session after all checks
  await saveSession(sender, session);
}

  // ===========================
  // 0) PRIORITY: CHECK FOR VOICE MESSAGES - UPDATED WITH SIMPLE CONFIRMATION FLOW AND ACCESS TOKEN ERROR HANDLING
  // ===========================
  if (metadata?.type === "audio" || metadata?.type === "voice" || text === 'voice_note') {
    console.log("🎤 [VOICE] Audio message detected");
    
    // Get session
    session = (await getSession(sender)) || { 
      step: "start",
      isInitialized: false,
      awaitingLang: false,
      state: 'initial'
    };
    
    // Check if we have audio URL from metadata
    const audioUrl = metadata.audio?.url || metadata.url || metadata.audioMetadata?.url || metadata.voice?.url;
    
    if (!audioUrl) {
      console.error("🎤 [VOICE] No audio URL found");
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_voice_access'));
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      return session;
    }
    
    console.log("🎤 [VOICE] Processing audio URL:", audioUrl.substring(0, 100) + "...");
    
    // Send processing message
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'processing_voice'));
    
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
          await sendMessageWithClient(sender, 
            "❌ Voice processing is temporarily unavailable. Please type your request instead."
          );
        } else {
          await sendMessageWithClient(sender, 
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
      await sendInteractiveButtonsWithClient(
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
      
      await sendMessageWithClient(sender, errorMessage);
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      return session;
    }
  }

  // Get session
  session = (await getSession(sender)) || { 
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

  // ---------------------------------------------
  // Quick handling: if we are awaiting an urban-help location, accept any text as location
  // This ensures a user can reply "Noida" or "Bombay" without being routed to unknown command
  // ---------------------------------------------
  if (text && session.urbanHelpContext && (session.urbanHelpContext.step === 'awaiting_location' || session.urbanHelpContext.step === 'awaiting_missing_info' || session.step === 'awaiting_urban_help_info')) {
    console.log(`🔧 [URBAN HELP] Received location while awaiting_location/missing_info: ${text}`);

    // Try to extract location from the reply text first
    const extracted = extractUrbanHelpFromText(text || '');
    const loc = extracted.location || text;

    // Accept the text as location
    session.urbanHelpContext.entities = session.urbanHelpContext.entities || {};
    session.urbanHelpContext.entities.location = loc;
    session.urbanHelpContext.text = session.urbanHelpContext.text || text;

    // Persist updated context
    await saveSession(sender, session);

    // If the reply is short (likely an implicit confirmation), go straight to searching
    const words = (loc || '').split(/\s+/).filter(Boolean);
    if (words.length <= 4) {
      session.urbanHelpContext.step = 'searching';
      session.step = 'searching_urban_help';

      const userLang = multiLanguage.getUserLanguage(sender) || 'en';
      await sendMessageWithClient(sender, multiLanguage.getMessage(userLang, 'searching', {
        category: session.urbanHelpContext.entities.category || 'service',
        location: loc
      }) || `🔍 Searching for ${session.urbanHelpContext.entities.category || 'service'} in ${loc}...`, effectiveClient);

      await urbanHelpFlow.executeUrbanHelpSearch(sender, session.urbanHelpContext.entities, session, effectiveClient, multiLanguage.getUserLanguage(sender) || 'en');
      return session;
    }

    // Otherwise show confirmation (longer replies may be an updated full request)
    session.urbanHelpContext.step = "awaiting_confirmation";

    await sendUrbanHelpConfirmation(sender,
      session.urbanHelpContext.text,
      session.urbanHelpContext.entities,
      multiLanguage.getUserLanguage(sender) || 'en',
      effectiveClient
    );

    session.step = "awaiting_urban_help_confirmation";
    await saveSession(sender, session);
    return session;
  }

// ===========================
// ✅ UPDATED: CHECK FOR POSTING SERVICE - INCLUDES CONFIRMATION HANDLING
// ===========================
if (text && !replyId) { // Only check text messages, not button clicks
  // Check if user is already in posting flow
  if (session.mode === 'posting' && session.draftId) {
    console.log(`📝 [CONTROLLER] User in posting flow, continuing with draft: ${session.draftId}`);
    
    // Create posting service instance
    const postingService = new PostingService(sender);
    
    // Continue the posting session
    const result = await postingService.continuePosting(text, session);
    
    if (result && result.shouldHandle !== false) {
      console.log(`📝 [CONTROLLER] Posting service handled: ${result.type}`);
      
      // Handle different response types
      switch(result.type) {
        case 'question':
        case 'confirmation':
          await sendMessageWithClient(sender, result.response, effectiveClient);
          // Update session for confirmation flow
          if (result.type === 'confirmation') {
            session.step = "posting_flow";
            session.expectedField = 'confirmation';
          }
          break;
          
        case 'confirmation_with_buttons':
        case 'summary_with_buttons':
          // Send interactive buttons for confirmation
          console.log(`📝 [CONTROLLER] Sending confirmation with buttons`);
          await sendInteractiveButtonsWithClient(
            effectiveClient,
            sender,
            result.response,
            result.buttons
          );
          session.step = "posting_flow";
          session.expectedField = 'confirmation';
          break;
          
        case 'success':
          await sendMessageWithClient(sender, result.response, effectiveClient);
          session.step = "menu";
          session.state = 'initial';
          delete session.mode;
          delete session.draftId;
          delete session.expectedField;
          break;
          
        case 'cancelled':
          await sendMessageWithClient(sender, result.response, effectiveClient);
          session.step = "menu";
          session.state = 'initial';
          delete session.mode;
          delete session.draftId;
          delete session.expectedField;
          break;
          
        case 'error':
          await sendMessageWithClient(sender, `⚠️ ${result.response}`, effectiveClient);
          session.step = "menu";
          session.state = 'initial';
          delete session.mode;
          delete session.draftId;
          delete session.expectedField;
          break;
      }
      
      await saveSession(sender, session);
      return session;
    }
  }
  
// If not in posting flow, check if it's a new posting request
const postingResult = await handlePostingService(sender, text, session, effectiveClient);
console.log("📝 [CONTROLLER] Posting service returned:", postingResult);

if (postingResult.handled) {
  console.log(`📝 [CONTROLLER] Posting service handled: ${postingResult.type}`);
  await handlePostingResult(sender, postingResult, session, effectiveClient);
  await saveSession(sender, session);
  return session;
}
}

// ===========================
// ✅ NEW: Handle posting result function
// ===========================
async function handlePostingResult(sender, postingResult, session, effectiveClient) {
  console.log(`📝 [HANDLE POSTING] Handling posting result: ${postingResult.type}`);
  
  switch(postingResult.type) {
    case 'question':
    case 'confirmation':
      await sendMessageWithClient(sender, postingResult.response, effectiveClient);
      session.step = "posting_flow";
      break;
      
    case 'confirmation_with_buttons':
    case 'summary_with_buttons':
      console.log(`📝 [HANDLE POSTING] Sending confirmation with buttons`);
      await sendInteractiveButtonsWithClient(
        effectiveClient,
        sender,
        postingResult.response,
        postingResult.buttons || [
          { id: 'confirm_yes', title: '✅ Yes, Post It' },
          { id: 'confirm_no', title: '❌ No, Cancel' }
        ]
      );
      session.step = "posting_flow";
      session.expectedField = 'confirmation';
      break;
      
    case 'success':
    case 'cancelled':
    case 'error':
      await sendMessageWithClient(sender, postingResult.response, effectiveClient);
      session.step = "menu";
      session.state = 'initial';
      break;
      
    default:
      console.log(`⚠️ [HANDLE POSTING] Unknown posting result type: ${postingResult.type}`);
  }
}

// ===========================
// ✅ CRITICAL FIX: Check for POSTING FLOW confirmation responses
// ===========================
if (text && !replyId && session.step === "posting_flow") {
  console.log(`📝 [POSTING FLOW] Processing posting flow response: "${text}"`);
  
  // Create posting service instance
  const postingService = new PostingService(sender);
  
  // Check if user already has a posting session
  const userSession = await getSession(sender);
  
  if (userSession.mode === 'posting' && userSession.draftId) {
    // User is in posting mode, continue with posting service
    const result = await postingService.continuePosting(text, userSession);
    
    if (result && result.shouldHandle !== false) {
      await handlePostingResult(sender, result, session, effectiveClient);
      await saveSession(sender, session);
      return session;
    }
  }
}

// ===========================
// ✅ ADDED: CHECK FOR VOICE CONFIRMATION BUTTON CLICKS - UPDATED WITH OFFERING DETECTION
// ===========================
if (replyId && (replyId.startsWith('confirm_') || replyId.startsWith('try_again') || 
    replyId.startsWith('type_instead') || replyId.startsWith('use_buttons'))) {
    
    console.log(`🎤 [VOICE BUTTON] Detected voice confirmation button: ${replyId}`);
    
    // Handle all confirmation types
    if (replyId.startsWith('confirm_')) {
        // Use voice raw transcription if available, otherwise fall back to urbanHelpContext or stored text
        const confirmedText = session.rawTranscription || session.urbanHelpContext?.text || session.urbanHelpContext?.transcription || session.urbanHelpContext?.rawText || '';
        
        if (!confirmedText) {
            await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'no_transcription'));
            session.state = 'initial';
            session.step = 'menu';
            await saveSession(sender, session);
            await sendMainMenuViaService(sender);
            return session;
        }
        
        // First, check the context of what they said
        const extractedInfo = extractUrbanHelpFromText(confirmedText);
        const context = detectIntentContext(confirmedText);
        const isOffering = isUserOfferingServices(confirmedText);
        
        console.log(`🔍 [VOICE/TEXT CONFIRM] Extracted context: ${context}, IsOffering: ${isOffering}`);
        console.log(`🔍 [VOICE/TEXT CONFIRM] Confirmed text: "${confirmedText}"`);
        
        // ✅ CRITICAL FIX: Check for "looking for" patterns first
        if (confirmedText.toLowerCase().includes('looking for') || 
            confirmedText.toLowerCase().includes('searching for') ||
            confirmedText.toLowerCase().includes('need ') ||
            confirmedText.toLowerCase().includes('want ') ||
            context === 'find') {
            
            console.log("🔧 [VOICE/TEXT CONFIRM] User is LOOKING FOR services (based on keywords)");
            
            await sendMessageWithClient(sender, `✅ Perfect! You're looking for: *"${confirmedText}"*\n\nSearching for services...`);
            
            const userLang = multiLanguage.getUserLanguage(sender) || 'en';
            
            if (extractedInfo.category && extractedInfo.location) {
                // We have both category and location, search immediately
                await executeUrbanHelpSearch(sender, extractedInfo, session, effectiveClient, userLang);
            } else {
                // Need more info
                await handleUrbanHelpTextRequest(sender, confirmedText, session, effectiveClient);
            }
            
        } else if (isOffering || context === 'offer') {
            // USER IS OFFERING A SERVICE → GO TO POSTING SERVICE
            console.log("🔧 [VOICE] User is OFFERING services, routing to posting service");
            
            const userLang = multiLanguage.getUserLanguage(sender) || 'en';
            let ackMessage = '';
            
            if (userLang === 'hi') {
                ackMessage = "🔧 मैं देख रहा हूं कि आप सेवाएं प्रदान कर रहे हैं। मैं आपकी पोस्टिंग में मदद करता हूं...";
            } else if (userLang === 'ta') {
                ackMessage = "🔧 நீங்கள் சேவைகளை வழங்குகிறீர்கள் என்று பார்க்கிறேன். உங்கள் இடுகைக்கு உதவுகிறேன்...";
            } else {
                ackMessage = "🔧 I see you're offering services. Let me help you post this...";
            }
            
            await sendMessageWithClient(sender, ackMessage);
            
            // CRITICAL FIX: Clear any existing urban help context
            delete session.urbanHelpContext;
            
            // Process with posting service
            const postingResult = await handlePostingService(sender, confirmedText, session, effectiveClient);
            console.log(`📝 [VOICE POSTING] Posting service result:`, postingResult);
            
            if (postingResult.handled) {
                await handlePostingResult(sender, postingResult, session, effectiveClient);
                await saveSession(sender, session);
                return session; // ✅ RETURN IMMEDIATELY
            } else {
                // If posting service didn't handle it, start a NEW posting flow
                console.log("📝 [VOICE] Posting service didn't handle, starting new posting flow");
                
                // Initialize a new posting service session
                const postingService = new PostingService(sender);
                const newResult = await postingService.startNewListing(confirmedText);
                
                if (newResult && newResult.type === 'question') {
                    await sendMessageWithClient(sender, newResult.response, effectiveClient);
                    session.step = "posting_flow";
                    session.state = 'posting';
                    await saveSession(sender, session);
                } else {
                    await sendMessageWithClient(sender, "I understand you're offering services. Please use the '📝 Post Listing' option from the menu.");
                    session.state = 'initial';
                    session.step = 'menu';
                    await saveSession(sender, session);
                    await sendMainMenuViaService(sender);
                }
                return session; // ✅ RETURN IMMEDIATELY
            }
            
        } else if (isUrbanHelpRequest(confirmedText)) {
            // USER IS LOOKING FOR A SERVICE → SEARCH FOR PROVIDERS
            console.log(`🔧 [URBAN HELP] User is LOOKING FOR services`);
            
            await sendMessageWithClient(sender, `✅ Perfect! You're looking for: *"${confirmedText}"*\n\nSearching for services...`);
            
            const userLang = multiLanguage.getUserLanguage(sender) || 'en';
            
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
        
    } else if (replyId === 'try_again' || replyId === 'try_again_urban') {
        // User wants to try again
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'try_again'));
        session.state = 'initial';
        session.step = 'menu';
        delete session.rawTranscription;
        delete session.urbanHelpContext;
        await saveSession(sender, session);
        
    } else if (replyId === 'type_instead') {
        // User wants to type
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'prompt_type_what_looking'));
        session.state = 'awaiting_text_input';
        session.step = 'awaiting_text_input';
        delete session.rawTranscription;
        await saveSession(sender, session);
        
    } else if (replyId === 'use_buttons') {
        // User wants to use menu buttons
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'showing_menu_options'));
        session.state = 'initial';
        session.step = 'menu';
        delete session.rawTranscription;
        await saveSession(sender, session);
        await sendMainMenuViaService(sender);
    }
    
    await saveSession(sender, session);
    return session;
}

// ===========================
// ✅ ADDED: CHECK FOR POSTING CONFIRMATION BUTTON CLICKS (already handled at the beginning)
// ===========================

// ===========================
// ✅ ADDED: CHECK FOR DRAFT CONFLICT BUTTONS
// ===========================
if (replyId && (replyId === 'continue_existing_draft' || replyId === 'start_new_listing' || replyId === 'cancel_draft_conflict') && 
    (session.step === "posting_flow" || session.mode === 'posting')) {
  console.log(`📝 [DRAFT CONFLICT] Handling draft conflict: ${replyId}`);
  
  const postingService = new PostingService(sender);
  
  if (replyId === 'continue_existing_draft') {
    // Get existing draft and continue
    const existingDraft = await postingService.draftManager.getUserActiveDraft(sender);
    if (existingDraft) {
      await postingService.sessionManager.updateSession({
        mode: 'posting',
        category: existingDraft.category,
        draftId: existingDraft.id,
        expectedField: null,
        step: 'posting_flow'
      });
      
      // Get next question
      const nextQuestion = await postingService.getNextQuestion(existingDraft.id);
      await sendMessageWithClient(sender, `↪️ Continuing your draft...\n\n${nextQuestion}`, effectiveClient);
      
      session.step = "posting_flow";
      session.mode = 'posting';
      session.draftId = existingDraft.id;
      await saveSession(sender, session);
    }
    
  } else if (replyId === 'start_new_listing') {
    // Delete old draft and start new
    const existingDraft = await postingService.draftManager.getUserActiveDraft(sender);
    if (existingDraft) {
      await postingService.draftManager.deleteDraft(existingDraft.id);
    }
    
    // Get the original message from session context
    const originalMessage = session.rawTranscription || session.lastMessage || '';
    if (originalMessage) {
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'starting_new_listing'), effectiveClient);
      
      // Process the original message again
      const result = await postingService.processMessage(originalMessage);
      if (result && result.shouldHandle !== false) {
        if (result.type === 'confirmation_with_buttons') {
          await sendInteractiveButtonsWithClient(
            effectiveClient,
            sender,
            result.response,
            result.buttons
          );
          session.step = "posting_flow";
          session.expectedField = 'confirmation';
        }
      }
    }
    
  } else if (replyId === 'cancel_draft_conflict') {
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'draft_conflict_cancelled'), effectiveClient);
    session.step = "menu";
    session.state = 'initial';
    delete session.mode;
    delete session.draftId;
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
  }
  
  await saveSession(sender, session);
  return session;
}

// ===========================
// ✅ NEW: Handle 'post_job' and 'find_job' clarifying buttons
// ===========================
if (replyId && (replyId === 'post_job' || replyId === 'find_job')) {
  console.log(`🔘 [BUTTON FLOW] Handling job clarification button: ${replyId}`);

  if (replyId === 'post_job') {
    // Start posting flow using the original message if available
    const postingService = new PostingService(sender);
    const originalMessage = session.rawTranscription || session.lastMessage || text || msg || '';

    // Try processing first (may return confirmation/summary)
    try {
      const result = await postingService.processMessage(originalMessage);
      if (result && result.shouldHandle !== false) {
        await handlePostingResult(sender, result, session, effectiveClient);
        await saveSession(sender, session);
        return session;
      }

      // Fallback: explicitly start a new listing
      const startResult = await postingService.startNewListing(originalMessage);
      if (startResult && startResult.shouldHandle !== false) {
        await handlePostingResult(sender, startResult, session, effectiveClient);
        await saveSession(sender, session);
        return session;
      }

    } catch (err) {
      console.error('⚠️ [BUTTON FLOW] Error starting posting from button:', err);
      await sendMessageWithClient(sender, "⚠️ Couldn't start posting. Please type your job details and I'll help you post it.", effectiveClient);
      session.step = 'menu';
      await saveSession(sender, session);
      return session;
    }
  }

  if (replyId === 'find_job') {
    console.log('🔎 [BUTTON FLOW] User chose to Find a job - routing to job seeker flow');
    try {
      if (session.jobSeekerContext && session.jobSeekerContext.step) {
        await jobFlow.handleJobSeekerReply(sender, text, session, effectiveClient);
      } else {
        await jobFlow.handleJobSeekerStart(sender, session, effectiveClient);
      }
      await saveSession(sender, session);
      return session;
    } catch (err) {
      console.error('⚠️ [BUTTON FLOW] Error routing to jobFlow:', err);
      await sendMessageWithClient(sender, "⚠️ Couldn't start job search. Please type what kind of job you're looking for.", effectiveClient);
      session.step = 'menu';
      await saveSession(sender, session);
      return session;
    }
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
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'no_transcription'));
        session.state = 'initial';
        session.step = 'menu';
        await saveSession(sender, session);
        await sendMainMenuViaService(sender);
        return session;
      }
      
      await sendMessageWithClient(sender, `✅ Perfect! You said: *"${confirmedText}"*\n\nLet me help you with that...`);
      
      // Check context first
      const extractedInfo = extractUrbanHelpFromText(confirmedText);
      const context = detectIntentContext(confirmedText);
      const isOffering = isUserOfferingServices(confirmedText);
      
      // ✅ CRITICAL FIX: Check for "looking for" patterns first
      if (confirmedText.toLowerCase().includes('looking for') || 
          confirmedText.toLowerCase().includes('searching for') ||
          confirmedText.toLowerCase().includes('need ') ||
          confirmedText.toLowerCase().includes('want ') ||
          context === 'find') {
        
        console.log("🔧 [VOICE TEXT] User is LOOKING FOR services (based on keywords)");
        
        if (extractedInfo.category && extractedInfo.location) {
          // We have both category and location, search immediately
          await executeUrbanHelpSearch(sender, extractedInfo, session, effectiveClient, userLang);
        } else {
          // Need more info
          await handleUrbanHelpTextRequest(sender, confirmedText, session, effectiveClient);
        }
        
      } else if (isOffering || context === 'offer') {
        // User is offering services
        let ackMessage = '';
        if (userLang === 'hi') {
          ackMessage = "🔧 मैं देख रहा हूं कि आप सेवाएं प्रदान कर रहे हैं। मैं आपकी पोस्टिंग में मदद करता हूं...";
        } else if (userLang === 'ta') {
          ackMessage = "🔧 நீங்கள் சேவைகளை வழங்குகிறீர்கள் என்று பார்க்கிறேன். உங்கள் இடுகைக்கு உதவுகிறேன்...";
        } else {
          ackMessage = "🔧 I see you're offering services. Let me help you post this...";
        }
        
        await sendMessageWithClient(sender, ackMessage);
        
        // Process with posting service
        const postingResult = await handlePostingService(sender, confirmedText, session, effectiveClient);
        if (postingResult.handled) {
          await handlePostingResult(sender, postingResult, session, effectiveClient);
        }
      } else if (isUrbanHelpRequest(confirmedText)) {
        // Check if it's an urban help request (looking for services)
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
      await sendMessageWithClient(sender, "🔄 No problem! Please send your voice message again.");
      session.state = 'initial';
      session.step = 'menu';
      delete session.rawTranscription;
      await saveSession(sender, session);
      
    } else if (lowerText.includes('type') || lowerText.includes('📝') || 
               lowerText.includes('टाइप') || lowerText.includes('தட்டச்சு')) {
      // User wants to type
      await sendMessageWithClient(sender, "📝 Please type what you're looking for:");
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
      
      await sendMessageWithClient(sender, errorMessage);
    }
    
    await saveSession(sender, session);
    return session;
  }

  // ===========================
  // 2) PRIORITY: CHECK FLOW SUBMISSION
  // ===========================
  const flowHandled = await handleFlowSubmission(metadata, sender);
  if (flowHandled) {
    const session = await getSession(sender);
    return session;
  }

  // ===========================
  // 3) CHECK FOR POSTING OPTION SELECTION (NEW)
  // ===========================
  if (msg === 'post_form' && session.step === 'awaiting_posting_option') {
    console.log("📋 User selected form posting");
    
    // Send WhatsApp Flow
    const { sendListingFlow } = require('./core/flows/whatsappFlows/postListingFlow');
    try {
      await sendListingFlow(sender);
      session.step = "awaiting_flow_completion";
      await saveSession(sender, session);
    } catch (error) {
      console.error("❌ Error sending flow:", error);
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_load_form'));
      session.step = "menu";
      await saveSession(sender, session);
    }
    return session;
  }

  if (msg === 'post_chat' && session.step === 'awaiting_posting_option') {
    console.log("💬 User selected chat posting");
    
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';
    
    let message = '';
    if (userLang === 'hi') {
      message = `💬 *चैट में टाइप करके पोस्ट करें*\n\n` +
                `बस अपनी लिस्टिंग का विवरण टाइप करें, जैसे:\n\n` +
                `• "मेरे पास सेक्टर 62 में 2BHK फ्लैट किराए पर है"\n` +
                `• "मैं गुड़गांव में इलेक्ट्रीशियन की सेवा देता हूं"\n` +
                `• "1BHK पीजी रूम उपलब्ध है, 8000 रुपये प्रति माह"\n\n` +
                `मैं आपसे जरूरी जानकारी एक-एक करके पूछूंगा।`;
    } else if (userLang === 'ta') {
      message = `💬 *அரட்டையில் தட்டச்சு செய்து இடுகையிடு*\n\n` +
                `உங்கள் பட்டியல் விவரங்களை தட்டச்சு செய்யவும், உதாரணம்:\n\n` +
                `• "செக்டர் 62-ல் 2BHK அடுக்குமாடி குடியிருப்பு கிடைக்கிறது"\n` +
                `• "குர்காவில் மின்தொழிலாளி சேவை செய்கிறேன்"\n` +
                `• "1BHK PG அறை கிடைக்கிறது, மாதத்திற்கு ₹8000"\n\n` +
                `நான் உங்களிடம் தேவையான தகவல்களை ஒவ்வொன்றாக கேட்பேன்.`;
    } else {
      message = `💬 *Type to Post in Chat*\n\n` +
                `Simply type your listing details, for example:\n\n` +
                `• "I have a 2BHK flat for rent in Sector 62"\n` +
                `• "I provide electrician services in Gurgaon"\n` +
                `• "1BHK PG room available, ₹8000 per month"\n\n` +
                `I'll ask you for required information one by one.`;
    }
    
    await sendMessageWithClient(sender, message);
    
    // Initialize posting service - will start when user types next message
    session.step = "awaiting_listing_description";
    session.state = 'initial';
    await saveSession(sender, session);
    
    return session;
  }

  if (msg === 'post_back' && session.step === 'awaiting_posting_option') {
    console.log("⬅️ User went back to menu");
    session.step = "menu";
    session.state = 'initial';
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
    return session;
  }

  // ===========================
  // 4) CHECK FOR URBAN HELP CONFIRMATION RESPONSES
  // ===========================
  if (session.step.startsWith("awaiting_urban_help_") && replyId) {
    console.log("🔧 [URBAN HELP] Processing response:", msg);
    return await handleUrbanHelpConfirmation(sender, msg, session, effectiveClient);
  }

  // ===========================
  // 5) CHECK FOR VOICE CONFIRMATION RESPONSES (OLD FLOW)
  // ===========================
  if (session.step === "awaiting_voice_confirmation" && replyId) {
    console.log("🎤 [VOICE] Processing confirmation response");
    return await handleVoiceConfirmation(sender, msg, session, effectiveClient);
  }

  // ===========================
  // 6) CHECK FOR VOICE SEARCH OPTIONS
  // ===========================
  if (msg.startsWith("voice_")) {
    return await handleVoiceSearchOptions(sender, msg, session, effectiveClient);
  }

  const user = await getUserProfile(sender);
  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(lower);
  const isNewUser = !user && !session.isInitialized;

  // ===========================
  // 7) NEW USER INTRO
  // ===========================
  if (isGreeting && isNewUser) {
    await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'welcome'));
    

    await sendLanguageListViaService(sender);

    session.isInitialized = true;
    session.housingFlow.awaitingLangSelection = true;
    session.step = "awaiting_language";
    await saveSession(sender, session);
    return session;
  }

  // ===========================
  // 8) EXISTING USER GREETING
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
  // 9) LANGUAGE SELECTION
  // ===========================
  if (session.housingFlow?.awaitingLangSelection) {
    const parsed = parseLangFromText(msg);

    if (parsed) {
      try {
        const saved = await saveUserLanguage(sender, parsed);
        if (saved) {
          multiLanguage.setUserLanguage(sender, parsed);
          session.housingFlow.awaitingLangSelection = false;
          session.step = "menu";
          session.state = 'initial';
          await saveSession(sender, session);

          // Send confirmation localized
          const languageNames = { en: 'English', hi: 'हिंदी', ta: 'தமிழ்', gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ' };
          await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'language_set', { lang: languageNames[parsed] || parsed }));

          await sendMainMenuViaService(sender, parsed);
          return session;
        }
      } catch (err) {
        console.warn("saveUserLanguage error:", err);
      }

      // Fallback if save failed
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'select_language_prompt'));
      await sendLanguageListViaService(sender);
      return session;
    } else {
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'select_language_prompt'));
      await sendLanguageListViaService(sender);
      return session;
    }
  }
  
  // ===========================
  // 10) URBAN HELP TEXT INPUT
  // ===========================
  if (session.step === "awaiting_urban_help_text" && text) {
    console.log("🔧 [URBAN HELP] Processing text input:", text);
    await handleUrbanHelpTextRequest(sender, text, session, effectiveClient);
    return session;
  }
  
  // ===========================
  // 11) TEXT INPUT AFTER VOICE CONFIRMATION
  // ===========================
  if (session.state === 'awaiting_text_input' && text) {
    console.log("📝 [TEXT INPUT] Processing text after voice fallback:", text);
    
    // Check if it's an urban help request
    if (isUrbanHelpRequest(text)) {
      await handleUrbanHelpTextRequest(sender, text, session, effectiveClient);
    } else {
      // Process as property-related request
      await sendMessageWithClient(sender, `🔍 Processing your request: *"${text}"*`);
      
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
        await sendMessageWithClient(sender, `✅ I understand you want to ${processingResult.intent.replace('_', ' ')}.`);
        await executeVoiceIntent(sender, processingResult.intent, processingResult.entities, session, effectiveClient);
      } else {
        await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'not_sure_try_menu'));
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
  // 12) URBAN HELP CATEGORY SELECTION
  // ===========================
if (msg.startsWith("text_category_") && session.step === "awaiting_urban_help_category") {
  const category = msg.replace("text_category_", "");
  const urbanContext = session.urbanHelpContext || {};
  
  urbanContext.category = category;
  urbanContext.step = "awaiting_location";
  
  // If we already have location from previous message, use it
  if (urbanContext.location) {
    // We have both category and location, show confirmation
    const userLang = multiLanguage.getUserLanguage(sender) || 'en';
    await sendUrbanHelpConfirmation(sender, urbanContext.text || category, urbanContext, userLang, effectiveClient);
    
    session.urbanHelpContext = urbanContext;
    session.step = "awaiting_urban_help_confirmation";
  } else {
    await sendMessageWithClient(sender, 
      `Where do you need the ${URBAN_HELP_CATEGORIES[category]?.name || category}?`,
      effectiveClient
    );
    
    session.urbanHelpContext = urbanContext;
    session.step = "awaiting_urban_help_location";
  }
  
  await saveSession(sender, session);
  return session;
}
  
  // ===========================
  // 13) URBAN HELP LOCATION INPUT
  // ===========================
// In handleIncomingMessage function, handle location input:
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
  // 14) MANAGE LISTINGS INTERACTIVE HANDLING
  // ==========================================
  
  // Handle listing selection from manage listings
  if (msg.startsWith("listing_") && (session.step === "managing_listings" || session.manageListings)) {
    console.log("🔍 [CONTROLLER] Listing selected for management:", msg);
    await handleListingSelection(sender, msg, session);
    return session;
  }
  
  // ==========================================
  // 15) DELETE FLOW HANDLING
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
  // 16) EDIT FLOW HANDLING
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
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_unable_edit_listing'));
    }
    return session;
  }
  
  // ==========================================
  // 17) EDIT FIELD SELECTION HANDLING
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
  // 18) EDIT FIELD VALUE INPUT (TEXT-BASED)
  // ==========================================
  if (session.editFlow?.step === "awaiting_field_value" && text) {
    console.log("🔍 [CONTROLLER] Field value received:", text);
    await updateFieldValue(sender, text, session);
    return session;
  }
  
  // ==========================================
  // 19) CANCEL MANAGE (Back button)
  // ==========================================
  if (msg === "cancel_manage" && session.manageListings?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Back to listing list");
    await handleManageListings(sender);
    return session;
  }
  
  // ==========================================
  // 20) SAVED LISTINGS INTERACTIVE HANDLING
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
      await sendMessageWithClient(
        sender,
        `📞 Contact the owner of "${listing.title || 'Untitled'}":\n\n` +
        `*Contact:* ${listing.contact}\n\n` +
        `You can call or message them directly.`
      );
    } else {
      await sendMessageWithClient(sender, "❌ Contact information is not available for this listing.");
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
  // 21) TEXT-BASED LISTING INPUT (FALLBACK)
  // ==========================================
  if (session.step === "awaiting_post_details" && text) {
    console.log("📝 [CONTROLLER] Processing text-based listing input");
    await handleTextListingInput(sender, text, session);
    return session;
  }
  
  // ==========================================
  // 22) INTERACTIVE LISTING ACTIONS
  // ==========================================
  if (session.step === "awaiting_listing_action" && replyId) {
    console.log(`🔄 Handling listing action: ${msg}`);
    
    const listingData = session.housingFlow.listingData;
    const currentIndex = session.housingFlow.currentIndex;
    const currentListing = listingData?.listings?.[currentIndex];
    
    if (!currentListing) {
      console.log("❌ Lost track of current listing, resetting to menu");
      await sendMessageWithClient(sender, "Sorry, I lost track of the current listing. Please try searching again.");
      session.step = "menu";
      session.state = 'initial';
      await saveSession(sender, session);
      return session;
    }
    
    if (msg === "NEXT_LISTING") {
      console.log("⏭️ Next button clicked");
      
      const listingData = session.housingFlow.listingData;
      if (!listingData || !listingData.listings) {
        await sendMessageWithClient(sender, "No listings data found. Please search again.");
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
        await sendMessageWithClient(sender, "🔄 You've seen all listings! Starting from the first one again.");
      }
      
      session.housingFlow.currentIndex = currentIndex;
      await saveSession(sender, session);
      
      await handleShowListings(sender, session);
      return session;
    }
    
    if (msg.startsWith("VIEW_DETAILS_")) {
        const index = parseInt(msg.replace('VIEW_DETAILS_', ''));
  const targetListing = listingData?.listings?.[index];
      console.log("📄 View details button clicked");
      await sendMessageWithClient(
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
        await sendMessageWithClient(
          sender, 
          `✅ Listing *${currentListing.title || 'Property'}* has been saved to your favorites! ❤️\n\n` +
          `You can view all your saved listings from the main menu.`
        );
      } else if (result.error === 'Listing already saved') {
        await sendMessageWithClient(sender, `⚠️ This listing is already in your saved listings.`);
      } else {
        await sendMessageWithClient(sender, `❌ Could not save the listing. Please try again.`);
      }
      
      await handleShowListings(sender, session);
      return session;
    }
    
    await sendMessageWithClient(sender, "Action unrecognized. Please select a button from the card.");
    await handleShowListings(sender, session); 
    return session;
  }

  // ===========================
  // 23) MENU COMMAND HANDLING
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
      // Offer dual posting options
      await handlePostListingFlow(sender, session, effectiveClient);
      return session;

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
        await sendMessageWithClient(sender, "🎤 Processing your voice message...");
        
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
            await sendInteractiveButtonsWithClient(
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
              await sendMessageWithClient(sender, 
                "❌ Voice processing is temporarily unavailable. Please type your request instead."
              );
            } else {
              await sendMessageWithClient(sender, `❌ ${processingResult.error}`);
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
          
          await sendMessageWithClient(sender, errorMessage);
          session.step = "menu";
          session.state = 'initial';
          await saveSession(sender, session);
        }
      } else {
        // No audio metadata - user typed "voice" command
        await sendMessageWithClient(
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
      await sendMessageWithClient(sender, "I didn't understand that. Choose an option or type *hi* to restart.");
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
              `🔩 தொழில்நுட்ப வல்லுநர் - ஏசி பழுதுபார்பப்பு, சாதன சேவை\n` +
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
  
  await sendMessageWithClient(sender, message, client);
  
  await sendInteractiveButtonsWithClient(
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

async function sendMainMenuViaService(to, language = 'en') {
  // Use the multiLanguage menu rows when possible
  const rows = multiLanguage.getMainMenuRows(language);
  const sections = [{ title: multiLanguage.getMessage(language, 'main_menu') || 'Menu', rows }];

  const title = multiLanguage.getMessage(language, 'welcome')?.split('\n')?.[0] || '🏡 MarketMatch AI';
  const body = multiLanguage.getMessage(language, 'main_menu') || 'Choose an option:';
  const buttonText = multiLanguage.getMessage(language, 'btn_menu') || 'Select an option';

  return sendList(
    to,
    title,
    body,
    buttonText,
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
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_no_client'));
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
      await sendMessageWithClient(sender, "🔍 Fetching available listings...");
      
      const topListings = await getTopListings(10); // Get top 10 listings
      
      if (!topListings || topListings.length === 0) {
        await sendMessageWithClient(
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
      await sendMessageWithClient(sender, "❌ Could not load listing details. Please try again.");
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
    await sendMessageWithClient(sender, "❌ Sorry, I couldn't load the listings. Please try again.");
    
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
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_no_client'));
      return;
    }
    
    // Fetch user's listings
    await sendMessageWithClient(sender, "📋 Fetching your listings...");
    
    const userListings = await getUserListings(sender);
    
    if (!userListings || userListings.length === 0) {
      await sendMessageWithClient(
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
    await sendMessageWithClient(sender, "❌ Sorry, I couldn't load your listings. Please try again.");
    
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
      await sendMessageWithClient(sender, multiLanguage.getMessageForUser(sender, 'error_no_client'));
      return;
    }
    
    // Fetch user's saved listings
    await sendMessageWithClient(sender, "💾 Loading your saved listings...");
    
    const savedListings = await getUserSavedListings(sender);
    
    if (!savedListings || savedListings.length === 0) {
      await sendMessageWithClient(
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
    await sendMessageWithClient(sender, "❌ Sorry, I couldn't load your saved listings. Please try again.");
    
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
      await sendMessageWithClient(sender, "❌ Listing not found. Please try again.");
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
    await sendMessageWithClient(sender, "❌ Error loading listing details. Please try again.");
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
      await sendMessageWithClient(sender, "❌ Could not find listing to delete.");
      await handleManageListings(sender);
      return;
    }
    
    // Delete the listing
    const result = await deleteListing(sender, listingId);
    
    if (result.success) {
      await sendMessageWithClient(
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
      await sendMessageWithClient(
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
    await sendMessageWithClient(sender, "❌ Error deleting listing. Please try again.");
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
      await sendMessageWithClient(sender, "❌ Saved listing not found. Please try again.");
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
    await sendMessageWithClient(sender, "❌ Error loading saved listing details. Please try again.");
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
      await sendMessageWithClient(sender, "❌ Could not find saved listing to remove.");
      await handleSavedListings(sender);
      return;
    }
    
    // Remove the listing from saved
    const result = await removeSavedListing(sender, listingId);
    
    if (result.success) {
      await sendMessageWithClient(
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
      await sendMessageWithClient(
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
    await sendMessageWithClient(sender, "❌ Error removing saved listing. Please try again.");
    await handleSavedListings(sender);
  }
}

// ========================================
// PLACEHOLDER FUNCTIONS FOR MISSING IMPLEMENTATIONS
// ========================================

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
  await sendMessageWithClient(sender, "The edit feature is currently unavailable. Please try again later.");
  
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
  await sendMessageWithClient(sender, "The update feature is currently unavailable. Please try again later.");
  
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
  await sendMessageWithClient(sender, "The save edits feature is currently unavailable. Please try again later.");
  
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
  await sendMessageWithClient(sender, "The text listing input feature is currently unavailable. Please use the menu options.");
  
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
  // Exported helpers for testing
  detectIntentContext,
  isUserOfferingServices,
  isUrbanHelpRequest,
  // ✅ ADDED: Placeholder functions for missing implementations
  handleFieldEdit,
  updateFieldValue,
  saveAllEdits,
  handleTextListingInput,
  // ✅ ADDED: Posting confirmation handler
  handlePostingConfirmation
};