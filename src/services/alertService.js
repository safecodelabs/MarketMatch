const axios = require('axios');
const multiLanguage = require('../../utils/multiLanguage');

// Simple alert service: logs to console and optionally posts to Slack via webhook URL
// Env vars:
// - ALERT_SLACK_WEBHOOK (optional) - if present, POSTs { text }
// - ALERT_EMAIL_TO (optional) - placeholder (not implemented)

async function alert(level, subject, details = {}) {
  const short = `[ALERT] ${level.toUpperCase()} - ${subject}`;
  console.error(short, details && details.message ? `: ${details.message}` : '');

  // Post to Slack if webhook provided
  const webhook = process.env.ALERT_SLACK_WEBHOOK;
  if (webhook) {
    try {
      await axios.post(webhook, { text: `${short}\n${details && details.message ? details.message : ''}` });
      console.log('✅ [ALERT] Sent Slack alert');
    } catch (err) {
      console.error('❌ [ALERT] Failed to send Slack alert:', err.message || err);
    }
  }

  // Placeholder for email alerts
  if (process.env.ALERT_EMAIL_TO) {
    console.log(`📧 [ALERT] Would send email to ${process.env.ALERT_EMAIL_TO} with subject "${subject}"`);
    // Future: integrate nodemailer if needed
  }
}

module.exports = { alert };
