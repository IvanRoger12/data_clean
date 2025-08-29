import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function buildPdfReport(opts: {
  fileName?: string;
  kpi: { rows: number; cols: number; dupPct: number; qualityScore: number };
  insights: string[];
  diffSample?: { row: number; column: string; old: string; new: string; reason: string }[];
  cleanedPreview?: Record<string, any>[];
}) {
  const doc = new jsPDF({ unit: "pt", compress: true });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("DataClean AI – Rapport Qualité", 40, 40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const meta = `Fichier: ${opts.fileName || "—"}  •  Lignes: ${opts.kpi.rows}  •  Colonnes: ${opts.kpi.cols}  •  Duplicats: ${opts.kpi.dupPct}%  •  Score: ${opts.kpi.qualityScore}%`;
  doc.text(meta, 40, 62);

  // Insights
  autoTable(doc, {
    startY: 84,
    head: [["Insights (IA)"]],
    body: (opts.insights || []).map((i) => [i]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [59, 130, 246] },
    theme: "grid",
    tableWidth: "auto",
    margin: { left: 40, right: 40 },
  });

  // Diff sample
  if (opts.diffSample && opts.diffSample.length) {
    autoTable(doc, {
      head: [["Ligne", "Colonne", "Ancien", "Nouveau", "Raison"]],
      body: opts.diffSample.slice(0, 50).map(d => [d.row, d.column, d.old, d.new, d.reason]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [147, 51, 234] },
      startY: (doc as any).lastAutoTable.finalY + 20 || 160,
      margin: { left: 40, right: 40 },
      theme: "grid",
    });
  }

  // Cleaned preview
  if (opts.cleanedPreview && opts.cleanedPreview.length) {
    const headers = Object.keys(opts.cleanedPreview[0] || {});
    autoTable(doc, {
      head: [headers],
      body: opts.cleanedPreview.map(r => headers.map(h => String(r[h] ?? ""))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [34, 197, 94] },
      startY: (doc as any).lastAutoTable.finalY + 20 || 160,
      margin: { left: 40, right: 40 },
      theme: "grid",
    });
  }

  return doc;
}
