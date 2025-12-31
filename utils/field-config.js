// File: /utils/field-config.js
const FIELD_CONFIGS = {
  housing: {
    displayName: '🏠 Housing',
    required: ['unitType', 'rent', 'location.area'],
    optional: ['deposit', 'furnishing', 'description', 'location.city'],
    fields: {
      unitType: {
        question: 'What type of property? (1BHK, 2BHK, 3BHK, Studio, PG)',
        type: 'string',
        validation: (value) => ['1bhk', '2bhk', '3bhk', 'studio', 'pg'].includes(value.toLowerCase())
      },
      rent: {
        question: 'What is the monthly rent? (e.g., 15000)',
        type: 'number',
        validation: (value) => !isNaN(value) && parseInt(value) > 0
      },
      deposit: {
        question: 'Security deposit amount? (Optional)',
        type: 'number',
        validation: (value) => !value || (!isNaN(value) && parseInt(value) >= 0)
      },
      'location.area': {
        question: 'Which area or sector?',
        type: 'string',
        validation: (value) => value && value.trim().length > 0
      },
      'location.city': {
        question: 'Which city? (Optional, defaults to Delhi/NCR)',
        type: 'string',
        validation: () => true
      }
    }
  },
  urban_help: {
    displayName: '🔧 Urban Help',
    required: ['serviceType', 'description', 'location.area'],
    optional: ['price', 'experience', 'location.city'],
    fields: {
      serviceType: {
        question: 'What service do you offer? (Plumber, Electrician, Cleaner, Tutor, etc.)',
        type: 'string',
        validation: (value) => value && value.trim().length > 0
      },
      description: {
        question: 'Please describe your service',
        type: 'string',
        validation: (value) => value && value.trim().length > 10
      },
      'location.area': {
        question: 'Which area do you serve?',
        type: 'string',
        validation: (value) => value && value.trim().length > 0
      }
    }
  }
};

module.exports = FIELD_CONFIGS;