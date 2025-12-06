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
// DELETE LISTING BY ID - ENHANCED DEBUG VERSION
// -----------------------------------------------------
async function deleteListing(listingId) {
  console.log(`🔍 [FIRESTORE] deleteListing called for ID: ${listingId}`);
  console.log(`🔍 [FIRESTORE] listingId type: ${typeof listingId}`);
  console.log(`🔍 [FIRESTORE] listingId value: "${listingId}"`);
  
  try {
    // Validate and clean listingId
    if (!listingId) {
      console.error(`❌ [FIRESTORE] Empty listing ID`);
      return { 
        success: false, 
        error: "Empty listing ID",
        listingId: listingId 
      };
    }
    
    const cleanListingId = String(listingId).trim();
    
    console.log(`🔍 [FIRESTORE] Clean listing ID: "${cleanListingId}"`);
    
    // Get document reference
    const docRef = listingsRef.doc(cleanListingId);
    
    console.log(`🔍 [FIRESTORE] Checking if document exists...`);
    
    // Check if document exists
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.warn(`⚠️ [FIRESTORE] Document ${cleanListingId} does not exist`);
      return { 
        success: false, 
        error: "Document not found",
        listingId: cleanListingId,
        exists: false
      };
    }
    
    console.log(`🔍 [FIRESTORE] Document found, data:`, doc.data());
    
    // Delete the document
    console.log(`🔍 [FIRESTORE] Attempting to delete document...`);
    await docRef.delete();
    
    console.log(`✅ [FIRESTORE] Document ${cleanListingId} deleted successfully`);
    
    return { 
      success: true, 
      listingId: cleanListingId,
      message: "Listing deleted successfully",
      deletedAt: Date.now(),
      existed: true
    };
    
  } catch (err) {
    console.error("🔥 [FIRESTORE] Error in deleteListing:", err);
    console.error("🔥 [FIRESTORE] Error name:", err.name);
    console.error("🔥 [FIRESTORE] Error message:", err.message);
    console.error("🔥 [FIRESTORE] Error code:", err.code);
    console.error("🔥 [FIRESTORE] Error stack:", err.stack);
    
    return { 
      success: false, 
      error: err.message || "Unknown error",
      listingId: listingId,
      code: err.code,
      name: err.name
    };
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

// -----------------------------------------------------
// REMOVE SAVED LISTING FROM USER FAVORITES
// -----------------------------------------------------
async function removeSavedListing(userId, listingId) {
  try {
    // Use the same composite ID format for lookup
    const docId = `${String(userId)}_${String(listingId)}`;
    
    const savedDoc = await savedRef.doc(docId).get();
    
    if (!savedDoc.exists) {
      console.log(`⚠️ Saved listing ${docId} not found for removal`);
      return { success: false, error: "Saved listing not found" };
    }
    
    await savedRef.doc(docId).delete();
    console.log(`✅ Saved listing ${docId} removed successfully`);
    return { success: true };
  } catch (err) {
    console.error("🔥 Error removing saved listing:", err);
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------
// GET USER'S SAVED LISTINGS
// -----------------------------------------------------
async function getUserSavedListings(userId) {
  try {
    // Query saved collection for this user
    const snapshot = await savedRef
      .where("userId", "==", userId)
      .orderBy("savedAt", "desc")
      .get();
    
    if (snapshot.empty) {
      console.log(`📭 No saved listings found for user ${userId}`);
      return [];
    }
    
    console.log(`🔍 Found ${snapshot.docs.length} saved items for user ${userId}`);
    
    // Get all listing IDs
    const savedItems = snapshot.docs.map(doc => ({
      savedId: doc.id,
      ...doc.data()
    }));
    
    const listingIds = savedItems.map(item => item.listingId);
    
    if (listingIds.length === 0) {
      return [];
    }
    
    // Fetch the actual listing data for each saved listing ID
    const listingsPromises = listingIds.map(async (listingId, index) => {
      try {
        const listingDoc = await listingsRef.doc(listingId).get();
        if (listingDoc.exists) {
          const listingData = listingDoc.data();
          return {
            id: listingId,
            ...listingData,
            savedAt: savedItems[index]?.savedAt?.toDate?.() || null
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching listing ${listingId}:`, error);
        return null;
      }
    });
    
    const listings = await Promise.all(listingsPromises);
    
    // Filter out null results (listings that might have been deleted)
    const validListings = listings.filter(listing => listing !== null);
    
    console.log(`✅ Retrieved ${validListings.length} valid saved listings for user ${userId}`);
    return validListings;
    
  } catch (err) {
    console.error("🔥 Error getting user saved listings:", err);
    return [];
  }
}

// -----------------------------------------------------
// CHECK IF LISTING IS ALREADY SAVED BY USER
// -----------------------------------------------------
async function isListingSaved(userId, listingId) {
  try {
    const docId = `${String(userId)}_${String(listingId)}`;
    const savedDoc = await savedRef.doc(docId).get();
    return savedDoc.exists;
  } catch (err) {
    console.error("🔥 Error checking if listing is saved:", err);
    return false;
  }
}

// -----------------------------------------------------
// GET SAVED COUNT FOR A LISTING
// -----------------------------------------------------
async function getSavedCount(listingId) {
  try {
    const snapshot = await savedRef.where("listingId", "==", listingId).get();
    return snapshot.size;
  } catch (err) {
    console.error("🔥 Error getting saved count:", err);
    return 0;
  }
}

// -----------------------------------------------------
// USER PROFILE & LANGUAGE (Kept as provided)
// -----------------------------------------------------
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

// -----------------------------------------------------
// UPDATE USER PROFILE WITH SAVED LISTINGS (LEGACY SUPPORT)
// -----------------------------------------------------
async function saveListingToUser(userId, listingId) {
  try {
    // This is for backward compatibility with the earlier implementation
    return await saveSavedListing(userId, listingId);
  } catch (err) {
    console.error("🔥 Error in saveListingToUser:", err);
    return { success: false, error: err.message };
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
  saveListingToUser, // For backward compatibility
  removeSavedListing,
  getUserSavedListings,
  isListingSaved,
  getSavedCount,
  deleteListing,
  updateListing,
  getUserProfile,
  saveUserLanguage,
};