import Papa from "papaparse";

export async function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (r) => {
        const rows = (r.data as any[]).map((row) => {
          const obj: Record<string, string> = {};
          Object.keys(row).forEach((k) => (obj[k] = (row[k] ?? "").toString()));
          return obj;
        });
        resolve(rows);
      },
      error: (err) => reject(err)
    });
  });
}

export function toCSV(rows: Record<string, any>[]): string {
  return Papa.unparse(rows, { quotes: (v:any)=> typeof v === "string" && /[",\n;]/.test(v) });
}
