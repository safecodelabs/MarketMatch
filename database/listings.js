// src/database/listings.js
const { db } = require("./firestore");
const { Timestamp } = require("firebase-admin/firestore");

/**
 * Firestore structure:
 * listings/
 *    autoId/
 *      title
 *      location
 *      category
 *      price
 *      contact
 *      description
 *      timestamp
 *      userId
 */

/**
 * addListing(data)
 */
async function addListing(data) {
  try {
    const docRef = db.collection("listings").doc();

    await docRef.set({
      title: data.title || "",
      location: data.location || "",
      category: data.property_type || "",
      price: Number(data.price) || 0,
      contact: data.contact || "",
      description: data.description || "",
      userId: data.userId || "",
      timestamp: Timestamp.now()
    });

    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("❌ Firestore addListing error:", err);
    return { success: false };
  }
}

/**
 * getListings({ category, location, maxPrice })
 */
async function getListings(filters = {}) {
  try {
    let ref = db.collection("listings");

    if (filters.category) {
      ref = ref.where("category", "==", filters.category);
    }
    if (filters.location) {
      ref = ref.where("location", "==", filters.location);
    }
    if (filters.maxPrice) {
      ref = ref.where("price", "<=", Number(filters.maxPrice));
    }

    const snap = await ref.orderBy("timestamp", "desc").limit(30).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("❌ Firestore getListings error:", err);
    return [];
  }
}

module.exports = {
  addListing,
  getListings
};
