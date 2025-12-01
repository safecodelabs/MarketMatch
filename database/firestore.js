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

const db = admin.firestore ? admin.firestore() : {
  collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }) })
};

const listingsRef = db.collection ? db.collection("listings") : null;
const usersRef = db.collection ? db.collection("users") : null;

// Add a new listing
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

// Fetch all listings (for everyone)
async function getAllListings(limit = 3) {
  try {
    const snapshot = await db
      .collection("listings")
      .orderBy("timestamp", "desc") // make sure you store timestamp when adding
      .limit(limit)
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("🔥 Error fetching all listings:", err);
    return [];
  }
}


// Fetch listings posted by a specific user
async function getUserListings(userId) {
  try {
    const snapshot = await listingsRef.where("owner", "==", userId).orderBy("timestamp", "desc").get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("🔥 Error fetching user listings:", err);
    return [];
  }
}

// Fetch user profile
async function getUserProfile(userId) {
  try {
    const doc = await usersRef.doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (err) {
    console.error("🔥 Error fetching user profile:", err);
    return null;
  }
}

// Save user's preferred language
async function saveUserLanguage(userId, lang) {
  try {
    await usersRef.doc(userId).set({ preferredLanguage: lang }, { merge: true });
    return true;
  } catch (err) {
    console.error("🔥 Error saving user language:", err);
    return false;
  }
}

// Fetch top 3 listings + total count
async function getTopListings() {
  try {
    const snapshot = await listingsRef.orderBy("timestamp", "desc").limit(3).get();
    const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const totalSnapshot = await listingsRef.get();
    const totalCount = totalSnapshot.size;
    return { listings, totalCount };
  } catch (err) {
    console.error("🔥 Error fetching top listings:", err);
    return { listings: [], totalCount: 0 };
  }
}

module.exports = {
  db,
  addListing,
  getAllListings,
  getUserListings,
  getUserProfile,
  saveUserLanguage,
  getTopListings
};
