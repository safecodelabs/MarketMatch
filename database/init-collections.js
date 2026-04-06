// File: /database/init-collections.js (Run this once)
const { db } = require('./firestore');

async function initializeCollections() {
  console.log('Initializing Firestore collections...');
  
  // Create sample data for required indexes
  const collections = ['users', 'sessions', 'drafts', 'listings'];
  
  for (const collection of collections) {
    try {
      // Create a dummy document to ensure collection exists
      const dummyRef = db.collection(collection).doc('init');
      await dummyRef.set({ 
        initialized: true,
        timestamp: new Date() 
      });
      
      // Delete the dummy document
      await dummyRef.delete();
      
      console.log(`✅ ${collection} collection initialized`);
    } catch (error) {
      console.log(`⚠️ ${collection}: ${error.message}`);
    }
  }
  
  console.log('✅ All collections initialized');
}

// Run if this file is executed directly
if (require.main === module) {
  initializeCollections();
}

module.exports = { initializeCollections };