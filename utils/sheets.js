// src/utils/googleSheets.js
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const CREDENTIALS_PATH = path.join(__dirname, "../../credentials/serviceAccount.json");
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key.replace(/\\n/g, "\n"),
  SCOPES
);

const sheets = google.sheets({ version: "v4", auth });

// Your spreadsheet ID (from the URL)
const SPREADSHEET_ID = "YOUR_SHEET_ID_HERE";

async function getHousingData() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "housing!A2:G", // skip headers
  });

  const rows = response.data.values || [];
  return rows.map(([id, name, location, property_type, price, contact, description]) => ({
    id,
    name,
    location,
    property_type,
    price,
    contact,
    description,
  }));
}

async function addHousingLead(lead) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "housing!A:G",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [lead.id, lead.name, lead.location, lead.property_type, lead.price, lead.contact, lead.description],
      ],
    },
  });
}

module.exports = { getHousingData, addHousingLead };
