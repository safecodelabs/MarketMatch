// File: /database/draft-manager.js
const { db } = require('./firestore.js');
const { Timestamp } = require('firebase/firestore');
const { v4: uuidv4 } = require('uuid');

class DraftManager {
  constructor() {
    this.collection = 'drafts';
  }

  async createDraft(userId, category, intent = 'offer') {
    const draftId = `draft_${uuidv4().slice(0, 8)}`;
    const draftRef = db.collection(this.collection).doc(draftId);
    
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
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
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
      const draftDoc = await draftRef.get();
      
      if (!draftDoc.exists) return null;
      
      const draft = draftDoc.data();
      const fieldParts = fieldPath.split('.');
      
      // Build update object
      const updateData = {};
      
      if (fieldParts[0] === 'location') {
        // For location fields
        updateData[`data.location.${fieldParts[1]}`] = value;
      } else {
        // For category-specific fields
        updateData[`data.${draft.category}.${fieldParts[1]}`] = value;
      }
      
      // Update filled fields
      const currentFilled = draft.filledFields || [];
      if (!currentFilled.includes(fieldPath)) {
        updateData.filledFields = [...currentFilled, fieldPath];
      }
      
      updateData.updatedAt = Timestamp.now();
      
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
      return null;
    }
  }
}

module.exports = DraftManager;