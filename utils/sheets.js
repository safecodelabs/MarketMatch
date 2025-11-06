// src/utils/sheets.js
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// ✅ 1. Load Google Sheets credentials (separate from Firebase)
const CREDENTIALS_PATH = path.join(__dirname, "../../credentials/credentials-sheets.json");
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));

// ✅ 2. Define the required scopes for Google Sheets access
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// ✅ 3. Authorize with the Sheets service account
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key.replace(/\\n/g, "\n"),
  SCOPES
);

// ✅ 4. Initialize Sheets API
const sheets = google.sheets({ version: "v4", auth });

// ✅ 5. Your Google Sheet ID
const SPREADSHEET_ID = "17dJX69_h4TeL8_D7-Htzlzw9NdXvsCqkvBwbO-XerCE";

// ✅ 6. Fetch housing data
async function getHousingData() {
  try {
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
  } catch (error) {
    console.error("❌ Error fetching housing data:", error.message);
    return [];
  }
}

// ✅ 7. Append a new housing lead
async function addHousingLead(lead) {
  try {
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
    console.log("✅ Lead added successfully!");
  } catch (error) {
    console.error("❌ Error adding lead:", error.message);
  }
}

module.exports = { getHousingData, addHousingLead };
