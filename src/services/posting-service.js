// File: /services/posting-service.js
const SessionManager = require('../database/session-manager');
const DraftManager = require('../database/draft-manager');
const FIELD_CONFIGS = require('../utils/field-config');
const { db } = require('../database/firestore');
const { Timestamp } = require('firebase/firestore');

class PostingService {
  constructor(userId) {
    this.userId = userId;
    this.sessionManager = new SessionManager(userId);
    this.draftManager = new DraftManager();
  }

  async processMessage(message) {
    const session = await this.sessionManager.getOrCreateSession();
    
    // If user is already in posting mode
    if (session.mode === 'posting' && session.draftId) {
      return await this.continuePosting(message, session);
    }
    
    // Check if this is a new posting request
    if (await this.isPostingIntent(message)) {
      return await this.startNewPosting(message);
    }
    
    return { type: 'not_posting', shouldHandle: false };
  }

  async isPostingIntent(message) {
    const lowerMsg = message.toLowerCase();
    const postingKeywords = [
      'post', 'list', 'add', 'create', 'offer', 'available',
      'rent', 'sell', 'service', 'help', 'looking for', 'need',
      '1bhk', '2bhk', '3bhk', 'flat', 'apartment', 'room',
      'plumber', 'electrician', 'cleaner', 'tutor'
    ];
    
    return postingKeywords.some(keyword => lowerMsg.includes(keyword));
  }

  async startNewPosting(message) {
    // Determine category from message
    const category = this.detectCategory(message);
    
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
      expectedField: null
    });
    
    // Try to extract initial info
    await this.extractInitialInfo(message, draft.id, category);
    
    // Get next question
    const nextQuestion = await this.getNextQuestion(draft.id);
    
    return {
      type: 'question',
      response: nextQuestion
    };
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
    
    if (lowerMsg === 'yes' || lowerMsg === 'y' || lowerMsg === '✅') {
      // Publish listing
      const result = await this.publishListing(draft);
      
      if (result.success) {
        await this.sessionManager.clearSession();
        return {
          type: 'success',
          response: '🎉 Your listing has been published successfully!\n\n' +
                   'View it here: [link to listing]'
        };
      } else {
        return {
          type: 'error',
          response: 'Failed to publish. Please try again.'
        };
      }
    } else if (lowerMsg === 'no' || lowerMsg === 'n' || lowerMsg === '❌') {
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

  detectCategory(message) {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('rent') || lowerMsg.includes('room') || 
        lowerMsg.includes('flat') || lowerMsg.includes('apartment') ||
        lowerMsg.includes('1bhk') || lowerMsg.includes('2bhk') ||
        lowerMsg.includes('3bhk') || lowerMsg.includes('pg')) {
      return 'housing';
    }
    
    if (lowerMsg.includes('service') || lowerMsg.includes('help') ||
        lowerMsg.includes('plumber') || lowerMsg.includes('electrician') ||
        lowerMsg.includes('cleaner') || lowerMsg.includes('tutor')) {
      return 'urban_help';
    }
    
    return null;
  }

  async extractInitialInfo(message, draftId, category) {
    // Simple extraction - you can enhance this with your AI
    const lowerMsg = message.toLowerCase();
    
    if (category === 'housing') {
      if (lowerMsg.includes('1bhk')) {
        await this.draftManager.updateDraftField(draftId, 'unitType', '1bhk');
      } else if (lowerMsg.includes('2bhk')) {
        await this.draftManager.updateDraftField(draftId, 'unitType', '2bhk');
      }
      
      // Extract rent
      const rentMatch = message.match(/(\d+)\s*(k|thousand|rs|₹)/i);
      if (rentMatch) {
        let rent = parseInt(rentMatch[1]);
        if (rentMatch[2].toLowerCase() === 'k') rent *= 1000;
        await this.draftManager.updateDraftField(draftId, 'rent', rent.toString());
      }
      
      // Extract area
      if (lowerMsg.includes('sector')) {
        const sectorMatch = message.match(/sector\s*(\d+[a-z]?)/i);
        if (sectorMatch) {
          await this.draftManager.updateDraftField(draftId, 'location.area', `Sector ${sectorMatch[1]}`);
        }
      }
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
      summary += `🔧 ${data.serviceType || 'Service'}\n`;
      if (data.description) summary += `📝 ${data.description.slice(0, 50)}...\n`;
    }
    
    if (location.area) summary += `📍 ${location.area}`;
    if (location.city) summary += `, ${location.city}`;
    
    return summary;
  }

  async publishListing(draft) {
    try {
      // Create listing in listings collection
      const listingId = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const listingRef = db.collection('listings').doc(listingId);
      
      const listingData = {
        id: listingId,
        status: 'active',
        category: draft.category,
        subCategory: draft.data?.[draft.category]?.subCategory || draft.category,
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
      
      await listingRef.set(listingData);
      
      // Delete draft
      await this.draftManager.deleteDraft(draft.id);
      
      return { success: true, listingId };
      
    } catch (error) {
      console.error('Publish Listing Error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = PostingService;