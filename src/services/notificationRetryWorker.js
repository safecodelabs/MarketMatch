const db = require('../../database/firestore');
const multiLanguage = require('../../utils/multiLanguage');
const { sendText } = require('./messageService');
const { alert } = require('./alertService');

/**
 * Retry failed notification attempts.
 * Behavior:
 *  - Finds job_requests with status='pending' and notificationAttempts > 0 and notificationAttempts < maxRetries
 *  - Skips requests whose lastNotificationError indicates 401 (auth) by default (records an alert)
 *  - Attempts sendText again; on success marks matched, on failure records failure and alerts if repeated
 */
async function runOnce(options = {}) {
  const maxRetries = options.maxRetries || 3;
  const includeAuthErrors = options.includeAuthErrors || false; // if true, will attempt even 401s

  console.log('🔁 [RETRY WORKER] Starting retry pass', { maxRetries, includeAuthErrors });

  const pending = await db.getPendingJobRequests(30); // look back 30 days
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const req of pending) {
    if (!req.notificationAttempts || req.notificationAttempts <= 0) continue; // we only retry ones that had attempts
    if (req.notificationAttempts >= maxRetries) continue; // reached max

    const last = req.lastNotificationError || {};
    if (!includeAuthErrors && last.status === 401) {
      // Auth errors require ops intervention; alert once and skip
      await alert('warning', `Auth error: notifications blocked (request=${req.id})`, { message: last.message || '', code: last.code || last.status });
      continue;
    }

    // re-build message and attempt
    const userLang = multiLanguage.getUserLanguage(req.userId) || 'en';
    const message = multiLanguage.getMessage(userLang, 'new_job_available', {
      title: req.matchedJobIds && req.matchedJobIds[0] ? `Job: ${req.matchedJobIds[0]}` : 'New Job',
      location: req.location || 'your area',
      category: req.desiredRole || 'Job',
      contact: req.contact || 'Contact not available'
    });

    try {
      attempted++;
      await sendText(req.userId, message);

      // mark matched with matched job if available
      const jobIdsToMark = (req.matchedJobIds && req.matchedJobIds.length) ? req.matchedJobIds : [];
      await db.updateJobRequestStatus(req.id, 'matched', jobIdsToMark);
      succeeded++;
      console.log(`✅ [RETRY WORKER] Successfully notified ${req.userId} (req=${req.id})`);
    } catch (err) {
      failed++;
      console.warn(`⚠️ [RETRY WORKER] Failed to notify ${req.userId} (req=${req.id}):`, err.message || err);
      try {
        await db.recordNotificationFailure(req.id, (req.matchedJobIds && req.matchedJobIds[0]) || null, {
          message: err.message || '',
          status: err.status || null,
          apiData: err.apiData || null
        });
      } catch (recErr) {
        console.error('❌ [RETRY WORKER] Failed recording notification failure:', recErr.message || recErr);
      }

      // If auth error, alert
      if (err.status === 401 || (err.apiData && err.apiData.error && err.apiData.error.code === 190)) {
        await alert('critical', 'Auth error retry failed (401). Notifications blocked until token fixed.', { message: err.message || '' });
      }
    }
  }

  console.log(`🔁 [RETRY WORKER] Done. attempted=${attempted} succeeded=${succeeded} failed=${failed}`);
  return { attempted, succeeded, failed };
}

module.exports = { runOnce };
