const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Path to your service account JSON file
const serviceAccountPath = path.resolve(process.cwd(), 'credentials', 'firebase-credentials.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
 // ✅ make sure this file exists

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

module.exports = { admin, db }; // ✅ Export both