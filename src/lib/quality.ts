export type QualityMetrics = {
  completeness: number;   // 0..1
  validity: number;       // 0..1
  uniqueness: number;     // 0..1
  consistency: number;    // 0..1
  outliers_ok: number;    // 0..1
};

export function qualityScoreV2(m: QualityMetrics): number {
  const w = { completeness:0.25, validity:0.35, uniqueness:0.15, consistency:0.15, outliers_ok:0.10 };
  const s = m.completeness*w.completeness
          + m.validity*w.validity
          + m.uniqueness*w.uniqueness
          + m.consistency*w.consistency
          + m.outliers_ok*w.outliers_ok;
  return Math.round(s * 100);
}

export function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}
