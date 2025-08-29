import React from 'react'
import { getJobs } from '../lib/api'

export default function JobsPanel() {
  const [jobs, setJobs] = React.useState<{ id: number; status: string; nextRun: string }[]>([])
  const [loading, setLoading] = React.useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await getJobs()
      setJobs(j.jobs || [])
    } catch (e) {
      alert('Erreur jobs: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Jobs</h3>
        <button onClick={load} className="px-3 py-1 bg-gray-800 rounded">{loading ? '…' : 'Rafraîchir'}</button>
      </div>
      <div className="mt-4 overflow-x-auto border border-gray-800 rounded-xl">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              {['ID', 'Statut', 'Prochaine exécution'].map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-300 border-r border-gray-800 last:border-r-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-gray-900/50">
                <td className="px-3 py-2 text-sm">{j.id}</td>
                <td className="px-3 py-2 text-sm">{j.status}</td>
                <td className="px-3 py-2 text-sm">{j.nextRun}</td>
              </tr>
            ))}
            {!jobs.length && <tr><td className="px-3 py-3 text-gray-500 text-sm" colSpan={3}>Aucun job.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
