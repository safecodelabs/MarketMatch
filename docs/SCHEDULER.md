# Match & Notify Scheduler

This project supports three ways to run the `match-and-notify` worker periodically:

1. GitHub Actions (recommended for hosted deployments)
   - Workflow: `.github/workflows/match-and-notify.yml`
   - Runs hourly by default (cron: `0 * * * *`).
   - Make sure required secrets (Firebase service account, WhatsApp tokens) are configured in the repository `Secrets`.

2. In-process scheduler (run inside the server)
   - Enable by setting env var: `ENABLE_SCHEDULED_MATCH_NOTIFY=1`
   - Optional env vars:
     - `MATCH_NOTIFY_INTERVAL_MINUTES` (default 60)
     - `MATCH_DAYS_WINDOW` (default 7)
     - `NOTIFY_MAX_RETRIES` (default 3)
   - The server will run the worker once on startup and then every `MATCH_NOTIFY_INTERVAL_MINUTES`.

3. Manual trigger (admin endpoint)
   - `POST /admin/run-match-notify` with `token` (use `ADMIN_TOKEN` or default `admin123`) in body or `x-admin-token` header.

Public dashboard (optional)
- To enable a public JSON metrics endpoint for live dashboards, set:
  - `ENABLE_PUBLIC_DASHBOARD=1`
  - `MATCH_DASHBOARD_ALLOWED_ORIGINS='*'` (or list of allowed origins, comma-separated)
- The endpoint will be available at `GET /public/dashboard-metrics` and returns totals plus a small listing breakdown. The dashboard hosted on GitHub Pages can poll this endpoint to show near‑real time numbers.
- Security: enabling public dashboard exposes only aggregated metrics (no secrets). For extra control, restrict `MATCH_DASHBOARD_ALLOWED_ORIGINS` to your GitHub Pages origin (e.g., `https://your-org.github.io`).
   - You can pass `daysWindow`, `maxRetries`, and `includeAuthErrors` in the POST body.

Usage examples
- Run locally via NPM script:
  - `npm run match-notify`

- Cron entry (server instance):
  - `*/60 * * * * cd /path/to/project && /usr/bin/node scripts/run-match-notify.js >> /var/log/match-notify.log 2>&1`

Security
- For GitHub Actions, configure secrets for Firestore / API credentials.
- For admin endpoint, set a strong `ADMIN_TOKEN` and restrict access (IP, auth) in production.

Troubleshooting
- If notifications fail due to auth (401), the worker will emit an alert and skip retries for those requests until credentials are fixed.
