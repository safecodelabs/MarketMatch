// =======================================================
// ✅ PATCHED FILE: utils/sessionStore.js
// =======================================================
// Debug-friendly session store that uses Firestore

const { db } = require('../database/firestore'); // use db exported from your firestore init

const collection = db && db.collection ? db.collection('sessions') : null;

// Default session structure for new/missing sessions
const defaultSession = { 
  step: 'start', 
  state: 'initial',
  housingFlow: { 
    step: 'start', 
    data: {}, 
    currentIndex: 0, 
    listingData: null 
  }, 
  isInitialized: false,
  timestamp: Date.now()
};

async function getSession(userId) {
  if (!userId) return null;
  if (!collection) {
    console.warn('⚠️ getSession: Firestore collection unavailable (db not initialized)');
    return { ...defaultSession };
  }

  try {
    const doc = await collection.doc(userId).get();
    if (!doc.exists) return { ...defaultSession };
    const data = doc.data() || {};
    
    // Ensure critical fields exist
    if (!data.housingFlow) {
      data.housingFlow = { step: 'start', data: {}, currentIndex: 0, listingData: null };
    }
    if (typeof data.isInitialized === 'undefined') data.isInitialized = false;
    if (!data.state) data.state = 'initial';
    if (!data.step) data.step = 'start';
    
    return data;
  } catch (err) {
    console.error('❌ getSession error:', err?.message || err);
    return { ...defaultSession };
  }
}

async function saveSession(userId, sessionData) {
  if (!userId) throw new Error('userId required');
  if (!sessionData || typeof sessionData !== 'object') throw new Error('Invalid session data');

  if (!collection) {
    console.warn('⚠️ saveSession: Firestore collection unavailable — skipping save');
    return false;
  }

  try {
    // Add timestamp for maintenance/debugging
    sessionData.lastUpdated = Date.now();
    sessionData.timestamp = Date.now();
    
    // Ensure required structure
    if (!sessionData.housingFlow) {
      sessionData.housingFlow = { step: 'start', data: {}, currentIndex: 0, listingData: null };
    }
    if (!sessionData.state) sessionData.state = 'initial';
    if (!sessionData.step) sessionData.step = 'start';
    if (typeof sessionData.isInitialized === 'undefined') sessionData.isInitialized = false;
    
    await collection.doc(userId).set(sessionData);
    console.log(`✅ saveSession: saved session for ${userId}`);
    return true;
  } catch (err) {
    console.error('❌ saveSession error:', err?.message || err, 'sessionData:', JSON.stringify(sessionData).slice(0, 300) + '...');
    throw err;
  }
}

async function deleteSession(userId) {
  if (!userId) throw new Error('userId required');
  if (!collection) {
    console.warn('⚠️ deleteSession: Firestore collection unavailable — skipping delete for', userId);
    return false;
  }
  try {
    await collection.doc(userId).delete();
    console.log(`✅ deleteSession: deleted session for ${userId}`);
    return true;
  } catch (err) {
    console.error('❌ deleteSession error:', err?.message || err);
    throw err;
  }
}

// ✅ NEW: Clear flow-specific data while keeping basic session
async function clearFlowData(userId) {
  if (!userId) throw new Error('userId required');
  
  try {
    const session = await getSession(userId);
    if (session) {
      // Clear ALL flow-specific data
      delete session.editFlow;
      delete session.manageListings;
      delete session.manageFlow;
      delete session.savedListingsFlow;  // ✅ ADDED: Clear saved listings flow
      delete session.viewingSavedListings; // ✅ ADDED: Clear saved viewing state
      delete session.urbanHelpContext; // ✅ ADDED: Clear urban help context
      delete session.rawTranscription; // ✅ ADDED: Clear voice transcription
      delete session.voiceContext; // ✅ ADDED: Clear voice context
      
      // Clear posting flow data
      delete session.mode;
      delete session.draftId;
      delete session.expectedField;
      delete session.postingOptions;
      
      // Clear housing flow data but keep the structure
      if (session.housingFlow) {
        delete session.housingFlow.listingData;
        delete session.housingFlow.currentIndex;
        delete session.housingFlow.currentListings;
        delete session.housingFlow.savedListingIndex; // ✅ ADDED
        delete session.housingFlow.savedListingsData; // ✅ ADDED
        session.housingFlow.step = 'start';
        session.housingFlow.data = {};
      }
      
      // Set step back to menu
      session.step = 'menu';
      session.state = 'initial';
      
      // Save cleaned session
      await saveSession(userId, session);
      console.log(`✅ clearFlowData: cleaned flow data for ${userId}`);
    }
    return true;
  } catch (err) {
    console.error('❌ clearFlowData error:', err?.message || err);
    return false;
  }
}

// ✅ NEW: Clear saved listings flow data specifically
async function clearSavedListingsFlow(userId) {
  if (!userId) throw new Error('userId required');
  
  try {
    const session = await getSession(userId);
    if (session) {
      // Clear only saved listings flow data
      delete session.savedListingsFlow;
      delete session.viewingSavedListings;
      
      if (session.housingFlow) {
        delete session.housingFlow.savedListingIndex;
        delete session.housingFlow.savedListingsData;
      }
      
      // Save cleaned session
      await saveSession(userId, session);
      console.log(`✅ clearSavedListingsFlow: cleaned saved listings flow for ${userId}`);
    }
    return true;
  } catch (err) {
    console.error('❌ clearSavedListingsFlow error:', err?.message || err);
    return false;
  }
}

// ✅ NEW: Initialize saved listings flow
async function initSavedListingsFlow(userId, listings) {
  if (!userId) throw new Error('userId required');
  
  try {
    const session = await getSession(userId);
    if (session) {
      session.savedListingsFlow = {
        listings: listings.reduce((acc, listing) => {
          acc[listing.id] = listing;
          return acc;
        }, {}),
        step: "awaiting_selection"
      };
      session.step = "viewing_saved_listings";
      await saveSession(userId, session);
      console.log(`✅ initSavedListingsFlow: initialized for ${userId} with ${listings.length} listings`);
    }
    return true;
  } catch (err) {
    console.error('❌ initSavedListingsFlow error:', err?.message || err);
    return false;
  }
}

// ✅ NEW: Update saved listings session state
async function updateSavedListingsSession(userId, updates) {
  if (!userId) throw new Error('userId required');
  
  try {
    const session = await getSession(userId);
    if (session && session.savedListingsFlow) {
      Object.assign(session.savedListingsFlow, updates);
      await saveSession(userId, session);
      console.log(`✅ updateSavedListingsSession: updated for ${userId}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error('❌ updateSavedListingsSession error:', err?.message || err);
    return false;
  }
}

// ✅ NEW: Check if user is in saved listings flow
async function isInSavedListingsFlow(userId) {
  if (!userId) return false;
  
  try {
    const session = await getSession(userId);
    return !!(session && (session.savedListingsFlow || session.step === "viewing_saved_listings"));
  } catch (err) {
    console.error('❌ isInSavedListingsFlow error:', err?.message || err);
    return false;
  }
}

// ✅ NEW: Clear posting flow data specifically
async function clearPostingFlow(userId) {
  if (!userId) throw new Error('userId required');
  
  try {
    const session = await getSession(userId);
    if (session) {
      delete session.mode;
      delete session.draftId;
      delete session.expectedField;
      delete session.postingOptions;
      delete session.category;
      
      session.step = 'menu';
      session.state = 'initial';
      
      await saveSession(userId, session);
      console.log(`✅ clearPostingFlow: cleaned posting flow for ${userId}`);
    }
    return true;
  } catch (err) {
    console.error('❌ clearPostingFlow error:', err?.message || err);
    return false;
  }
}

// ✅ NEW: Clear voice context data
async function clearVoiceContext(userId) {
  if (!userId) throw new Error('userId required');
  
  try {
    const session = await getSession(userId);
    if (session) {
      delete session.rawTranscription;
      delete session.voiceContext;
      delete session.urbanHelpContext;
      
      await saveSession(userId, session);
      console.log(`✅ clearVoiceContext: cleaned voice context for ${userId}`);
    }
    return true;
  } catch (err) {
    console.error('❌ clearVoiceContext error:', err?.message || err);
    return false;
  }
}

module.exports = { 
  getSession, 
  saveSession, 
  deleteSession,
  clearFlowData,
  clearSavedListingsFlow,
  initSavedListingsFlow,
  updateSavedListingsSession,
  isInSavedListingsFlow,
  clearPostingFlow, // ✅ ADDED
  clearVoiceContext // ✅ ADDED
};