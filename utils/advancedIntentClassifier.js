const compromise = require('compromise');

class AdvancedIntentClassifier {
  constructor() {
    // Only focus on housing/property search intents - comprehensive list
    this.propertyIntents = [
      // Direct property search requests
      'i need 2bhk in delhi',
      'looking for 3 bedroom apartment in mumbai',
      'want to rent a house in bangalore',
      'searching for 1rk in noida',
      'find me a flat in gurgaon',
      'need accommodation in pune',
      'looking for rental property',
      'want to buy a house',
      'searching for sale property',
      'find apartment for rent',
      'need 2bhk flat',
      'want 3bhk house',
      'looking for pg in delhi',
      'find room for rent',
      'need office space',
      'want commercial property',
      'searching for villa',
      'find bungalow for sale',
      'need warehouse',
      'want showroom space',

      // Location-based searches
      'delhi property',
      'mumbai flat',
      'bangalore house',
      'chennai apartment',
      'pune rental',
      'noida accommodation',
      'gurgaon property',
      'properties in delhi',
      'flats in mumbai',
      'houses in bangalore',
      'apartments in chennai',

      // BHK specific
      '1bhk apartment',
      '2bhk flat',
      '3bhk house',
      '4bhk villa',
      '5bhk bungalow',
      '1rk room',
      '2rk accommodation',
      'studio apartment',
      '1 bedroom flat',
      '2 bedroom house',
      '3 bedroom apartment',

      // Budget based
      'property under 50000',
      'flat budget 1 lakh',
      'house below 2 lakhs',
      'apartment maximum 3 lakhs',
      'rent upto 50k',
      'property around 1 lac',
      'accommodation within 2 lakhs',

      // Type specific
      'for rent property',
      'for sale house',
      'rental apartment',
      'purchase flat',
      'buying property',
      'leasing house',
      'on rent flat',
      'to buy apartment',
      'rental property',
      'sale property'
    ];

    // Strong property keywords that should trigger search
    this.propertyKeywords = [
      'property', 'properties', 'flat', 'flats', 'apartment', 'apartments',
      'house', 'houses', 'home', 'homes', 'accommodation', 'accommodations',
      'rent', 'rental', 'rentals', 'lease', 'buy', 'purchase', 'sale',
      'bhk', 'rk', 'bedroom', 'bedrooms', 'room', 'rooms', 'pg', 'hostel',
      'villa', 'villas', 'bungalow', 'bungalows', 'office', 'offices',
      'shop', 'shops', 'showroom', 'warehouse', 'commercial'
    ];

    // Location keywords
    this.locationKeywords = [
      'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'pune',
      'ahmedabad', 'jaipur', 'surat', 'kanpur', 'lucknow', 'indore',
      'thane', 'nagpur', 'noida', 'gurgaon', 'faridabad', 'ghaziabad',
      'meerut', 'rajkot', 'varanasi', 'agra', 'allahabad', 'bareilly',
      'moradabad', 'aligarh', 'bijnor', 'saharanpur', 'muzaffarnagar', 'bulandshahr'
    ];

    console.log('🤖 [NLP] Advanced Housing Intent Classifier initialized - Housing Only Focus');
  }

  extractEntities(text) {
    const doc = compromise(text);
    const entities = {
      locations: [],
      numbers: [],
      currencies: [],
      propertyTypes: [],
      services: []
    };

    // Extract locations using compromise
    const cities = ['delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'surat', 'kanpur', 'lucknow', 'indore', 'thane', 'nagpur', 'noida', 'gurgaon', 'faridabad', 'ghaziabad', 'meerut', 'rajkot', 'varanasi', 'agra', 'allahabad', 'bareilly', 'moradabad', 'aligarh', 'bijnor', 'saharanpur', 'muzaffarnagar', 'bulandshahr'];

    cities.forEach(city => {
      if (text.toLowerCase().includes(city)) {
        entities.locations.push(city.charAt(0).toUpperCase() + city.slice(1));
      }
    });

    // Extract numbers using compromise
    const numbers = doc.numbers().out('array');
    entities.numbers = numbers.map(n => parseFloat(n));

    // Extract BHK/RK patterns
    const bhkMatch = text.match(/(\d+)\s*(bhk|rk|bedroom)/i);
    if (bhkMatch) {
      entities.bedrooms = parseInt(bhkMatch[1]);
      entities.propertyType = bhkMatch[2].toLowerCase();
    }

    // Extract currency amounts
    const currencyMatch = text.match(/(?:rs|₹|rupees?)\s*(\d+(?:\s*,?\d+)*(?:\.\d+)?)\s*(k|lakh|lac|thousand)?/gi);
    if (currencyMatch) {
      entities.currencies = currencyMatch.map(match => {
        const numMatch = match.match(/(\d+(?:\s*,?\d+)*(?:\.\d+)?)/);
        const multiplierMatch = match.match(/(k|lakh|lac|thousand)/i);
        let amount = parseFloat(numMatch[1].replace(/,/g, ''));

        if (multiplierMatch) {
          const multiplier = multiplierMatch[1].toLowerCase();
          if (multiplier === 'k' || multiplier === 'thousand') amount *= 1000;
          else if (multiplier === 'lakh' || multiplier === 'lac') amount *= 100000;
        }

        return amount;
      });
    }

    // Extract property types
    const propertyKeywords = ['apartment', 'flat', 'house', 'villa', 'bungalow', 'pg', 'room', 'office', 'shop', 'warehouse', 'showroom'];
    propertyKeywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword)) {
        entities.propertyTypes.push(keyword);
      }
    });

    // Extract services
    const serviceKeywords = ['plumber', 'electrician', 'carpenter', 'mechanic', 'doctor', 'tutor', 'maid', 'driver', 'cook', 'cleaner', 'painter', 'gardener', 'security', 'nanny', 'photographer', 'event planner'];
    serviceKeywords.forEach(service => {
      if (text.toLowerCase().includes(service)) {
        entities.services.push(service);
      }
    });

    return entities;
  }

  classifyIntent(text) {
    const lowerText = text.toLowerCase();

    // First check for strong property keywords - if found, it's definitely a property search
    const hasPropertyKeyword = this.propertyKeywords.some(keyword =>
      lowerText.includes(keyword)
    );

    // Check for location keywords
    const hasLocationKeyword = this.locationKeywords.some(location =>
      lowerText.includes(location)
    );

    // Check for BHK/RK patterns
    const hasBHKPattern = /\b\d+\s*(bhk|rk|bedroom)\b/i.test(text);

    // Check for budget patterns
    const hasBudgetPattern = /\b(?:budget|price|rupees|rs|₹|under|max|upto|up to|around|within)\b.*\d+/i.test(text);

    // If any strong indicators are present, classify as property search
    if (hasPropertyKeyword || hasLocationKeyword || hasBHKPattern || hasBudgetPattern) {
      return {
        intent: 'property_search',
        confidence: 0.95,
        score: 10
      };
    }

    // Fallback to keyword matching with training examples
    let bestScore = 0;
    this.propertyIntents.forEach(example => {
      const words = example.split(' ');
      let score = 0;
      words.forEach(word => {
        if (lowerText.includes(word)) {
          score += 1;
        }
      });

      if (score > bestScore) {
        bestScore = score;
      }
    });

    // Even if score is low, check for property-related verbs
    const propertyVerbs = ['need', 'want', 'looking', 'searching', 'find', 'show', 'get', 'have'];
    const hasPropertyVerb = propertyVerbs.some(verb => lowerText.includes(verb));

    if (hasPropertyVerb && (hasLocationKeyword || hasBHKPattern)) {
      return {
        intent: 'property_search',
        confidence: 0.9,
        score: Math.max(bestScore, 5)
      };
    }

    return {
      intent: bestScore > 2 ? 'property_search' : 'unknown',
      confidence: bestScore > 2 ? Math.min(bestScore / 5, 0.8) : 0,
      score: bestScore
    };
  }

  analyzePropertySearch(text) {
    const intent = this.classifyIntent(text);
    const entities = this.extractEntities(text);

    // Check for explicit property search phrases
    const lowerText = text.toLowerCase();
    const propertySearchPhrases = [
      'looking for', 'searching for', 'find me', 'need', 'want',
      'show me', 'find a', 'find an', 'i need', 'i want'
    ];
    const hasPropertySearchPhrase = propertySearchPhrases.some(phrase => lowerText.includes(phrase));

    // Advanced property search analysis
    const result = {
      isPropertySearch: intent.intent === 'property_search' ||
                       entities.locations.length > 0 ||
                       entities.bedrooms ||
                       entities.propertyTypes.length > 0 ||
                       hasPropertySearchPhrase,
      intent: intent.intent,
      confidence: intent.confidence,
      entities: entities,
      searchCriteria: {}
    };

    // Enhanced bedrooms extraction with multiple patterns
    if (entities.bedrooms) {
      result.searchCriteria.bedrooms = entities.bedrooms;
    } else {
      // Multi-pattern bedrooms extraction
      const bhkPatterns = [
        /(\d+)\s*bhk/i,
        /(\d+)\s*bedroom/i,
        /(\d+)\s*bed/i,
        /(\d+)\s*room/i,
        /(\d+)\s*b\.h\.k/i,
        /(\d+)\s*br/i,
        /(\d+)\s*bhk\s*flat/i,
        /(\d+)\s*bed\s*flat/i
      ];

      for (const pattern of bhkPatterns) {
        const match = text.match(pattern);
        if (match) {
          result.searchCriteria.bedrooms = parseInt(match[1]);
          break;
        }
      }
    }

    // Enhanced location extraction with comprehensive fuzzy matching
    if (entities.locations.length > 0) {
      result.searchCriteria.location = entities.locations[0];
    } else {
      // Comprehensive fuzzy location matching for major Indian cities
      const fuzzyLocations = {
        // Delhi variations
        'delihi': 'Delhi', 'delhi': 'Delhi', 'new delhi': 'Delhi', 'delhii': 'Delhi',
        // Mumbai variations
        'mumbay': 'Mumbai', 'bombay': 'Mumbai', 'mumbai': 'Mumbai', 'mumbaai': 'Mumbai',
        // Bangalore variations
        'banglore': 'Bangalore', 'bangaluru': 'Bangalore', 'bengaluru': 'Bangalore', 'bangalore': 'Bangalore',
        // Gurugram variations
        'gurgao': 'Gurugram', 'gurgaon': 'Gurugram', 'gurugram': 'Gurugram', 'gurgaun': 'Gurugram',
        // Noida variations
        'noida': 'Noida', 'noidaa': 'Noida', 'noiada': 'Noida',
        // Hyderabad variations
        'hydrabad': 'Hyderabad', 'hyderabad': 'Hyderabad', 'hydrabad': 'Hyderabad',
        // Chennai variations
        'chenai': 'Chennai', 'chennai': 'Chennai', 'madras': 'Chennai', 'chenaii': 'Chennai',
        // Kolkata variations
        'calcuta': 'Kolkata', 'calcutta': 'Kolkata', 'kolkata': 'Kolkata', 'kolkatta': 'Kolkata',
        // Ahmedabad variations
        'ahmedbad': 'Ahmedabad', 'ahmedabad': 'Ahmedabad', 'ahmedabed': 'Ahmedabad',
        // Pune variations
        'poona': 'Pune', 'pune': 'Pune', 'punay': 'Pune',
        // Jaipur variations
        'jaipur': 'Jaipur', 'jaypur': 'Jaipur',
        // Lucknow variations
        'lucknow': 'Lucknow', 'lakhnaw': 'Lucknow',
        // Kanpur variations
        'kanpur': 'Kanpur', 'kanpure': 'Kanpur',
        // Nagpur variations
        'nagpur': 'Nagpur', 'nagpure': 'Nagpur',
        // Indore variations
        'indore': 'Indore', 'indaur': 'Indore',
        // Thane variations
        'thane': 'Thane', 'thanay': 'Thane',
        // Bhopal variations
        'bhopal': 'Bhopal', 'bhopale': 'Bhopal',
        // Visakhapatnam variations
        'vizag': 'Visakhapatnam', 'visakhapatnam': 'Visakhapatnam', 'vizagapatam': 'Visakhapatnam',
        // Vadodara variations
        'baroda': 'Vadodara', 'vadodara': 'Vadodara',
        // Ludhiana variations
        'ludhiana': 'Ludhiana', 'ludhianaa': 'Ludhiana',
        // Agra variations
        'agra': 'Agra', 'agraa': 'Agra',
        // Nashik variations
        'nashik': 'Nashik', 'nashike': 'Nashik',
        // Faridabad variations
        'faridabad': 'Faridabad', 'faridabade': 'Faridabad',
        // Meerut variations
        'meerut': 'Meerut', 'meerute': 'Meerut',
        // Rajkot variations
        'rajkot': 'Rajkot', 'rajkote': 'Rajkot',
        // Jabalpur variations
        'jabalpur': 'Jabalpur', 'jabalpure': 'Jabalpur',
        // Srinagar variations
        'srinagar': 'Srinagar', 'srinagare': 'Srinagar',
        // Chandigarh variations
        'chandigarh': 'Chandigarh', 'chandigarhe': 'Chandigarh'
      };

      const lowerText = text.toLowerCase();
      for (const [typo, correct] of Object.entries(fuzzyLocations)) {
        if (lowerText.includes(typo)) {
          result.searchCriteria.location = correct;
          break;
        }
      }
    }

    // Enhanced budget extraction
    if (entities.currencies.length > 0) {
      result.searchCriteria.budget = entities.currencies[0];
      result.searchCriteria.maxPrice = entities.currencies[0];
    } else {
      // Extract budget from text patterns
      const budgetPatterns = [
        /under\s*(\d+(?:,\d+)*)/i,
        /below\s*(\d+(?:,\d+)*)/i,
        /up\s*to\s*(\d+(?:,\d+)*)/i,
        /max\s*(\d+(?:,\d+)*)/i,
        /(\d+(?:,\d+)*)\s*per\s*month/i,
        /(\d+(?:,\d+)*)\s*pm/i,
        /(\d+(?:,\d+)*)\s*lakh/i,
        /(\d+(?:,\d+)*)\s*thousand/i,
        /(\d+(?:,\d+)*)\s*k/i
      ];

      for (const pattern of budgetPatterns) {
        const match = text.match(pattern);
        if (match) {
          const budget = parseInt(match[1].replace(/,/g, ''));
          result.searchCriteria.budget = budget;
          result.searchCriteria.maxPrice = budget;
          break;
        }
      }
    }

    // Enhanced property type detection (rent/sale)
    if (lowerText.includes('rent') || lowerText.includes('rental') || lowerText.includes('lease') ||
        lowerText.includes('on rent') || lowerText.includes('for rent') || lowerText.includes('rented')) {
      result.searchCriteria.type = 'rent';
    } else if (lowerText.includes('sale') || lowerText.includes('buy') || lowerText.includes('purchase') ||
               lowerText.includes('for sale') || lowerText.includes('selling') || lowerText.includes('bought')) {
      result.searchCriteria.type = 'sale';
    } else {
      // Smart default: if user is "looking for" or "searching for", they likely want to rent
      // If they wanted to sell, they'd say "sell my property" or similar
      if (hasPropertySearchPhrase) {
        result.searchCriteria.type = 'rent';
      } else {
        // Default to rent for property searches
        result.searchCriteria.type = 'rent';
      }
    }

    // Extract property category with enhanced detection
    if (entities.propertyTypes.length > 0) {
      result.searchCriteria.category = entities.propertyTypes[0];
    } else {
      // Additional property type detection
      const propertyTypePatterns = {
        'apartment': /apartment|flat/i,
        'house': /house|independent house|villa/i,
        'studio': /studio/i,
        'penthouse': /penthouse/i,
        'duplex': /duplex/i
      };

      for (const [type, pattern] of Object.entries(propertyTypePatterns)) {
        if (pattern.test(text)) {
          result.searchCriteria.category = type;
          break;
        }
      }
    }

    console.log('🧠 [ADVANCED NLP] Enhanced analysis result:', result);
    return result;
  }

  analyzeUrbanHelp(text) {
    const intent = this.classifyIntent(text);
    const entities = this.extractEntities(text);

    return {
      isUrbanHelp: intent.intent === 'urban_help' || entities.services.length > 0,
      intent: intent.intent,
      confidence: intent.confidence,
      services: entities.services,
      location: entities.locations.length > 0 ? entities.locations[0] : null
    };
  }

  analyzeJobSearch(text) {
    const intent = this.classifyIntent(text);

    return {
      isJobSearch: intent.intent === 'job_search',
      intent: intent.intent,
      confidence: intent.confidence
    };
  }

  analyzeLanguageChange(text) {
    const intent = this.classifyIntent(text);

    if (intent.intent === 'language_change') {
      if (text.toLowerCase().includes('english') || text.toLowerCase().includes('angrezi')) {
        return { changeTo: 'en', confidence: intent.confidence };
      } else if (text.toLowerCase().includes('hindi') || text.toLowerCase().includes('हिंदी')) {
        return { changeTo: 'hi', confidence: intent.confidence };
      }
    }

    return null;
  }
}

module.exports = AdvancedIntentClassifier;