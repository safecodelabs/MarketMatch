// database/firestore.js

const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "../credentials/firebase-credentials.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

const db = admin.firestore();

module.exports = {
  db,
  usersRef: db.collection("users"),
};
