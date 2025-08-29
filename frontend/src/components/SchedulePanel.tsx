import React from 'react'
import { scheduleICS } from '../lib/api'

export default function SchedulePanel() {
  const [freq, setFreq] = React.useState('DAILY')
  const [time, setTime] = React.useState('09:00')
  const [downloading, setDownloading] = React.useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      const ics = await scheduleICS(`${freq} ${time}`)
      const blob = new Blob([ics], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'dataclean-schedule.ics'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Erreur ICS: ' + (e as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold">Planification (ICS)</h3>
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div>
          <div className="text-sm text-gray-400 mb-2">Fréquence</div>
          <select value={freq} onChange={e => setFreq(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2">
            <option value="DAILY">Quotidien</option>
            <option value="WEEKLY">Hebdomadaire</option>
            <option value="MONTHLY">Mensuel</option>
          </select>
        </div>
        <div>
          <div className="text-sm text-gray-400 mb-2">Heure</div>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"/>
        </div>
        <div className="flex items-end">
          <button onClick={download} disabled={downloading} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 w-full">Télécharger .ics</button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-3">Pour le 24/7 réel: Cron côté serveur (Pro).</div>
    </div>
  )
}
