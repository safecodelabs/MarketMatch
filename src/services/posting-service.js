// File: /services/posting-service.js - COMPLETELY FIXED VERSION
const admin = require('firebase-admin');
const SessionManager = require('../../database/session-manager');
const DraftManager = require('../../database/draft-manager');

// ✅ FIXED: Use const and avoid multiple let declarations
// Load FIELD_CONFIGS safely
function loadFieldConfigs() {
  try {
    return require('../../utils/field-config');
  } catch (e1) {
    try {
      return require('../utils/field-config');
    } catch (e2) {
      console.log("⚠️ FIELD_CONFIGS not found, using default config");
      // Return default config (same as before)
      return {
        urban_help: {
          displayName: 'Urban Help',
          required: ['serviceType', 'description', 'location.area'],
          fields: {
            serviceType: { question: 'What service do you provide? (e.g., Plumber, Electrician, Cook)' },
            description: { question: 'Please describe your service:' },
            experience: { question: 'How many years of experience do you have?' },
            rate: { question: 'What is your rate? (e.g., ₹500/hour, ₹3000/month)' },
            'location.area': { question: 'Where are you located? (Area/Neighborhood)' },
            'location.city': { question: 'Which city?' },
            availability: { question: 'When are you available?' },
            phone: { question: 'Contact number:' }
          }
        },
        housing: {
          displayName: 'Housing',
          required: ['unitType', 'rent', 'location.area'],
          fields: {
            unitType: { question: 'What type of property? (1BHK, 2BHK, 3BHK, Room, PG, etc.)' },
            propertyType: { question: 'Property type? (Apartment, House, Villa, etc.)' },
            rent: { question: 'Monthly rent? (e.g., ₹15,000)' },
            deposit: { question: 'Security deposit amount?' },
            furnishing: { question: 'Furnishing type? (Fully, Semi, Unfurnished)' },
            'location.area': { question: 'Area/Neighborhood?' },
            'location.city': { question: 'City?' },
            'location.fullAddress': { question: 'Full address? (Optional, will be shared after contact)' },
            amenities: { question: 'Amenities available?' },
            description: { question: 'Property description:' }
          }
        },
        commodity: {
          displayName: 'Commodity',
          required: ['itemName', 'price', 'location.area'],
          fields: {
            itemName: { question: 'What item are you selling?' },
            price: { question: 'Price?' },
            condition: { question: 'Condition? (New, Like New, Good, Fair)' },
            description: { question: 'Item description:' },
            'location.area': { question: 'Location?' }
          }
        },
        vehicle: {
          displayName: 'Vehicle',
          required: ['vehicleType', 'brand', 'price', 'location.area'],
          fields: {
            vehicleType: { question: 'Type of vehicle? (Car, Bike, Scooter, etc.)' },
            brand: { question: 'Brand?' },
            model: { question: 'Model?' },
            year: { question: 'Manufacturing year?' },
            price: { question: 'Price?' },
            condition: { question: 'Condition?' },
            description: { question: 'Description:' },
            'location.area': { question: 'Location?' }
          }
        },
        electronics: {
          displayName: 'Electronics',
          required: ['itemType', 'brand', 'price', 'location.area'],
          fields: {
            itemType: { question: 'Type of electronic item?' },
            brand: { question: 'Brand?' },
            model: { question: 'Model?' },
            price: { question: 'Price?' },
            condition: { question: 'Condition?' },
            description: { question: 'Description:' },
            'location.area': { question: 'Location?' }
          }
        },
        furniture: {
          displayName: 'Furniture',
          required: ['itemType', 'price', 'location.area'],
          fields: {
            itemType: { question: 'Type of furniture?' },
            price: { question: 'Price?' },
            condition: { question: 'Condition?' },
            description: { question: 'Description:' },
            'location.area': { question: 'Location?' }
          }
        },
        job: {
          displayName: 'Job',
          required: ['jobPosition', 'jobType', 'location.area'],
          fields: {
            jobPosition: { question: 'Job position/title?' },
            jobType: { question: 'Job type? (Full-time, Part-time, Contract, Internship)' },
            salary: { question: 'Salary/compensation?' },
            company: { question: 'Company name?' },
            experienceRequired: { question: 'Experience required?' },
            description: { question: 'Job description:' },
            'location.area': { question: 'Location?' }
          }
        }
      };
    }
  }
}

// ✅ FIXED: Use const instead of let
const FIELD_CONFIGS = loadFieldConfigs();

// Load IntentClassifier safely
function loadIntentClassifier() {
  try {
    return require('../../src/core/ai/intentClassifier');
  } catch (e1) {
    try {
      return require('../core/ai/intentClassifier');
    } catch (e2) {
      console.log("⚠️ IntentClassifier not found, using fallback");
      return {
        classify: async (text) => {
          console.log(`🤖 [FALLBACK] Classifying: "${text}"`);
          const lower = text.toLowerCase();
          
          const result = {
            intent: 'general_help',
            confidence: 0.1,
            entities: {},
            originalText: text,
            isConfident: false
          };
          
          if (lower.includes("i'm") || lower.includes("i am") || 
              lower.includes("i provide") || lower.includes("available")) {
            result.context = 'offer';
          } else if (lower.includes("need") || lower.includes("want") || 
                     lower.includes("looking for")) {
            result.context = 'find';
          }
          
          const serviceTypes = [
            // Core home services
            'electrician',
            'plumber',
            'carpenter',
            'painter',
            'mason',
            'welder',
            'fitter',
            'mechanic',
            'technician',
            'repair',
            'installer',
            'fabricator',
            
            // Domestic help
            'maid',
            'cook',
            'cleaner',
            'helper',
            'assistant',
            'babysitter',
            'caretaker',
            'ayah',
            'househelp',
            
            // Driving & transport
            'driver',
            'delivery',
            'loader',
            'packer',
            'mover',
            
            // Construction & labour
            'contractor',
            'labour',
            'worker',
            'construction',
            'siteworker',
            'operator',
            'supervisor',
            
            // Appliance & home tech
            'ac technician',
            'refrigerator repair',
            'washing machine repair',
            'tv repair',
            'ro service',
            'geyser repair',
            'cctv installer',
            'internet technician',
            
            // Furniture & fittings
            'furniture repair',
            'sofa repair',
            'polish worker',
            'modular kitchen installer',
            'false ceiling worker',
            
            // Cleaning & maintenance
            'deep cleaning',
            'pest control',
            'water tank cleaning',
            'drain cleaning',
            
            // Exterior & misc
            'gardener',
            'mali',
            'security guard',
            'watchman',
            
            // Education / personal
            'tutor',
            'home tutor',
            
            // Local generic (VERY IMPORTANT for search matching)
            'local service',
            'local help',
            'home service',
            'nearby service'
          ];
          
          for (const service of serviceTypes) {
            if (lower.includes(service)) {
              result.entities.service_type = service;
              result.intent = 'service_offer';
              result.confidence = 0.8;
              break;
            }
          }
          
          const locations = ['noida', 'delhi', 'gurgaon', 'gurugram', 'faridabad', 'ghaziabad'];
          for (const loc of locations) {
            if (lower.includes(loc)) {
              result.entities.location = loc.charAt(0).toUpperCase() + loc.slice(1);
            }
          }
          
          if (lower.includes('bhk') || lower.includes('room') || lower.includes('flat') || 
              lower.includes('apartment') || lower.includes('rent')) {
            result.intent = 'property_rent';
            result.confidence = 0.7;
          }
          
          return result;
        }
      };
    }
  }
}

// ✅ FIXED: Use const instead of let
const IntentClassifier = loadIntentClassifier();

class PostingService {
  constructor(userId) {
    this.userId = userId;
    this.sessionManager = new SessionManager(userId);
    this.draftManager = new DraftManager();
  }
  async handleImmediateOffering(message, intentResult = null) {
  console.log("🚨 [IMMEDIATE OFFERING] Handling immediate offering detection");
  
  try {
    // Quick check if this is definitely an offering
    const lowerMsg = message.toLowerCase();
    const isDefinitelyOffering = /i('?m| am)\s+(a\s+|an\s+|)\s*([^,.!?]+?)\s+(in|at|near|available)/i.test(lowerMsg) ||
                                /i\s+(provide|offer|do|work\s+as)/i.test(lowerMsg) ||
                                lowerMsg.includes('i\'m a') ||
                                lowerMsg.includes('i am a') ||
                                lowerMsg.includes('i provide') ||
                                lowerMsg.includes('i offer');

    if (!isDefinitelyOffering) {
      return { type: 'not_posting', shouldHandle: false };
    }

    console.log("🚨 [IMMEDIATE OFFERING] Definitely an offering, starting new posting");

    // Use intent classifier if available
    if (!intentResult) {
      try {
        intentResult = await IntentClassifier.classify(message);
        console.log("🚨 [IMMEDIATE OFFERING] Intent result:", intentResult);
      } catch (error) {
        intentResult = {
          intent: 'service_offer',
          confidence: 0.8,
          entities: {},
          context: 'offer'
        };
      }
    }

    // Force category to urban_help for service offerings
    intentResult.intent = 'service_offer';
    intentResult.context = 'offer';
    
    if (!intentResult.entities) {
      intentResult.entities = {};
    }
    
    // Extract service type from message
    const serviceMatch = message.match(/i('?m| am)\s+(a\s+|an\s+|)\s*([^,.!?]+?)\s+(in|at|near|$)/i);
    if (serviceMatch && serviceMatch[3]) {
      let serviceType = serviceMatch[3].trim();
      // Clean up
      serviceType = serviceType
        .replace(/^\s*(a|an|the)\s+/i, '')
        .replace(/\s+in\s+.*$/i, '')
        .trim();
      
      if (serviceType && serviceType.length > 0) {
        intentResult.entities.service_type = serviceType;
        console.log(`🚨 [IMMEDIATE OFFERING] Extracted service type: ${serviceType}`);
      }
    }
    
    // Extract location from message
    const locationMatch = message.match(/\b(in|at|near|around|mein|me|main)\s+([^,.!?]+)/i);
    if (locationMatch && locationMatch[2]) {
      intentResult.entities.location = locationMatch[2].trim();
      console.log(`🚨 [IMMEDIATE OFFERING] Extracted location: ${intentResult.entities.location}`);
    }

    // Start new posting with the offering context
    return await this.startNewPosting(message, intentResult);

  } catch (error) {
    console.error("🚨 [IMMEDIATE OFFERING] Error:", error);
    return {
      type: 'error',
      response: 'Sorry, there was an error processing your offering. Please try again.',
      shouldHandle: true
    };
  }
}

  async processMessage(message) {
    try {
      console.log(`📝 [POSTING SERVICE] Processing message from ${this.userId}: "${message}"`);
      
      const session = await this.sessionManager.getOrCreateSession();
      console.log(`📝 [POSTING SERVICE] Current session:`, session);
      
      // If user is already in posting mode
      if (session.mode === 'posting' && session.draftId) {
        console.log(`📝 [POSTING SERVICE] Continuing existing posting session`);
        return await this.continuePosting(message, session);
      }
          // ✅ ADDED: Check for immediate offering FIRST
    const immediateOfferingResult = await this.handleImmediateOffering(message);
    if (immediateOfferingResult.shouldHandle !== false) {
      console.log("📝 [POSTING SERVICE] Immediate offering handled");
      return immediateOfferingResult;
    }
      
      // Check if this is a new posting request using intent classifier
      let intentResult;
      try {
        intentResult = await IntentClassifier.classify(message);
        console.log("📝 [POSTING SERVICE] Intent classification result:", intentResult);
      } catch (error) {
        console.log("⚠️ [POSTING SERVICE] Intent classifier failed, using fallback");
        intentResult = {
          intent: 'general_help',
          confidence: 0.1,
          entities: {},
          context: null,
          isConfident: false
        };
      }
      
      // Check if this is a posting intent
      const isPosting = await this.isPostingIntent(message, intentResult);
      console.log(`📝 [POSTING SERVICE] Is posting intent: ${isPosting}`);
      
      if (isPosting) {
        return await this.startNewPosting(message, intentResult);
      }
      
      return { type: 'not_posting', shouldHandle: false };
      
    } catch (error) {
      console.error('❌ [POSTING SERVICE] Error processing message:', error);
      return {
        type: 'error',
        response: 'Sorry, there was an error processing your message. Please try again.',
        shouldHandle: true
      };
    }
  }

  async isPostingIntent(message, intentResult = null) {
    // First check with intent classifier if result provided
    if (intentResult && intentResult.intent) {
      const postingIntents = [
        'property_sale', 'property_rent', 'service_offer', 'commodity_sell',
        'vehicle_sell', 'electronics_sell', 'furniture_sell', 'job_offer'
      ];
      
      if (postingIntents.includes(intentResult.intent)) {
        console.log(`📝 [POSTING SERVICE] Intent classifier detected posting intent: ${intentResult.intent}`);
        return true;
      }
      
      // Also check if context is 'offer'
      if (intentResult.context === 'offer') {
        console.log(`📝 [POSTING SERVICE] Intent classifier detected offer context`);
        return true;
      }
      
      // Check confidence
      if (intentResult.confidence > 0.7) {
        return true;
      }
    }
    
    // Fallback to keyword matching
    const lowerMsg = message.toLowerCase();
    const postingKeywords = [
      'post', 'list', 'add', 'create', 'offer', 'available',
      'rent', 'sell', 'service', 'help', 'looking for', 'need',
      '1bhk', '2bhk', '3bhk', 'flat', 'apartment', 'room',
      'plumber', 'electrician', 'cleaner', 'tutor', 'maid', 'cook',
      'carpenter', 'painter', 'driver', 'technician',
      'i\'m', 'i am', 'available for', 'provide', 'professional',
      'experienced', 'for hire', 'for rent', 'selling',
      'mai', 'main', 'mein', 'hun', 'hoon', // Hindi: I am
      'deta', 'deti', 'dete', 'deti hoon', 'deta hoon', // Hindi: provide
      'mason', 'worker', 'labour', 'contractor' // ADDED: Construction keywords
    ];
    
    const hasKeyword = postingKeywords.some(keyword => lowerMsg.includes(keyword));
    console.log(`📝 [POSTING SERVICE] Keyword detection result: ${hasKeyword}`);
    
    return hasKeyword;
  }

  async startNewListing(initialMessage) {
    try {
      console.log("📝 [POSTING SERVICE] Starting new listing from voice/offering");
      console.log("📝 [POSTING SERVICE] Initial message:", initialMessage);
      
      // Use intent classifier to understand the message
      let intentResult;
      try {
        intentResult = await IntentClassifier.classify(initialMessage);
        console.log("📝 [POSTING SERVICE] Intent analysis:", intentResult);
      } catch (error) {
        console.log("⚠️ [POSTING SERVICE] Intent classifier failed, using simple detection");
        intentResult = {
          intent: 'general_help',
          confidence: 0.1,
          entities: {},
          context: null
        };
      }
      
      // Check if this is actually an offering
      const isOffering = intentResult.context === 'offer' || 
                        ['service_offer', 'property_sale', 'commodity_sell', 
                         'vehicle_sell', 'job_offer'].includes(intentResult.intent) ||
                        this.isUserOfferingServices(initialMessage);
      
      console.log(`📝 [POSTING SERVICE] Is offering: ${isOffering}`);
      
      if (!isOffering) {
        console.log("📝 [POSTING SERVICE] Not an offering message, using regular flow");
        return await this.startNewPosting(initialMessage, intentResult);
      }
      
      // Determine category from intent classifier
      const category = this.detectCategoryFromIntent(intentResult, initialMessage);
      console.log(`📝 [POSTING SERVICE] Detected category: ${category}`);
      
      // If no clear category, ask for it
      if (!category) {
        return {
          type: 'question',
          response: 'What type of listing are you creating? (Housing, Urban Help, Vehicle, Electronics, Furniture, Commodity, or Job)',
          shouldHandle: true
        };
      }
      
      // Create new draft
      const draft = await this.draftManager.createDraft(this.userId, category);
      console.log(`📝 [POSTING SERVICE] Created draft: ${draft.id}`);
      
      // Update session
      await this.sessionManager.updateSession({
        mode: 'posting',
        category: category,
        draftId: draft.id,
        expectedField: null,
        isVoiceInitiated: true // Mark as voice-initiated
      });
      
      // Extract initial info using intent classifier entities
      const extractedInfo = await this.extractInfoFromIntent(intentResult, initialMessage, category);
      console.log("📝 [POSTING SERVICE] Extracted info:", extractedInfo);
      
      // Save extracted info to draft
      if (extractedInfo) {
        await this.saveExtractedInfo(draft.id, category, extractedInfo);
      }
      
      // Get next question or show confirmation if we have enough info
      const draftWithData = await this.draftManager.getDraft(draft.id);
      const nextField = this.getNextRequiredField(draftWithData);
      
      if (nextField) {
        await this.sessionManager.updateSession({ expectedField: nextField });
        const question = this.getFieldQuestion(nextField, category);
        
        return {
          type: 'question',
          response: question,
          shouldHandle: true
        };
      } else {
        // All required fields filled, show confirmation
        const summary = await this.generateSummary(draftWithData);
        await this.sessionManager.updateSession({ expectedField: 'confirmation' });
        
        return {
          type: 'confirmation',
          response: `${summary}\n\n✅ Is this correct?\nReply "YES" to post or "NO" to cancel.`,
          shouldHandle: true
        };
      }
      
    } catch (error) {
      console.error("❌ [POSTING SERVICE] Error starting new listing:", error);
      return {
        type: 'error',
        response: "Sorry, I couldn't start your listing. Please try again.",
        shouldHandle: true
      };
    }
  }

  async startNewPosting(message, intentResult = null) {
    try {
      console.log("📝 [POSTING SERVICE] Starting new posting");
      console.log("📝 [POSTING SERVICE] Message:", message);
      
      // Use intent classifier if result not provided
      if (!intentResult) {
        try {
          intentResult = await IntentClassifier.classify(message);
          console.log("📝 [POSTING SERVICE] Classified intent:", intentResult);
        } catch (error) {
          console.log("⚠️ [POSTING SERVICE] Intent classifier failed");
          intentResult = {
            intent: 'general_help',
            confidence: 0.1,
            entities: {},
            context: null
          };
        }
      }
      
      // Determine category from message using intent classifier
      let category = this.detectCategoryFromIntent(intentResult, message);
      
      // If no category from intent, try direct detection
      if (!category) {
        category = this.detectCategory(message);
      }
      
      // If still no category but user is offering something
      if (!category && (intentResult.context === 'offer' || this.isUserOfferingServices(message))) {
        category = 'urban_help'; // Default for service offers
      }
      
    console.log(`📝 [POSTING SERVICE] Determined category: ${category}`);
    
    if (!category) {
      return {
        type: 'question',
        response: 'What type of listing are you creating? (Housing, Urban Help, Vehicle, Electronics, Furniture, Commodity, or Job)',
        shouldHandle: true
      };
    }
    
// Check if user already has an active draft
const existingDraft = await this.draftManager.getUserActiveDraft(this.userId);
if (existingDraft) {
  return {
    type: 'confirmation_with_buttons',
    response: `📝 *Draft Conflict*\n\nYou already have a draft in progress.\n\nWhat would you like to do?`,
    buttons: [
      { id: 'continue_existing_draft', title: '↪️ Continue Existing Draft' },
      { id: 'start_new_listing', title: '🆕 Start New Listing' },
      { id: 'cancel_draft_conflict', title: '❌ Cancel' }
    ],
    shouldHandle: true
  };
}
    
    // Create new draft
    const draft = await this.draftManager.createDraft(this.userId, category);
    console.log(`📝 [POSTING SERVICE] Created draft: ${draft.id}`);
    
    // ✅ CRITICAL FIX: Extract and save info BEFORE getting next question
    const extractedInfo = await this.extractInfoFromIntent(intentResult, message, category);
    console.log("📝 [POSTING SERVICE] Extracted info:", extractedInfo);
    
    if (extractedInfo) {
      await this.saveExtractedInfo(draft.id, category, extractedInfo);
      console.log("📝 [POSTING SERVICE] Saved extracted info to draft");
    }
    
    // Update session
    await this.sessionManager.updateSession({
      mode: 'posting',
      category: category,
      draftId: draft.id,
      expectedField: null,
      step: 'posting_flow',
      isVoiceInitiated: false
    });
    
    // ✅ Get the ACTUAL next required field with updated draft data
    const updatedDraft = await this.draftManager.getDraft(draft.id);
    console.log("📝 [POSTING SERVICE] Draft after saving extracted info:", updatedDraft.data);
    
    const nextField = this.getNextRequiredField(updatedDraft);
    console.log(`📝 [POSTING SERVICE] Next required field: ${nextField}`);
    
    if (nextField) {
      await this.sessionManager.updateSession({ expectedField: nextField });
      const question = this.getFieldQuestion(nextField, category);
      
      return {
        type: 'question',
        response: question,
        shouldHandle: true
      };
    } else {
// All required fields filled, show confirmation
const summary = await this.generateSummary(updatedDraft);
await this.sessionManager.updateSession({ expectedField: 'confirmation' });

return {
  type: 'summary_with_buttons',  // Change from 'confirmation' to 'summary_with_buttons'
  response: `${summary}\n\n✅ Is this correct?`,
  buttons: [
    { id: 'confirm_yes', title: '✅ Yes, Post It' },
    { id: 'confirm_no', title: '❌ No, Cancel' }
  ],
  shouldHandle: true
};
    }
    
  } catch (error) {
    console.error("❌ [POSTING SERVICE] Error starting new posting:", error);
    return {
      type: 'error',
      response: "Sorry, I couldn't start your listing. Please try again.",
      shouldHandle: true
    };
  }
}

  detectCategoryFromIntent(intentResult, message) {
    const lowerMsg = message.toLowerCase();
    
    // Map intent classifier intents to our categories
    const intentToCategory = {
      'property_sale': 'housing',
      'property_rent': 'housing',
      'property_search': 'housing',
      'service_offer': 'urban_help',
      'service_request': 'urban_help',
      'commodity_sell': 'commodity',
      'commodity_search': 'commodity',
      'vehicle_sell': 'vehicle',
      'vehicle_buy': 'vehicle',
      'electronics_sell': 'electronics',
      'electronics_buy': 'electronics',
      'furniture_sell': 'furniture',
      'furniture_buy': 'furniture',
      'job_offer': 'job',
      'job_search': 'job'
    };
    
    // Check intent mapping first
    if (intentResult.intent && intentToCategory[intentResult.intent]) {
      return intentToCategory[intentResult.intent];
    }
    
    // Fallback to keyword detection
    return this.detectCategory(message);
  }

  isUserOfferingServices(text) {
    const lower = text.toLowerCase();
    
    const offeringPatterns = [
      /i('?m| am)\s+(a\s+|an\s+|)\s*([^,.!?]+?)\s+(in|at|near|for|available)/i,
      /i\s+(have|provide|offer|do|work\s+as|am\s+available|am\s+expert)/i,
      /(available|provide|offer|sell|selling|for\s+sale|for\s+hire|service|professional|experienced)/i,
      /(mai|main|mein)\s+(hun|hoon|hu)\s+(.+?)\s+(ka|ki|ke)/i, // Hindi patterns
      /(karta|karti)\s+hu/i // Hindi: I do
    ];
    
    const offeringKeywords = [
      "i'm", "i am", "i have", "available", "provide", "offer", 
      "sell", "selling", "for sale", "professional", "experienced",
      "worker", "mason", "contractor", "labour", "service",
      "charges", "rate", "price", "fee", "cost",
      "hun", "hoon", "hu" // Hindi: am
    ];
    
    // Check patterns
    for (const pattern of offeringPatterns) {
      if (pattern.test(lower)) {
        console.log(`✅ Offering pattern matched: ${pattern}`);
        return true;
      }
    }
    
    // Check keywords
    for (const keyword of offeringKeywords) {
      if (lower.includes(keyword)) {
        console.log(`✅ Offering keyword matched: ${keyword}`);
        return true;
      }
    }
    
    // Special case: "I'm a [profession] in [location]"
    const professionPattern = /i('?m| am)\s+(a\s+|an\s+|)\s*([^,.!?]+?)\s+in\s+([^,.!?]+)/i;
    if (professionPattern.test(lower)) {
      console.log("✅ Profession pattern matched (I'm a [profession] in [location])");
      return true;
    }
    
    return false;
  }

async extractInfoFromIntent(intentResult, message, category) {
  const info = {};
  const entities = intentResult.entities || {};
  const lowerMsg = message.toLowerCase();
  
  console.log("📝 [POSTING SERVICE] Extracting info from intent entities:", entities);
  console.log("📝 [POSTING SERVICE] Full intent result:", intentResult);
  
  if (category === 'urban_help') {
    // Use service_type from intent classifier
    if (entities.service_type) {
      info.serviceType = entities.service_type;
      console.log(`✅ Extracted service_type: ${info.serviceType}`);
    } else {
      // Try to extract from "I am a [profession]" pattern
      const offeringMatch = lowerMsg.match(/i('?m| am| mai| main| mein)\s+(a\s+|an\s+|)\s*([^,.!?]+?)\s+(in|at|near|$)/i);
      if (offeringMatch && offeringMatch[3]) {
        const profession = offeringMatch[3].trim();
        // Clean up
        const cleanedProfession = profession
          .replace(/^\s*(a|an|the)\s+/i, '')
          .replace(/\s+in\s+.*$/i, '')
          .trim();
        
        if (cleanedProfession && cleanedProfession.length > 0) {
          info.serviceType = cleanedProfession;
          console.log(`✅ Extracted serviceType from pattern: ${info.serviceType}`);
        }
      }
    }
    
    // Use location from intent classifier
    if (entities.location) {
      info.location = entities.location;
      console.log(`✅ Extracted location: ${info.location}`);
    } else {
      // Try to extract location from message
      const locationMatch = message.match(/\b(in|at|near|around|mein|me|main)\s+([^,.!?]+)/i);
      if (locationMatch && locationMatch[2]) {
        info.location = locationMatch[2].trim();
        console.log(`✅ Extracted location from pattern: ${info.location}`);
      }
    }
    
    // Use the whole message as initial description
    info.description = message;
    console.log(`✅ Using message as description: ${info.description.substring(0, 50)}...`);
      
    } else if (category === 'housing') {
      // Use entities from intent classifier
      if (entities.bhk) info.unitType = entities.bhk;
      if (entities.location) info.location = entities.location;
      if (entities.price) info.rent = this.parsePrice(entities.price);
      if (entities.type) info.propertyType = entities.type;
      
      // Extract BHK from message
      if (!info.unitType) {
        const bhkMatch = message.match(/\b(\d+)(bhk|BHK| bedroom| bed)\b/i);
        if (bhkMatch) {
          info.unitType = `${bhkMatch[1]}BHK`;
        }
      }
      
    } else if (category === 'vehicle') {
      if (entities.type) info.vehicleType = entities.type;
      if (entities.brand) info.brand = entities.brand;
      if (entities.price) info.price = this.parsePrice(entities.price);
      
    } else if (category === 'electronics') {
      if (entities.type) info.itemType = entities.type;
      if (entities.brand) info.brand = entities.brand;
      
    } else if (category === 'job') {
      if (entities.position) info.jobPosition = entities.position;
      if (entities.type) info.jobType = entities.type;
    }
    
    console.log("📝 [POSTING SERVICE] Final extracted info:", info);
    return Object.keys(info).length > 0 ? info : null;
  }

  async continuePosting(message, session) {
    try {
      console.log(`📝 [POSTING SERVICE] Continuing posting for draft: ${session.draftId}`);
      
      const draft = await this.draftManager.getDraft(session.draftId);
      
      if (!draft) {
        await this.sessionManager.clearSession();
        return {
          type: 'error',
          response: 'Session expired. Please start over.',
          shouldHandle: true
        };
      }
      
      // Handle confirmation
      if (session.expectedField === 'confirmation') {
        return await this.handleConfirmation(message, draft);
      }
      
      // Handle field response
      if (session.expectedField) {
        console.log(`📝 [POSTING SERVICE] Updating field ${session.expectedField} with: "${message}"`);
        
        // Update the field
        await this.draftManager.updateDraftField(draft.id, session.expectedField, message);
        
        // Check if all required fields are filled
        const updatedDraft = await this.draftManager.getDraft(draft.id);
        const nextField = this.getNextRequiredField(updatedDraft);
        
        if (nextField) {
          await this.sessionManager.updateSession({ expectedField: nextField });
          const question = this.getFieldQuestion(nextField, draft.category);
          
          return {
            type: 'question',
            response: question,
            shouldHandle: true
          };
        } else {
          // All required fields filled, show confirmation
          const summary = await this.generateSummary(updatedDraft);
          await this.sessionManager.updateSession({ expectedField: 'confirmation' });
          
          return {
            type: 'confirmation',
            response: `${summary}\n\n✅ Is this correct?\nReply "YES" to post or "NO" to cancel.`,
            shouldHandle: true
          };
        }
      }
      
      // If no expected field, start from the first required field
      const nextField = this.getNextRequiredField(draft);
      if (nextField) {
        await this.sessionManager.updateSession({ expectedField: nextField });
        const question = this.getFieldQuestion(nextField, draft.category);
        
        return {
          type: 'question',
          response: question,
          shouldHandle: true
        };
      }
      
      return {
        type: 'error',
        response: 'Please answer the question above.',
        shouldHandle: true
      };
      
    } catch (error) {
      console.error("❌ [POSTING SERVICE] Error continuing posting:", error);
      return {
        type: 'error',
        response: 'Sorry, there was an error processing your response. Please try again.',
        shouldHandle: true
      };
    }
  }

async handleConfirmation(message, draft) {
  const summary = await this.generateSummary(draft);
  
  // Check if this is a button click
  if (message.interactive && message.interactive.type === 'button_reply') {
    const buttonId = message.interactive.button_reply.id;
    
    if (buttonId === 'confirm_yes') {
      return await this.publishAndRespond(draft);
    } else if (buttonId === 'confirm_no') {
      return await this.cancelAndRespond(draft);
    } else if (buttonId === 'confirm_edit') {
      return await this.editAndRespond(draft);
    }
  }
  
  // If user typed "yes" in text, treat as button click
  const lowerMsg = message.text ? message.text.toLowerCase().trim() : '';
  
  if (this.isYesMessage(lowerMsg)) {
    // Send the summary WITH buttons first
    return {
      type: 'summary_with_buttons',
      response: `${summary}\n\n✅ Is this correct?`,
      buttons: [
        { id: 'confirm_yes', title: '✅ Yes, Post It' },
        { id: 'confirm_no', title: '❌ No, Cancel' }
      ],
      shouldHandle: true
    };
  }
  
  if (this.isNoMessage(lowerMsg)) {
    return await this.cancelAndRespond(draft);
  }
  
  // Default: Show summary with buttons (this is what happens when flow completes)
  return {
    type: 'summary_with_buttons',
    response: `${summary}\n\n✅ Is this correct?`,
    buttons: [
      { id: 'confirm_yes', title: '✅ Yes, Post It' },
      { id: 'confirm_no', title: '❌ No, Cancel' }
    ],
    shouldHandle: true
  };
}

// Helper methods for fallback text support
isYesMessage(text) {
  const yesPatterns = ['yes', 'y', 'haan', 'han', 'ha', 'sahi', 'correct', 'right', 'confirm'];
  return yesPatterns.includes(text);
}

isNoMessage(text) {
  const noPatterns = ['no', 'n', 'nahi', 'na', 'galat', 'wrong', 'incorrect', 'cancel'];
  return noPatterns.includes(text);
}

async publishAndRespond(draft) {
  const result = await this.publishListing(draft);
  if (result.success) {
    await this.sessionManager.clearSession();
    return {
      type: 'success',
      response: '🎉 Your listing has been published successfully!\n\n' +
               'You can view it from the "Manage Listings" option.',
      shouldHandle: true
    };
  } else {
    return {
      type: 'error',
      response: 'Failed to publish. Please try again.',
      shouldHandle: true
    };
  }
}

async cancelAndRespond(draft) {
  await this.draftManager.deleteDraft(draft.id);
  await this.sessionManager.clearSession();
  return {
    type: 'cancelled',
    response: 'Listing cancelled. You can start a new one anytime.',
    shouldHandle: true
  };
}

async editAndRespond(draft) {
  const firstField = this.getNextRequiredField(draft);
  if (firstField) {
    await this.sessionManager.updateSession({ expectedField: firstField });
    const question = this.getFieldQuestion(firstField, draft.category);
    return {
      type: 'question',
      response: `Let's edit your listing. ${question}`,
      shouldHandle: true
    };
  }
}

  detectCategory(message) {
    const lowerMsg = message.toLowerCase();
    
    // EMERGENCY FIX: If message contains "I'm a" or "I am a", treat as urban help
    if (/i('?m| am)\s+(a\s+|an\s+|)/i.test(lowerMsg)) {
      console.log("🚨 EMERGENCY DETECTION: 'I am a' pattern detected -> Urban Help");
      return 'urban_help';
    }
    
    // Urban Help services - EXPANDED
    const urbanHelpKeywords = [
      'plumber', 'electrician', 'cleaner', 'tutor', 'maid', 'cook',
      'carpenter', 'painter', 'driver', 'technician', 'service',
      'help', 'mechanic', 'gardener', 'welder', 'repair',
      'beautician', 'salon', 'barber', 'tailor', 'laundry',
      // ADDED:
      'mason', 'contractor', 'labour', 'worker', 'construction',
      'fitter', 'helper', 'assistant', 'operator', 'installer',
      'fabricator', 'handyman', 'technician', 'repairman',
      'nurse', 'caretaker', 'security', 'guard', 'watchman',
      'delivery', 'packer', 'mover', 'shifting', 'transport'
    ];
    
    // Housing keywords
    const housingKeywords = [
      'rent', 'room', 'flat', 'apartment', '1bhk', '2bhk',
      '3bhk', 'pg', 'hostel', 'house', 'villa', 'property',
      'accommodation', 'shared', 'single'
    ];
    
    // Vehicle keywords
    const vehicleKeywords = [
      'car', 'bike', 'scooter', 'motorcycle', 'vehicle', 'auto',
      'cycle', 'bicycle', 'suv', 'sedan', 'hatchback'
    ];
    
    // Electronics keywords
    const electronicsKeywords = [
      'phone', 'laptop', 'tv', 'television', 'refrigerator', 'fridge',
      'ac', 'air conditioner', 'washing machine', 'microwave', 'oven',
      'electronics', 'mobile', 'tablet', 'computer'
    ];
    
    // Furniture keywords
    const furnitureKeywords = [
      'sofa', 'bed', 'table', 'chair', 'wardrobe', 'cupboard',
      'almirah', 'dining', 'furniture', 'mattress'
    ];
    
    // Commodity keywords
    const commodityKeywords = [
      'sell', 'buy', 'commodity', 'item', 'product', 'goods',
      'thing', 'stuff', 'article'
    ];
    
    // Job keywords
    const jobKeywords = [
      'job', 'work', 'employment', 'vacancy', 'position',
      'hiring', 'recruiting', 'opportunity', 'opening'
    ];
    
    // Check categories in order with better matching
    for (const keyword of urbanHelpKeywords) {
      // Better matching: check if word exists (not just substring)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerMsg)) {
        console.log(`✅ Urban help keyword matched: ${keyword}`);
        return 'urban_help';
      }
    }
    
    for (const keyword of housingKeywords) {
      if (lowerMsg.includes(keyword)) {
        console.log(`✅ Housing keyword matched: ${keyword}`);
        return 'housing';
      }
    }
    
    for (const keyword of vehicleKeywords) {
      if (lowerMsg.includes(keyword)) {
        console.log(`✅ Vehicle keyword matched: ${keyword}`);
        return 'vehicle';
      }
    }
    
    for (const keyword of electronicsKeywords) {
      if (lowerMsg.includes(keyword)) {
        console.log(`✅ Electronics keyword matched: ${keyword}`);
        return 'electronics';
      }
    }
    
    for (const keyword of furnitureKeywords) {
      if (lowerMsg.includes(keyword)) {
        console.log(`✅ Furniture keyword matched: ${keyword}`);
        return 'furniture';
      }
    }
    
    for (const keyword of jobKeywords) {
      if (lowerMsg.includes(keyword)) {
        console.log(`✅ Job keyword matched: ${keyword}`);
        return 'job';
      }
    }
    
    for (const keyword of commodityKeywords) {
      if (lowerMsg.includes(keyword)) {
        console.log(`✅ Commodity keyword matched: ${keyword}`);
        return 'commodity';
      }
    }
    
    // If no category found but user is offering something
    if (this.isUserOfferingServices(lowerMsg)) {
      console.log("✅ User is offering services but no specific category found, defaulting to urban_help");
      return 'urban_help';
    }
    
    console.log("❌ No category detected");
    return null;
  }

  parsePrice(priceStr) {
    if (!priceStr) return null;
    
    const lower = priceStr.toLowerCase();
    const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
    if (!numMatch) return null;
    
    const number = parseFloat(numMatch[1]);
    
    if (lower.includes('lakh') || lower.includes('lac')) {
      return number * 100000;
    } else if (lower.includes('crore') || lower.includes('cr')) {
      return number * 10000000;
    } else if (lower.includes('k') || lower.includes('thousand')) {
      return number * 1000;
    }
    
    return number;
  }

  async saveExtractedInfo(draftId, category, info) {
  try {
    console.log(`📝 [POSTING SERVICE] Saving extracted info for ${category}:`, info);
    console.log(`📝 [POSTING SERVICE] Draft ID: ${draftId}`);
    
    if (category === 'urban_help') {
      if (info.serviceType) {
        console.log(`📝 [POSTING SERVICE] Saving serviceType: ${info.serviceType}`);
        await this.draftManager.updateDraftField(draftId, 'serviceType', info.serviceType);
      }
      if (info.description) {
        console.log(`📝 [POSTING SERVICE] Saving description: ${info.description}`);
        await this.draftManager.updateDraftField(draftId, 'description', info.description);
      }
      if (info.location) {
        console.log(`📝 [POSTING SERVICE] Saving location.area: ${info.location}`);
        await this.draftManager.updateDraftField(draftId, 'location.area', info.location);
      }
      } else if (category === 'housing') {
        if (info.unitType) {
          await this.draftManager.updateDraftField(draftId, 'unitType', info.unitType);
        }
        if (info.location) {
          await this.draftManager.updateDraftField(draftId, 'location.area', info.location);
        }
        if (info.rent) {
          await this.draftManager.updateDraftField(draftId, 'rent', info.rent.toString());
        }
        if (info.propertyType) {
          await this.draftManager.updateDraftField(draftId, 'propertyType', info.propertyType);
        }
      } else if (category === 'vehicle') {
        if (info.vehicleType) {
          await this.draftManager.updateDraftField(draftId, 'vehicleType', info.vehicleType);
        }
        if (info.brand) {
          await this.draftManager.updateDraftField(draftId, 'brand', info.brand);
        }
        if (info.price) {
          await this.draftManager.updateDraftField(draftId, 'price', info.price.toString());
        }
      } else if (category === 'electronics') {
        if (info.itemType) {
          await this.draftManager.updateDraftField(draftId, 'itemType', info.itemType);
        }
        if (info.brand) {
          await this.draftManager.updateDraftField(draftId, 'brand', info.brand);
        }
      } else if (category === 'job') {
        if (info.jobPosition) {
          await this.draftManager.updateDraftField(draftId, 'jobPosition', info.jobPosition);
        }
        if (info.jobType) {
          await this.draftManager.updateDraftField(draftId, 'jobType', info.jobType);
        }
      }
      
      console.log(`📝 [POSTING SERVICE] Saved info to draft ${draftId}`);

      const updatedDraft = await this.draftManager.getDraft(draftId);
      console.log(`📝 [POSTING SERVICE] Draft after save:`, updatedDraft.data);

    } catch (error) {
      console.error(`❌ [POSTING SERVICE] Error saving extracted info:`, error);
      console.error(`❌ Error stack:`, error.stack);
    }
  }

  async extractInitialInfo(message, draftId, category) {
    // This is now handled by extractInfoFromIntent
    let intentResult;
    try {
      intentResult = await IntentClassifier.classify(message);
    } catch (error) {
      intentResult = {
        intent: 'general_help',
        confidence: 0.1,
        entities: {},
        context: null
      };
    }
    
    const extractedInfo = await this.extractInfoFromIntent(intentResult, message, category);
    if (extractedInfo) {
      await this.saveExtractedInfo(draftId, category, extractedInfo);
    }
  }

  getNextRequiredField(draft) {
    try {
      const config = FIELD_CONFIGS[draft.category];
      if (!config) {
        console.log(`❌ [POSTING SERVICE] No config found for category: ${draft.category}`);
        return null;
      }
      
      console.log(`📝 [POSTING SERVICE] Required fields for ${draft.category}:`, config.required);
      console.log(`📝 [POSTING SERVICE] Current draft data:`, draft.data);
      
      for (const field of config.required) {
        const fieldParts = field.split('.');
        let value;
        
        if (fieldParts[0] === 'location') {
          value = draft.data?.location?.[fieldParts[1]];
          console.log(`📝 [POSTING SERVICE] Checking location field ${field}: ${value}`);
        } else {
          value = draft.data?.[draft.category]?.[fieldParts[0]];
          console.log(`📝 [POSTING SERVICE] Checking category field ${field}: ${value}`);
        }
        
        if (!value || value.trim() === '') {
          console.log(`📝 [POSTING SERVICE] Next required field: ${field}`);
          return field;
        }
      }
      
      console.log(`📝 [POSTING SERVICE] All required fields are filled`);
      return null;
      
    } catch (error) {
      console.error(`❌ [POSTING SERVICE] Error getting next required field:`, error);
      return null;
    }
  }

  getFieldQuestion(fieldPath, category) {
    try {
      const config = FIELD_CONFIGS[category];
      if (!config) {
        console.log(`❌ [POSTING SERVICE] No config found for category: ${category}`);
        return `Please provide ${fieldPath}:`;
      }
      
      if (config.fields[fieldPath]) {
        return config.fields[fieldPath].question;
      }
      
      // If field not in config, generate generic question
      const fieldName = fieldPath.split('.').pop();
      const readableName = fieldName.replace(/([A-Z])/g, ' $1').toLowerCase();
      return `Please provide ${readableName}:`;
      
    } catch (error) {
      console.error(`❌ [POSTING SERVICE] Error getting field question:`, error);
      return `Please provide ${fieldPath}:`;
    }
  }

async getNextQuestion(draftId) {
  try {
    const draft = await this.draftManager.getDraft(draftId);
    if (!draft) {
      return 'Sorry, I could not find your draft. Please start over.';
    }
    
    const nextField = this.getNextRequiredField(draft);
    
    if (nextField) {
      await this.sessionManager.updateSession({ expectedField: nextField });
      const question = this.getFieldQuestion(nextField, draft.category);
      return question;
    } else {
      // All required fields filled - show summary WITH BUTTONS
      const summary = await this.generateSummary(draft);
      await this.sessionManager.updateSession({ expectedField: 'confirmation' });
      
      // Return summary with buttons instead of plain text
      return {
        type: 'summary_with_buttons',
        response: `${summary}\n\n✅ Is this correct?`,
        buttons: [
          { id: 'confirm_yes', title: '✅ Yes, Post It' },
          { id: 'confirm_no', title: '❌ No, Cancel' }
        ],
        shouldHandle: true
      };
    }
    
  } catch (error) {
    console.error(`❌ [POSTING SERVICE] Error getting next question:`, error);
    return 'Sorry, there was an error. Please try again.';
  }
}

  async generateSummary(draft) {
    try {
      const category = draft.category;
      const data = draft.data?.[category] || {};
      const location = draft.data?.location || {};
      
      let summary = `📋 **Listing Summary**\n`;
      summary += `Type: ${FIELD_CONFIGS[category]?.displayName || category}\n`;
      
      if (category === 'housing') {
        summary += `🏠 ${data.unitType?.toUpperCase() || 'Property'}\n`;
        if (data.propertyType) summary += `Type: ${data.propertyType}\n`;
        if (data.rent) summary += `💰 Rent: ₹${this.formatNumber(data.rent)}\n`;
        if (data.deposit) summary += `💵 Deposit: ₹${this.formatNumber(data.deposit)}\n`;
        if (data.furnishing) summary += `🛋️ ${data.furnishing}\n`;
        if (data.description) {
          const shortDesc = data.description.length > 50 ? 
            data.description.slice(0, 50) + '...' : data.description;
          summary += `📝 ${shortDesc}\n`;
        }
      } else if (category === 'urban_help') {
      const serviceType = data.serviceType || 'Service';
      const serviceName = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
      summary += `🔧 *Service:* ${serviceName}\n`;
      if (data.description) {
        const shortDesc = data.description.length > 100 ? 
          data.description.slice(0, 100) + '...' : data.description;
        summary += `📝 *Description:* ${shortDesc}\n`;
      }
      if (data.experience) summary += `⭐ *Experience:* ${data.experience}\n`;
      if (data.rate) summary += `💰 *Rate:* ${data.rate}\n`;
      if (data.availability) summary += `⏰ *Available:* ${data.availability}\n`;
      } else if (category === 'vehicle') {
        if (data.vehicleType) summary += `🚗 Type: ${data.vehicleType}\n`;
        if (data.brand) summary += `🏷️ Brand: ${data.brand}\n`;
        if (data.model) summary += `📱 Model: ${data.model}\n`;
        if (data.year) summary += `📅 Year: ${data.year}\n`;
        if (data.price) summary += `💰 Price: ₹${this.formatNumber(data.price)}\n`;
        if (data.condition) summary += `⚡ Condition: ${data.condition}\n`;
      } else if (category === 'electronics') {
        if (data.itemType) summary += `📱 Type: ${data.itemType}\n`;
        if (data.brand) summary += `🏷️ Brand: ${data.brand}\n`;
        if (data.model) summary += `🔄 Model: ${data.model}\n`;
        if (data.price) summary += `💰 Price: ₹${this.formatNumber(data.price)}\n`;
        if (data.condition) summary += `⚡ Condition: ${data.condition}\n`;
      } else if (category === 'furniture') {
        if (data.itemType) summary += `🛋️ Type: ${data.itemType}\n`;
        if (data.price) summary += `💰 Price: ₹${this.formatNumber(data.price)}\n`;
        if (data.condition) summary += `⚡ Condition: ${data.condition}\n`;
      } else if (category === 'commodity') {
        if (data.itemName) summary += `📦 Item: ${data.itemName}\n`;
        if (data.price) summary += `💰 Price: ₹${this.formatNumber(data.price)}\n`;
        if (data.condition) summary += `⚡ Condition: ${data.condition}\n`;
      } else if (category === 'job') {
        if (data.jobPosition) summary += `💼 Position: ${data.jobPosition}\n`;
        if (data.jobType) summary += `📅 Type: ${data.jobType}\n`;
        if (data.salary) summary += `💰 Salary: ${data.salary}\n`;
        if (data.company) summary += `🏢 Company: ${data.company}\n`;
        if (data.experienceRequired) summary += `⭐ Experience Required: ${data.experienceRequired}\n`;
      }
      
      if (location.area) {
        summary += `📍 ${location.area}`;
        if (location.city) summary += `, ${location.city}`;
        summary += '\n';
      }
      
      return summary;
      
    } catch (error) {
      console.error(`❌ [POSTING SERVICE] Error generating summary:`, error);
      return 'Listing summary unavailable.';
    }
  }

  formatNumber(num) {
    if (!num) return '0';
    
    const number = parseFloat(num);
    if (isNaN(number)) return num;
    
    if (number >= 10000000) {
      return (number / 10000000).toFixed(2) + ' Cr';
    } else if (number >= 100000) {
      return (number / 100000).toFixed(2) + ' Lakh';
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + 'K';
    }
    
    return number.toLocaleString('en-IN');
  }

async publishListing(draft) {
  try {
    console.log(`📝 [POSTING SERVICE] Publishing listing from draft: ${draft.id}`);
    
    // ✅ Use admin from firestore.js or import it
    const { db } = require('../../database/firestore');
    const admin = require('firebase-admin'); // ADD THIS
    
    const listingId = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const listingRef = db.collection('listings').doc(listingId);
    
    // ✅ Use admin.firestore.FieldValue.serverTimestamp() correctly
    const listingData = {
      id: listingId,
      status: 'active',
      category: draft.category,
      subCategory: draft.data?.[draft.category]?.serviceType || 
                  draft.data?.[draft.category]?.unitType || 
                  draft.data?.[draft.category]?.itemType ||
                  draft.data?.[draft.category]?.vehicleType ||
                  draft.data?.[draft.category]?.jobPosition ||
                  draft.category,
      data: draft.data,
      owner: {
        userId: this.userId,
        phone: this.userId
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // ✅ FIXED
      metrics: {
        views: 0,
        contacts: 0
      }
    };
    
    // Add 30 days for expiration
    const expiresAtDate = new Date();
    expiresAtDate.setDate(expiresAtDate.getDate() + 30);
    listingData.expiresAt = expiresAtDate.getTime();
    
    // Add title based on category
    if (draft.category === 'urban_help') {
      const serviceType = draft.data?.['urban_help']?.serviceType || 'Service';
      const location = draft.data?.location?.area || '';
      listingData.title = `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}${location ? ` in ${location}` : ''}`;
    } else if (draft.category === 'housing') {
      const unitType = draft.data?.['housing']?.unitType || 'Property';
      const location = draft.data?.location?.area || '';
      listingData.title = `${unitType.toUpperCase()}${location ? ` in ${location}` : ''} for Rent`;
    } else if (draft.category === 'vehicle') {
      const vehicleType = draft.data?.['vehicle']?.vehicleType || 'Vehicle';
      const brand = draft.data?.['vehicle']?.brand || '';
      listingData.title = `${brand ? brand + ' ' : ''}${vehicleType} for Sale`;
    } else if (draft.category === 'electronics') {
      const itemType = draft.data?.['electronics']?.itemType || 'Electronic Item';
      const brand = draft.data?.['electronics']?.brand || '';
      listingData.title = `${brand ? brand + ' ' : ''}${itemType} for Sale`;
    } else if (draft.category === 'furniture') {
      const itemType = draft.data?.['furniture']?.itemType || 'Furniture';
      listingData.title = `${itemType} for Sale`;
    } else if (draft.category === 'commodity') {
      const itemName = draft.data?.['commodity']?.itemName || 'Item';
      listingData.title = `${itemName} for Sale`;
    } else if (draft.category === 'job') {
      const jobPosition = draft.data?.['job']?.jobPosition || 'Job';
      listingData.title = `${jobPosition} Position Available`;
    }
    
    console.log(`📝 [POSTING SERVICE] Saving listing to Firestore:`, listingData);
    await listingRef.set(listingData);
    
    // Delete draft
    await this.draftManager.deleteDraft(draft.id);
    
    console.log(`📝 [POSTING SERVICE] Listing published successfully: ${listingId}`);
    return { success: true, listingId };
    
  } catch (error) {
    console.error('❌ [POSTING SERVICE] Publish Listing Error:', error);
    return { success: false, error: error.message };
  }
}
    
    // Helper method to clear user session
    async clearUserSession() {
      try {
        await this.sessionManager.clearSession();
        return true;
      } catch (error) {
        console.error('❌ [POSTING SERVICE] Error clearing session:', error);
        return false;
      }
    }
    
    // Helper method to get current draft status
    async getCurrentDraftStatus() {
      try {
        const session = await this.sessionManager.getOrCreateSession();
        if (session.mode === 'posting' && session.draftId) {
          const draft = await this.draftManager.getDraft(session.draftId);
          if (draft) {
            return {
              hasDraft: true,
              category: draft.category,
              draftId: draft.id,
              status: draft.status,
              filledFields: draft.filledFields?.length || 0
            };
          }
        }
        return { hasDraft: false };
      } catch (error) {
        console.error('❌ [POSTING SERVICE] Error getting draft status:', error);
        return { hasDraft: false };
      }
    }
}

module.exports = PostingService;