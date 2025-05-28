const { google } = require('googleapis');
const path = require('path');
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../../../creds/cred-sheets.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'AdContacts';

async function fetchAdContacts(city, type) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:E`,
  });

  const rows = response.data.values || [];

  return rows
    .filter(row => row[0]?.toLowerCase() === city.toLowerCase() && row[2]?.toLowerCase() === type.toLowerCase())
    .map(row => `📍 ${row[1]} – Contact: ${row[3] || 'N/A'} ${row[4] ? `(${row[4]})` : ''}`);
}

module.exports = { fetchAdContacts };