// src/utils/sheets.js
require("dotenv").config();

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

let credentials;

try {
  if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    console.log("✅ Loaded Google Sheets credentials from environment variables.");
  } else {
    const CREDENTIALS_PATH = path.resolve(process.cwd(), "credentials/credentials-sheets.json");
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    console.log("✅ Loaded Google Sheets credentials from local file.");
  }
} catch (error) {
  console.error("❌ Failed to load Google Sheets credentials:", error.message);
  throw new Error("Google Sheets credentials missing or invalid");
}

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.JWT(credentials.client_email, null, credentials.private_key, SCOPES);
const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "YOUR_LOCAL_DEV_SHEET_ID";
if (!process.env.GOOGLE_SHEETS_ID) {
  console.warn("⚠️  Using local fallback Sheet ID. Set GOOGLE_SHEETS_ID in env.");
}

/**
 * readSheetRange(range) -> returns { headers: [], rows: [[]] }
 */
async function readSheetRange(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });
  const values = res.data.values || [];
  const headers = values.length ? values[0].map(h => (h || "").toString().trim()) : [];
  const rows = values.length > 1 ? values.slice(1) : [];
  return { headers, rows };
}

/**
 * getHousingData()
 * Reads 'housing' sheet but infers columns from header row.
 * Returns array of objects with keys derived from header row lowercased.
 */
async function getHousingData() {
  try {
    // Read full housing sheet (first 1000 rows) — adjust as needed
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "housing!A1:Z1000"
    });

    const values = data.values || [];
    if (values.length < 2) return [];

    const headers = values[0].map(h => (h || "").toString().trim().toLowerCase().replace(/\s+/g, "_"));
    const rows = values.slice(1);

    const items = rows.map(row => {
      const obj = {};
      headers.forEach((hdr, idx) => {
        obj[hdr] = row[idx] !== undefined ? row[idx] : "";
      });
      // keep common fallback keys
      obj.id = obj.id || obj.row_id || "";
      obj.name = obj.name || obj.owner || "";
      obj.location = obj.location || obj.city || "";
      obj.property_type = obj.property_type || obj.type || "";
      obj.price = obj.price || obj.price_inr || "";
      obj.contact = obj.contact || "";
      obj.description = obj.description || obj.details || "";
      return obj;
    });

    return items;
  } catch (error) {
    console.error("❌ Error fetching housing data:", error.message);
    return [];
  }
}

/**
 * addHousingLead(lead)
 * appends to housing sheet: id, name, location, property_type, price, contact, description
 */
async function addHousingLead(lead) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "housing!A:G",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            lead.id || `lead_${Date.now()}`,
            lead.name || "",
            lead.location || "",
            lead.property_type || "",
            lead.price || "",
            lead.contact || "",
            lead.description || ""
          ]
        ]
      }
    });

    console.log("✅ Lead added successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error adding lead:", error.message);
    return false;
  }
}

module.exports = { getHousingData, addHousingLead };
