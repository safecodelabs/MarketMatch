// src/database/firestore.js
const admin = require("firebase-admin");
const path = require("path");

// ----------------------------------------
// 1. Initialize Firebase Admin with env var or local JSON
// ----------------------------------------
if (!admin.apps.length) {
  let serviceAccount;

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // Use Railway / cloud env variable
      serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      console.log("🔥 Loaded Firebase service account from env var:", serviceAccount.project_id);
    } else {
      // Fallback to local JSON file
      serviceAccount = require(path.join(__dirname, "../credentials/firebase-credentials.json"));
      console.log("🔥 Loaded Firebase service account from local file:", serviceAccount.project_id);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("❌ Firestore initialization failed:", error.message);
    throw error;
  }
}

const db = admin.firestore();
const listingsRef = db.collection("listings");

// ----------------------------------------
// 2. Add a new listing
// ----------------------------------------
async function addListing(listingData) {
  try {
    const payload = {
      ...listingData,
      timestamp: admin.firestore.Timestamp.now(),
    };

    const docRef = await listingsRef.add(payload);

    return {
      success: true,
      id: docRef.id,
      message: "Listing added successfully",
    };
  } catch (err) {
    console.error("🔥 Error adding listing:", err);
    return { success: false, error: err.message };
  }
}

// ----------------------------------------
// 3. Get listings with filters
// ----------------------------------------
async function getListings(filters = {}) {
  try {
    let ref = listingsRef;

    if (filters.category) ref = ref.where("category", "==", filters.category);
    if (filters.location) ref = ref.where("location", "==", filters.location);
    if (filters.maxPrice) ref = ref.where("price", "<=", Number(filters.maxPrice));

    const snapshot = await ref
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("🔥 Error fetching listings:", err);
    return [];
  }
}

// ----------------------------------------
// 4. Get by category
// ----------------------------------------
async function getListingsByCategory(category) {
  return await getListings({ category });
}

// ----------------------------------------
// 5. Get ALL listings for AI
// ----------------------------------------
async function getAllListings(limit = 200) {
  try {
    const snapshot = await listingsRef
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("🔥 Error fetching all listings:", err);
    return [];
  }
}

// ----------------------------------------
// 6. Get listings by a specific user
// ----------------------------------------
async function getUserListings(userId) {
  try {
    const snapshot = await listingsRef
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("🔥 Error fetching user listings:", err);
    return [];
  }
}

module.exports = {
  addListing,
  getListings,
  getListingsByCategory,
  getAllListings,
  getUserListings,
  db,
};
