// src/lib/quality.ts
// Premium quality scoring: robust type inference, 4D metrics + global score + summary

export type InferredType = "number" | "text" | "date";

export type ColumnReport = {
  inferredType: InferredType;
  missingPct: number;    // 0..100
  invalidPct: number;    // 0..100
  duplicatePct: number;  // 0..100 (only for key col like 'id' or if dedup used)
  issues: string[];      // ["missing","invalid","duplicates"]
};

export type DimensionScores = {
  completeness: number;  // 0..1
  validity: number;      // 0..1
  uniqueness: number;    // 0..1
  consistency: number;   // 0..1
  outliers_ok: number;   // 0..1 (set by caller if you compute it)
};

export type QualityReport = {
  perColumn: Record<string, ColumnReport>;
  dimensions: DimensionScores;
  globalScore: number; // 0..100
};

export function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function normalize01(v: number): number {
  if (v > 1) return Math.min(v / 100, 1);
  if (v < 0) return 0;
  return v;
}

export function interpretQuality(score: number): string {
  if (score >= 90) return "Excellent 👑 (Très haute qualité)";
  if (score >= 75) return "Bon ✅ (Qualité maîtrisée)";
  if (score >= 60) return "Moyen ⚠️ (Amélioration nécessaire)";
  return "Faible 🚨 (Risque élevé de mauvaise donnée)";
}

export type QualityMetrics = {
  completeness: number;   // 0..1 or 0..100
  validity: number;       // 0..1 or 0..100
  uniqueness: number;     // 0..1 or 0..100
  consistency: number;    // 0..1 or 0..100
  outliers_ok: number;    // 0..1 or 0..100
};

export function qualityScoreV2(m: QualityMetrics): number {
  const w = { completeness: 0.25, validity: 0.35, uniqueness: 0.15, consistency: 0.15, outliers_ok: 0.10 };
  const s =
    normalize01(m.completeness) * w.completeness +
    normalize01(m.validity) * w.validity +
    normalize01(m.uniqueness) * w.uniqueness +
    normalize01(m.consistency) * w.consistency +
    normalize01(m.outliers_ok) * w.outliers_ok;
  return Math.round(s * 100);
}

// --------- Type inference (value-based fallback) ---------

function inferTypeByValue(v: any): InferredType {
  if (v === null || v === undefined) return "text";
  const s = String(v).trim();
  if (!s) return "text";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(s)) return "date";
  if (!isNaN(Number(s))) return "number";
  return "text";
}

function inferType(colName: string, rows: any[]): InferredType {
  const name = colName.toLowerCase();
  // name-based hints
  if (["email", "mail"].some((k) => name.includes(k))) return "text";
  if (["phone", "tel", "télé"].some((k) => name.includes(k))) return "text";
  if (["birth", "dob", "date"].some((k) => name.includes(k))) return "date";
  if (["id", "age", "montant", "amount", "salaire", "prix"].some((k) => name.includes(k))) return "number";

  // value voting on sample
  const slice = rows.slice(0, 50);
  const votes: Record<InferredType, number> = { number: 0, text: 0, date: 0 };
  slice.forEach((r) => {
    votes[inferTypeByValue(r[colName])] = (votes[inferTypeByValue(r[colName])] || 0) + 1;
  });
  return (Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0] as InferredType);
}

// --------- Quality computation ---------

export function computeQualityReport(
  rows: any[],
  opts?: { keyCol?: string; outlierCols?: string[]; outlierIdxByCol?: Record<string, Set<number>> }
): QualityReport {
  const n = rows.length;
  const cols = n ? Object.keys(rows[0]) : [];
  const perColumn: Record<string, ColumnReport> = {};
  let totalMissing = 0;
  let totalInvalid = 0;
  let consistentCols = 0;
  let totalDup = 0;

  const keyCol = opts?.keyCol && cols.includes(opts.keyCol) ? opts.keyCol : (cols.includes("id") ? "id" : null);

  if (keyCol) {
    const seen = new Set<string>();
    rows.forEach((r) => {
      const k = String(r[keyCol] ?? "");
      if (k && seen.has(k)) totalDup++;
      seen.add(k);
    });
  }

  cols.forEach((c) => {
    const t = inferType(c, rows);
    let missing = 0, invalid = 0;

    for (let i = 0; i < n; i++) {
      const v = rows[i][c];
      const s = v === null || v === undefined ? "" : String(v).trim();
      if (!s) { missing++; continue; }
      if (t === "number" && isNaN(Number(s))) invalid++;
      if (t === "date" && !(/^\d{4}-\d{2}-\d{2}$/.test(s))) invalid++;
      // text => no invalid check by default
    }

    const duplicatePct = keyCol === c && n ? Math.round((totalDup / n) * 100) : 0;
    const missingPct = pct(missing, n);
    const invalidPct = pct(invalid, n);
    const issues: string[] = [];
    if (missingPct > 0) issues.push("missing");
    if (invalidPct > 0) issues.push("invalid");
    if (duplicatePct > 0) issues.push("duplicates");

    perColumn[c] = { inferredType: t, missingPct, invalidPct, duplicatePct, issues };

    totalMissing += missing;
    totalInvalid += invalid;
    const colConsistent = !(t === "number" && invalidPct > 0) && !(t === "date" && invalidPct > 0);
    if (colConsistent) consistentCols++;
  });

  const cells = Math.max(1, n * Math.max(1, cols.length));
  const completeness = Math.max(0, 1 - totalMissing / cells);
  const validity = Math.max(0, 1 - totalInvalid / cells);
  const uniqueness = keyCol ? Math.max(0, 1 - totalDup / Math.max(1, n)) : 1;
  const consistency = cols.length ? Math.max(0, consistentCols / cols.length) : 1;

  // outliers_ok: if caller provided outlier marks, compute % non-outlier rows averaged across provided cols
  let outliers_ok = 1;
  if (opts?.outlierCols && opts.outlierCols.length && opts.outlierIdxByCol) {
    let acc = 0;
    let count = 0;
    for (const c of opts.outlierCols) {
      const marked = opts.outlierIdxByCol[c];
      if (!marked) continue;
      const ratio = 1 - (marked.size / Math.max(1, n));
      acc += ratio;
      count++;
    }
    if (count > 0) outliers_ok = acc / count;
  }

  const dimensions: DimensionScores = { completeness, validity, uniqueness, consistency, outliers_ok };
  const globalScore = qualityScoreV2(dimensions);

  return { perColumn, dimensions, globalScore };
}

export function summarizeQualityReport(r: QualityReport) {
  return {
    score: r.globalScore,
    label: interpretQuality(r.globalScore),
    dimensions: {
      completeness: Math.round(normalize01(r.dimensions.completeness) * 100),
      validity: Math.round(normalize01(r.dimensions.validity) * 100),
      uniqueness: Math.round(normalize01(r.dimensions.uniqueness) * 100),
      consistency: Math.round(normalize01(r.dimensions.consistency) * 100),
      outliers_ok: Math.round(normalize01(r.dimensions.outliers_ok) * 100),
    },
    generatedAt: new Date().toISOString(),
  };
}
