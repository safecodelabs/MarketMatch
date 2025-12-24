// Enhanced AI intent classifier for multiple domains
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

class IntentClassifier {
  constructor() {
    this.threshold = 0.3;
    this.initializeTrainingData();
  }

  initializeTrainingData() {
    // Comprehensive training data for Indian context
    this.trainingData = {
      // Property/Housing intents
      'property_search': [
        'looking for 2bhk in noida',
        'need 3 bhk flat for rent',
        'want to buy apartment in gurgaon',
        'searching for house in delhi',
        'i need property',
        'show me flats for sale',
        'find me a house',
        '2 bhk in greater noida',
        '3 bedroom flat in noida extension',
        'looking for pg in delhi'
      ],
      
      'property_rent': [
        'want to rent a house',
        'looking for rental apartment',
        'need pg accommodation',
        'room for rent',
        'flat on rent',
        'house for rent',
        'rental property needed',
        'paying guest accommodation',
        'flatmate wanted',
        'shared room required'
      ],
      
      'service_request': [
        'need electrician in greater noida',
        'looking for plumber',
        'want carpenter service',
        'need home cleaning service',
        'require ac repair',
        'electrician needed',
        'plumber required',
        'carpenter for furniture',
        'cleaning service at home',
        'technician for repair'
      ],
      
      'commodity_search': [
        'looking for 2 ton steel',
        'need 5 ton rice',
        'want to buy cement',
        'searching for wheat',
        'need construction materials',
        'steel required',
        'rice needed',
        'cement for construction',
        'wheat purchase',
        'building materials'
      ],
      
      'buy_sell': [
        'want to sell my car',
        'looking to buy furniture',
        'need to purchase electronics',
        'selling old laptop',
        'buy mobile phone',
        'sell bike',
        'purchase television',
        'second hand items',
        'used car sale',
        'new furniture buy'
      ],
      
      'general_help': [
        'i need help',
        'can you assist me',
        'what can you do',
        'show me options',
        'help needed',
        'guide me',
        'what services',
        'how to use',
        'need assistance'
      ]
    };

    // Initialize TF-IDF
    this.tfidf = new natural.TfIdf();
    
    // Train the classifier
    Object.keys(this.trainingData).forEach(intent => {
      this.trainingData[intent].forEach(text => {
        this.tfidf.addDocument(text.toLowerCase(), intent);
      });
    });
  }

  // Entities extraction patterns for Indian context
  getEntityPatterns() {
    return {
      property: {
        bhk: /\b(\d+)\s*(?:bhk|bedroom|bed room|bed|room|rk)\b/i,
        location: /\b(?:in|at|near|around|greater|sector|area)\s+([a-z\s]+?)(?:\s+(?:sector|area|road|street|extension|noida|delhi|gurgaon))?\b/i,
        type: /\b(?:flat|apartment|house|villa|pg|room|studio|independent floor)\b/i,
        budget: /\b(?:under|around|budget|rs\.?|₹)\s*(\d+[,\d]*\s*(?:lakh|lac|crore|cr)?)\b/i
      },
      service: {
        service_type: /\b(electrician|plumber|carpenter|cleaner|repair|technician|painter|mechanic|driver|maid)\b/i,
        location: /\b(?:in|at|near|greater|sector)\s+([a-z\s]+)/i,
        urgency: /\b(?:urgent|immediate|asap|today|now)\b/i
      },
      commodity: {
        quantity: /\b(\d+(?:\.\d+)?)\s*(?:ton|kg|quintal|bag|piece|unit)\b/i,
        item: /\b(steel|rice|wheat|cement|sand|brick|material|iron|dal|pulses)\b/i,
        quality: /\b(?:best|premium|standard|regular|a\-grade)\b/i
      },
      vehicle: {
        type: /\b(car|bike|scooter|motorcycle|auto|vehicle)\b/i,
        brand: /\b(maruti|tata|hyundai|honda|hero|bajaj|yamaha)\b/i,
        condition: /\b(new|used|secondhand|old)\b/i
      }
    };
  }

  async classify(text) {
    const lowerText = text.toLowerCase();
    console.log(`🤖 [AI] Classifying: "${lowerText}"`);
    
    // Quick keyword matching for common Indian terms
    const quickMatches = this.quickMatch(lowerText);
    if (quickMatches.confidence > 0.8) {
      console.log(`🤖 [AI] Quick match: ${quickMatches.intent}`);
      return quickMatches;
    }
    
    // Use TF-IDF for more complex classification
    const tfidfResult = await this.tfidfClassify(lowerText);
    
    // Extract entities based on the intent
    const entities = this.extractEntities(lowerText, tfidfResult.intent);
    
    return {
      intent: tfidfResult.intent,
      confidence: tfidfResult.confidence,
      entities: entities,
      originalText: text,
      language: this.detectLanguage(text)
    };
  }

  quickMatch(text) {
    // Common Indian English/Hinglish patterns
    const patterns = {
      'property_search': [
        /\b(?:chaahiye|chahiye|chahie)\s+(?:property|flat|house|ghar)\b/i,
        /\b(?:dhoondh|dhund|find)\s+(?:raha|rahi|rha|rhi)\b/,
        /\b\d+\s*(?:bhk|bedroom)\b/,
        /\b(?:noida|delhi|gurgaon|greater)\s+(?:mein|me|main)\b/
      ],
      'service_request': [
        /\b(?:electrician|plumber|carpenter)\s+(?:chahiye|required|needed)\b/i,
        /\b(?:service|kaam|work)\s+(?:karwana|karana|karwane)\b/,
        /\b(?:aana|ana)\s+(?:hai|he)\s+(?:ghar|home)\b/
      ],
      'commodity_search': [
        /\b(?:ton|kg)\s+(?:steel|rice|cement)\b/i,
        /\b(?:material|samagri)\s+(?:chahiye|required)\b/,
        /\b(?:construction|building)\s+(?:material|samagri)\b/
      ]
    };

    for (const [intent, intentPatterns] of Object.entries(patterns)) {
      for (const pattern of intentPatterns) {
        if (pattern.test(text)) {
          return {
            intent: intent,
            confidence: 0.9,
            entities: {},
            quickMatch: true
          };
        }
      }
    }

    return { intent: 'general_help', confidence: 0.1, entities: {} };
  }

  async tfidfClassify(text) {
    const scores = {};
    
    // Initialize scores
    Object.keys(this.trainingData).forEach(intent => {
      scores[intent] = 0;
    });

    // Calculate TF-IDF scores
    const tokens = tokenizer.tokenize(text);
    tokens.forEach(token => {
      this.tfidf.tfidfs(token, (i, measure) => {
        const intent = this.tfidf.documents[i].__categories;
        if (intent && scores[intent] !== undefined) {
          scores[intent] += measure;
        }
      });
    });

    // Find best match
    let bestIntent = 'general_help';
    let bestScore = 0;
    
    Object.entries(scores).forEach(([intent, score]) => {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    });

    // Normalize confidence (0 to 1)
    const confidence = Math.min(bestScore / 10, 1);
    
    return {
      intent: bestIntent,
      confidence: confidence,
      isConfident: confidence > this.threshold
    };
  }

  extractEntities(text, intent) {
    const patterns = this.getEntityPatterns();
    const entities = {};
    
    // Common entities for all intents
    const commonPatterns = {
      location: /\b(?:in|at|near|around|mein|me|main)\s+([a-z\s]+?)(?:\s+(?:sector|area))?\b/i,
      quantity: /\b(\d+(?:\.\d+)?)\s*(?:ton|kg|bhk|bedroom|room)\b/i
    };
    
    // Extract common entities
    Object.entries(commonPatterns).forEach(([type, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        entities[type] = match[1] || match[0];
      }
    });

    // Extract intent-specific entities
    switch(intent) {
      case 'property_search':
      case 'property_rent':
        Object.entries(patterns.property).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        
        // Special handling for Indian locations
        const locationMatch = text.match(/\b(noida|delhi|gurgaon|greater noida|noida extension|sector \d+)\b/i);
        if (locationMatch && !entities.location) {
          entities.location = locationMatch[0];
        }
        break;
        
      case 'service_request':
        Object.entries(patterns.service).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        break;
        
      case 'commodity_search':
        Object.entries(patterns.commodity).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        break;
        
      case 'buy_sell':
        Object.entries(patterns.vehicle).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        
        // Extract buy/sell keywords
        if (text.includes('sell') || text.includes('bech') || text.includes('bikri')) {
          entities.action = 'sell';
        } else if (text.includes('buy') || text.includes('kharid') || text.includes('purchase')) {
          entities.action = 'buy';
        }
        break;
    }
    
    // Clean up entities
    Object.keys(entities).forEach(key => {
      if (entities[key]) {
        entities[key] = entities[key].toString().trim();
      }
    });
    
    return entities;
  }

  detectLanguage(text) {
    // Simple language detection for Indian languages
    const hindiWords = ['hai', 'he', 'mein', 'me', 'chahiye', 'chaahiye', 'ka', 'ki', 'ke', 'ko'];
    const tamilWords = ['irukku', 'illai', 'venum', 'vendum', 'aana', 'varum'];
    
    const words = text.toLowerCase().split(' ');
    
    let hindiCount = 0;
    let tamilCount = 0;
    
    words.forEach(word => {
      if (hindiWords.includes(word)) hindiCount++;
      if (tamilWords.includes(word)) tamilCount++;
    });
    
    if (hindiCount > 2) return 'hi';
    if (tamilCount > 2) return 'ta';
    return 'en'; // Default to English
  }

  // Get user-friendly description of intent
  getIntentDescription(intent, entities, language = 'en') {
    const descriptions = {
      en: {
        'property_search': `looking for ${entities.bhk || 'a'} property ${entities.location ? 'in ' + entities.location : ''}`,
        'property_rent': `want to rent ${entities.bhk || 'a'} property ${entities.location ? 'in ' + entities.location : ''}`,
        'service_request': `need ${entities.service_type || 'a service'} ${entities.location ? 'in ' + entities.location : ''}`,
        'commodity_search': `looking for ${entities.quantity || ''} ${entities.item || 'commodity'}`,
        'buy_sell': `want to ${entities.action || 'buy/sell'} ${entities.type || 'something'}`,
        'general_help': 'need assistance'
      },
      hi: {
        'property_search': `${entities.bhk || ''} प्रॉपर्टी ${entities.location ? entities.location + ' में' : ''} ढूंढ रहे हैं`,
        'property_rent': `${entities.bhk || ''} प्रॉपर्टी ${entities.location ? entities.location + ' में' : ''} किराए पर चाहिए`,
        'service_request': `${entities.service_type || 'सर्विस'} ${entities.location ? entities.location + ' में' : ''} चाहिए`,
        'commodity_search': `${entities.quantity || ''} ${entities.item || 'सामान'} चाहिए`,
        'buy_sell': `${entities.type || 'सामान'} ${entities.action === 'sell' ? 'बेचना' : 'खरीदना'} चाहते हैं`,
        'general_help': 'सहायता चाहिए'
      }
    };
    
    const langDescriptions = descriptions[language] || descriptions.en;
    return langDescriptions[intent] || langDescriptions['general_help'];
  }
}

module.exports = new IntentClassifier();