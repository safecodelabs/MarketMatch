// src/db/listings.db.js
const { db } = require("../utils/firebase");

// Collection reference
const listingsRef = db.collection("listings");

/**
 * Fetch all listings
 * Returns: array of listing objects (each with id)
 */
async function getAllListings() {
  try {
    const snap = await listingsRef.get();
    const data = [];
    snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    return data;
  } catch (err) {
    console.error("❌ Firestore read failed:", err.message);
    return [];
  }
}

/**
 * Add a new listing
 * Accepts: listing object
 * Auto-generates ID
 */
async function addListing(listing) {
  try {
    const docRef = await listingsRef.add({
      ...listing,
      createdAt: Date.now()
    });
    return { id: docRef.id };
  } catch (err) {
    console.error("❌ Firestore add failed:", err.message);
    throw err;
  }
}

/**
 * Update a listing
 */
async function updateListing(id, data) {
  try {
    await listingsRef.doc(id).update(data);
    return true;
  } catch (err) {
    console.error("❌ Firestore update failed:", err.message);
    return false;
  }
}

module.exports = {
  getAllListings,
  addListing,
  updateListing,
};
