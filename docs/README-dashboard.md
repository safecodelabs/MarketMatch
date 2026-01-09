Dashboard generation and GitHub Pages

The project includes an automated dashboard generator at `scripts/generate-dashboard.js` that queries Firestore and writes `docs/dashboard.html`.

Enabling the GitHub Action:
1. Add the Firebase service account JSON as a repo secret named `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
2. The workflow `.github/workflows/generate-dashboard.yml` will run on push and daily and commit `docs/dashboard.html`.
3. Enable GitHub Pages in the repository and set the source to the `docs/` folder.

Local usage:
- `npm run generate-dashboard` will generate `docs/dashboard.html` locally (requires env `GOOGLE_APPLICATION_CREDENTIALS_JSON` or a credentials file in `credentials/`).

Metrics included:
- total users
- total listings
- total urban help providers
- total jobs posted
- total job requests
- total messages (in/out)

Retry worker & alerting

- Run `npm run retry-notifications` to reattempt failed notifications. By default it skips 401 (auth) errors and will record and alert on repeated auth failures.
- Configure `ALERT_SLACK_WEBHOOK` (repo secret) to post critical alerts to a Slack channel.
- A test alert can be sent with `npm run test-alert`.