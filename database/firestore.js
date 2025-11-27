// database/firestore.js
const admin = require("firebase-admin");
const path = require("path");

// init admin SDK
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
    // Do not throw to allow local dev without credentials — other calls will fail explicitly.
  }
}

const db = admin.firestore ? admin.firestore() : {
  collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }) })
};

const listingsRef = db.collection ? db.collection("listings") : null;
const usersRef = db.collection ? db.collection("users") : null;
const sessionsRef = db.collection ? db.collection("sessions") : null;

async function addListing(listingData) {
  try {
    const payload = {
      ...listingData,
      timestamp: admin.firestore ? admin.firestore.Timestamp.now() : Date.now()
    };
    const docRef = await listingsRef.add(payload);
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("🔥 Error adding listing:", err);
    return { success: false, error: err.message || err };
  }
}

async function getAllListings(limit = 200) {
  try {
    const snapshot = await listingsRef.orderBy ? listingsRef.orderBy("timestamp", "desc").limit(limit).get() : { docs: [] };
    return snapshot.docs ? snapshot.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  } catch (err) {
    console.error("🔥 Error fetching all listings:", err);
    return [];
  }
}

async function getUserListings(userId) {
  try {
    const snapshot = await listingsRef.where ? listingsRef.where("userId", "==", userId).orderBy("timestamp", "desc").get() : { docs: [] };
    return snapshot.docs ? snapshot.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  } catch (err) {
    console.error("🔥 Error fetching user listings:", err);
    return [];
  }
}

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

module.exports = {
  db,
  addListing,
  getAllListings,
  getUserListings,
  getUserProfile,
  saveUserLanguage
};
