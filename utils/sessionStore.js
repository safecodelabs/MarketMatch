// =======================================================
// ✅ PATCHED FILE: utils/sessionStore.js
// =======================================================
// Debug-friendly session store that uses Firestore

const { db } = require('../database/firestore'); // use db exported from your firestore init

const collection = db && db.collection ? db.collection('sessions') : null;

// Default session structure for new/missing sessions
const defaultSession = { 
    step: 'start', 
    housingFlow: { step: 'start', data: {} }, 
    isInitialized: false 
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
        if (!data.housingFlow) data.housingFlow = { step: 'start', data: {} };
        if (typeof data.isInitialized === 'undefined') data.isInitialized = false;
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
        const plainData = JSON.parse(JSON.stringify(sessionData)); // strip undefined
        // Add timestamp for maintenance/debugging
        plainData.lastUpdated = Date.now(); 
        await collection.doc(userId).set(plainData);
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
            // Clear flow-specific data but keep basic session
            delete session.editFlow;
            delete session.manageListings;
            delete session.manageFlow;
            
            // Clear housing flow data but keep the structure
            if (session.housingFlow) {
                delete session.housingFlow.listingData;
                delete session.housingFlow.currentIndex;
                delete session.housingFlow.currentListings;
                session.housingFlow.step = 'start';
            }
            
            // Set step back to menu
            session.step = 'menu';
            
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

module.exports = { 
    getSession, 
    saveSession, 
    deleteSession,
    clearFlowData  // ✅ ADDED
};