export type Preview = {
  columns: string[];
  data: (string | number)[][];
  totalRows: number;
  totalCols: number;
  fileName?: string;
};

export type KPI = {
  rows: number; cols: number; dupPct: number; anomalies?: number; qualityScore: number;
};
