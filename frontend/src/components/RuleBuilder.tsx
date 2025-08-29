import React from 'react'
import { loadRules, saveRules, Rule } from '../lib/storage'

export default function RuleBuilder({ columns, sample }: { columns: string[], sample: Record<string, any>[] }) {
  const [rules, setRules] = React.useState<Rule[]>(loadRules())

  const add = () => {
    if (!columns.length) return
    const r: Rule = { column: columns[0], required: false }
    setRules(prev => [...prev, r])
  }

  const update = (i: number, patch: Partial<Rule>) => {
    setRules(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  const remove = (i: number) => setRules(prev => prev.filter((_, idx) => idx !== i))

  const test = (row: Record<string, any>, r: Rule): boolean => {
    const v = String(row[r.column] ?? '')
    if (r.required && !v) return false
    if (r.minLen && v.length < r.minLen) return false
    if (r.maxLen && v.length > r.maxLen) return false
    if (r.regex) {
      try {
        const re = new RegExp(r.regex)
        if (!re.test(v)) return false
      } catch { return false }
    }
    return true
  }

  const saveAll = () => saveRules(rules)

  const failed = sample.map(row => rules.every(r => test(row, r))).filter(ok => !ok).length

  const presets = [
    [{ column: 'email', required: true, regex: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' }],
    [{ column: 'phone', required: false, minLen: 8, maxLen: 16 }],
    [{ column: 'date', required: false, regex: '^\\d{4}-\\d{2}-\\d{2}$' }]
  ]

  const loadPreset = (i: number) => setRules(presets[i] as Rule[])

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Rule Builder</h3>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-gray-700 rounded" onClick={add}>+ Règle</button>
          <button className="px-3 py-1 bg-brand-600 rounded" onClick={saveAll}>Sauvegarder</button>
        </div>
      </div>

      <div className="text-sm text-gray-400 mt-2">Échecs sur l’échantillon: {failed}</div>

      <div className="mt-4 flex gap-2">
        <button className="px-3 py-1 bg-gray-800 rounded" onClick={() => loadPreset(0)}>Preset Email</button>
        <button className="px-3 py-1 bg-gray-800 rounded" onClick={() => loadPreset(1)}>Preset Phone</button>
        <button className="px-3 py-1 bg-gray-800 rounded" onClick={() => loadPreset(2)}>Preset Date</button>
      </div>

      <div className="mt-4 space-y-3">
        {rules.map((r, i) => (
          <div key={i} className="bg-gray-950 border border-gray-800 rounded-lg p-3 grid md:grid-cols-6 gap-2 text-sm">
            <select value={r.column} onChange={e => update(i, { column: e.target.value })} className="bg-gray-900 border border-gray-700 rounded px-2 py-1">
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!r.required} onChange={e => update(i, { required: e.target.checked })}/> Required</label>
            <input placeholder="regex" value={r.regex || ''} onChange={e => update(i, { regex: e.target.value })} className="bg-gray-900 border border-gray-700 rounded px-2 py-1"/>
            <input type="number" placeholder="min" value={r.minLen ?? ''} onChange={e => update(i, { minLen: e.target.value ? parseInt(e.target.value) : undefined })} className="bg-gray-900 border border-gray-700 rounded px-2 py-1"/>
            <input type="number" placeholder="max" value={r.maxLen ?? ''} onChange={e => update(i, { maxLen: e.target.value ? parseInt(e.target.value) : undefined })} className="bg-gray-900 border border-gray-700 rounded px-2 py-1"/>
            <button onClick={() => remove(i)} className="px-3 py-1 bg-red-700 rounded">Supprimer</button>
          </div>
        ))}
        {!rules.length && <div className="text-gray-500 text-sm">Aucune règle.</div>}
      </div>
    </div>
  )
}
