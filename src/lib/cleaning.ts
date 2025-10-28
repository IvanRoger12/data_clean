// frontend/src/lib/cleaning.ts
import { parse, isValid, formatISO } from 'date-fns';
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

// --- Types ---

export type SemanticType = 'text' | 'number' | 'date' | 'email' | 'phone' | 'unknown';
export type ColTypeMap = { [header: string]: SemanticType };
export type RawData = Record<string, string | number | null | undefined>;
export type ParsedRow = Record<string, any>;
export type CleaningOptions = {
  imputeMissing: boolean;
  removeDuplicates: boolean;
  countryCode: CountryCode;
};
export type DiffLog = {
  rowIdx: number;
  col: string;
  before: any;
  after: any;
  type: 'normalize' | 'impute' | 'invalid';
};
export type CleaningReport = {
  proposalRows: ParsedRow[];
  finalRows: ParsedRow[];
  diffs: DiffLog[];
  invalidMap: Map<string, number[]>;
  duplicateIndices: Set<number>;
  outlierIdxByCol: Map<string, number[]>;
  colTypes: ColTypeMap;
  stats: {
    rowCount: number;
    colCount: number;
    corrections: number;
    duplicates: number;
    invalids: number;
    missing: number;
  };
};

// --- Constantes ---

const DATE_FORMATS = [
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'd/M/yyyy',
  'MM/dd/yyyy',
  'dd.MM.yyyy',
  'dd-MM-yyyy',
  'yyyy/MM/dd',
  'M/d/yyyy',
  "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
  'yyyy-MM-dd HH:mm:ss',
];

const EMAIL_DOMAIN_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com', // Ajouté depuis votre fichier
  'hotmal.com': 'hotmail.com',
  'hotnail.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.fr': 'yahoo.fr', // Ajouté
  'yahooo.com': 'yahoo.com', // Ajouté
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Inférence de Type ---

export function getColumnTypes(headers: string[]): ColTypeMap {
  const colTypes: ColTypeMap = {};
  for (const header of headers) {
    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes('email') || lowerHeader.includes('e-mail') || lowerHeader.includes('mail')) {
      colTypes[header] = 'email';
    } else if (
      lowerHeader.includes('phone') ||
      lowerHeader.includes('tel') ||
      lowerHeader.includes('mobile') ||
      lowerHeader.includes('télé')
    ) {
      colTypes[header] = 'phone';
    } else if (
      lowerHeader.includes('date') ||
      lowerHeader.includes('birth') ||
      lowerHeader.includes('dob')
    ) {
      colTypes[header] = 'date';
    } else if (
      lowerHeader.includes('amount') ||
      lowerHeader.includes('price') ||
      lowerHeader.includes('salaire') ||
      lowerHeader.includes('montant') ||
      lowerHeader.includes('prix') ||
      lowerHeader.includes('age') ||
      lowerHeader.includes('id')
    ) {
      colTypes[header] = 'number';
    } else if (
      lowerHeader.includes('city') ||
      lowerHeader.includes('ville') ||
      lowerHeader.includes('location') ||
      lowerHeader.includes('country')
    ) {
      colTypes[header] = 'text';
    } else {
      colTypes[header] = 'text'; // Par défaut 'text'
    }
  }
  return colTypes;
}

// --- Normaliseurs Individuels ---

function normalizeEmail(value: string | null | undefined): {
  value: string | null;
  valid: boolean;
} {
  if (value === null || value === undefined || value.trim() === '') {
    return { value: null, valid: true }; // Manquant n'est pas invalide
  }
  let email = value.trim().toLowerCase();
  const [local, domain] = email.split('@');
  if (domain && EMAIL_DOMAIN_FIXES[domain]) {
    email = `${local}@${EMAIL_DOMAIN_FIXES[domain]}`;
  }
  const valid = EMAIL_REGEX.test(email);
  return { value: valid ? email : value, valid }; // Retourne l'original si invalide
}

function normalizePhone(
  value: string | null | undefined,
  countryCode: CountryCode
): { value: string | null; valid: boolean } {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { value: null, valid: true };
  }
  const strValue = String(value).trim();
  try {
    const phoneNumber = parsePhoneNumberFromString(strValue, countryCode);
    if (phoneNumber && phoneNumber.isValid()) {
      return { value: phoneNumber.format('E.164'), valid: true };
    }
  } catch (error) {
    // libphonenumber peut échouer sur des formats très étranges
  }
  return { value: strValue, valid: false };
}

function normalizeDate(value: string | null | undefined): {
  value: string | null;
  valid: boolean;
} {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { value: null, valid: true };
  }
  const strValue = String(value).trim();
  const baseDate = new Date();
  for (const format of DATE_FORMATS) {
    const parsedDate = parse(strValue, format, baseDate);
    if (isValid(parsedDate)) {
      try {
        const iso = formatISO(parsedDate, { representation: 'date' });
        return { value: iso, valid: true };
      } catch (e) {
        // ignore, try next format
      }
    }
  }
  // Tentative native (votre "Last chance")
   const d2 = new Date(strValue);
   if (!isNaN(d2.getTime())) {
     const iso = formatISO(d2, { representation: 'date' });
     return { value: iso, valid: true };
   }
  return { value: strValue, valid: false };
}

function normalizeNumber(value: string | null | undefined): {
  value: number | null;
  valid: boolean;
} {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { value: null, valid: true };
  }
  let strValue = String(value).trim();
  
  // Gérer format FR/EU (espace millier, virgule décimale)
  strValue = strValue
    .replace(/\s|’|'/g, '') // "1 234,56" -> "1234,56" (gère aussi apostrophes)
    .replace(/,/g, '.'); // "1234,56" -> "1234.56"
    
  // Gérer cas "1.234.56" (milliers .), pas géré par votre code
  if (strValue.indexOf('.') < strValue.lastIndexOf('.')) {
    strValue = strValue.replace(/\./g, ''); // "1.234.56" -> "123456" (suppose pas de décimales)
  }

  const num = parseFloat(strValue);
  if (isNaN(num)) {
    return { value: null, valid: false }; // Mettre null si invalide
  }
  return { value: num, valid: true };
}

// --- Fonctions de Calcul (Stats) ---

function getOutliers(data: number[]): Set<number> {
  if (data.length < 4) return new Set();
  const sorted = [...data].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const outlierIndices = new Set<number>();
  data.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outlierIndices.add(index);
    }
  });
  return outlierIndices;
}

function getColumnMedian(data: (number | null)[]): number | null {
  const validData = data.filter(n => n !== null && !isNaN(n)) as number[];
  if (validData.length === 0) return null;
  const sorted = validData.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getColumnMode(data: (string | null)[]): string | null {
  const validData = data.filter(s => s !== null && s.trim() !== '');
  if (validData.length === 0) return null;
  const counts: Record<string, number> = {};
  let maxCount = 0;
  let mode: string | null = null;
  
  validData.forEach(s => {
    const val = s!;
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
      mode = val;
    }
  });
  return mode;
}

// --- Processeur Principal ---

export function processDataCleaning(
  originalData: RawData[],
  colTypes: ColTypeMap,
  options: CleaningOptions
): CleaningReport {
  
  const diffs: DiffLog[] = [];
  const invalidMap = new Map<string, number[]>();
  const outlierIdxByCol = new Map<string, number[]>();
  const proposalRows: ParsedRow[] = [];
  const rowHashes = new Map<string, number>();
  const duplicateIndices = new Set<number>();

  let stats = { corrections: 0, duplicates: 0, invalids: 0, missing: 0 };

  // --- Pass 1: Normalisation & Détection ---
  originalData.forEach((rawRow, rowIdx) => {
    const proposalRow: ParsedRow = {};
    let rowHash = '';
    
    for (const col of Object.keys(rawRow)) {
      const rawValue = rawRow[col];
      const type = colTypes[col] || 'text';
      let normalized: { value: any; valid: boolean } = { value: rawValue, valid: true };

      try {
        switch (type) {
          case 'email':
            normalized = normalizeEmail(rawValue as string);
            break;
          case 'phone':
            normalized = normalizePhone(rawValue as string, options.countryCode);
            break;
          case 'date':
            normalized = normalizeDate(rawValue as string);
            break;
          case 'number':
            normalized = normalizeNumber(rawValue as string);
            break;
          case 'text':
          default:
            const val = rawValue === null || rawValue === undefined ? null : String(rawValue).trim();
            normalized = { value: val, valid: true };
            break;
        }
      } catch (e) {
        console.error(`Error normalizing row ${rowIdx}, col ${col}:`, e);
        normalized = { value: rawValue, valid: false };
      }

      proposalRow[col] = normalized.value;
      
      // Construction du hash (inspiré de votre buildUniqKey)
      if (type === 'email') rowHash += `|E:${normalized.value}`;
      else if (type === 'phone') rowHash += `|P:${normalized.value}`;
      else rowHash += `|${normalized.value}`;

      // Log stats
      if (normalized.value === null) {
        stats.missing++;
      }
      if (!normalized.valid) {
        stats.invalids++;
        if (!invalidMap.has(col)) invalidMap.set(col, []);
        invalidMap.get(col)!.push(rowIdx);
        diffs.push({ rowIdx, col, before: rawValue, after: normalized.value, type: 'invalid' });
      }
      if (rawValue != normalized.value && normalized.valid && rawValue !== null) {
        stats.corrections++;
        diffs.push({ rowIdx, col, before: rawValue, after: normalized.value, type: 'normalize' });
      }
    }
    
    // Détection doublons
    if (rowHashes.has(rowHash)) {
      stats.duplicates++;
      duplicateIndices.add(rowIdx); // Marque celui-ci comme doublon
    } else {
      rowHashes.set(rowHash, rowIdx);
    }
    
    proposalRows.push(proposalRow);
  });

  // --- Pass 2: Outliers ---
  for (const col of Object.keys(colTypes)) {
    if (colTypes[col] === 'number') {
      const numData = proposalRows.map(row => row[col] as number | null).filter(n => n !== null) as number[];
      const outlierIndices = getOutliers(numData);
      
      // Map indices from numData back to original proposalRows indices
      const originalIndices = new Set<number>();
      let numDataIdx = 0;
      proposalRows.forEach((row, rowIdx) => {
        if(row[col] !== null) {
          if (outlierIndices.has(numDataIdx)) {
            originalIndices.add(rowIdx);
          }
          numDataIdx++;
        }
      });
      if (originalIndices.size > 0) {
        outlierIdxByCol.set(col, Array.from(originalIndices));
      }
    }
  }

  // --- Pass 3: Imputation (si activée) ---
  if (options.imputeMissing) {
    const imputationValues: Record<string, string | number | null> = {};
    
    // Calculer imputation
    for (const col of Object.keys(colTypes)) {
      if (colTypes[col] === 'number') {
        imputationValues[col] = getColumnMedian(proposalRows.map(row => row[col]));
      } else {
        imputationValues[col] = getColumnMode(proposalRows.map(row => row[col]));
      }
    }
    
    // Appliquer imputation
    proposalRows.forEach((row, rowIdx) => {
      for (const col of Object.keys(row)) {
        const isMissing = row[col] === null;
        // On impute aussi les invalides
        const isInvalid = invalidMap.get(col)?.includes(rowIdx); 
        
        if ((isMissing || isInvalid) && imputationValues[col] !== null) {
          const before = row[col];
          const after = imputationValues[col];
          row[col] = after;
          
          diffs.push({ rowIdx, col, before, after, type: 'impute' });
          
          // Mettre à jour les stats
          if (isMissing) stats.missing--;
          if (isInvalid) {
            stats.invalids--;
            // Retirer de la map invalide
            const invalidIdx = invalidMap.get(col)!.indexOf(rowIdx);
            if (invalidIdx > -1) invalidMap.get(col)!.splice(invalidIdx, 1);
          }
        }
      }
    });
  }

  // --- Pass 4: Suppression Doublons (si activée) ---
  let finalRows = [...proposalRows];
  if (options.removeDuplicates) {
    finalRows = finalRows.filter((_, rowIdx) => !duplicateIndices.has(rowIdx));
  }

  return {
    proposalRows,
    finalRows,
    diffs,
    invalidMap,
    duplicateIndices,
    outlierIdxByCol,
    colTypes,
    stats: {
      ...stats,
      rowCount: originalData.length,
      colCount: Object.keys(colTypes).length,
    }
  };
}
