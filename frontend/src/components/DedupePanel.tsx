import React from 'react'
import { FuzzyPair } from '../lib/types'
import { fuzzy } from '../lib/api'

export default function DedupePanel({
  sampleRows,
  columns
}: {
  sampleRows: Record<string, any>[],
  columns: string[]
}) {
  const [keys, setKeys] = React.useState<string[]>([])
  const [threshold, setThreshold] = React.useState(90)
  const [pairs, setPairs] = React.useState<FuzzyPair[]>([])
  const [loading, setLoading] = React.useState(false)

  const toggle = (c: string) => {
    setKeys(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  const run = async () => {
    setLoading(true)
    try {
      const p = await fuzzy(sampleRows, keys, threshold)
      setPairs(p)
    } catch (e) {
      alert('Erreur fuzzy: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fuzzy Dedupe</h3>
        <div className="text-sm text-gray-400">Évalue des paires proches selon des clés</div>
      </div>

      <div className="mt-4 grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="text-sm text-gray-300 mb-2">Clés composites</div>
          <div className="flex flex-wrap gap-2">
            {columns.map(c => (
              <button key={c}
                onClick={() => toggle(c)}
                className={`px-3 py-1 rounded-full text-sm border ${keys.includes(c) ? 'bg-brand-600 border-brand-600' : 'border-gray-700 bg-gray-900 hover:bg-gray-800'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-300 mb-2">Seuil ({threshold})</div>
          <input type="range" min={70} max={100} value={threshold} onChange={e => setThreshold(parseInt(e.target.value))}
            className="w-full"/>
        </div>
      </div>

      <div className="mt-4">
        <button onClick={run} disabled={!keys.length || loading}
          className="px-5 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50">
          {loading ? 'Calcul...' : 'Trouver les doublons (échantillon)'}
        </button>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold mb-2">Paires détectées</h4>
        <div className="space-y-2">
          {pairs.slice(0, 20).map((p, idx) => (
            <div key={idx} className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm">
              <span className="text-gray-400">i={p.i}</span>
              <span className="mx-2">↔</span>
              <span className="text-gray-400">j={p.j}</span>
              <span className="ml-3 text-gray-200">score {p.score}</span>
            </div>
          ))}
          {!pairs.length && <div className="text-gray-500 text-sm">Aucun résultat (sur l’échantillon).</div>}
        </div>
      </div>
    </div>
  )
}
