const db = require('../../database/firestore');
const multiLanguage = require('../../utils/multiLanguage');
const { sendText } = require('./messageService');
const { alert } = require('./alertService');

/**
 * Match pending requests across categories (jobs, urban help, listings) against existing
 * posts/providers/listings and notify users when matches are found.
 * - Looks back N days for pending requests
 * - For job requests uses db.searchJobs
 * - For user (urban help/property) requests uses searchUrbanServices and searchListingsByCriteria
 * - Records send failures via recordNotificationFailure
 */
async function runOnce(options = {}) {
  const daysWindow = options.daysWindow || 7;
  const maxRetries = options.maxRetries || 3;
  const includeAuthErrors = options.includeAuthErrors || false;

  console.log('🔁 [MATCH-NOTIFY] Starting matching pass', { daysWindow, maxRetries, includeAuthErrors });

  // 1) Jobs: re-run matches for pending job requests
  try {
    const pendingJobs = await db.getPendingJobRequests(daysWindow);
    console.log(`🔎 [MATCH-NOTIFY][JOBS] Found ${pendingJobs.length} pending job requests`);

    for (const req of pendingJobs) {
      try {
        // If already tried too many times and reached maxRetries, skip
        if (req.notificationAttempts && req.notificationAttempts >= maxRetries) continue;

        // Re-run search with role & location
        const matches = await db.searchJobs({ role: req.desiredRole, location: req.location });
        if (!matches || matches.length === 0) continue;

        // Use first match for notification
        const job = matches[0];
        const userLang = multiLanguage.getUserLanguage(req.userId) || 'en';
        const message = multiLanguage.getMessage(userLang, 'new_job_available', {
          title: job.title || job.role || 'Job',
          location: job.location || req.location || 'your area',
          category: job.normalizedRole || job.role || req.desiredRole || 'Job',
          contact: job.contact || 'Contact not available'
        });

        try {
          await sendText(req.userId, message);
          await db.updateJobRequestStatus(req.id, 'matched', [job.id]);
          console.log(`✅ [MATCH-NOTIFY][JOBS] Notified ${req.userId} about job ${job.id}`);
        } catch (err) {
          console.warn(`⚠️ [MATCH-NOTIFY][JOBS] Failed to notify ${req.userId} (req=${req.id}):`, err.message || err);
          await db.recordNotificationFailure(req.id, job.id, { message: err.message || '', status: err.status || null, apiData: err.apiData || null });

          if (err.status === 401 || (err.apiData && err.apiData.error && err.apiData.error.code === 190)) {
            await alert('critical', 'Auth error: notifications blocked (jobs)', { message: err.message || '' });
          }
        }
      } catch (err) {
        console.warn('⚠️ [MATCH-NOTIFY][JOBS] Error processing request:', err && err.message || err);
      }
    }
  } catch (err) {
    console.error('❌ [MATCH-NOTIFY][JOBS] Failed to fetch or process pending job requests:', err && err.message || err);
  }

  // 2) Urban help & listings: re-run for pending user requests
  try {
    const pending = await db.getPendingUserRequestsAll(daysWindow);
    console.log(`🔎 [MATCH-NOTIFY][URBAN] Found ${pending.length} pending user requests`);

    for (const req of pending) {
      try {
        // Skip if too many attempts
        if (req.notificationAttempts && req.notificationAttempts >= maxRetries) continue;

        // First, attempt to find providers (urban_services) by category and location
        let matchedItems = [];
        if (req.category) {
          matchedItems = await db.searchUrbanServices(req.category, req.location || '');
        }

        // If none found, attempt to find relevant listings (e.g., service listings)
        if ((!matchedItems || matchedItems.length === 0) && req.type !== 'job') {
          const listingMatches = await db.searchListingsByCriteria({ type: req.type || req.category, location: req.location });
          if (listingMatches && listingMatches.length) matchedItems = listingMatches;
        }

        if (!matchedItems || matchedItems.length === 0) continue;

        // Notify user with first match
        const item = matchedItems[0];
        const userLang = multiLanguage.getUserLanguage(req.userId) || 'en';
        const message = multiLanguage.getMessage(userLang, 'new_listing_available', {
          category: req.category || req.type || 'Service',
          location: req.location || 'your area',
          title: item.name || item.title || 'New Provider'
        });

        try {
          await sendText(req.userId, message);
          await db.updateRequestStatus(req.id, 'matched', [item.id]);
          console.log(`✅ [MATCH-NOTIFY][URBAN] Notified ${req.userId} about provider ${item.id}`);
        } catch (err) {
          console.warn(`⚠️ [MATCH-NOTIFY][URBAN] Failed to notify ${req.userId} (req=${req.id}):`, err.message || err);
          await db.recordNotificationFailure(req.id, item.id, { message: err.message || '', status: err.status || null, apiData: err.apiData || null });

          if (err.status === 401 || (err.apiData && err.apiData.error && err.apiData.error.code === 190)) {
            await alert('critical', 'Auth error: notifications blocked (urban_help/listings)', { message: err.message || '' });
          }
        }
      } catch (err) {
        console.warn('⚠️ [MATCH-NOTIFY][URBAN] Error processing request:', err && err.message || err);
      }
    }
  } catch (err) {
    console.error('❌ [MATCH-NOTIFY][URBAN] Failed to fetch or process pending user requests:', err && err.message || err);
  }

  console.log('🔁 [MATCH-NOTIFY] Pass complete');
  return true;
}

module.exports = { runOnce };
