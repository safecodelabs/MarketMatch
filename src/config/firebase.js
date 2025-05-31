const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('../../serviceAccountKey.json'); // adjust path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();

module.exports = { db };
