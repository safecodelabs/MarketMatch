// File: /database/draft-manager.js - COMPLETELY FIXED VERSION
const { db } = require('./firestore.js');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin'); // ADD THIS

class DraftManager {
  constructor() {
    this.collection = 'drafts';
  }

  async createDraft(userId, category, intent = 'offer') {
    const draftId = `draft_${uuidv4().slice(0, 8)}`;
    const draftRef = db.collection(this.collection).doc(draftId);
    
    // ✅ FIX: Use admin.firestore.FieldValue.serverTimestamp() correctly
    const draftData = {
      ownerId: userId,
      status: 'draft',
      category: category,
      intent: intent,
      data: {
        [category]: {},
        location: {}
      },
      filledFields: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // ✅ FIXED
      updatedAt: admin.firestore.FieldValue.serverTimestamp()  // ✅ FIXED
    };

    await draftRef.set(draftData);
    return { id: draftId, ...draftData };
  }

  async getDraft(draftId) {
    try {
      const draftRef = db.collection(this.collection).doc(draftId);
      const draftDoc = await draftRef.get();
      
      if (!draftDoc.exists) return null;
      
      return { id: draftDoc.id, ...draftDoc.data() };
    } catch (error) {
      console.error('Get Draft Error:', error);
      return null;
    }
  }

  async updateDraftField(draftId, fieldPath, value) {
    try {
      const draftRef = db.collection(this.collection).doc(draftId);
      
      const updateData = {};
      
      if (fieldPath.startsWith('location.')) {
        // For location fields
        const locationField = fieldPath.replace('location.', '');
        updateData[`data.location.${locationField}`] = value;
      } else {
        // Get current category first
        const draftDoc = await draftRef.get();
        if (!draftDoc.exists) return null;
        
        const draft = draftDoc.data();
        const category = draft.category;
        
        // For category-specific fields
        updateData[`data.${category}.${fieldPath}`] = value;
      }
      
      // Update timestamp
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp(); // ✅ FIXED
      
      await draftRef.update(updateData);
      return await this.getDraft(draftId);
      
    } catch (error) {
      console.error('Update Draft Error:', error);
      throw error;
    }
  }

  async deleteDraft(draftId) {
    try {
      await db.collection(this.collection).doc(draftId).delete();
      return true;
    } catch (error) {
      console.error('Delete Draft Error:', error);
      return false;
    }
  }

  async getUserActiveDraft(userId) {
    try {
      const snapshot = await db.collection(this.collection)
        .where('ownerId', '==', userId)
        .where('status', '==', 'draft')
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      
      const draftDoc = snapshot.docs[0];
      return { id: draftDoc.id, ...draftDoc.data() };
    } catch (error) {
      console.error('Get User Draft Error:', error);
      
      // Fallback: Get all drafts and filter client-side
      try {
        const allSnapshot = await db.collection(this.collection)
          .where('ownerId', '==', userId)
          .get();
        
        if (allSnapshot.empty) return null;
        
        const drafts = [];
        allSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.status === 'draft') {
            drafts.push({
              id: doc.id,
              ...data
            });
          }
        });
        
        // Sort by updatedAt manually
        drafts.sort((a, b) => {
          const timeA = a.updatedAt?.toDate?.().getTime() || 0;
          const timeB = b.updatedAt?.toDate?.().getTime() || 0;
          return timeB - timeA; // Descending
        });
        
        return drafts[0] || null;
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        return null;
      }
    }
  }
}

module.exports = DraftManager;