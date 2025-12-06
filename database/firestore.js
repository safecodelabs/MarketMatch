// database/firestore.js
const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  let serviceAccount;
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } else {
      serviceAccount = require(path.join(__dirname, "..", "credentials", "firebase-credentials.json"));
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("✅ Firestore initialized:", serviceAccount.project_id || "local");
  } catch (err) {
    console.error("❌ Firestore initialization failed:", err.message || err);
  }
}

const db = admin.firestore();

const listingsRef = db.collection("listings");
const usersRef = db.collection("users");
const savedRef = db.collection("saved"); // Dedicated collection for saved items

// -----------------------------------------------
// GET TOP LISTINGS (for chatbotController.js)
// -----------------------------------------------
async function getTopListings(limit = 10) {
  console.log("🔍 [DB] getTopListings called, limit:", limit);
  try {
    // Get listings ordered by timestamp (newest first)
    const snapshot = await listingsRef
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    
    if (snapshot.empty) {
      console.log("📭 [DB] No listings found");
      return { listings: [], totalCount: 0 };
    }
    
    const listings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ [DB] Found ${listings.length} listings`);
    return { listings, totalCount: listings.length };
  } catch (err) {
    console.error("❌ [DB] Error in getTopListings:", err);
    return { listings: [], totalCount: 0 };
  }
}

// -----------------------------------------------
// ADD NEW LISTING
// -----------------------------------------------
async function addListing(listingData) {
  try {
    const payload = {
      ...listingData,
      timestamp: admin.firestore.Timestamp.now(),
      createdAt: Date.now()
    };
    const docRef = await listingsRef.add(payload);
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("🔥 Error adding listing:", err);
    return { success: false, error: err.message || err };
  }
}

// -----------------------------------------------
// FETCH ALL LISTINGS
// -----------------------------------------------
async function getAllListings() {
  try {
    const snapshot = await listingsRef.get();
    
    if (snapshot.empty) return [];

    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`[DB] Fetched ${items.length} listings successfully.`);
    return items; 
  } catch (err) {
    console.error("🔥 Error fetching all listings:", err);
    return [];
  }
}

// -----------------------------------------------
// FETCH USER-SPECIFIC LISTINGS
// -----------------------------------------------
async function getUserListings(userId) {
  try {
    // Listings are saved with the 'user' field corresponding to the sender's WA_ID
    const snapshot = await listingsRef.where("user", "==", userId).get(); 
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("🔥 Error fetching user listings:", err);
    return [];
  }
}

// -----------------------------------------------------
// GET SINGLE LISTING BY ID
// -----------------------------------------------------
async function getListingById(listingId) {
  try {
    const doc = await listingsRef.doc(listingId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error("🔥 Error fetching listing by ID:", err);
    return null;
  }
}

// -----------------------------------------------------
// DELETE LISTING BY ID
// -----------------------------------------------------
async function deleteListing(listingId) {
  try {
    await listingsRef.doc(listingId).delete();
    console.log(`✅ Listing ${listingId} deleted successfully`);
    return { success: true };
  } catch (err) {
    console.error("🔥 Error deleting listing:", err);
    return { success: false, error: err.message || err };
  }
}

// -----------------------------------------------------
// UPDATE LISTING BY ID
// -----------------------------------------------------
async function updateListing(listingId, updates) {
  try {
    const listingRef = listingsRef.doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      console.error(`❌ Listing ${listingId} not found for update`);
      return { success: false, error: "Listing not found" };
    }
    
    // Add updatedAt timestamp
    const updateData = {
      ...updates,
      updatedAt: Date.now()
    };
    
    await listingRef.update(updateData);
    console.log(`✅ Listing ${listingId} updated successfully`);
    return { success: true, listingId, updates: updateData };
  } catch (error) {
    console.error("❌ Error updating listing:", error);
    return { success: false, error: error.message || error };
  }
}

// -----------------------------------------------------
// SAVE LISTING TO USER FAVORITES/SAVED
// -----------------------------------------------------
async function saveSavedListing(userId, listingId) {
  try {
    // Use a composite ID for uniqueness and easy lookup/deletion
    const docId = `${String(userId)}_${String(listingId)}`;
    
    const data = {
      userId,
      listingId,
      savedAt: admin.firestore.Timestamp.now()
    };
    await savedRef.doc(docId).set(data, { merge: true });
    return { success: true };
  } catch (err) {
    console.error("🔥 Error saving listing to favorites:", err);
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// USER PROFILE & LANGUAGE (Kept as provided)
// -----------------------------------------------
async function getUserProfile(userId) {
  try {
    const doc = await usersRef.doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (err) {
    console.error("🔥 Error fetching user profile:", err);
    return null;
  }
}

async function saveUserLanguage(userId, lang) {
  try {
    await usersRef.doc(userId).set({ 
      preferredLanguage: lang,
      lastUpdated: Date.now()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error("🔥 Error saving user language:", err);
    return false;
  }
}

// Export the necessary functions
module.exports = {
  db,
  addListing,
  getAllListings,
  getTopListings,
  getUserListings,
  getListingById, 
  saveSavedListing, 
  deleteListing,
  updateListing,  // ✅ ADDED
  getUserProfile,
  saveUserLanguage,
};