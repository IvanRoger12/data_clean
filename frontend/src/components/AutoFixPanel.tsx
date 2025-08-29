import React from 'react'
import { AutoFixResponse } from '../lib/types'
import { Download } from 'lucide-react'
import { downloadCSV } from '../lib/csv'
import { downloadAnalysisPDF } from '../lib/pdf'
import { AnalyzeResponse } from '../lib/types'

export default function AutoFixPanel({
  analysis,
  autoFixData
}: {
  analysis: AnalyzeResponse | null
  autoFixData: AutoFixResponse | null
}) {
  if (!autoFixData) return null
  const cols = Object.keys(autoFixData.cleaned_preview[0] || {})
  const rows = autoFixData.cleaned_preview.map((r) => cols.map((c) => String(r[c] ?? '')))

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Auto-Fix (safe)</h3>
            <p className="text-gray-400 text-sm">
              Trim, emails lower, dates ISO, phones E.164, doublons exacts. <em>Aperçu sur 10 lignes.</em>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => downloadCSV('cleaned_sample.csv', autoFixData.cleaned_preview)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4"/> CSV (sample)
            </button>
            <button
              onClick={() => analysis && downloadAnalysisPDF('rapport.pdf', analysis, [], autoFixData.diff_sample)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              Rapport PDF
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto border border-gray-800 rounded-xl">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                {cols.map((c, i) => (
                  <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-300 border-r border-gray-800 last:border-r-0">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-900/50">
                  {r.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-sm text-gray-200 border-r border-gray-900 last:border-r-0">{cell || <span className="text-gray-600 italic">null</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold mb-2">Échantillon de modifications</h4>
          <div className="grid gap-2">
            {autoFixData.diff_sample.slice(0, 12).map((d, idx) => (
              <div key={idx} className="text-sm bg-gray-950 border border-gray-800 rounded-lg p-3">
                <span className="text-gray-400 mr-2">Ligne {d.row}</span>
                <span className="text-gray-300">{d.column}</span>
                <span className="mx-2 text-gray-500">:</span>
                <span className="text-red-400 line-through">{String(d.old)}</span>
                <span className="mx-2 text-gray-500">→</span>
                <span className="text-green-400">{String(d.new)}</span>
                <span className="ml-3 text-xs text-gray-500">({d.reason})</span>
              </div>
            ))}
            {!autoFixData.diff_sample.length && (
              <div className="text-gray-400 text-sm">Aucune modification détectée sur l’échantillon.</div>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-3">
            Doublons exacts retirés: {autoFixData.removed_exact_duplicates}
          </div>
        </div>
      </div>
    </div>
  )
}
