// src/lib/cleaning.ts
// Premium clean module: robust normalization, audit log, duplicates, outliers (IQR)

import { parse as parseDate, isValid as isValidDate, format as fmtDate } from "date-fns";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// ---------- Email / Phone / Date Normalizers ----------

const EMAIL_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "yahooo.fr": "yahoo.fr",
  "yahooo.com": "yahoo.com",
  "outlok.com": "outlook.com",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DATE_FORMATS = [
  "dd/MM/yyyy",
  "d/M/yyyy",
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "dd.MM.yyyy",
  "dd-MM-yyyy",
  "yyyy/MM/dd",
];

export function normalizeEmail(v: string): { value: string; valid: boolean; changed: boolean } {
  const raw = (v || "").trim();
  if (!raw) return { value: "", valid: false, changed: false };
  let val = raw.toLowerCase();
  const m = val.match(/@([^@]+)$/);
  if (m) {
    const dom = m[1];
    const fix = EMAIL_FIXES[dom];
    if (fix) val = val.replace(/@[^@]+$/, "@" + fix);
  }
  const valid = EMAIL_RE.test(val);
  return { value: valid ? val : val, valid, changed: val !== raw };
}

export function normalizePhone(
  v: string,
  defaultCountry: "FR" | "US" | "GB" = "FR"
): { value: string; valid: boolean; changed: boolean } {
  const raw = (v || "").toString().trim();
  if (!raw) return { value: "", valid: false, changed: false };
  // keep only digits and leading '+'
  const cleaned = raw.replace(/[^\d+]/g, "");
  const p = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!p || !p.isValid()) return { value: raw, valid: false, changed: false };
  const e164 = p.number; // +33...
  return { value: e164, valid: true, changed: e164 !== raw };
}

export function normalizeDateISO(v: string): { value: string; valid: boolean; changed: boolean } {
  const raw = (v || "").trim();
  if (!raw) return { value: "", valid: false, changed: false };

  for (const f of DATE_FORMATS) {
    const d = parseDate(raw, f, new Date());
    if (isValidDate(d)) {
      const iso = fmtDate(d, "yyyy-MM-dd");
      return { value: iso, valid: true, changed: iso !== raw };
    }
  }
  // Last chance: native Date
  const d2 = new Date(raw);
  if (!isNaN(d2.getTime())) {
    const iso = fmtDate(d2, "yyyy-MM-dd");
    return { value: iso, valid: true, changed: iso !== raw };
  }
  return { value: raw, valid: false, changed: false };
}

export function normalizeNumber(v: string): {
  value: string;
  valid: boolean;
  changed: boolean;
  num?: number;
} {
  const raw = (v || "").trim();
  if (!raw) return { value: "", valid: false, changed: false };
  let s = raw.replace(/\s|’|'/g, ""); // remove spaces / apostrophes

  if (s.includes(",") && s.includes(".")) {
    // assume '.' is thousands, ',' is decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  const valid = !Number.isNaN(n);
  return { value: valid ? s : raw, valid, changed: valid && s !== raw, num: valid ? n : undefined };
}

// ---------- Type inference (name-based) ----------

export type ColumnHint = "email" | "phone" | "date" | "number" | "text";

export function inferColumnType(column: string): ColumnHint {
  const c = column.toLowerCase();
  if (c.includes("mail")) return "email";
  if (c.includes("phone") || c.includes("tel") || c.includes("télé")) return "phone";
  if (c.includes("birth") || c.includes("date") || c.includes("dob")) return "date";
  if (
    c.includes("montant") ||
    c.includes("salaire") ||
    c.includes("prix") ||
    c.includes("amount") ||
    c === "id" ||
    c.includes("age")
  )
    return "number";
  return "text";
}

// ---------- Outliers (IQR) ----------

export function detectOutliersIQR(nums: number[]): Set<number> {
  if (nums.length < 5) return new Set();
  const sorted = [...nums].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const idx = new Set<number>();
  nums.forEach((v, i) => {
    if (v < low || v > high) idx.add(i);
  });
  return idx;
}

// ---------- Unique key for dedup ----------

export function buildUniqKey(row: Record<string, string>): string {
  const keys = Object.keys(row);
  const emailKey = keys.find((k) => k.toLowerCase().includes("mail"));
  const phoneKey = keys.find((k) => k.toLowerCase().includes("phone") || k.toLowerCase().includes("tel"));
  if (emailKey && row[emailKey]) return "E:" + row[emailKey].trim().toLowerCase();
  if (phoneKey && row[phoneKey]) return "P:" + row[phoneKey].replace(/[^\d+]/g, "");
  return "R:" + JSON.stringify(keys.sort().map((k) => [k, (row[k] || "").toLowerCase().trim()]));
}

// ---------- Cleaning pipeline ----------

export type DiffCell = {
  rowIdx: number;
  column: string;
  before: string;
  after: string;
  rule: string;
  confidence: number;
};

export type CleanOptions = {
  impute?: boolean;               // default false
  defaultCountry?: "FR" | "US" | "GB";
  dropDuplicateStrategy?: "row" | "keep-first"; // "row" = drop dup rows, "keep-first" same effect here
};

export function cleanDataset(
  rows: Record<string, string>[],
  options?: CleanOptions
) {
  const impute = !!options?.impute;
  const defaultCountry = options?.defaultCountry ?? "FR";
  const diffs: DiffCell[] = [];
  const statsInvalid: Record<string, number> = {};
  const colTypes: Record<string, ColumnHint> = {};
  const columns = Object.keys(rows[0] ?? {});
  columns.forEach((c) => (colTypes[c] = inferColumnType(c)));

  // 1) Normalize pass + collect numeric series for outliers
  const numericCols = columns.filter((c) => colTypes[c] === "number");
  const normalized = rows.map((r, idx) => {
    const out: Record<string, string> = { ...r };

    for (let c of columns) {
      const hint = colTypes[c];
      const v = r[c] ?? "";
      let after = v;
      let ok = true;
      let rule = "";

      if (hint === "email") {
        const { value, valid, changed } = normalizeEmail(v);
        after = value; ok = valid; if (changed) rule = "email_fix";
      } else if (hint === "phone") {
        const { value, valid, changed } = normalizePhone(v, defaultCountry);
        after = value; ok = valid; if (changed) rule = "phone_e164";
      } else if (hint === "date") {
        const { value, valid, changed } = normalizeDateISO(v);
        after = value; ok = valid; if (changed) rule = "date_iso";
      } else if (hint === "number") {
        const { value, valid, changed } = normalizeNumber(v);
        after = value; ok = valid; if (changed) rule = "num_locale";
      } else {
        const trimmed = (v || "").toString().trim();
        ok = true;
        if (trimmed !== v) { after = trimmed; rule = "trim"; }
      }

      if (!ok) statsInvalid[c] = (statsInvalid[c] ?? 0) + 1;

      if (after !== v) {
        diffs.push({
          rowIdx: idx,
          column: c,
          before: v,
          after,
          rule: rule || "normalize",
          confidence: hint === "text" ? 0.8 : 0.95,
        });
        out[c] = after;
      }
    }
    return out;
  });

  // 2) Outliers (IQR) – mark only
  const outlierIdxByCol: Record<string, Set<number>> = {};
  numericCols.forEach((c) => {
    const series: number[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const num = normalizeNumber(normalized[i][c]).num;
      if (num !== undefined) series.push(num);
      else series.push(NaN);
    }
    const cleanSeries = series.filter((x) => !Number.isNaN(x)) as number[];
    outlierIdxByCol[c] = detectOutliersIQR(cleanSeries);
  });

  // 3) Optional imputation
  if (impute) {
    for (let c of columns) {
      const hint = colTypes[c];
      if (hint === "number") {
        const nums: number[] = [];
        normalized.forEach((r) => {
          const n = normalizeNumber(r[c]).num;
          if (n !== undefined) nums.push(n);
        });
        if (nums.length) {
          nums.sort((a, b) => a - b);
          const median = nums[Math.floor(nums.length / 2)];
          normalized.forEach((r, idx) => {
            if (!r[c]) {
              diffs.push({ rowIdx: idx, column: c, before: "", after: String(median), rule: "impute_median", confidence: 0.85 });
              r[c] = String(median);
            }
          });
        }
      } else {
        const freq = new Map<string, number>();
        normalized.forEach((r) => {
          const val = r[c];
          if (val) freq.set(val, (freq.get(val) ?? 0) + 1);
        });
        const mode = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (mode) {
          normalized.forEach((r, idx) => {
            if (!r[c]) {
              diffs.push({ rowIdx: idx, column: c, before: "", after: mode, rule: "impute_mode", confidence: 0.8 });
              r[c] = mode;
            }
          });
        }
      }
    }
  }

  // 4) Deduplicate rows by unique key (email/phone or row signature)
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  normalized.forEach((r, idx) => {
    const key = buildUniqKey(r);
    if (seen.has(key)) {
      duplicates.add(idx);
    } else {
      seen.add(key);
    }
  });

  return {
    rowsFixed: normalized,
    diffs,
    statsInvalid,
    duplicates,
    outlierIdxByCol,
    colTypes,
  };
}
