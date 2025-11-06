// src/utils/sheets.js
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

let credentials;

// ✅ 1. Load credentials
try {
  // If env var is set (e.g., in Railway)
  if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
    console.log("✅ Loaded Google Sheets credentials from environment variables.");
  } else {
    // Else fallback to local file (for local dev)
    const CREDENTIALS_PATH = path.join(__dirname, "../../credentials/credentials-sheets.json");
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
    console.log("✅ Loaded Google Sheets credentials from local file.");
  }
} catch (error) {
  console.error("❌ Failed to load Google Sheets credentials:", error.message);
  throw new Error("Google Sheets credentials missing or invalid");
}

// ✅ 2. Define required scopes
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// ✅ 3. Authorize
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key.replace(/\\n/g, "\n"),
  SCOPES
);

// ✅ 4. Initialize Sheets API
const sheets = google.sheets({ version: "v4", auth });

// ✅ 5. Google Sheet ID
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

// ✅ 7. Append new housing lead
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
