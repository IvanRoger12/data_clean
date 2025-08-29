export type Preview = {
  columns: string[];
  data: string[][];
  totalRows: number;
  totalCols: number;
  fileName?: string;
};

export type KPI = {
  rows: number;
  cols: number;
  dupPct: number;
  anomalies: number;
  qualityScore: number;
};

export type AnalyzeResponse = {
  preview: Preview;
  profile: { columns: Record<string, { missingPct: number }> };
  kpi: KPI;
  detected: Record<string, string>;
};

export type AutoFixResponse = {
  detected: Record<string, string>;
  cleaned_preview: Record<string, string>[];
  diff_sample: { row: number; column: string; old: string; new: string; reason: string }[];
  removed_exact_duplicates: number;
};

export type FuzzyPair = { i: number; j: number; score: number };
