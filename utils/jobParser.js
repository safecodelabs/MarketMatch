// utils/jobParser.js
// Lightweight heuristic parser for free-text job postings (single-line and multi-line formats)

const PHONE_RE = /(?:(?:\+91|91)?\s*[-\s.]*)?([6-9]\d{9})/g;
const SALARY_RE = /(?:ctc|salary|upto|up to|from)?\s*(?:upto|up to|from)?\s*(?:₹|Rs\.?)?\s*([\d.,]+)\s*(?:lpa|lac|cr|crore|k|thousand|\/month|\/year)?/i;
const EXPERIENCE_RE = /(\b\d+\s*(?:years|yrs|year|months|month|mos|mo)\b)|\b(min\s*)?\d+\s*months\b|\b(fresher|freshers|no experience|no-experience)\b/i;

const ROLE_SYNONYMS = [
  { keys: ['international travel', 'international travel voice', 'travel voice', 'voice process', 'voice-only'], role: 'voice_process' },
  { keys: ['team lead', 'team leader', 'lead'], role: 'team_lead' },
  { keys: ['customer service', 'customer support', 'bpo'], role: 'customer_service' },
  { keys: ['driver', 'delivery driver', 'delivery'], role: 'driver' },
  { keys: ['developer', 'frontend', 'backend', 'full stack', 'engineer'], role: 'developer' },
  { keys: ['sales', 'telecaller', 'tele-caller', 'business development'], role: 'sales' },
  { keys: ['maid', 'domestic help', 'househelp'], role: 'maid' }
];

function normalizeRole(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const s of ROLE_SYNONYMS) {
    for (const k of s.keys) {
      if (t.includes(k)) return s.role;
    }
  }
  return t.replace(/[^a-z0-9 ]/g, '').trim();
}

function extractTitleFromStructured(text) {
  // Look for "designation:" field first (preferred in structured format)
  const designationMatch = text.match(/designation\s*[:\-]?\s*(.+?)(?:\n|$)/i);
  if (designationMatch) return designationMatch[1].trim();

  // Then look for "hiring:" patterns
  const hiringMatch = text.match(/hiring\s*[:\-]?\s*(.+?)(?:\n|$)/i);
  if (hiringMatch) return hiringMatch[1].trim();

  // Fallback to first non-empty line
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines[0] || null;
}

function extractLocationFromStructured(text) {
  // Look for "location:" field - stop at pipe (|) or newline
  const match = text.match(/location\s*[:\-]?\s*([^\n|]+)/i);
  if (match) {
    const loc = match[1].trim().split('|')[0].trim();
    return loc || null;
  }
  return null;
}

function extractExperienceFromStructured(text) {
  // Look for "requirement:" or "experience:" fields across multiple lines
  // The requirement section might span multiple lines, so we need to capture more context
  const requirementMatch = text.match(/\*?requirement\*?\s*[:\-]?\s*([\s\S]+?)(?:\n\n|$)/i);
  if (requirementMatch) {
    const requirementText = requirementMatch[1];
    const yrsMatch = requirementText.match(/(\d+)\s*(?:years?|yrs?)\s*(?:experience|exp)?/i);
    if (yrsMatch) {
      const months = parseInt(yrsMatch[1]) * 12;
      return {
        minMonths: months,
        raw: yrsMatch[0],
        level: months <= 12 ? 'junior' : (months <= 36 ? 'mid' : 'senior')
      };
    }
  }

  // Also try direct experience line
  const expMatch = text.match(/experience\s*[:\-]?\s*(.+?)(?:\n|$)/i);
  if (expMatch) {
    const expText = expMatch[1];
    const yrsMatch = expText.match(/(\d+)\s*(?:years?|yrs?)\s*(?:experience|exp)?/i);
    if (yrsMatch) {
      const months = parseInt(yrsMatch[1]) * 12;
      return {
        minMonths: months,
        raw: yrsMatch[0],
        level: months <= 12 ? 'junior' : (months <= 36 ? 'mid' : 'senior')
      };
    }
  }

  return { minMonths: null, raw: null, level: null };
}

function extractSalaryFromStructured(text) {
  // Look for "ctc:" or "salary:" field - capture everything until newline or pipe
  const ctcMatch = text.match(/(?:ctc|salary)\s*[:\-]?\s*(?:up to|upto|from)?\s*([^\n|]+)/i);
  if (ctcMatch) {
    const salaryText = ctcMatch[1].trim();
    // Parse "10 lpa + incentives" or "₹10,00,000" etc
    const numMatch = salaryText.match(/([\d.,]+)\s*(?:lpa|lac|cr|crore|k|thousand)?/i);
    if (numMatch) {
      let amount = parseFloat(numMatch[1].replace(/,/g, ''));
      // If it's in LPA, convert to approx annual value (in thousands)
      if (/lpa/i.test(salaryText)) {
        amount = amount * 100; // 10 lpa = 1000k
      }
      return { min: amount, max: amount, raw: salaryText };
    }
  }
  return { min: null, max: null, raw: null };
}

function extractContactFromStructured(text) {
  const phones = [];
  let m;
  while ((m = PHONE_RE.exec(text)) !== null) {
    phones.push(m[1]);
    if (phones.length >= 2) break;
  }
  return phones.length ? phones[0] : null;
}

function extractPerksFromStructured(text) {
  const m = text.match(/perks?\s*[:\-]?\s*(.+?)(?:\n|$)/i);
  if (m) {
    return m[1].split(/[,&\/]+/).map(p => p.trim()).filter(Boolean);
  }
  return null;
}

function parseJobPost(text) {
  // Detect if it's a structured (multi-line) or simple (single-line) format
  const isStructured = text.includes('\n') && (text.match(/:/g) || []).length >= 2;

  let result;
  if (isStructured) {
    result = parseStructuredJobPost(text);
  } else {
    result = parseSimpleJobPost(text);
  }

  return result;
}

function parseStructuredJobPost(text) {
  const title = extractTitleFromStructured(text);
  const location = extractLocationFromStructured(text);
  const experience = extractExperienceFromStructured(text);
  const salary = extractSalaryFromStructured(text);
  const contact = extractContactFromStructured(text);
  const perks = extractPerksFromStructured(text);
  const immediateStart = /walk.?in|immediate|joining/i.test(text);

  let role = null;
  if (title) {
    // Extract role: remove parenthetical content and trim
    role = title.split(/[(\-]/)[0].trim();
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
    rawText: text,
    format: 'structured'
  };
}

function parseSimpleJobPost(text) {
  const title = extractTitleSimple(text);
  const location = extractLocationSimple(text);
  const experience = extractExperienceSimple(text);
  const salary = extractSalarySimple(text);
  const contact = extractContactFromStructured(text);
  const perks = extractPerksSimple(text);
  const immediateStart = /Immediate\s*joining|immediate\s*joining/i.test(text);

  let role = null;
  if (title) {
    role = title.split(/\(|-|–|—/)[0].trim();
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
    rawText: text,
    format: 'simple'
  };
}

function extractTitleSimple(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const l of lines) {
    const m = l.match(/^\s*(Hiring|Job|Opening|Vacancy)\s*[:\-]?\s*(.+)/i);
    if (m) return m[2].trim();
  }
  return lines[0] || null;
}

function extractLocationSimple(text) {
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

function extractExperienceSimple(text) {
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

function extractSalarySimple(text) {
  const m = text.match(/(?:upto|up to|from)?\s*₹?\s*([\d,]+)(?:\s*[–-]\s*(?:₹?\s*)?([\d,]+))?/i);
  if (m) {
    const a = m[1] ? parseInt(m[1].replace(/,/g, '')) : null;
    const b = m[2] ? parseInt(m[2].replace(/,/g, '')) : null;
    return { min: a, max: b || a, raw: m[0] };
  }
  return { min: null, max: null, raw: null };
}

function extractPerksSimple(text) {
  const m = text.match(/Perks\s*[:\-]\s*(.+)/i);
  if (m) {
    return m[1].split(/[,&\/]+/).map(p => p.trim()).filter(Boolean);
  }
  return null;
}

module.exports = {
  parseJobPost,
  normalizeRole
};
