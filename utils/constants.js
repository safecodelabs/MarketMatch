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

// Intent Types
module.exports.INTENTS = {
  BUY_PROPERTY: 'buy_property',
  RENT_PROPERTY: 'rent_property',
  SELL_PROPERTY: 'sell_property',
  POST_LISTING: 'post_listing',
  SEARCH_LISTING: 'search_listing',
  VIEW_LISTING: 'view_listing',
  CONTACT_AGENT: 'contact_agent',
  UNKNOWN: 'unknown'
};

// Session States
module.exports.SESSION_STATES = {
  START: 'start',
  MENU: 'menu',
  AWAITING_LANGUAGE: 'awaiting_language',
  AWAITING_LISTING_ACTION: 'awaiting_listing_action',
  AWAITING_POST_DETAILS: 'awaiting_post_details',
  AWAITING_FLOW_SUBMISSION: 'awaiting_flow_submission',
  MANAGING_LISTINGS: 'managing_listings',
  VIEWING_SAVED_LISTINGS: 'viewing_saved_listings',
  PROCESSING_VOICE: 'processing_voice',
  AWAITING_VOICE_CONFIRMATION: 'awaiting_voice_confirmation',
  AWAITING_VOICE: 'awaiting_voice'
};

// Flow Steps Configuration
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

// Button IDs for interactive messages
module.exports.BUTTON_IDS = {
  // Housing Flow
  VIEW_LISTINGS: 'view_listings',
  POST_LISTING: 'post_listing',
  MANAGE_LISTINGS: 'manage_listings',
  SAVED_LISTINGS: 'saved_listings',
  CHANGE_LANGUAGE: 'change_language',
  
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
  CANCEL_EDITS: 'cancel_edits'
};

// Menu Configuration
module.exports.MENU_CONFIG = {
  MAX_LISTINGS_PER_PAGE: 5,
  MAX_SAVED_LISTINGS: 50,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
  MAX_VOICE_DURATION: 60, // seconds
  MAX_VOICE_SIZE: 10 * 1024 * 1024 // 10MB
};

// Error Messages
module.exports.ERROR_MESSAGES = {
  NO_LISTINGS: 'No listings available right now. Please check back later.',
  VOICE_PROCESSING_FAILED: 'Sorry, I couldn\'t process your voice message. Please try again or type your request.',
  VOICE_TOO_LONG: 'Your voice message is too long. Please keep it under 60 seconds.',
  VOICE_TOO_LARGE: 'Your voice message is too large. Please send a shorter message.',
  NO_INTERNET: 'No internet connection. Please check your connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  INVALID_INPUT: 'Invalid input. Please check your message and try again.',
  SESSION_EXPIRED: 'Your session has expired. Please type "hi" to start again.',
  PERMISSION_DENIED: 'Permission denied. Please contact support if you believe this is an error.'
};

// Success Messages
module.exports.SUCCESS_MESSAGES = {
  LISTING_POSTED: '🎉 Listing posted successfully!',
  LISTING_UPDATED: '✅ Listing updated successfully!',
  LISTING_DELETED: '🗑️ Listing deleted successfully!',
  LISTING_SAVED: '❤️ Listing saved to your favorites!',
  LISTING_REMOVED: 'Listing removed from your saved list.',
  VOICE_PROCESSED: '🎤 Voice message processed successfully!',
  LANGUAGE_CHANGED: '🌐 Language changed successfully!'
};

// Voice Processing Constants (Detailed)
module.exports.VOICE_CONFIG = {
  SUPPORTED_FORMATS: ['ogg', 'opus', 'mp3', 'wav', 'm4a', 'aac'],
  MAX_DURATION_SECONDS: 60,
  MAX_FILE_SIZE_MB: 10,
  MIN_CONFIDENCE_THRESHOLD: 0.7,
  HIGH_CONFIDENCE_THRESHOLD: 0.9,
  TRANSCRIPTION_TIMEOUT: 30000, // 30 seconds
  INTENT_EXTRACTION_TIMEOUT: 10000 // 10 seconds
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
  LOCATIONS: module.exports.LOCATIONS,
  BHK_OPTIONS: module.exports.BHK_OPTIONS,
  PRICE_RANGES: module.exports.PRICE_RANGES,
  LANGUAGES: module.exports.LANGUAGES,
  BUTTON_IDS: module.exports.BUTTON_IDS,
  MENU_CONFIG: module.exports.MENU_CONFIG,
  ERROR_MESSAGES: module.exports.ERROR_MESSAGES,
  SUCCESS_MESSAGES: module.exports.SUCCESS_MESSAGES,
  VOICE_CONFIG: module.exports.VOICE_CONFIG,
  FLOW_CONFIG: module.exports.FLOW_CONFIG
};