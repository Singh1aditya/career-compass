import Papa from "papaparse";

export interface CSVRow {
  [key: string]: string;
}

export interface MappingConfig {
  [csvColumn: string]: string | null; // CSV column -> database field
}

export interface ContactPreview {
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  role?: string;
  contact_type: string;
  notes?: string;
  duplicateMatch?: string; // Email of potential duplicate
}

export interface ImportResult {
  success: boolean;
  created: number;
  duplicates: number;
  errors: string[];
}

const DEFAULT_CONTACT_TYPE = "other";
const CONTACT_FIELDS = [
  "name",
  "email",
  "phone",
  "company_name",
  "role",
  "contact_type",
  "notes",
];

/**
 * Parse CSV file and return rows
 */
export function parseCSVFile(
  file: File
): Promise<{ rows: CSVRow[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const columns = Object.keys(results.data[0] || {});
        resolve({
          rows: results.data,
          columns,
        });
      },
      error: (error: any) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

/**
 * Auto-detect column mappings based on CSV headers
 */
export function detectColumnMappings(csvColumns: string[]): MappingConfig {
  const mapping: MappingConfig = {};
  const lowerColumns = csvColumns.map((c) => c.toLowerCase());

  for (const csvCol of csvColumns) {
    const lowerCol = csvCol.toLowerCase();

    // Try to match CSV column to database field
    if (
      lowerCol.includes("name") ||
      lowerCol.includes("contact") ||
      lowerCol === "person"
    ) {
      mapping[csvCol] = "name";
    } else if (lowerCol.includes("email") || lowerCol === "e-mail") {
      mapping[csvCol] = "email";
    } else if (lowerCol.includes("phone") || lowerCol.includes("telephone")) {
      mapping[csvCol] = "phone";
    } else if (lowerCol.includes("company")) {
      mapping[csvCol] = "company_name";
    } else if (lowerCol.includes("role") || lowerCol.includes("title")) {
      mapping[csvCol] = "role";
    } else if (lowerCol.includes("type")) {
      mapping[csvCol] = "contact_type";
    } else if (lowerCol.includes("note") || lowerCol.includes("comment")) {
      mapping[csvCol] = "notes";
    } else {
      mapping[csvCol] = null; // Unmapped column
    }
  }

  return mapping;
}

/**
 * Convert CSV row to contact using mapping
 */
export function mapRowToContact(
  row: CSVRow,
  mapping: MappingConfig
): ContactPreview {
  const contact: ContactPreview = {
    name: "",
    contact_type: DEFAULT_CONTACT_TYPE,
  };

  for (const [csvCol, dbField] of Object.entries(mapping)) {
    if (!dbField || !row[csvCol]) continue;

    const value = (row[csvCol] || "").trim();
    if (!value) continue;

    if (dbField === "name") contact.name = value;
    else if (dbField === "email") contact.email = value;
    else if (dbField === "phone") contact.phone = value;
    else if (dbField === "company_name") contact.company_name = value;
    else if (dbField === "role") contact.role = value;
    else if (dbField === "contact_type") contact.contact_type = value;
    else if (dbField === "notes") contact.notes = value;
  }

  // Validate required fields
  if (!contact.name) {
    contact.name = contact.email || "Unnamed Contact";
  }

  return contact;
}

/**
 * Detect duplicates based on email
 */
export function findDuplicates(
  contacts: ContactPreview[],
  existingEmails: Set<string>
): ContactPreview[] {
  const result: ContactPreview[] = [];
  const seenEmails = new Set<string>();

  for (const contact of contacts) {
    if (!contact.email) {
      result.push(contact);
      continue;
    }

    const lowerEmail = contact.email.toLowerCase();

    // Check if duplicate in import
    if (seenEmails.has(lowerEmail)) {
      result.push({
        ...contact,
        duplicateMatch: `Duplicate in import (appears ${
          contacts.filter((c) => c.email?.toLowerCase() === lowerEmail).length
        } times)`,
      });
      continue;
    }

    // Check if duplicate in existing database
    if (existingEmails.has(lowerEmail)) {
      result.push({
        ...contact,
        duplicateMatch: "Already exists in database",
      });
      continue;
    }

    seenEmails.add(lowerEmail);
    result.push(contact);
  }

  return result;
}

/**
 * Validate contacts before import
 */
export function validateContacts(contacts: ContactPreview[]): {
  valid: ContactPreview[];
  invalid: { contact: ContactPreview; error: string }[];
} {
  const valid: ContactPreview[] = [];
  const invalid: { contact: ContactPreview; error: string }[] = [];

  for (const contact of contacts) {
    const errors: string[] = [];

    if (!contact.name || contact.name.length < 2) {
      errors.push("Name is required and must be at least 2 characters");
    }

    if (contact.email && !isValidEmail(contact.email)) {
      errors.push("Invalid email format");
    }

    if (contact.phone && !isValidPhone(contact.phone)) {
      errors.push("Invalid phone format");
    }

    if (errors.length === 0) {
      valid.push(contact);
    } else {
      invalid.push({ contact, error: errors.join("; ") });
    }
  }

  return { valid, invalid };
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate phone format (basic)
 */
function isValidPhone(phone: string): boolean {
  // Accept any format with at least 7 digits
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7;
}

/**
 * Generate import summary
 */
export function generateImportSummary(
  total: number,
  valid: number,
  duplicates: number
) {
  return {
    total,
    valid,
    duplicates,
    willImport: valid - duplicates,
    skipped: total - valid,
  };
}

/**
 * Download template CSV
 */
export function downloadTemplate() {
  const headers = ["name", "email", "phone", "company", "role", "type", "notes"];
  const rows = [headers];

  // Add example row
  rows.push([
    "Jane Smith",
    "jane@example.com",
    "+1-555-0100",
    "Acme Corp",
    "Engineering Manager",
    "recruiter",
    "Met at conference",
  ]);

  const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "career-crm-contacts-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
