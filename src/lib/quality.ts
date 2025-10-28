export type QualityMetrics = {
  completeness: number;
  validity: number;
  uniqueness: number;
  consistency: number;
  outliers_ok: number;
};

function normalize(v: number): number {
  if (v > 1) return Math.min(v / 100, 1);
  if (v < 0) return 0;
  return v;
}

export function qualityScoreV2(m: QualityMetrics): number {
  const w = { completeness:0.25, validity:0.35, uniqueness:0.15, consistency:0.15, outliers_ok:0.10 };
  const s =
    normalize(m.completeness)*w.completeness +
    normalize(m.validity)*w.validity +
    normalize(m.uniqueness)*w.uniqueness +
    normalize(m.consistency)*w.consistency +
    normalize(m.outliers_ok)*w.outliers_ok;
  return Math.round(s * 100);
}

export function interpretQuality(score: number): string {
  if (score >= 90) return "Excellent 👑 (Très haute qualité)";
  if (score >= 75) return "Bon ✅ (Qualité maîtrisée)";
  if (score >= 60) return "Moyen ⚠️ (Amélioration nécessaire)";
  return "Faible 🚨 (Risque élevé de mauvaise donnée)";
}

export function summarizeQuality(metrics: QualityMetrics) {
  const score = qualityScoreV2(metrics);
  return {
    score,
    label: interpretQuality(score),
    metrics,
    date: new Date().toISOString()
  };
}

export function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}
