// ========================================
// utils/constants.js
// ========================================

// Voice Processing Constants
module.exports.VOICE_CONFIDENCE_THRESHOLD = 0.7;
module.exports.GROQ_API_KEY = process.env.GROQ_API_KEY;

// Voice Message Types
module.exports.MESSAGE_TYPES = {
  VOICE: 'ptt',
  AUDIO: 'audio',
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  STICKER: 'sticker'
};

// Intent Types - ✅ UPDATED: Added Urban Help Intents
module.exports.INTENTS = {
  BUY_PROPERTY: 'buy_property',
  RENT_PROPERTY: 'rent_property',
  SELL_PROPERTY: 'sell_property',
  POST_LISTING: 'post_listing',
  SEARCH_LISTING: 'search_listing',
  VIEW_LISTING: 'view_listing',
  CONTACT_AGENT: 'contact_agent',
  
  // ✅ ADDED: Urban Help Intents
  URBAN_HELP: 'urban_help',
  URBAN_HELP_REQUEST: 'urban_help_request',
  FIND_SERVICE: 'find_service',
  REQUEST_SERVICE: 'request_service',
  
  UNKNOWN: 'unknown'
};

// Session States - ✅ UPDATED: Added Urban Help and Confirmation States
module.exports.SESSION_STATES = {
  START: 'start',
  MENU: 'menu',
  AWAITING_LANGUAGE: 'awaiting_language',
  AWAITING_LISTING_ACTION: 'awaiting_listing_action',
  AWAITING_POST_DETAILS: 'awaiting_post_details',
  AWAITING_FLOW_SUBMISSION: 'awaiting_flow_submission',
  MANAGING_LISTINGS: 'managing_listings',
  VIEWING_SAVED_LISTINGS: 'viewing_saved_listings',
  
  // Voice Processing States
  PROCESSING_VOICE: 'processing_voice',
  AWAITING_VOICE_CONFIRMATION: 'awaiting_voice_confirmation',
  AWAITING_VOICE: 'awaiting_voice',
  AWAITING_CONFIRMATION: 'awaiting_confirmation', // ✅ NEW: For voice transcription confirmation
  AWAITING_TEXT_INPUT: 'awaiting_text_input', // ✅ NEW: For fallback to text input
  
  // ✅ ADDED: Urban Help States
  AWAITING_URBAN_HELP_CHOICE: 'awaiting_urban_help_choice',
  AWAITING_URBAN_HELP_CATEGORY: 'awaiting_urban_help_category',
  AWAITING_URBAN_HELP_LOCATION: 'awaiting_urban_help_location',
  AWAITING_URBAN_HELP_CONFIRMATION: 'awaiting_urban_help_confirmation',
  AWAITING_URBAN_HELP_TEXT: 'awaiting_urban_help_text',
  AWAITING_URBAN_HELP_INFO: 'awaiting_urban_help_info',
  AWAITING_URBAN_HELP_CLARIFICATION: 'awaiting_urban_help_clarification'
};

// Flow Steps Configuration - ✅ UPDATED: Added Urban Help Flow
module.exports.flowSteps = {
  chooseService: {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: 'How can I help you today? Please choose one of the options below.',
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: { id: 'housing', title: '🏠 Housing' },
          },
          {
            type: 'reply',
            reply: { id: 'services', title: '🔧 Services' },
          },
          {
            type: 'reply',
            reply: { id: 'help', title: '❓ Help' },
          }
        ],
      },
    },
  },
  
  housingFlow: {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: '🏡 Housing Services\n\nWhat would you like to do?',
      },
      action: {
        button: 'Select Option',
        sections: [
          {
            title: 'Housing Options',
            rows: [
              {
                id: 'view_housing_listings',
                title: '🔍 View Listings',
                description: 'Browse available properties'
              },
              {
                id: 'post_housing_listing',
                title: '📝 Post Listing',
                description: 'List your property'
              },
              {
                id: 'manage_housing_listings',
                title: '⚙️ Manage Listings',
                description: 'Edit or delete your listings'
              }
            ]
          }
        ]
      }
    }
  },
  
  // ✅ ADDED: Urban Help Flow
  urbanHelpFlow: {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: '🔧 Urban Help Services\n\nWhat type of service do you need?',
      },
      action: {
        button: 'Select Service',
        sections: [
          {
            title: 'Popular Services',
            rows: [
              {
                id: 'service_electrician',
                title: '🔧 Electrician',
                description: 'Wiring, switches, electrical repairs'
              },
              {
                id: 'service_plumber',
                title: '🚰 Plumber',
                description: 'Pipe leaks, bathroom fittings'
              },
              {
                id: 'service_maid',
                title: '🧹 Maid/Househelp',
                description: 'Cleaning, cooking, domestic help'
              },
              {
                id: 'service_carpenter',
                title: '🔨 Carpenter',
                description: 'Furniture, doors, windows repair'
              }
            ]
          },
          {
            title: 'More Services',
            rows: [
              {
                id: 'service_cleaner',
                title: '🧼 Cleaner',
                description: 'Deep cleaning, house cleaning'
              },
              {
                id: 'service_technician',
                title: '🔩 Technician',
                description: 'AC repair, appliance servicing'
              },
              {
                id: 'service_driver',
                title: '🚗 Driver',
                description: 'Car driver, chauffeur services'
              },
              {
                id: 'service_painter',
                title: '🎨 Painter',
                description: 'House painting, wall colors'
              }
            ]
          }
        ]
      }
    }
  },
  
  voicePrompt: {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: '🎤 Voice Message Option\n\nYou can also send a voice message in any language to describe what you\'re looking for!',
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: { id: 'send_voice', title: '🎤 Send Voice Message' },
          },
          {
            type: 'reply',
            reply: { id: 'use_text', title: '📝 Use Text Instead' },
          }
        ],
      },
    },
  },
  
  // ✅ ADDED: Voice Confirmation Flow
  voiceConfirmation: {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: '🎤 I heard: "{transcription}"\n\nIs this correct?',
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: { id: 'confirm_yes', title: '✅ Yes, correct' },
          },
          {
            type: 'reply',
            reply: { id: 'confirm_try_again', title: '🔄 Try again' },
          },
          {
            type: 'reply',
            reply: { id: 'confirm_type_instead', title: '📝 Type instead' },
          }
        ],
      },
    },
  }
};

// Property Types
module.exports.PROPERTY_TYPES = {
  APARTMENT: 'Apartment',
  HOUSE: 'House',
  VILLA: 'Villa',
  FLAT: 'Flat',
  PG: 'PG',
  STUDIO: 'Studio',
  DUPLEX: 'Duplex',
  PENTHOUSE: 'Penthouse'
};

// ✅ ADDED: Urban Help Service Categories
module.exports.SERVICE_CATEGORIES = {
  ELECTRICIAN: {
    id: 'electrician',
    name: 'Electrician',
    emoji: '🔧',
    keywords: ['electrician', 'wiring', 'electrical', 'fuse', 'light', 'switch', 'मिस्त्री', 'மின்தொழிலாளி']
  },
  PLUMBER: {
    id: 'plumber',
    name: 'Plumber',
    emoji: '🚰',
    keywords: ['plumber', 'pipe', 'water', 'leak', 'tap', 'bathroom', 'toilet', 'प्लंबर', 'குழாய்த்தொழிலாளி']
  },
  MAID: {
    id: 'maid',
    name: 'Maid/Househelp',
    emoji: '🧹',
    keywords: ['maid', 'househelp', 'cleaning', 'cook', 'naukrani', 'housekeeping', 'नौकरानी', 'வேலைக்காரி']
  },
  CARPENTER: {
    id: 'carpenter',
    name: 'Carpenter',
    emoji: '🔨',
    keywords: ['carpenter', 'woodwork', 'furniture', 'repair', 'door', 'window', 'बढ़ई', 'தச்சர்']
  },
  CLEANER: {
    id: 'cleaner',
    name: 'Cleaner',
    emoji: '🧼',
    keywords: ['cleaner', 'cleaning', 'deep clean', 'house cleaning', 'सफाई', 'சுத்தம்']
  },
  TECHNICIAN: {
    id: 'technician',
    name: 'Technician',
    emoji: '🔩',
    keywords: ['technician', 'ac repair', 'appliance repair', 'tv repair']
  },
  DRIVER: {
    id: 'driver',
    name: 'Driver',
    emoji: '🚗',
    keywords: ['driver', 'chauffeur', 'car driver', 'permanent driver', 'ड्राइवर', 'ஓட்டுநர்']
  },
  PAINTER: {
    id: 'painter',
    name: 'Painter',
    emoji: '🎨',
    keywords: ['painter', 'painting', 'wall', 'color', 'house painting', 'पेंटर', 'ஓவியர்']
  },
  GARDENER: {
    id: 'gardener',
    name: 'Gardener',
    emoji: '🌿',
    keywords: ['gardener', 'gardening', 'lawn', 'plants', 'बागवान', 'தோட்டக்காரர்']
  },
  SECURITY: {
    id: 'security',
    name: 'Security Guard',
    emoji: '👮',
    keywords: ['security', 'guard', 'watchman', 'चौकीदार', 'பாதுகாப்பு']
  }
};

// Location Types
module.exports.LOCATIONS = [
  'Noida',
  'Delhi',
  'Gurgaon',
  'Greater Noida',
  'Ghaziabad',
  'Faridabad',
  'Bangalore',
  'Mumbai',
  'Chennai',
  'Hyderabad',
  'Pune',
  'Kolkata'
];

// BHK Options
module.exports.BHK_OPTIONS = ['1RK', '1BHK', '2BHK', '3BHK', '4BHK', '5BHK+'];

// Price Ranges (in Lakhs)
module.exports.PRICE_RANGES = {
  RENT: [
    { min: 0, max: 10, label: 'Under 10K' },
    { min: 10, max: 20, label: '10K - 20K' },
    { min: 20, max: 30, label: '20K - 30K' },
    { min: 30, max: 50, label: '30K - 50K' },
    { min: 50, max: 100, label: '50K - 1L' },
    { min: 100, max: 9999, label: 'Above 1L' }
  ],
  SALE: [
    { min: 0, max: 20, label: 'Under 20L' },
    { min: 20, max: 50, label: '20L - 50L' },
    { min: 50, max: 100, label: '50L - 1Cr' },
    { min: 100, max: 200, label: '1Cr - 2Cr' },
    { min: 200, max: 500, label: '2Cr - 5Cr' },
    { min: 500, max: 9999, label: 'Above 5Cr' }
  ]
};

// ✅ ADDED: Service Price Ranges
module.exports.SERVICE_PRICE_RANGES = {
  ELECTRICIAN: [
    { min: 0, max: 500, label: 'Under ₹500' },
    { min: 500, max: 1000, label: '₹500 - ₹1,000' },
    { min: 1000, max: 2000, label: '₹1,000 - ₹2,000' },
    { min: 2000, max: 5000, label: '₹2,000 - ₹5,000' },
    { min: 5000, max: 99999, label: 'Above ₹5,000' }
  ],
  PLUMBER: [
    { min: 0, max: 300, label: 'Under ₹300' },
    { min: 300, max: 800, label: '₹300 - ₹800' },
    { min: 800, max: 1500, label: '₹800 - ₹1,500' },
    { min: 1500, max: 3000, label: '₹1,500 - ₹3,000' },
    { min: 3000, max: 99999, label: 'Above ₹3,000' }
  ],
  MAID: [
    { min: 0, max: 2000, label: 'Under ₹2,000/month' },
    { min: 2000, max: 5000, label: '₹2,000 - ₹5,000/month' },
    { min: 5000, max: 10000, label: '₹5,000 - ₹10,000/month' },
    { min: 10000, max: 20000, label: '₹10,000 - ₹20,000/month' },
    { min: 20000, max: 99999, label: 'Above ₹20,000/month' }
  ]
};

// Language Options
module.exports.LANGUAGES = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  ta: 'தமிழ் (Tamil)',
  gu: 'ગુજરાતી (Gujarati)',
  kn: 'ಕನ್ನಡ (Kannada)',
  mr: 'मराठी (Marathi)',
  te: 'తెలుగు (Telugu)',
  bn: 'বাংলা (Bengali)',
  ml: 'മലയാളം (Malayalam)'
};

// Button IDs for interactive messages - ✅ UPDATED: Added Urban Help Buttons
module.exports.BUTTON_IDS = {
  // Housing Flow
  VIEW_LISTINGS: 'view_listings',
  POST_LISTING: 'post_listing',
  MANAGE_LISTINGS: 'manage_listings',
  SAVED_LISTINGS: 'saved_listings',
  CHANGE_LANGUAGE: 'change_language',
  URBAN_HELP: 'urban_help', // ✅ NEW: Urban help menu button
  
  // Listing Actions
  NEXT_LISTING: 'NEXT_LISTING',
  VIEW_DETAILS: 'VIEW_DETAILS_',
  SAVE_LISTING: 'SAVE_LISTING_',
  
  // Voice Actions
  VOICE_SEARCH: 'voice_search',
  VOICE_SEE_MORE: 'voice_see_more',
  VOICE_REFINE_SEARCH: 'voice_refine_search',
  VOICE_MAIN_MENU: 'voice_main_menu',
  
  // Confirmation Buttons
  CONFIRM_YES: 'confirm_yes',
  CONFIRM_NO: 'confirm_no',
  CONFIRM_TRY_AGAIN: 'confirm_try_again', // ✅ NEW: For voice confirmation
  CONFIRM_TYPE_INSTEAD: 'confirm_type_instead', // ✅ NEW: For voice confirmation
  CONFIRM_DELETE: 'confirm_delete',
  CONFIRM_REMOVE: 'confirm_remove_saved',
  
  // Edit Flow
  EDIT_TITLE: 'edit_title',
  EDIT_LOCATION: 'edit_location',
  EDIT_PRICE: 'edit_price',
  EDIT_TYPE: 'edit_type',
  EDIT_BHK: 'edit_bhk',
  EDIT_CONTACT: 'edit_contact',
  EDIT_DESCRIPTION: 'edit_description',
  EDIT_CANCEL: 'edit_cancel',
  EDIT_ANOTHER: 'edit_another',
  SAVE_EDITS: 'save_edits',
  CANCEL_EDITS: 'cancel_edits',
  
  // ✅ ADDED: Urban Help Buttons
  URBAN_HELP_VOICE: 'urban_voice',
  URBAN_HELP_TYPE: 'urban_type',
  SERVICE_ELECTRICIAN: 'service_electrician',
  SERVICE_PLUMBER: 'service_plumber',
  SERVICE_MAID: 'service_maid',
  SERVICE_CARPENTER: 'service_carpenter',
  SERVICE_CLEANER: 'service_cleaner',
  SERVICE_TECHNICIAN: 'service_technician',
  SERVICE_DRIVER: 'service_driver',
  SERVICE_PAINTER: 'service_painter',
  
  // ✅ ADDED: Location Selection Buttons
  LOCATION_NOIDA: 'location_noida',
  LOCATION_GURGAON: 'location_gurgaon',
  LOCATION_DELHI: 'location_delhi',
  LOCATION_BANGALORE: 'location_bangalore',
  LOCATION_MUMBAI: 'location_mumbai'
};

// Menu Configuration - ✅ UPDATED: Added Urban Help Config
module.exports.MENU_CONFIG = {
  MAX_LISTINGS_PER_PAGE: 5,
  MAX_SAVED_LISTINGS: 50,
  MAX_SERVICES_PER_PAGE: 8, // ✅ NEW: For urban help services
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
  MAX_VOICE_DURATION: 60, // seconds
  MAX_VOICE_SIZE: 10 * 1024 * 1024, // 10MB
  
  // ✅ NEW: Urban Help Configuration
  SERVICE_CONFIG: {
    DEFAULT_RATING_MIN: 4.0,
    MAX_RESULTS_PER_CATEGORY: 10,
    SEARCH_RADIUS_KM: 10, // Search within 10km radius
    MAX_CONTACT_DISPLAY: 3 // Show only 3 contacts initially
  }
};

// Error Messages - ✅ UPDATED: Added Urban Help Errors
module.exports.ERROR_MESSAGES = {
  NO_LISTINGS: 'No listings available right now. Please check back later.',
  NO_SERVICES: 'No service providers available in your area right now. We\'ll notify you when one becomes available.', // ✅ NEW
  VOICE_PROCESSING_FAILED: 'Sorry, I couldn\'t process your voice message. Please try again or type your request.',
  VOICE_TOO_LONG: 'Your voice message is too long. Please keep it under 60 seconds.',
  VOICE_TOO_LARGE: 'Your voice message is too large. Please send a shorter message.',
  NO_INTERNET: 'No internet connection. Please check your connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  INVALID_INPUT: 'Invalid input. Please check your message and try again.',
  SESSION_EXPIRED: 'Your session has expired. Please type "hi" to start again.',
  PERMISSION_DENIED: 'Permission denied. Please contact support if you believe this is an error.',
  
  // ✅ NEW: Urban Help Errors
  SERVICE_NOT_AVAILABLE: 'Sorry, this service is not available in your area yet.',
  PROVIDER_NOT_FOUND: 'No service providers found matching your criteria.',
  LOCATION_REQUIRED: 'Please specify a location to find service providers.',
  CATEGORY_REQUIRED: 'Please specify what type of service you need.'
};

// Success Messages - ✅ UPDATED: Added Urban Help Success Messages
module.exports.SUCCESS_MESSAGES = {
  LISTING_POSTED: '🎉 Listing posted successfully!',
  LISTING_UPDATED: '✅ Listing updated successfully!',
  LISTING_DELETED: '🗑️ Listing deleted successfully!',
  LISTING_SAVED: '❤️ Listing saved to your favorites!',
  LISTING_REMOVED: 'Listing removed from your saved list.',
  VOICE_PROCESSED: '🎤 Voice message processed successfully!',
  LANGUAGE_CHANGED: '🌐 Language changed successfully!',
  
  // ✅ NEW: Urban Help Success Messages
  SERVICE_FOUND: '✅ Found service providers in your area!',
  REQUEST_POSTED: '📝 Your service request has been posted. Providers will contact you soon.',
  PROVIDER_CONTACTED: '📞 The service provider has been notified. They will contact you shortly.',
  SEARCH_INITIATED: '🔍 Searching for service providers in your area...'
};

// Voice Processing Constants (Detailed) - ✅ UPDATED: Added Confirmation Config
module.exports.VOICE_CONFIG = {
  SUPPORTED_FORMATS: ['ogg', 'opus', 'mp3', 'wav', 'm4a', 'aac'],
  MAX_DURATION_SECONDS: 60,
  MAX_FILE_SIZE_MB: 10,
  MIN_CONFIDENCE_THRESHOLD: 0.7,
  HIGH_CONFIDENCE_THRESHOLD: 0.9,
  TRANSCRIPTION_TIMEOUT: 30000, // 30 seconds
  INTENT_EXTRACTION_TIMEOUT: 10000, // 10 seconds
  
  // ✅ NEW: Voice Confirmation Settings
  CONFIRMATION: {
    AUTO_TIMEOUT: 120000, // 2 minutes for confirmation response
    MAX_RETRIES: 2,
    RETRY_DELAY: 5000 // 5 seconds between retries
  }
};

// WhatsApp Flow Configuration
module.exports.FLOW_CONFIG = {
  MODES: {
    DRAFT: 'draft',
    PUBLISHED: 'published'
  },
  VERSIONS: {
    V2: '2',
    V3: '3'
  },
  ACTIONS: {
    NAVIGATE: 'navigate',
    DATA_EXCHANGE: 'data_exchange'
  }
};

// ✅ ADDED: Urban Help Configuration
module.exports.URBAN_HELP_CONFIG = {
  DEFAULT_CATEGORIES: ['electrician', 'plumber', 'maid', 'carpenter', 'cleaner'],
  POPULAR_LOCATIONS: ['Noida', 'Gurgaon', 'Delhi', 'Bangalore', 'Mumbai'],
  SEARCH_RADIUS_KM: 10,
  MIN_PROVIDER_RATING: 4.0,
  MAX_RESULTS: 5,
  REQUEST_EXPIRY_HOURS: 24,
  
  // Service availability hours (24-hour format)
  SERVICE_HOURS: {
    START: 8, // 8 AM
    END: 20   // 8 PM
  }
};

// ✅ ADDED: Session Storage Keys
module.exports.SESSION_KEYS = {
  VOICE_TRANSCRIPTION: 'rawTranscription',
  URBAN_HELP_CONTEXT: 'urbanHelpContext',
  VOICE_CONTEXT: 'voiceContext',
  HOUSING_FLOW: 'housingFlow',
  EDIT_FLOW: 'editFlow',
  SAVED_LISTINGS_FLOW: 'savedListingsFlow',
  MANAGE_LISTINGS: 'manageListings'
};

// ✅ ADDED: Multi-language Response Templates
module.exports.RESPONSE_TEMPLATES = {
  // Voice Confirmation Templates
  VOICE_CONFIRMATION: {
    en: '🎤 I heard: "*{transcription}"*\n\nIs this correct?\n\nReply with:\n✅ *Yes* - if correct\n🔄 *No* - to try again\n📝 *Type* - to type instead',
    hi: '🎤 मैंने सुना: "*{transcription}"*\n\nक्या यह सही है?\n\nजवाब दें:\n✅ *हां* - अगर सही है\n🔄 *नहीं* - फिर से कोशिश करें\n📝 *टाइप करें* - टाइप करके भेजें',
    ta: '🎤 நான் கேட்டேன்: "*{transcription}"*\n\nஇது சரியானதா?\n\nபதில்:\n✅ *ஆம்* - சரியானது என்றால்\n🔄 *இல்லை* - மீண்டும் முயற்சிக்கவும்\n📝 *தட்டச்சு செய்யவும்* - தட்டச்சு செய்து அனுப்பவும்',
    gu: '🎤 મેં સાંભળ્યું: "*{transcription}"*\n\nશું આ સાચું છે?\n\nજવાબ આપો:\n✅ *હા* - જો સાચું હોય\n🔄 *ના* - ફરી પ્રયાસ કરો\n📝 *ટાઈપ કરો* - ટાઈપ કરીને મોકલો'
  },
  
  // Urban Help Search Templates
  URBAN_HELP_SEARCH: {
    en: '🔍 Searching for {category} in {location}...',
    hi: '🔍 {location} में {category} की खोज की जा रही है...',
    ta: '🔍 {location} இல் {category} தேடப்படுகிறது...',
    gu: '🔍 {location} માં {category} શોધાય છે...'
  }
};

// Export all constants
module.exports = {
  ...module.exports,
  // Ensure backward compatibility
  flowSteps: module.exports.flowSteps,
  VOICE_CONFIDENCE_THRESHOLD: module.exports.VOICE_CONFIDENCE_THRESHOLD,
  GROQ_API_KEY: module.exports.GROQ_API_KEY,
  MESSAGE_TYPES: module.exports.MESSAGE_TYPES,
  INTENTS: module.exports.INTENTS,
  SESSION_STATES: module.exports.SESSION_STATES,
  PROPERTY_TYPES: module.exports.PROPERTY_TYPES,
  SERVICE_CATEGORIES: module.exports.SERVICE_CATEGORIES, // ✅ NEW
  LOCATIONS: module.exports.LOCATIONS,
  BHK_OPTIONS: module.exports.BHK_OPTIONS,
  PRICE_RANGES: module.exports.PRICE_RANGES,
  SERVICE_PRICE_RANGES: module.exports.SERVICE_PRICE_RANGES, // ✅ NEW
  LANGUAGES: module.exports.LANGUAGES,
  BUTTON_IDS: module.exports.BUTTON_IDS,
  MENU_CONFIG: module.exports.MENU_CONFIG,
  ERROR_MESSAGES: module.exports.ERROR_MESSAGES,
  SUCCESS_MESSAGES: module.exports.SUCCESS_MESSAGES,
  VOICE_CONFIG: module.exports.VOICE_CONFIG,
  FLOW_CONFIG: module.exports.FLOW_CONFIG,
  URBAN_HELP_CONFIG: module.exports.URBAN_HELP_CONFIG, // ✅ NEW
  SESSION_KEYS: module.exports.SESSION_KEYS, // ✅ NEW
  RESPONSE_TEMPLATES: module.exports.RESPONSE_TEMPLATES // ✅ NEW
};