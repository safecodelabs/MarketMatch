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

// -----------------------------------------------
// ADD NEW LISTING
// -----------------------------------------------
async function addListing(listingData) {
  try {
    const payload = {
      ...listingData,
      timestamp: admin.firestore.Timestamp.now(),   // Always store timestamp
    };
    const docRef = await listingsRef.add(payload);
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("🔥 Error adding listing:", err);
    return { success: false, error: err.message || err };
  }
}

// -----------------------------------------------
// FIXED: FETCH ALL LISTINGS (NO LIMIT)
// Smart ordering: use timestamp OR createdAt
// -----------------------------------------------
async function getAllListings() {
  try {
    const snapshot = await listingsRef.get();
    if (snapshot.empty) return [];

    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort manually in JS because some listings may have timestamp, some createdAt
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
    const snapshot = await listingsRef
      .where("owner", "==", userId)
      .get();

    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("🔥 Error fetching user listings:", err);
    return [];
  }
}

// -----------------------------------------------
// USER PROFILE
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

// -----------------------------------------------
// SAVE USER LANGUAGE
// -----------------------------------------------
async function saveUserLanguage(userId, lang) {
  try {
    await usersRef.doc(userId).set({ preferredLanguage: lang }, { merge: true });
    return true;
  } catch (err) {
    console.error("🔥 Error saving user language:", err);
    return false;
  }
}

// -----------------------------------------------
// FETCH TOP 3 LISTINGS + TOTAL COUNT
// -----------------------------------------------
async function getTopListings() {
  try {
    const all = await getAllListings();
    return {
      listings: all.slice(0, 3),
      totalCount: all.length
    };
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
