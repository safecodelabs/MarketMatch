module.exports = {
  // -----------------------------
  //  PRIMARY HOUSING INTENT
  // -----------------------------
  housing: {
    keywords: [
      "flat", "flats", "apartment", "apartments", "house", "houses",
      "property", "properties", "real estate", "estate",
      "rent", "for rent", "rental", "lease", "pg", "hostel",
      "buy", "purchase", "sell", "for sale", "resale",
      "1bhk", "2bhk", "3bhk", "4bhk", "bhk", "rk", "1rk", "2rk",
      "villa", "villas", "bungalow", "row house", "independent house",
      "plot", "plots", "land", "shop", "commercial", "office",
      "warehouse", "godown", "studio", "penthouse",
      "investment property", "invest", "builder floor", "luxury flat",
      "affordable housing"
    ],
    requiredInfo: ["city", "property_type", "budget", "bhk"]
  },

  // -----------------------------
  //  GENERAL BROWSE INTENT
  // -----------------------------
  browse: {
    keywords: [
      "looking for", "searching", "explore", "show properties",
      "find me", "any flat", "any house",
      "suggest flat", "options", "listings", "near me"
    ]
  },

  // -----------------------------
  //  USER WANTS TO SELL
  // -----------------------------
  sellProperty: {
    keywords: [
      "sell my house", "sell property", "post property", "list property",
      "list my flat", "add listing", "post flat", "post house", "new listing"
    ],
    requiredInfo: ["city", "property_type", "price", "contact"]
  },

  // -----------------------------
  //  LOCATION INTENT
  // -----------------------------
  location: {
    keywords: [
      "in", "near", "around", "location", "area", "locality", "sector",
      "block", "region", "town", "city", "village"
    ]
  },

  // -----------------------------
  //  BUDGET INTENT
  // -----------------------------
  budget: {
    keywords: ["budget", "under", "below", "max", "upto", "price", "cost"]
  },

  // ======================================================
  // 🚀 EXPANDED INTENTS (NEW)
  // ======================================================

  // 1. Commercial Spaces
  commercial: {
    keywords: [
      "commercial", "commercial space", "commercial property",
      "shop", "shops", "godown", "warehouse", "storage",
      "showroom", "commercial rent", "commercial lease"
    ],
    requiredInfo: ["city", "property_type", "budget"]
  },

  // 2. Office Space
  office: {
    keywords: [
      "office", "office space", "coworking", "co-working",
      "shared office", "private cabin", "workspace"
    ],
    requiredInfo: ["city", "budget", "size"]
  },

  // 3. PG / Hostel intent
  pgHostel: {
    keywords: [
      "pg", "hostel", "mens pg", "girls pg", "student hostel",
      "shared accommodation"
    ],
    requiredInfo: ["city", "budget"]
  },

  // 4. Land / Plot
  landPlot: {
    keywords: [
      "plot", "land", "open plot", "agricultural land",
      "farm land", "industrial land"
    ],
    requiredInfo: ["city", "budget", "size"]
  },

  // 5. New Project Launches
  newProjects: {
    keywords: [
      "new launch", "new project", "upcoming project",
      "builder project", "rera approved", "township"
    ]
  },

  // 6. Property Inspection Visit
  inspection: {
    keywords: [
      "visit", "site visit", "property visit", "when can i see",
      "schedule visit"
    ]
  },

  // 7. Price Negotiation
  negotiation: {
    keywords: [
      "nego", "negotiable", "discount", "best price",
      "last price"
    ]
  },

  // 8. Home Loan / EMI
  loan: {
    keywords: [
      "loan", "home loan", "emi", "interest rate",
      "finance", "bank loan"
    ]
  },

  // 9. Verify Listing
  verifyListing: {
    keywords: [
      "verified", "is this real", "genuine", "authentic", "is this available"
    ]
  },

  // 10. Luxury Properties
  luxury: {
    keywords: [
      "luxury", "premium", "high end", "ultra luxury",
      "posh area"
    ]
  },

  // 11. Affordable Housing
  affordable: {
    keywords: [
      "affordable", "budget friendly", "cheap flat", "low budget"
    ]
  },

  // 12. Property Documents
  documents: {
    keywords: [
      "documents", "papers", "legal", "registry", "agreement",
      "document verification"
    ]
  },

  // 13. Amenities Search
  amenities: {
    keywords: [
      "parking", "gym", "garden", "pool", "lift", "balcony",
      "furnished", "semi furnished", "unfurnished"
    ]
  },

  // 14. Area Measurement
  size: {
    keywords: [
      "sqft", "square feet", "sq ft", "sft",
      "area", "carpet area", "built up"
    ]
  },

  // 15. Urgent Requirement
  urgent: {
    keywords: [
      "urgent", "asap", "immediately", "fast", "quick"
    ]
  }
};
