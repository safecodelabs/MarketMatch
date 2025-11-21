// src/utils/sheets.js
require("dotenv").config();

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

let credentials;

// ✅ 1. Load Google Sheets credentials
try {
  if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);

    // Fix private key format
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");

    console.log("✅ Loaded Google Sheets credentials from environment variables.");
  } else {
    const CREDENTIALS_PATH = path.resolve(
      process.cwd(),
      "credentials/credentials-sheets.json"
    );

    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));

    // Fix private key format
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");

    console.log("✅ Loaded Google Sheets credentials from local file.");
  }
} catch (error) {
  console.error("❌ Failed to load Google Sheets credentials:", error.message);
  throw new Error("Google Sheets credentials missing or invalid");
}

// ✅ 2. Define required scopes
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// ✅ 3. Authorize service account
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  SCOPES
);

// ✅ 4. Sheets API client
const sheets = google.sheets({ version: "v4", auth });

// ✅ 5. Load sheet ID safely (no Github leaks)
const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID || "YOUR_LOCAL_DEV_SHEET_ID";

// If running local with missing ID → warn user
if (!process.env.GOOGLE_SHEETS_ID) {
  console.warn("⚠️  Using local fallback Sheet ID. Set GOOGLE_SHEETS_ID in env.");
}

// ✅ 6. Fetch housing data
async function getHousingData() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "housing!A2:G",
    });

    const rows = response.data.values || [];
    return rows.map(
      ([
        id,
        name,
        location,
        property_type,
        price,
        contact,
        description,
      ]) => ({
        id,
        name,
        location,
        property_type,
        price,
        contact,
        description,
      })
    );
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
          [
            lead.id,
            lead.name,
            lead.location,
            lead.property_type,
            lead.price,
            lead.contact,
            lead.description,
          ],
        ],
      },
    });

    console.log("✅ Lead added successfully!");
  } catch (error) {
    console.error("❌ Error adding lead:", error.message);
  }
}

module.exports = { getHousingData, addHousingLead };
