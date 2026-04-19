const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const axios = require('axios');

// Razorpay configuration (use your actual keys)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_key';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret';

// Database references
const db = admin.firestore();
const brokerLeadsRef = db.collection('brokerLeads');
const brokersRef = db.collection('brokers');

// JWT verification middleware
const verifyBrokerToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.brokerId = decodedToken.uid;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ================================
// AUTHENTICATION ROUTES
// ================================

// Broker signup with Razorpay payment
router.post('/signup', async (req, res) => {
  try {
    const { email, password, brokerName, phoneNumber } = req.body;

    // Create Firebase user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: brokerName
    });

    // Create broker profile
    await brokersRef.doc(userRecord.uid).set({
      email,
      brokerName,
      phoneNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending_payment',
      isPaid: false,
      paymentId: null,
      leadsCount: 0
    });

    // Generate custom token for immediate login
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    res.json({
      success: true,
      uid: userRecord.uid,
      token: customToken,
      brokerName,
      email
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Broker login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verify email/password via Firebase REST API
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true
      }
    );

    const brokerDoc = await brokersRef.doc(response.data.localId).get();

    if (!brokerDoc.exists) {
      return res.status(404).json({ error: 'Broker profile not found' });
    }

    if (!brokerDoc.data().isPaid) {
      return res.status(403).json({
        error: 'Payment required',
        needsPayment: true,
        plans: [
          { id: 1, name: 'Starter', price: 29900, leadLimit: 50 },
          { id: 2, name: 'Professional', price: 49900, leadLimit: 200 },
          { id: 3, name: 'Enterprise', price: 99900, leadLimit: 1000 }
        ]
      });
    }

    res.json({
      success: true,
      token: response.data.idToken,
      brokerId: response.data.localId,
      brokerName: brokerDoc.data().brokerName
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ================================
// PAYMENT ROUTES
// ================================

// Create Razorpay order
router.post('/payment/create-order', verifyBrokerToken, async (req, res) => {
  try {
    const { planId } = req.body;

    const plans = {
      1: { amount: 29900, name: 'Starter', leads: 50 },
      2: { amount: 49900, name: 'Professional', leads: 200 },
      3: { amount: 99900, name: 'Enterprise', leads: 1000 }
    };

    const plan = plans[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Create Razorpay order
    const orderResponse = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: plan.amount,
        currency: 'INR',
        receipt: `order_${req.brokerId}_${Date.now()}`,
        notes: {
          brokerId: req.brokerId,
          planId: planId,
          planName: plan.name
        }
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET
        }
      }
    );

    res.json({
      success: true,
      orderId: orderResponse.data.id,
      amount: plan.amount,
      planName: plan.name,
      leadLimit: plan.leads,
      keyId: RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Payment order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment and activate broker
router.post('/payment/verify', async (req, res) => {
  try {
    const { orderId, paymentId, signature, brokerId, planId } = req.body;

    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Update broker status
    const plans = {
      1: { leads: 50, validity: 30 },
      2: { leads: 200, validity: 30 },
      3: { leads: 1000, validity: 30 }
    };

    await brokersRef.doc(brokerId).update({
      isPaid: true,
      paymentId,
      orderId,
      planId,
      leadLimit: plans[planId].leads,
      validityDays: plans[planId].validity,
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    });

    res.json({
      success: true,
      message: 'Payment verified and broker activated'
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ================================
// LEADS ROUTES
// ================================

// Get all leads for broker
router.get('/leads', verifyBrokerToken, async (req, res) => {
  try {
    const snapshot = await brokerLeadsRef.get();
    const leads = [];

    snapshot.forEach(doc => {
      leads.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Update lead status
router.put('/leads/:leadId', verifyBrokerToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status, notes } = req.body;

    await brokerLeadsRef.doc(leadId).update({
      status,
      notes,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastContactedBy: req.brokerId
    });

    res.json({
      success: true,
      message: 'Lead updated successfully'
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Get broker dashboard stats
router.get('/stats', verifyBrokerToken, async (req, res) => {
  try {
    const leadsSnapshot = await brokerLeadsRef.get();
    const leads = [];

    leadsSnapshot.forEach(doc => {
      leads.push(doc.data());
    });

    const stats = {
      totalLeads: leads.length,
      newLeads: leads.filter(l => l.status === 'new').length,
      contactedLeads: leads.filter(l => l.status === 'contacted').length,
      convertedLeads: leads.filter(l => l.status === 'converted').length,
      conversionRate: leads.length > 0 ? (leads.filter(l => l.status === 'converted').length / leads.length * 100).toFixed(2) : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
