import React from 'react'
import { getInsights } from '../lib/api'
import { AnalyzeResponse } from '../lib/types'
import { Bot, Zap } from 'lucide-react'

export default function ChatDrawer({
  open,
  onClose,
  analysis
}: {
  open: boolean
  onClose: () => void
  analysis: AnalyzeResponse | null
}) {
  const [messages, setMessages] = React.useState<{ role: 'user'|'assistant', text: string }[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const ask = async () => {
    if (!input.trim()) return
    const prompt = input
    setMessages(m => [...m, { role: 'user', text: prompt }])
    setInput('')
    setLoading(true)
    try {
      const bullets = await getInsights(analysis?.profile ?? { columns: {} }, analysis?.kpi ?? {}, prompt)
      setMessages(m => [...m, { role: 'assistant', text: bullets.map(b => `• ${b}`).join('\n') }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: 'Erreur IA: ' + (e as Error).message }])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (open && !messages.length && analysis) {
      setMessages([{ role: 'assistant', text: `Pose-moi une question sur tes données.\nScore actuel: ${analysis.kpi.qualityScore}% | Duplicates: ${analysis.kpi.dupPct}%` }])
    }
  }, [open])

  return (
    <div className={`fixed top-0 right-0 h-full w-full md:w-[440px] bg-gray-900/95 backdrop-blur border-l border-gray-800 transform transition-transform duration-300 z-50 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4"/>
          </div>
          <div className="font-semibold">Assistant IA</div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>

      <div className="p-4 space-y-3 h-[calc(100%-112px)] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`whitespace-pre-wrap p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-blue-600 text-white ml-8' : 'bg-gray-800 text-gray-100 mr-8 border border-gray-700'}`}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg mr-8 text-sm text-gray-300">
            <Zap className="w-4 h-4 inline mr-2"/> L’IA réfléchit…
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-800 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Pose une question…" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2"/>
        <button onClick={ask} disabled={loading || !input.trim()} className="px-4 bg-brand-600 hover:bg-brand-700 rounded disabled:opacity-50">Envoyer</button>
      </div>
    </div>
  )
}
