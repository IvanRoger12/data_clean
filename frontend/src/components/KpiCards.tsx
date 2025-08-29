import React from 'react'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { KPI } from '../lib/types'

export default function KpiCards({ kpi }: { kpi: KPI }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Qualité globale</h2>
          <p className="text-gray-400 text-sm">Évaluation IA + heuristiques</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold">{kpi.qualityScore}%</div>
          <div className="flex items-center justify-end text-green-400"><TrendingUp className="w-4 h-4 mr-1"/>Améliorable</div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {[
          ['Lignes', kpi.rows],
          ['Colonnes', kpi.cols],
          ['Dup%', `${kpi.dupPct}%`],
          ['Anomalies', kpi.anomalies]
        ].map(([label, val], idx) => (
          <div key={idx} className="bg-gray-950/60 border border-gray-800 rounded-xl p-4">
            <div className="text-gray-400 text-xs">{label}</div>
            <div className="text-lg font-semibold mt-1">{val}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center text-xs text-gray-500 mt-4">
        <RefreshCw className="w-3 h-3 mr-2"/> KPIs recalculés après chaque action
      </div>
    </div>
  )
}
