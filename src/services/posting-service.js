// File: /services/posting-service.js
const SessionManager = require('../../database/session-manager');
const DraftManager = require('../../database/draft-manager');
const FIELD_CONFIGS = require('../../utils/field-config');
const { db } = require('../../database/firestore');
const { Timestamp } = require('firebase/firestore');
const IntentClassifier = require('./intent-classifier'); // Import your intent classifier

class PostingService {
  constructor(userId) {
    this.userId = userId;
    this.sessionManager = new SessionManager(userId);
    this.draftManager = new DraftManager();
    this.intentClassifier = IntentClassifier; // Use your intent classifier
  }

  async processMessage(message) {
    const session = await this.sessionManager.getOrCreateSession();
    
    // If user is already in posting mode
    if (session.mode === 'posting' && session.draftId) {
      return await this.continuePosting(message, session);
    }
    
    // Check if this is a new posting request using intent classifier
    const intentResult = await this.intentClassifier.classify(message);
    console.log("📝 [POSTING SERVICE] Intent classification result:", intentResult);
    
    if (await this.isPostingIntent(message, intentResult)) {
      return await this.startNewPosting(message, intentResult);
    }
    
    return { type: 'not_posting', shouldHandle: false };
  }

  // ✅ UPDATED: Use intent classifier for better detection
  async isPostingIntent(message, intentResult = null) {
    // First check with intent classifier if result provided
    if (intentResult) {
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
    
    return postingKeywords.some(keyword => lowerMsg.includes(keyword));
  }

  // ✅ ADDED: New method to handle voice-initiated offerings
  async startNewListing(initialMessage) {
    try {
      console.log("📝 [POSTING SERVICE] Starting new listing from voice/offering");
      console.log("📝 [POSTING SERVICE] Initial message:", initialMessage);
      
      // Use intent classifier to understand the message
      const intentResult = await this.intentClassifier.classify(initialMessage);
      console.log("📝 [POSTING SERVICE] Intent analysis:", intentResult);
      
      // Check if this is actually an offering
      const isOffering = intentResult.context === 'offer' || 
                        ['service_offer', 'property_sale', 'commodity_sell', 
                         'vehicle_sell', 'job_offer'].includes(intentResult.intent);
      
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
          response: 'What type of listing? (Housing, Urban Help, etc.)'
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
        isVoiceInitiated: true, // Mark as voice-initiated
        originalIntent: intentResult
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
          response: question
        };
      } else {
        // All required fields filled, show confirmation
        const summary = await this.generateSummary(draftWithData);
        await this.sessionManager.updateSession({ expectedField: 'confirmation' });
        
        return {
          type: 'confirmation',
          response: `${summary}\n\n✅ Is this correct?\nReply "YES" to post or "NO" to cancel.`
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
    // Use intent classifier if result not provided
    if (!intentResult) {
      intentResult = await this.intentClassifier.classify(message);
    }
    
    // Determine category from message using intent classifier
    const category = this.detectCategoryFromIntent(intentResult, message);
    
    if (!category) {
      return {
        type: 'question',
        response: 'What type of listing? (Housing, Urban Help, etc.)'
      };
    }
    
    // Create new draft
    const draft = await this.draftManager.createDraft(this.userId, category);
    
    // Update session
    await this.sessionManager.updateSession({
      mode: 'posting',
      category: category,
      draftId: draft.id,
      expectedField: null,
      isVoiceInitiated: false,
      originalIntent: intentResult
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
      response: nextQuestion
    };
  }

  // ✅ ADDED: Detect category from intent classifier
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
    if (intentToCategory[intentResult.intent]) {
      return intentToCategory[intentResult.intent];
    }
    
    // Fallback to keyword detection
    return this.detectCategory(message);
  }

  // ✅ ADDED: Extract info from intent classifier
  async extractInfoFromIntent(intentResult, message, category) {
    const info = {};
    const entities = intentResult.entities || {};
    
    console.log("📝 [POSTING SERVICE] Extracting info from intent entities:", entities);
    
    if (category === 'urban_help') {
      // Use service_type from intent classifier
      if (entities.service_type) {
        info.serviceType = entities.service_type;
      } else if (intentResult.intent === 'service_offer') {
        // Try to extract from message
        const serviceMatch = message.match(/\b(electrician|plumber|carpenter|cleaner|repair|technician|painter|mechanic|driver|maid|cook|babysitter|security|guard|tutor|teacher)\b/i);
        if (serviceMatch) {
          info.serviceType = serviceMatch[0].toLowerCase();
        }
      }
      
      // Use location from intent classifier
      if (entities.location) {
        info.location = entities.location;
      }
      
      // Use description
      info.description = message;
      
      // If serviceType not found but context is offering, try to extract
      if (!info.serviceType && intentResult.context === 'offer') {
        const offeringMatch = message.toLowerCase().match(/i('?m| am| mai| main| mein) (a |an )?(.+?)( in| at| near|$)/i);
        if (offeringMatch && offeringMatch[3]) {
          info.serviceType = offeringMatch[3].trim();
        }
      }
      
    } else if (category === 'housing') {
      // Use entities from intent classifier
      if (entities.bhk) info.unitType = entities.bhk;
      if (entities.location) info.location = entities.location;
      if (entities.price) info.rent = this.parsePrice(entities.price);
      if (entities.type) info.propertyType = entities.type;
      
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
    
    return info;
  }

  async continuePosting(message, session) {
    const draft = await this.draftManager.getDraft(session.draftId);
    
    if (!draft) {
      await this.sessionManager.clearSession();
      return {
        type: 'error',
        response: 'Session expired. Please start over.'
      };
    }
    
    // Handle confirmation
    if (session.expectedField === 'confirmation') {
      return await this.handleConfirmation(message, draft);
    }
    
    // Handle field response
    if (session.expectedField) {
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
          response: question
        };
      } else {
        // All required fields filled, show confirmation
        const summary = await this.generateSummary(updatedDraft);
        await this.sessionManager.updateSession({ expectedField: 'confirmation' });
        
        return {
          type: 'confirmation',
          response: `${summary}\n\n✅ Is this correct?\nReply "YES" to post or "NO" to cancel.`
        };
      }
    }
    
    return {
      type: 'error',
      response: 'Please answer the question above.'
    };
  }

  async handleConfirmation(message, draft) {
    const lowerMsg = message.toLowerCase().trim();
    
    if (lowerMsg === 'yes' || lowerMsg === 'y' || lowerMsg === '✅' || lowerMsg === 'confirm' ||
        lowerMsg === 'haan' || lowerMsg === 'han' || lowerMsg === 'ha' || lowerMsg === 'sahi') {
      // Publish listing
      const result = await this.publishListing(draft);
      
      if (result.success) {
        await this.sessionManager.clearSession();
        return {
          type: 'success',
          response: '🎉 Your listing has been published successfully!\n\n' +
                   'You can view it from the "Manage Listings" option.'
        };
      } else {
        return {
          type: 'error',
          response: 'Failed to publish. Please try again.'
        };
      }
    } else if (lowerMsg === 'no' || lowerMsg === 'n' || lowerMsg === '❌' || lowerMsg === 'cancel' ||
               lowerMsg === 'nahi' || lowerMsg === 'na' || lowerMsg === 'galat') {
      await this.draftManager.deleteDraft(draft.id);
      await this.sessionManager.clearSession();
      return {
        type: 'cancelled',
        response: 'Listing cancelled. You can start a new one anytime.'
      };
    }
    
    return {
      type: 'question',
      response: 'Please reply "YES" to post or "NO" to cancel.'
    };
  }

  // Fallback category detection (kept for compatibility)
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
    
    // Check for urban help first
    for (const keyword of urbanHelpKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'urban_help';
      }
    }
    
    // Check for housing
    for (const keyword of housingKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'housing';
      }
    }
    
    return null;
  }

  // ✅ ADDED: Parse price from string
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

  // ✅ ADDED: Save extracted info to draft
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
      }
      
      console.log(`📝 [POSTING SERVICE] Saved info to draft ${draftId}`);
    } catch (error) {
      console.error(`❌ [POSTING SERVICE] Error saving extracted info:`, error);
    }
  }

  // Legacy method (kept for compatibility)
  async extractInitialInfo(message, draftId, category) {
    // This is now handled by extractInfoFromIntent
    const intentResult = await this.intentClassifier.classify(message);
    const extractedInfo = await this.extractInfoFromIntent(intentResult, message, category);
    if (extractedInfo) {
      await this.saveExtractedInfo(draftId, category, extractedInfo);
    }
  }

  getNextRequiredField(draft) {
    const config = FIELD_CONFIGS[draft.category];
    if (!config) return null;
    
    for (const field of config.required) {
      const fieldParts = field.split('.');
      let value;
      
      if (fieldParts[0] === 'location') {
        value = draft.data?.location?.[fieldParts[1]];
      } else {
        value = draft.data?.[draft.category]?.[fieldParts[1]];
      }
      
      if (!value || value.trim() === '') {
        return field;
      }
    }
    
    return null;
  }

  getFieldQuestion(fieldPath, category) {
    const config = FIELD_CONFIGS[category];
    if (!config || !config.fields[fieldPath]) {
      return `Please provide ${fieldPath}:`;
    }
    
    return config.fields[fieldPath].question;
  }

  async getNextQuestion(draftId) {
    const draft = await this.draftManager.getDraft(draftId);
    const nextField = this.getNextRequiredField(draft);
    
    if (nextField) {
      await this.sessionManager.updateSession({ expectedField: nextField });
      return this.getFieldQuestion(nextField, draft.category);
    }
    
    return 'Please provide more details about your listing.';
  }

  async generateSummary(draft) {
    const category = draft.category;
    const data = draft.data?.[category] || {};
    const location = draft.data?.location || {};
    
    let summary = `📋 **Listing Summary**\n`;
    summary += `Type: ${FIELD_CONFIGS[category]?.displayName || category}\n`;
    
    if (category === 'housing') {
      summary += `🏠 ${data.unitType?.toUpperCase() || 'Property'}\n`;
      summary += `💰 Rent: ₹${data.rent || 'Not specified'}\n`;
      if (data.deposit) summary += `💵 Deposit: ₹${data.deposit}\n`;
      if (data.furnishing) summary += `🛋️ ${data.furnishing}\n`;
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
    }
    
    if (location.area) summary += `📍 ${location.area}`;
    if (location.city) summary += `, ${location.city}`;
    
    return summary;
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
        subCategory: draft.data?.[draft.category]?.serviceType || draft.data?.[draft.category]?.unitType || draft.category,
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
}

module.exports = PostingService;