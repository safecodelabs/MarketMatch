// src/database/firestore.js

const admin = require("firebase-admin");

// ----------------------------------------
// 1. Initialize Firebase Admin safely
// ----------------------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // Railway uses built-in SA
  });
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
// 3. Get listings with combined filters
// ----------------------------------------
async function getListings(filters = {}) {
  try {
    let ref = listingsRef;

    if (filters.category) {
      ref = ref.where("category", "==", filters.category);
    }
    if (filters.location) {
      ref = ref.where("location", "==", filters.location);
    }
    if (filters.maxPrice) {
      ref = ref.where("price", "<=", Number(filters.maxPrice));
    }

    const snapshot = await ref
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    let results = [];
    snapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });

    return results;
  } catch (err) {
    console.error("🔥 Error fetching listings:", err);
    return [];
  }
}

// ----------------------------------------
// 4. Fetch listings by category only
// ----------------------------------------
async function getListingsByCategory(category) {
  return await getListings({ category });
}

// ----------------------------------------
// 5. Fetch ALL listings (for AI pre-loading)
// ----------------------------------------
async function getAllListings(limit = 200) {
  try {
    const snapshot = await listingsRef
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    let results = [];
    snapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });

    return results;
  } catch (err) {
    console.error("🔥 Error fetching all listings:", err);
    return [];
  }
}

// ----------------------------------------
// 6. Fetch listings by user
// ----------------------------------------
async function getUserListings(userId) {
  try {
    const snapshot = await listingsRef
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .get();

    let results = [];
    snapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });

    return results;
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
