import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { AnalyzeResponse } from './types'

export function downloadAnalysisPDF(filename: string, analysis: AnalyzeResponse, insights: string[], diffs?: any[]) {
  const doc = new jsPDF({ unit: 'pt' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('DataClean AI – Rapport Qualité', 40, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const k = analysis.kpi
  doc.text(`Fichier: ${analysis.preview.fileName || '—'}`, 40, 70)
  doc.text(`Lignes: ${k.rows} | Colonnes: ${k.cols} | Duplicates: ${k.dupPct}% | Score: ${k.qualityScore}%`, 40, 86)

  // Missing %
  const rows = Object.entries(analysis.profile.columns).map(([c, v]) => [c, `${v.missingPct}%`, analysis.detected[c] || '—'])
  autoTable(doc, {
    startY: 110,
    head: [['Colonne', '% manquants', 'Type détecté']],
    body: rows.slice(0, 30)
  })

  // Insights
  const y = (doc as any).lastAutoTable?.finalY || 150
  autoTable(doc, {
    startY: y + 20,
    head: [['Insights IA']],
    body: insights.length ? insights.map(i => [i]) : [['(aucun)']],
  })

  // Diff sample
  if (diffs?.length) {
    const yy = (doc as any).lastAutoTable?.finalY || y + 20
    autoTable(doc, {
      startY: yy + 20,
      head: [['Ligne', 'Colonne', 'Ancien', 'Nouveau', 'Raison']],
      body: diffs.slice(0, 50).map(d => [d.row, d.column, String(d.old), String(d.new), d.reason])
    })
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
