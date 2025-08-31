import { parse as parseDate, isValid as isValidDate, format as fmtDate } from "date-fns";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const EMAIL_FIXES: Record<string, string> = {
  "gmial.com":"gmail.com",
  "gmai.com":"gmail.com",
  "gnail.com":"gmail.com",
  "hotmial.com":"hotmail.com",
  "yahooo.fr":"yahoo.fr",
  "yahooo.com":"yahoo.com",
  "outlok.com":"outlook.com"
};
const DATE_FORMATS = ["dd/MM/yyyy","d/M/yyyy","yyyy-MM-dd","MM/dd/yyyy","dd.MM.yyyy","dd-MM-yyyy","yyyy/MM/dd"];

export function normalizeEmail(v: string): { value: string; valid: boolean; changed: boolean } {
  const raw = (v || "").trim();
  if (!raw) return { value: "", valid: false, changed: false };
  let val = raw.toLowerCase();
  const m = val.match(/@([^@]+)$/);
  if (m) {
    const dom = m[1];
    const fix = EMAIL_FIXES[dom];
    if (fix) val = val.replace(/@[^@]+$/, "@"+fix);
  }
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  return { value: val, valid, changed: val !== raw };
}

export function normalizePhone(v: string, defaultCountry: "FR"|"US"|"GB" = "FR"): { value: string; valid: boolean; changed: boolean } {
  const raw = (v||"").toString().trim();
  if (!raw) return { value: "", valid: false, changed: false };
  const cleaned = raw.replace(/[^\d+]/g, "");
  const p = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!p || !p.isValid()) return { value: raw, valid: false, changed: false };
  const e164 = p.number; // +33...
  return { value: e164, valid: true, changed: e164 !== raw };
}

export function normalizeDateISO(v: string): { value: string; valid: boolean; changed: boolean } {
  const raw = (v||"").trim();
  if (!raw) return { value: "", valid: false, changed: false };
  for (const f of DATE_FORMATS) {
    const d = parseDate(raw, f, new Date());
    if (isValidDate(d)) {
      const iso = fmtDate(d, "yyyy-MM-dd");
      return { value: iso, valid: true, changed: iso !== raw };
    }
  }
  const d2 = new Date(raw);
  if (!isNaN(d2.getTime())) {
    const iso = fmtDate(d2, "yyyy-MM-dd");
    return { value: iso, valid: true, changed: iso !== raw };
  }
  return { value: raw, valid: false, changed: false };
}

export function normalizeNumber(v: string): { value: string; valid: boolean; changed: boolean; num?: number } {
  const raw = (v||"").trim();
  if (!raw) return { value: "", valid: false, changed: false };
  let s = raw.replace(/\s|’|'/g, ""); // supprime espaces / apostrophes
  if (s.includes(",") && s.includes(".")) {
    // suppose . milliers, , décimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  const valid = !Number.isNaN(n);
  return { value: valid ? s : raw, valid, changed: valid && s !== raw, num: valid ? n : undefined };
}

export type ColumnHint = "email"|"phone"|"date"|"number"|"text";
export function inferColumnType(column: string): ColumnHint {
  const c = column.toLowerCase();
  if (c.includes("mail")) return "email";
  if (c.includes("phone") || c.includes("tel") || c.includes("télé")) return "phone";
  if (c.includes("date")) return "date";
  if (c.includes("montant") || c.includes("salaire") || c.includes("prix") || c.includes("amount")) return "number";
  return "text";
}

export type DiffCell = {
  rowIdx: number;
  column: string;
  before: string;
  after: string;
  rule: string;
  confidence: number;
};

export function detectOutliersIQR(nums: number[]): Set<number> {
  if (nums.length < 5) return new Set();
  const sorted = [...nums].sort((a,b)=>a-b);
  const q1 = sorted[Math.floor(sorted.length*0.25)];
  const q3 = sorted[Math.floor(sorted.length*0.75)];
  const iqr = q3 - q1;
  const low = q1 - 1.5*iqr;
  const high = q3 + 1.5*iqr;
  const idx = new Set<number>();
  nums.forEach((v,i)=>{ if (v < low || v > high) idx.add(i); });
  return idx;
}

export function buildUniqKey(row: Record<string,string>): string {
  const keys = Object.keys(row);
  // priorité email / phone / nom+ville
  const emailKey = keys.find(k=>k.toLowerCase().includes("mail"));
  const phoneKey = keys.find(k=>k.toLowerCase().includes("phone")||k.toLowerCase().includes("tel"));
  if (emailKey && row[emailKey]) return "E:"+row[emailKey].trim().toLowerCase();
  if (phoneKey && row[phoneKey]) return "P:"+row[phoneKey].replace(/[^\d+]/g,"");
  return "R:"+JSON.stringify(keys.sort().map(k=>[k,(row[k]||"").toLowerCase().trim()]));
}

/**
 * Applique des corrections "vraies". Renvoie :
 * - rowsFixed : lignes corrigées
 * - diffs     : liste des diffs cellule par cellule
 * - stats     : invalid par colonne
 * - duplicates: indices de lignes marquées comme doublons (sauf 1ère occurrence)
 */
export function cleanDataset(
  rows: Record<string,string>[],
  options?: { impute?: boolean; defaultCountry?: "FR"|"US"|"GB" }
){
  const impute = !!options?.impute;
  const defaultCountry = options?.defaultCountry ?? "FR";
  const diffs: DiffCell[] = [];
  const statsInvalid: Record<string, number> = {};
  const colTypes: Record<string, ColumnHint> = {};
  const columns = Object.keys(rows[0] ?? {});
  columns.forEach(c=> colTypes[c] = inferColumnType(c));

  // Première passe : normalisation et collecte pour IQR
  const numericCols = columns.filter(c => colTypes[c]==="number");
  const numericArrays: Record<string, number[]> = {};
  numericCols.forEach(c => numericArrays[c]=[]);

  const normalized = rows.map((r, idx) => {
    const nr: Record<string,string> = {...r};
    columns.forEach((c) => {
      const hint = colTypes[c];
      const v = r[c] ?? "";
      let after = v;
      let rule = "";
      let ok = true;
      if (hint === "email") {
        const { value, valid, changed } = normalizeEmail(v);
        after = value; ok = valid; if (changed) rule="email_fix";
      } else if (hint==="phone") {
        const { value, valid, changed } = normalizePhone(v, defaultCountry);
        after = value; ok = valid; if (changed) rule="phone_e164";
      } else if (hint==="date") {
        const { value, valid, changed } = normalizeDateISO(v);
        after = value; ok = valid; if (changed) rule="date_iso";
      } else if (hint==="number") {
        const { value, valid, changed, num } = normalizeNumber(v);
        after = value; ok = valid; if (changed) rule="num_locale";
        if (ok && num!==undefined) numericArrays[c].push(num);
      } else {
        // trim
        after = (v||"").toString().trim();
        ok = true;
        if (after !== v) rule = "trim";
      }

      if (!ok) {
        statsInvalid[c] = (statsInvalid[c] ?? 0) + 1;
      }

      if (after !== v) {
        diffs.push({ rowIdx: idx, column: c, before: v, after, rule: rule || "normalize", confidence: hint==="text" ? 0.8 : 0.95 });
        nr[c] = after;
      }
    });
    return nr;
  });

  // Outliers (marque seulement ; correction manuelle possible plus tard)
  const outlierIdxByCol: Record<string, Set<number>> = {};
  numericCols.forEach(c=>{
    const series = normalized.map(r => Number(normalizeNumber(r[c]).num ?? NaN)).filter(n=>!Number.isNaN(n));
    outlierIdxByCol[c] = detectOutliersIQR(series);
  });

  // Imputation (optionnelle)
  if (impute) {
    columns.forEach((c)=>{
      const hint = colTypes[c];
      const colVals = normalized.map(r=>r[c]);
      if (hint==="number") {
        const nums = colVals.map(v=>normalizeNumber(v).num).filter(n=>n!==undefined) as number[];
        if (nums.length) {
          const sorted = [...nums].sort((a,b)=>a-b);
          const median = sorted[Math.floor(sorted.length/2)];
          normalized.forEach((r,idx)=>{
            if (!r[c]) {
              diffs.push({ rowIdx: idx, column: c, before: "", after: String(median), rule: "impute_median", confidence: 0.85 });
              r[c] = String(median);
            }
          });
        }
      } else {
        // mode pour catégoriel / texte
        const freq = new Map<string, number>();
        colVals.forEach(v => { if (v) freq.set(v, (freq.get(v)??0)+1); });
        const mode = [...freq.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
        if (mode) {
          normalized.forEach((r,idx)=>{
            if (!r[c]) {
              diffs.push({ rowIdx: idx, column: c, before: "", after: mode, rule: "impute_mode", confidence: 0.8 });
              r[c] = mode;
            }
          });
        }
      }
    });
  }

  // Déduplication par clé
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  normalized.forEach((r, idx)=>{
    const key = buildUniqKey(r);
    if (seen.has(key)) duplicates.add(idx);
    else seen.add(key);
  });

  return { rowsFixed: normalized, diffs, statsInvalid, duplicates, outlierIdxByCol, colTypes };
}
