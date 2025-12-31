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
        'looking for pg in delhi',
        'need rented accommodation',
        'searching for studio apartment',
        'want to lease commercial space',
        'find office space',
        'looking for shop for rent'
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
        'shared room required',
        'hostel needed',
        'boys pg required',
        'girls hostel',
        'single room required'
      ],
      
      'property_sale': [
        'want to sell my flat',
        'selling apartment',
        'property for sale',
        'house sale',
        'plot for sale',
        'land selling',
        'commercial property sale',
        'want to sell land'
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
        'technician for repair',
        'need driver',
        'want cook',
        'maid required',
        'security guard needed',
        'babysitter wanted'
      ],
      
      'service_offer': [
        'i am a plumber',
        'electrician available',
        'i provide cleaning service',
        'carpenter here',
        'driver available',
        'cook available',
        'i offer repair services',
        'beautician services',
        'i am a tutor',
        'yoga teacher available'
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
        'building materials',
        'sand needed',
        'bricks required',
        'tiles want to buy',
        'paint required'
      ],
      
      'commodity_sell': [
        'selling steel',
        'cement for sale',
        'have rice to sell',
        'wheat available',
        'construction materials selling',
        'sand for sale'
      ],
      
      'vehicle_buy': [
        'want to buy car',
        'looking to purchase bike',
        'need scooter',
        'want second hand car',
        'buying new motorcycle',
        'need auto rickshaw',
        'want electric vehicle'
      ],
      
      'vehicle_sell': [
        'want to sell my car',
        'selling bike',
        'have scooter for sale',
        'car sale',
        'motorcycle selling',
        'second hand vehicle sale'
      ],
      
      'electronics_buy': [
        'want to buy laptop',
        'need mobile phone',
        'looking for television',
        'purchase refrigerator',
        'buy ac',
        'need washing machine',
        'want smart watch'
      ],
      
      'electronics_sell': [
        'selling laptop',
        'mobile phone for sale',
        'television selling',
        'fridge sale',
        'ac for sale',
        'washing machine selling'
      ],
      
      'furniture_buy': [
        'need sofa',
        'want bed',
        'looking for dining table',
        'buy wardrobe',
        'need office chair',
        'want study table'
      ],
      
      'furniture_sell': [
        'selling sofa',
        'bed for sale',
        'dining table selling',
        'wardrobe sale',
        'office chair selling'
      ],
      
      'job_search': [
        'looking for job',
        'need employment',
        'want work',
        'searching for part time job',
        'need office job',
        'want driver job',
        'looking for teaching job',
        'need receptionist work'
      ],
      
      'job_offer': [
        'need employee',
        'want to hire',
        'looking for staff',
        'require driver',
        'need office assistant',
        'want cook to hire',
        'looking for security guard'
      ],
      
      'education': [
        'need tuition',
        'looking for coaching',
        'want to learn english',
        'computer courses',
        'need music classes',
        'want dance lessons',
        'looking for yoga classes'
      ],
      
      'health': [
        'need doctor',
        'looking for hospital',
        'want ambulance',
        'need medicine',
        'searching for clinic',
        'want physiotherapy',
        'need dental care'
      ],
      
      'events': [
        'need event planner',
        'looking for caterer',
        'want photographer',
        'need decorator',
        'searching for dj',
        'want makeup artist',
        'need wedding planner'
      ],
      
      'legal': [
        'need lawyer',
        'looking for legal help',
        'want advocate',
        'need notary',
        'searching for legal advice',
        'want divorce lawyer',
        'need property lawyer'
      ],
      
      'travel': [
        'need taxi',
        'looking for cab',
        'want bus ticket',
        'need train booking',
        'searching for hotel',
        'want tour package',
        'need travel agent'
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
        'need assistance',
        'i am confused',
        'what is this',
        'how does this work',
        'explain to me'
      ],
      
      'greeting': [
        'hello',
        'hi',
        'hey',
        'good morning',
        'good evening',
        'namaste',
        'how are you',
        'whats up'
      ],
      
      'farewell': [
        'bye',
        'goodbye',
        'see you',
        'thanks',
        'thank you',
        'dhanyavad',
        'shukriya',
        'tata'
      ],
      
      'complaint': [
        'i have complaint',
        'problem with service',
        'not satisfied',
        'issue with order',
        'want to complain',
        'bad experience',
        'need refund',
        'service was poor'
      ],
      
      'appreciation': [
        'good service',
        'thank you for help',
        'very nice',
        'excellent service',
        'satisfied',
        'happy with service',
        'good job',
        'well done'
      ],
      
      'query': [
        'what is the price',
        'how much cost',
        'where is location',
        'when available',
        'what time',
        'how to contact',
        'what are charges',
        'any discount'
      ],
      
      'booking': [
        'want to book',
        'need appointment',
        'reserve for me',
        'schedule meeting',
        'book service',
        'fix appointment',
        'take booking'
      ],
      
      'cancellation': [
        'want to cancel',
        'cancel booking',
        'cancel order',
        'need cancellation',
        'refund required',
        'cancel appointment'
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
        bhk: /\b(\d+)\s*(?:bhk|bedroom|bed room|bed|room|rk|room kitchen)\b/i,
        location: /\b(?:in|at|near|around|greater|sector|area|mein|me|main)\s+([a-z\s]+?)(?:\s+(?:sector|area|road|street|extension|noida|delhi|gurgaon|mumbai|bangalore|chennai|hyderabad|pune|kolkata))?\b/i,
        type: /\b(?:flat|apartment|house|villa|pg|room|studio|independent floor|penthouse|duplex|farmhouse|bunglow)\b/i,
        budget: /\b(?:under|around|budget|rs\.?|₹|rupees|price)\s*(\d+[,\d]*\s*(?:lakh|lac|crore|cr|thousand|k)?)\b/i,
        furnished: /\b(?:furnished|semi-furnished|unfurnished)\b/i
      },
      service: {
        service_type: /\b(electrician|plumber|carpenter|cleaner|repair|technician|painter|mechanic|driver|maid|cook|babysitter|security|guard|tutor|teacher|trainer|beautician|salon|spa|yoga|trainer|coach)\b/i,
        location: /\b(?:in|at|near|greater|sector|area|mein)\s+([a-z\s]+)/i,
        urgency: /\b(?:urgent|immediate|asap|today|now|jaldi|fast|quick)\b/i,
        experience: /\b(?:experience|exp|experienced|fresher|fresh|new)\b/i
      },
      commodity: {
        quantity: /\b(\d+(?:\.\d+)?)\s*(?:ton|kg|quintal|bag|piece|unit|packet|box|crate)\b/i,
        item: /\b(steel|rice|wheat|cement|sand|brick|material|iron|dal|pulses|flour|atta|sugar|salt|oil|ghee|spices|masala)\b/i,
        quality: /\b(?:best|premium|standard|regular|a\-grade|first quality|second quality)\b/i,
        brand: /\b(?:tata|jsw|ambuja|ultratech|shree)\b/i
      },
      vehicle: {
        type: /\b(car|bike|scooter|motorcycle|auto|vehicle|rikshaw|scooty|cycle|bicycle)\b/i,
        brand: /\b(maruti|tata|hyundai|honda|hero|bajaj|yamaha|suzuki|kia|mg|mahindra|tvs|royal enfield)\b/i,
        condition: /\b(new|used|secondhand|old|refurbished|reconditioned)\b/i,
        model: /\b(?:swift|dzire|alto|baleno|brezza|creta|i20|activa|jupiter|access|pulsar|apache)\b/i,
        year: /\b(?:20\d{2}|manufactured|year|model)\s+(\d{4})\b/i
      },
      electronics: {
        type: /\b(laptop|mobile|phone|smartphone|television|tv|refrigerator|fridge|ac|air conditioner|washing machine|microwave|oven|watch|smartwatch)\b/i,
        brand: /\b(apple|samsung|oneplus|xiaomi|redmi|realme|oppo|vivo|sony|lg|whirlpool|voltas|daikin|hp|dell|lenovo)\b/i,
        condition: /\b(new|used|refurbished|sealed|unboxed|open box)\b/i
      },
      furniture: {
        type: /\b(sofa|bed|table|chair|wardrobe|almirah|dining table|study table|office chair|cupboard|shelf|rack|cabinet)\b/i,
        material: /\b(wood|metal|plastic|leather|fabric|rexine|teak|sheesham|mango wood)\b/i
      },
      job: {
        position: /\b(driver|cook|maid|security|guard|receptionist|assistant|clerk|accountant|teacher|tutor|sales|marketing|engineer|developer|designer|manager|supervisor)\b/i,
        type: /\b(full.?time|part.?time|contract|permanent|temporary|freelance|work from home|wfh|remote)\b/i,
        salary: /\b(salary|pay|wage|income|earning)\s+(\d+[,\d]*)\b/i,
        qualification: /\b(graduate|degree|diploma|certificate|experienced|fresher|skilled|unskilled)\b/i
      },
      person: {
        gender: /\b(male|female|boy|girl|man|woman|lady|gentleman)\b/i,
        age: /\b(age|aged|years? old)\s+(\d+)\b/i
      },
      time: {
        date: /\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|next week|this week)\b/i,
        time: /\b(\d{1,2}(?:am|pm|:\d{2})?)\b/i
      }
    };
  }

  async classify(text) {
    const lowerText = text.toLowerCase();
    console.log(`🤖 [AI] Classifying: "${lowerText}"`);
    
    // Detect intent context (offer/find)
    const intentContext = this.detectIntentContext(lowerText);
    
    // Quick keyword matching for common Indian terms
    const quickMatches = this.quickMatch(lowerText);
    if (quickMatches.confidence > 0.8) {
      console.log(`🤖 [AI] Quick match: ${quickMatches.intent}`);
      if (intentContext) {
        quickMatches.context = intentContext;
      }
      return quickMatches;
    }
    
    // Use TF-IDF for more complex classification
    const tfidfResult = await this.tfidfClassify(lowerText);
    
    // Extract entities based on the intent
    const entities = this.extractEntities(lowerText, tfidfResult.intent);
    
    const result = {
      intent: tfidfResult.intent,
      confidence: tfidfResult.confidence,
      entities: entities,
      originalText: text,
      language: this.detectLanguage(text),
      isConfident: tfidfResult.confidence > this.threshold
    };
    
    // Add context if detected
    if (intentContext) {
      result.context = intentContext;
    }
    
    // Adjust intent based on context
    if (intentContext && result.confidence > this.threshold) {
      result.intent = this.adjustIntentByContext(result.intent, intentContext);
    }
    
    return result;
  }

  // Detect if user is offering or looking for something
  detectIntentContext(text) {
    const lower = text.toLowerCase();
    
    // OFFERING patterns (I am/I'm/I have)
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
    
    // LOOKING patterns (I need/I want/looking for)
    const lookingPatterns = [
      /i need/i,
      /i want/i,
      /looking for/i,
      /searching for/i,
      /find (a |an )?/i,
      /need (a |an )?/i,
      /want (a |an )?/i,
      /require/i,
      /require (a |an )?/i,
      /i require/i,
      /i am looking/i,
      /i'm looking/i,
      /searching/i,
      /find me/i,
      /show me/i,
      /give me/i,
      /get me/i,
      /help me find/i,
      /where can i find/i,
      /how to get/i,
      /where to get/i,
      /i am in need/i,
      /i need help finding/i,
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
    
    if (lookingPatterns.some(pattern => pattern.test(lower))) {
      return 'find'; // User is looking for services/goods
    }
    
    // Default based on other clues
    if (lower.includes('hire') || lower.includes('book') || lower.includes('require') || 
        lower.includes('buy') || lower.includes('purchase') || lower.includes('rent') ||
        lower.includes('want') || lower.includes('need') || lower.includes('looking')) {
      return 'find';
    }
    
    if (lower.includes('available') || lower.includes('contact me') || lower.includes('call me') ||
        lower.includes('sell') || lower.includes('sale') || lower.includes('provide') ||
        lower.includes('offer') || lower.includes('service') || lower.includes('work')) {
      return 'offer';
    }
    
    return null; // Can't determine
  }

  // Adjust intent based on context (offer/find)
  adjustIntentByContext(intent, context) {
    const intentMapping = {
      'property_search': context === 'offer' ? 'property_sale' : 'property_search',
      'property_rent': context === 'offer' ? 'property_rent_offer' : 'property_rent',
      'service_request': context === 'offer' ? 'service_offer' : 'service_request',
      'commodity_search': context === 'offer' ? 'commodity_sell' : 'commodity_search',
      'buy_sell': context === 'offer' ? 'vehicle_sell' : 'vehicle_buy',
      'vehicle_buy': context === 'offer' ? 'vehicle_sell' : 'vehicle_buy',
      'electronics_buy': context === 'offer' ? 'electronics_sell' : 'electronics_buy',
      'furniture_buy': context === 'offer' ? 'furniture_sell' : 'furniture_buy',
      'job_search': context === 'offer' ? 'job_offer' : 'job_search'
    };
    
    return intentMapping[intent] || intent;
  }

  quickMatch(text) {
    // Common Indian English/Hinglish patterns with expanded coverage
    const patterns = {
      'greeting': [
        /^hello$/i, /^hi$/i, /^hey$/i, /^namaste$/i, /^namaskar$/i,
        /good morning/i, /good evening/i, /good afternoon/i,
        /kaise ho/i, /kya haal hai/i, /how are you/i
      ],
      'farewell': [
        /^bye$/i, /^goodbye$/i, /^see you$/i, /^tata$/i,
        /^thanks$/i, /^thank you$/i, /^dhanyavad$/i, /^shukriya$/i,
        /thank you very much/i
      ],
      'property_search': [
        /\b(?:chaahiye|chahiye|chahie)\s+(?:property|flat|house|ghar|makan)\b/i,
        /\b(?:dhoondh|dhund|find|search|khoj)\s+(?:raha|rahi|rha|rhi)\s+(?:hu|hoon|hun)\b/i,
        /\b\d+\s*(?:bhk|bedroom|bed|room)\b/,
        /\b(?:noida|delhi|gurgaon|greater|mumbai|bangalore|chennai|pune|kolkata|hyderabad)\s+(?:mein|me|main|m|ma)\b/i,
        /\bflat\s+(?:chahiye|required|needed)\b/i,
        /\bhouse\s+(?:chahiye|required|needed)\b/i
      ],
      'property_rent': [
        /\brent\s+(?:par|pe|mein|ke liye)\s+(?:chahiye|chiye|required)\b/i,
        /\bkraya\s+(?:ghar|flat|property)\b/i,
        /\brental\s+(?:accommodation|property)\b/i,
        /\bpg\s+(?:chahiye|required|needed)\b/i,
        /\bpaying guest\b/i
      ],
      'service_request': [
        /\b(?:electrician|plumber|carpenter|mechanic|driver|cook|maid)\s+(?:chahiye|required|needed|bulana|bulwana)\b/i,
        /\b(?:service|kaam|work)\s+(?:karwana|karana|karwane|karane)\b/,
        /\b(?:aana|ana|aaye)\s+(?:hai|he|chaahiye)\s+(?:ghar|home|office|yahan)\b/,
        /\b(?:repair|sudhar|theek)\s+(?:karwana|karana)\b/i
      ],
      'commodity_search': [
        /\b(?:ton|kg|quintal)\s+(?:steel|rice|cement|wheat|atta|sugar)\b/i,
        /\b(?:material|samagri|saman)\s+(?:chahiye|required|needed|mangwana)\b/,
        /\b(?:construction|building|nirmaan)\s+(?:material|samagri)\b/,
        /\bcement\s+(?:bag|bags)\s+(?:chahiye|required)\b/i
      ],
      'vehicle_buy': [
        /\b(?:car|gadi|gaadi|bike|motorcycle|scooter)\s+(?:kharidna|kharidni|leni|lena|chahiye|required)\b/i,
        /\b(?:second hand|used|purani)\s+(?:car|gadi)\s+(?:chahiye|required)\b/i,
        /\bnew\s+(?:car|bike)\s+(?:chahiye|required)\b/i
      ],
      'job_search': [
        /\b(?:job|naukri|kaam|work|employment)\s+(?:chahiye|required|needed|dhunda)\b/i,
        /\b(?:naukri|job)\s+(?:ki|ka)\s+(?:talaash|search|dhoondh)\b/i,
        /\b(?:part time|full time)\s+(?:job|naukri|kaam)\b/i
      ],
      'health': [
        /\b(?:doctor|daktar|hospital|aspatal|clinic)\s+(?:chahiye|required|needed)\b/i,
        /\b(?:ambulance|elaan|ambulens)\s+(?:chahiye|required)\b/i,
        /\b(?:medicine|dawai|dava)\s+(?:chahiye|required)\b/i
      ],
      'education': [
        /\b(?:tuition|coaching|classes|padhai|shiksha)\s+(?:chahiye|required|needed)\b/i,
        /\b(?:teacher|tutor|adhyapak)\s+(?:chahiye|required)\b/i,
        /\b(?:english|computer|music|dance|yoga)\s+(?:classes|course)\b/i
      ],
      'query': [
        /\b(?:price|daam|cost|kimat|charge)\s+(?:kya|kitna|kya hai|kitni)\b/i,
        /\b(?:location|jagah|sthan|address)\s+(?:kahan|kaha|where)\b/i,
        /\b(?:time|samay|waqt)\s+(?:kya|kab|when)\b/i,
        /\b(?:contact|sampark|phone)\s+(?:number|no|kya)\b/i
      ]
    };

    // Check for exact matches first
    if (patterns.greeting.some(p => p.test(text))) {
      return { intent: 'greeting', confidence: 0.95, entities: {} };
    }
    
    if (patterns.farewell.some(p => p.test(text))) {
      return { intent: 'farewell', confidence: 0.95, entities: {} };
    }

    // Then check other patterns
    for (const [intent, intentPatterns] of Object.entries(patterns)) {
      if (intent === 'greeting' || intent === 'farewell') continue;
      
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
    let secondBestIntent = 'general_help';
    let secondBestScore = 0;
    
    Object.entries(scores).forEach(([intent, score]) => {
      if (score > bestScore) {
        secondBestScore = bestScore;
        secondBestIntent = bestIntent;
        bestScore = score;
        bestIntent = intent;
      } else if (score > secondBestScore) {
        secondBestScore = score;
        secondBestIntent = intent;
      }
    });

    // Calculate normalized confidence
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? bestScore / totalScore : 0;
    
    // If confidence is low but second best is close, return both
    const result = {
      intent: bestIntent,
      confidence: confidence,
      isConfident: confidence > this.threshold
    };
    
    // If second best is close, include it for context
    if (secondBestScore > 0 && (bestScore - secondBestScore) < 0.5) {
      result.alternativeIntents = [
        { intent: bestIntent, score: bestScore },
        { intent: secondBestIntent, score: secondBestScore }
      ];
    }
    
    return result;
  }

  extractEntities(text, intent) {
    const patterns = this.getEntityPatterns();
    const entities = {};
    
    // Common entities for all intents
    const commonPatterns = {
      location: /\b(?:in|at|near|around|mein|me|main|ke paas|pass|ke nazdeek)\s+([a-z\s]+?)(?:\s+(?:sector|area|colony|nagar|vihar|enclave|road|marg|street))?\b/i,
      quantity: /\b(\d+(?:\.\d+)?)\s*(?:ton|kg|bhk|bedroom|room|piece|unit|liter|ltr|meter|mtr|sqft|sq ft)\b/i,
      price: /\b(?:rs\.?|₹|rupees|price|cost|daam|kimat)\s*(\d+[,\d]*\s*(?:lakh|lac|crore|cr|thousand|k|hajar)?)\b/i,
      contact: /\b(\d{10})\b|\b(?:phone|mobile|contact)\s+(?:number|no)?\s*[:\-]?\s*(\d{10})\b/i
    };
    
    // Extract common entities
    Object.entries(commonPatterns).forEach(([type, pattern]) => {
      const matches = text.match(new RegExp(pattern, 'gi'));
      if (matches) {
        entities[type] = matches.map(match => 
          match.replace(/(?:rs\.?|₹|rupees|price|cost|daam|kimat)\s*/gi, '').trim()
        );
        if (entities[type].length === 1) {
          entities[type] = entities[type][0];
        }
      }
    });

    // Extract intent-specific entities
    switch(intent) {
      case 'property_search':
      case 'property_rent':
      case 'property_sale':
        Object.entries(patterns.property).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        
        // Special handling for Indian locations
        const locationMatch = text.match(/\b(noida|delhi|gurgaon|greater noida|noida extension|sector \d+|mumbai|bangalore|chennai|hyderabad|pune|kolkata|jaipur|ahmedabad|lucknow|indore|bhopal|patna)\b/i);
        if (locationMatch && !entities.location) {
          entities.location = locationMatch[0];
        }
        break;
        
      case 'service_request':
      case 'service_offer':
        Object.entries(patterns.service).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        break;
        
      case 'commodity_search':
      case 'commodity_sell':
        Object.entries(patterns.commodity).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        break;
        
      case 'vehicle_buy':
      case 'vehicle_sell':
        Object.entries(patterns.vehicle).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        
        // Extract buy/sell keywords
        if (text.includes('sell') || text.includes('bech') || text.includes('bikri') || 
            text.includes('sale') || text.includes('bikau')) {
          entities.action = 'sell';
        } else if (text.includes('buy') || text.includes('kharid') || 
                   text.includes('purchase') || text.includes('khareed')) {
          entities.action = 'buy';
        }
        break;
        
      case 'electronics_buy':
      case 'electronics_sell':
        Object.entries(patterns.electronics).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        break;
        
      case 'furniture_buy':
      case 'furniture_sell':
        Object.entries(patterns.furniture).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        break;
        
      case 'job_search':
      case 'job_offer':
        Object.entries(patterns.job).forEach(([type, pattern]) => {
          const match = text.match(pattern);
          if (match) {
            entities[type] = match[1] || match[0];
          }
        });
        break;
        
      case 'health':
        // Extract health-related entities
        const healthTypes = text.match(/\b(doctor|hospital|clinic|ambulance|medicine|pharmacy|chemist|dawai|daktar|aspatal)\b/i);
        if (healthTypes) {
          entities.health_type = healthTypes[0];
        }
        break;
        
      case 'education':
        // Extract education-related entities
        const eduTypes = text.match(/\b(tuition|coaching|classes|course|training|teacher|tutor|adhyapak|shiksha|padhai)\b/i);
        if (eduTypes) {
          entities.education_type = eduTypes[0];
        }
        
        const subjects = text.match(/\b(english|math|science|physics|chemistry|biology|computer|programming|music|dance|yoga|art|drawing)\b/i);
        if (subjects) {
          entities.subject = subjects[0];
        }
        break;
        
      case 'events':
        // Extract event-related entities
        const eventTypes = text.match(/\b(wedding|marriage|birthday|party|function|event|ceremony|reception|engagement)\b/i);
        if (eventTypes) {
          entities.event_type = eventTypes[0];
        }
        
        const services = text.match(/\b(caterer|photographer|decorator|dj|makeup|artist|planner|venue|banquet)\b/i);
        if (services) {
          entities.event_service = services[0];
        }
        break;
    }
    
    // Extract person-related entities for relevant intents
    if (intent.includes('service') || intent.includes('job')) {
      Object.entries(patterns.person).forEach(([type, pattern]) => {
        const match = text.match(pattern);
        if (match) {
          entities[type] = match[1] || match[0];
        }
      });
    }
    
    // Extract time-related entities for booking/request intents
    if (intent.includes('request') || intent.includes('booking') || 
        intent.includes('service') || intent.includes('appointment')) {
      Object.entries(patterns.time).forEach(([type, pattern]) => {
        const match = text.match(pattern);
        if (match) {
          entities[type] = match[1] || match[0];
        }
      });
    }
    
    // Clean up entities
    Object.keys(entities).forEach(key => {
      if (entities[key]) {
        if (Array.isArray(entities[key])) {
          entities[key] = entities[key].map(item => item.toString().trim());
        } else {
          entities[key] = entities[key].toString().trim();
        }
      }
    });
    
    return entities;
  }

  detectLanguage(text) {
    // Enhanced language detection for Indian languages
    const hindiWords = ['hai', 'he', 'mein', 'me', 'chahiye', 'chaahiye', 'ka', 'ki', 'ke', 'ko', 'se', 'par', 'pe', 'na', 'ne', 'kya', 'kyun', 'kaise', 'kahan', 'kab', 'kitna', 'kitni'];
    const tamilWords = ['irukku', 'illai', 'venum', 'vendum', 'aana', 'varum', 'podi', 'pa', 'thaan', 'la', 'ku', 'ai', 'um'];
    const teluguWords = ['unnayi', 'ledu', 'kavali', 'avasaram', 'undhi', 'unnaru', 'emi', 'evaru', 'ela', 'ekkada'];
    const bengaliWords = ['ache', 'nai', 'chai', 'dorkar', 'kore', 'ki', 'kemon', 'kothay', 'kokhon'];
    const punjabiWords = ['hai', 'hega', 'chahida', 'chahide', 'da', 'di', 'de', 'nu', 'te', 'vich'];
    const gujaratiWords = ['che', 'chhe', 'joye', 'j', 'na', 'ni', 'no', 'ne', 'ma', 'thi'];
    const marathiWords = ['ahe', 'nahi', 'pahije', 'lagte', 'la', 'cha', 'chi', 'che', 'shivya', 'kay', 'kasha', 'kutha'];
    const kannadaWords = ['ide', 'illa', 'beku', 'bejar', 'yaake', 'yelli', 'yenu', 'aadu'];
    const malayalamWords = ['undu', 'illa', 'venam', 'vendum', 'ente', 'ninte', 'avan', 'aval'];
    
    const words = text.toLowerCase().split(/\s+/);
    
    const languageScores = {
      'hi': 0, 'ta': 0, 'te': 0, 'bn': 0, 'pa': 0, 
      'gu': 0, 'mr': 0, 'kn': 0, 'ml': 0, 'en': 0
    };
    
    words.forEach(word => {
      if (hindiWords.includes(word)) languageScores.hi++;
      if (tamilWords.includes(word)) languageScores.ta++;
      if (teluguWords.includes(word)) languageScores.te++;
      if (bengaliWords.includes(word)) languageScores.bn++;
      if (punjabiWords.includes(word)) languageScores.pa++;
      if (gujaratiWords.includes(word)) languageScores.gu++;
      if (marathiWords.includes(word)) languageScores.mr++;
      if (kannadaWords.includes(word)) languageScores.kn++;
      if (malayalamWords.includes(word)) languageScores.ml++;
      
      // English detection
      if (/^[a-z]+$/.test(word) && word.length > 2) {
        languageScores.en++;
      }
    });
    
    // Find language with highest score
    let maxLang = 'en';
    let maxScore = 0;
    
    Object.entries(languageScores).forEach(([lang, score]) => {
      if (score > maxScore) {
        maxScore = score;
        maxLang = lang;
      }
    });
    
    // If no Indian language detected with good confidence, default to English
    if (maxLang !== 'en' && maxScore < 2) {
      return 'en';
    }
    
    return maxLang;
  }

  // Get user-friendly description of intent
  getIntentDescription(intent, entities, language = 'en') {
    const descriptions = {
      en: {
        'property_search': `looking for ${entities.bhk || 'a'} property ${entities.location ? 'in ' + entities.location : ''}`,
        'property_rent': `want to rent ${entities.bhk || 'a'} property ${entities.location ? 'in ' + entities.location : ''}`,
        'property_sale': `want to sell ${entities.bhk || 'a'} property ${entities.location ? 'in ' + entities.location : ''}`,
        'service_request': `need ${entities.service_type || 'a service'} ${entities.location ? 'in ' + entities.location : ''}`,
        'service_offer': `offering ${entities.service_type || 'services'} ${entities.location ? 'in ' + entities.location : ''}`,
        'commodity_search': `looking for ${entities.quantity || ''} ${entities.item || 'commodity'}`,
        'commodity_sell': `selling ${entities.quantity || ''} ${entities.item || 'commodity'}`,
        'vehicle_buy': `want to buy ${entities.type || 'vehicle'} ${entities.brand ? '(' + entities.brand + ')' : ''}`,
        'vehicle_sell': `want to sell ${entities.type || 'vehicle'} ${entities.brand ? '(' + entities.brand + ')' : ''}`,
        'electronics_buy': `want to buy ${entities.type || 'electronics'}`,
        'electronics_sell': `want to sell ${entities.type || 'electronics'}`,
        'furniture_buy': `want to buy ${entities.type || 'furniture'}`,
        'furniture_sell': `want to sell ${entities.type || 'furniture'}`,
        'job_search': `looking for ${entities.position || 'a job'} ${entities.type ? '(' + entities.type + ')' : ''}`,
        'job_offer': `offering ${entities.position || 'a job'} ${entities.type ? '(' + entities.type + ')' : ''}`,
        'education': `need ${entities.education_type || 'education services'} ${entities.subject ? 'for ' + entities.subject : ''}`,
        'health': `need ${entities.health_type || 'health services'}`,
        'events': `need ${entities.event_service || 'event services'} for ${entities.event_type || 'an event'}`,
        'legal': `need legal help`,
        'travel': `need travel services`,
        'greeting': `greeting`,
        'farewell': `farewell`,
        'general_help': `need assistance`,
        'complaint': `have a complaint`,
        'appreciation': `appreciating service`,
        'query': `asking a question`,
        'booking': `want to book`,
        'cancellation': `want to cancel`
      },
      hi: {
        'property_search': `${entities.bhk || ''} प्रॉपर्टी ${entities.location ? entities.location + ' में' : ''} ढूंढ रहे हैं`,
        'property_rent': `${entities.bhk || ''} प्रॉपर्टी ${entities.location ? entities.location + ' में' : ''} किराए पर चाहिए`,
        'property_sale': `${entities.bhk || ''} प्रॉपर्टी ${entities.location ? entities.location + ' में' : ''} बेचना चाहते हैं`,
        'service_request': `${entities.service_type || 'सर्विस'} ${entities.location ? entities.location + ' में' : ''} चाहिए`,
        'service_offer': `${entities.service_type || 'सर्विस'} ${entities.location ? entities.location + ' में' : ''} दे रहे हैं`,
        'commodity_search': `${entities.quantity || ''} ${entities.item || 'सामान'} चाहिए`,
        'commodity_sell': `${entities.quantity || ''} ${entities.item || 'सामान'} बेच रहे हैं`,
        'vehicle_buy': `${entities.type || 'वाहन'} ${entities.brand ? '(' + entities.brand + ')' : ''} खरीदना चाहते हैं`,
        'vehicle_sell': `${entities.type || 'वाहन'} ${entities.brand ? '(' + entities.brand + ')' : ''} बेचना चाहते हैं`,
        'job_search': `${entities.position || 'नौकरी'} ${entities.type ? '(' + entities.type + ')' : ''} ढूंढ रहे हैं`,
        'job_offer': `${entities.position || 'नौकरी'} ${entities.type ? '(' + entities.type + ')' : ''} दे रहे हैं`,
        'general_help': 'सहायता चाहिए'
      }
    };
    
    const langDescriptions = descriptions[language] || descriptions.en;
    return langDescriptions[intent] || langDescriptions['general_help'];
  }
  
  // Get response suggestions based on intent
  getResponseSuggestions(intent, context = 'find') {
    const suggestions = {
      'property_search': context === 'find' ? [
        'What type of property are you looking for? (Flat/House/Plot)',
        'Please specify location',
        'What is your budget?',
        'How many BHK?',
        'Furnished or unfurnished?'
      ] : [
        'Please provide property details',
        'Location?',
        'Price?',
        'Size/BHK?',
        'Contact information?'
      ],
      'service_request': context === 'find' ? [
        'What service do you need?',
        'Location?',
        'When do you need it?',
        'Any specific requirements?'
      ] : [
        'What service do you provide?',
        'Your experience?',
        'Rates?',
        'Availability?',
        'Contact details?'
      ],
      'general_help': [
        'How can I help you?',
        'You can ask me about: Properties, Services, Jobs, Buying/Selling items',
        'What specific assistance do you need?'
      ]
    };
    
    return suggestions[intent] || ['How can I assist you further?'];
  }
}

module.exports = new IntentClassifier();