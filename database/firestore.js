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
// ADD NEW LISTING
// -----------------------------------------------
async function addListing(listingData) {
  try {
    const payload = {
      ...listingData,
      timestamp: admin.firestore.Timestamp.now(),
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
async function getAllListings(limit) {
  try {
    let query = listingsRef;
    if (limit) query = query.limit(limit);
    
    const snapshot = await query.get();
    if (snapshot.empty) return [];

    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort manually in JS for robustness
    items.sort((a, b) => {
      const t1 = a.timestamp?.seconds || a.createdAt?.seconds || 0;
      const t2 = b.timestamp?.seconds || b.createdAt?.seconds || 0;
      return t2 - t1; // descending
    });

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
    const snapshot = await listingsRef.where("userId", "==", userId).get(); // Assuming 'userId' field
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("🔥 Error fetching user listings:", err);
    return [];
  }
}

// -----------------------------------------------------
// ✅ NEW: GET SINGLE LISTING BY ID
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
// ✅ NEW: SAVE LISTING TO USER FAVORITES/SAVED
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
    await usersRef.doc(userId).set({ preferredLanguage: lang }, { merge: true });
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
  getUserListings,
  getListingById, // ⭐ NEW
  saveSavedListing, // ⭐ NEW
  getUserProfile,
  saveUserLanguage,
  // Removed getTopListings, saveListingForUser as they weren't in the core flow but can be kept if needed elsewhere
};