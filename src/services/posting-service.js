// File: /services/posting-service.js
const SessionManager = require('../../database/session-manager');
const DraftManager = require('../../database/draft-manager');
const { db } = require('../../database/firestore');
const { Timestamp } = require('firebase/firestore');

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
            'electrician', 'plumber', 'cook', 'maid', 'cleaner', 'driver', 
            'tutor', 'carpenter', 'painter', 'technician', 'mechanic'
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
      'deta', 'deti', 'dete', 'deti hoon', 'deta hoon' // Hindi: provide
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
      const category = this.detectCategoryFromIntent(intentResult, message);
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
          type: 'question',
          response: `You already have a draft in progress. Do you want to continue with that or start a new ${category} listing?`,
          shouldHandle: true,
          options: ['Continue draft', 'Start new']
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
        isVoiceInitiated: false
      });
      
      // Try to extract initial info using intent classifier
      const extractedInfo = await this.extractInfoFromIntent(intentResult, message, category);
      if (extractedInfo) {
        await this.saveExtractedInfo(draft.id, category, extractedInfo);
      }
      
      // Get next question
      const nextQuestion = await this.getNextQuestion(draft.id);
      
      return {
        type: 'question',
        response: nextQuestion,
        shouldHandle: true
      };
      
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
      /available for/i,
      /service provided/i,
      /services available/i,
      /hire me/i,
      /i am expert/i,
      /professional/i,
      /experienced/i
    ];
    
    const offeringKeywords = ["i'm", "i am", "i have", "available", "provide", "offer", "sell", "selling", "for sale", "professional", "experienced"];
    
    // Check for offering patterns
    const hasPattern = offeringPatterns.some(pattern => pattern.test(lower));
    
    // Check keywords
    const hasKeyword = offeringKeywords.some(word => lower.includes(word));
    
    return hasPattern || hasKeyword;
  }

  async extractInfoFromIntent(intentResult, message, category) {
    const info = {};
    const entities = intentResult.entities || {};
    const lowerMsg = message.toLowerCase();
    
    console.log("📝 [POSTING SERVICE] Extracting info from intent entities:", entities);
    
    if (category === 'urban_help') {
      // Use service_type from intent classifier
      if (entities.service_type) {
        info.serviceType = entities.service_type;
      } else if (intentResult.intent === 'service_offer' || intentResult.context === 'offer') {
        // Try to extract from message
        const serviceMatch = message.match(/\b(electrician|plumber|carpenter|cleaner|repair|technician|painter|mechanic|driver|maid|cook|babysitter|security|guard|tutor|teacher)\b/i);
        if (serviceMatch) {
          info.serviceType = serviceMatch[0].toLowerCase();
        } else {
          // If no specific service found, extract from "I am a [service]" pattern
          const offeringMatch = lowerMsg.match(/i('?m| am| mai| main| mein) (a |an )?(.+?)( in| at| near|$)/i);
          if (offeringMatch && offeringMatch[3]) {
            info.serviceType = offeringMatch[3].trim();
          } else {
            info.serviceType = 'service';
          }
        }
      }
      
      // Use location from intent classifier
      if (entities.location) {
        info.location = entities.location;
      } else {
        // Try to extract location from message
        const locationMatch = message.match(/\b(in|at|near|around|mein|me|main)\s+([^,.!?]+)/i);
        if (locationMatch && locationMatch[2]) {
          info.location = locationMatch[2].trim();
        }
      }
      
      // Use description
      info.description = message;
      
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
    const lowerMsg = message.toLowerCase().trim();
    
    if (lowerMsg === 'yes' || lowerMsg === 'y' || lowerMsg === '✅' || lowerMsg === 'confirm' ||
        lowerMsg === 'haan' || lowerMsg === 'han' || lowerMsg === 'ha' || lowerMsg === 'sahi' ||
        lowerMsg === 'correct' || lowerMsg === 'right') {
      // Publish listing
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
    } else if (lowerMsg === 'no' || lowerMsg === 'n' || lowerMsg === '❌' || lowerMsg === 'cancel' ||
               lowerMsg === 'nahi' || lowerMsg === 'na' || lowerMsg === 'galat' ||
               lowerMsg === 'wrong' || lowerMsg === 'incorrect') {
      await this.draftManager.deleteDraft(draft.id);
      await this.sessionManager.clearSession();
      return {
        type: 'cancelled',
        response: 'Listing cancelled. You can start a new one anytime.',
        shouldHandle: true
      };
    } else if (lowerMsg === 'edit' || lowerMsg === 'change' || lowerMsg.includes('modify')) {
      // Get first field for editing
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
    
    return {
      type: 'question',
      response: 'Please reply "YES" to post or "NO" to cancel.',
      shouldHandle: true
    };
  }

  detectCategory(message) {
    const lowerMsg = message.toLowerCase();
    
    // Urban Help services
    const urbanHelpKeywords = [
      'plumber', 'electrician', 'cleaner', 'tutor', 'maid', 'cook',
      'carpenter', 'painter', 'driver', 'technician', 'service',
      'help', 'mechanic', 'gardener', 'welder', 'repair',
      'beautician', 'salon', 'barber', 'tailor', 'laundry'
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
    
    // Check categories in order
    for (const keyword of urbanHelpKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'urban_help';
      }
    }
    
    for (const keyword of housingKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'housing';
      }
    }
    
    for (const keyword of vehicleKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'vehicle';
      }
    }
    
    for (const keyword of electronicsKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'electronics';
      }
    }
    
    for (const keyword of furnitureKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'furniture';
      }
    }
    
    for (const keyword of jobKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'job';
      }
    }
    
    for (const keyword of commodityKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'commodity';
      }
    }
    
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
      
      if (category === 'urban_help') {
        if (info.serviceType) {
          await this.draftManager.updateDraftField(draftId, 'serviceType', info.serviceType);
        }
        if (info.description) {
          await this.draftManager.updateDraftField(draftId, 'description', info.description);
        }
        if (info.location) {
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
    } catch (error) {
      console.error(`❌ [POSTING SERVICE] Error saving extracted info:`, error);
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
        return this.getFieldQuestion(nextField, draft.category);
      }
      
      return 'Please provide more details about your listing.';
      
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
        summary += `🔧 ${serviceName}\n`;
        if (data.description) {
          const shortDesc = data.description.length > 50 ? 
            data.description.slice(0, 50) + '...' : data.description;
          summary += `📝 ${shortDesc}\n`;
        }
        if (data.experience) summary += `⭐ Experience: ${data.experience}\n`;
        if (data.rate) summary += `💰 Rate: ${data.rate}\n`;
        if (data.availability) summary += `⏰ Available: ${data.availability}\n`;
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
      
      // Create listing in listings collection
      const listingId = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const listingRef = db.collection('listings').doc(listingId);
      
      // Prepare listing data
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
          phone: this.userId // Assuming userId is phone number
        },
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        metrics: {
          views: 0,
          contacts: 0
        }
      };
      
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