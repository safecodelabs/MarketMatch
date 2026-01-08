// utils/jobParser.js
// Lightweight heuristic parser for free-text job postings

const PHONE_RE = /(?:(?:\+91|91)?\s*[-\s.]*)?([6-9]\d{9})/g;
const SALARY_RE = /₹?\s?([\d,]+)(?:\s*[–-]\s*₹?\s?([\d,]+))?/i;
const EXPERIENCE_RE = /(\b\d+\s*(?:years|yrs|year|months|month|mos|mo)\b)|\b(min\s*)?\d+\s*months\b|\b(fresher|freshers|no experience|no-experience)\b/i;

const ROLE_SYNONYMS = [
  { keys: ['customer service', 'customer support', 'bpo', 'voice process', 'voice process', 'voice'], role: 'customer_service' },
  { keys: ['international travel', 'international travel voice', 'travel voice'], role: 'voice_process' },
  { keys: ['driver', 'delivery driver', 'delivery'], role: 'driver' },
  { keys: ['developer', 'frontend', 'backend', 'full stack'], role: 'developer' },
  { keys: ['sales', 'telecaller', 'tele-caller'], role: 'sales' },
  { keys: ['maid', 'domestic help'], role: 'maid' }
];

function normalizeRole(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const s of ROLE_SYNONYMS) {
    for (const k of s.keys) {
      if (t.includes(k)) return s.role;
    }
  }
  // fallback: sanitize and return short form
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function extractTitle(text) {
  // Prefer lines starting with "Hiring:" or similar
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const l of lines) {
    const m = l.match(/^\s*(Hiring|Job|Opening|Vacancy)\s*[:\-]?\s*(.+)/i);
    if (m) return m[2].trim();
  }
  // Fallback to first line
  return lines[0] || null;
}

function extractLocation(text) {
  // Look for parentheses containing a city e.g., (Gurgaon)
  const paren = text.match(/\(([^)]+)\)/);
  if (paren) return paren[1].trim();

  // Look for lines like "Location: Gurgaon" or ending city names
  const locLine = text.match(/location\s*[:\-]\s*([A-Za-z\s,-]+)/i);
  if (locLine) return locLine[1].trim();

  // Try to find city terms near keywords like "in <City>"
  const inLoc = text.match(/in\s+([A-Za-z\s]{2,30})/i);
  if (inLoc) return inLoc[1].trim();

  return null;
}

function extractExperience(text) {
  const m = text.match(/(min\s*)?(\d+)\s*months?/i) || text.match(/(\d+)\s*years?/i);
  if (m) {
    let months = 0;
    if (/months?/i.test(m[0])) {
      months = parseInt(m[2] || m[1]);
    } else if (/years?/i.test(m[0])) {
      months = parseInt(m[1]) * 12;
    }
    return { minMonths: months, raw: m[0], level: months === 0 ? 'none' : (months <= 12 ? 'junior' : 'senior') };
  }
  if (/fresher|freshers|no experience|no-experience/i.test(text)) {
    return { minMonths: 0, raw: 'no experience', level: 'none' };
  }
  return { minMonths: null, raw: null, level: null };
}

function extractSalary(text) {
  const m = text.match(SALARY_RE);
  if (m) {
    const a = m[1] ? parseInt(m[1].replace(/,/g, '')) : null;
    const b = m[2] ? parseInt(m[2].replace(/,/g, '')) : null;
    return { min: a, max: b || a, raw: m[0] };
  }
  return { min: null, max: null, raw: null };
}

function extractContact(text) {
  const phones = [];
  let m;
  while ((m = PHONE_RE.exec(text)) !== null) {
    phones.push(m[1]);
    if (phones.length >= 2) break;
  }
  return phones.length ? phones[0] : null;
}

function extractPerks(text) {
  const m = text.match(/Perks\s*[:\-]\s*(.+)/i);
  if (m) {
    return m[1].split(/[,&\/]+/).map(p => p.trim()).filter(Boolean);
  }
  return null;
}

function parseJobPost(text) {
  const title = extractTitle(text);
  const location = extractLocation(text);
  const experience = extractExperience(text);
  const salary = extractSalary(text);
  const contact = extractContact(text);
  const perks = extractPerks(text);
  const immediateStart = /Immediate\s*joining|immediate\s*joining/i.test(text);

  // Role extraction: try to get from title or from first line
  let role = null;
  if (title) {
    // take content until parentheses or dash
    role = title.split(/\(|-|–|—/)[0].trim();
  }
  if (!role) {
    // fallback: look for "Hiring: <role>"
    const m = text.match(/Hiring\s*[:\-]?\s*([^\n\(]+)/i);
    if (m) role = m[1].trim();
  }

  const normalizedRole = normalizeRole(role || title || 'unknown');

  return {
    title,
    role: role || null,
    normalizedRole,
    location,
    experience,
    salary,
    contact,
    perks,
    immediateStart,
    rawText: text
  };
}

module.exports = {
  parseJobPost,
  normalizeRole
};
