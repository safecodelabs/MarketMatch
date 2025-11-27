// database/firestore.js
const admin = require("firebase-admin");

let serviceAccount = null;

try {
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} catch (err) {
  console.error("❌ Firebase credentials missing or invalid:", err);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = {
  db,
  usersRef: db.collection("users"),
};
