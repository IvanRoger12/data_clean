import React from 'react'
import { BarChart3, Globe, Brain, MessageCircle } from 'lucide-react'
import UploadArea from './components/UploadArea'
import DataTable from './components/DataTable'
import KpiCards from './components/KpiCards'
import AutoFixPanel from './components/AutoFixPanel'
import DedupePanel from './components/DedupePanel'
import RuleBuilder from './components/RuleBuilder'
import SchedulePanel from './components/SchedulePanel'
import JobsPanel from './components/JobsPanel'
import ChatDrawer from './components/ChatDrawer'
import { analyze, autoFix, getInsights, llmTest, setApiBase, getApiBase } from './lib/api'
import { AnalyzeResponse, AutoFixResponse } from './lib/types'
import { clip } from './lib/sanitize'
import { downloadAnalysisPDF } from './lib/pdf'

type Tab = 'analyze'|'autofix'|'dedupe'|'rules'|'schedule'|'jobs'

export default function App() {
  const [active, setActive] = React.useState<Tab>('analyze')
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<{ columns: string[]; data: string[][]; totalRows: number; totalCols: number; fileName?: string } | null>(null)
  const [analysis, setAnalysis] = React.useState<AnalyzeResponse | null>(null)
  const [autoData, setAutoData] = React.useState<AutoFixResponse | null>(null)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [insights, setInsights] = React.useState<string[]>([])
  const [apiBase, setBase] = React.useState(getApiBase())

  React.useEffect(() => {
    // set env base once (if provided)
    if (import.meta.env.VITE_API_BASE_URL && !apiBase) {
      const b = String(import.meta.env.VITE_API_BASE_URL)
      setApiBase(b)
      setBase(b)
    }
  }, [])

  const onPicked = (f: File) => {
    setFile(f)
    setAnalysis(null)
    setAutoData(null)
    setInsights([])
    setPreview(null)
    setActive('analyze')
    // Just show a client header preview for UX before analysis
    setPreview({ columns: [], data: [], totalRows: 0, totalCols: 0, fileName: f.name })
  }

  const runAnalyze = async () => {
    if (!file) return
    setLoading(true)
    try {
      const a = await analyze(file)
      setAnalysis(a)
      setPreview(a.preview)
      setActive('analyze')
    } catch (e) {
      alert('Erreur analyse: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const runAutoFix = async () => {
    if (!file) return
    setLoading(true)
    try {
      const r = await autoFix(file)
      setAutoData(r)
      setActive('autofix')
    } catch (e) {
      alert('Erreur auto-fix: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const runInsights = async () => {
    if (!analysis) return
    setLoading(true)
    try {
      const i = await getInsights(analysis.profile, analysis.kpi)
      setInsights(i)
    } catch (e) {
      alert('Erreur insights: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const testLLM = async () => {
    try {
      const r = await llmTest()
      alert(`LLM: ${JSON.stringify(r)}`)
    } catch (e) {
      alert('Test LLM: ' + (e as Error).message)
    }
  }

  const columns = analysis?.preview.columns || preview?.columns || []
  const sampleRows: Record<string, any>[] =
    autoData?.cleaned_preview ||
    (analysis ? analysis.preview.data.slice(0, 10).map(r => {
      const obj: Record<string, string> = {}
      analysis.preview.columns.forEach((c, i) => obj[c] = String(r[i] ?? ''))
      return obj
    }) : [])

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6"/>
            </div>
            <div>
              <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">DataClean AI</div>
              <div className="text-xs text-gray-400">Assistant IA pour nettoyage de données</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-gray-400"/>
              <input
                value={apiBase}
                onChange={e => { setBase(e.target.value); setApiBase(e.target.value) }}
                placeholder="https://…hf.space"
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded w-[260px]"
              />
              <button onClick={testLLM} className="px-2 py-1 bg-gray-700 rounded text-xs">Test LLM</button>
            </div>
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-sm"
            >
              <MessageCircle className="w-4 h-4"/> Chat IA
            </button>
          </div>
        </div>

        {/* NAV */}
        <nav className="border-t border-gray-800 bg-gray-900/60">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-6">
              {[
                ['analyze', 'Analyser'],
                ['autofix', 'Auto-Fix'],
                ['dedupe', 'Dedupe'],
                ['rules', 'Règles'],
                ['schedule', 'Planifier'],
                ['jobs', 'Jobs']
              ].map(([id, label]) => (
                <button key={id}
                  onClick={() => setActive(id as Tab)}
                  className={`py-4 border-b-2 text-sm ${active === id ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Analyze tab */}
        {active === 'analyze' && (
          <>
            {!file && <UploadArea onFile={onPicked}/>}
            {file && !analysis && (
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{clip(file.name)}</div>
                    <div className="text-gray-400 text-sm">Taille {(file.size/1024/1024).toFixed(2)} Mo</div>
                  </div>
                  <button onClick={runAnalyze} disabled={loading} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 flex items-center gap-2">
                    <Brain className="w-4 h-4"/>{loading ? 'Analyse…' : 'Analyser'}
                  </button>
                </div>
              </div>
            )}

            {analysis && (
              <>
                <KpiCards kpi={analysis.kpi}/>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">Types détectés : {Object.entries(analysis.detected).slice(0, 6).map(([c, t]) => `${c}=${t}`).join(', ')}{Object.keys(analysis.detected).length>6?'…':''}</div>
                  <div className="flex gap-2">
                    <button onClick={runAutoFix} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded">Auto-Fix</button>
                    <button onClick={runInsights} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded">Insights IA</button>
                    <button onClick={() => downloadAnalysisPDF('rapport.pdf', analysis, insights)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded">PDF</button>
                  </div>
                </div>

                {!!insights.length && (
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
                    <h4 className="font-semibold mb-2">Insights IA</h4>
                    <ul className="list-disc ml-6 text-sm text-gray-300 space-y-1">
                      {insights.map((i, idx) => <li key={idx}>{i}</li>)}
                    </ul>
                  </div>
                )}

                <DataTable columns={analysis.preview.columns} rows={analysis.preview.data}/>
              </>
            )}
          </>
        )}

        {/* Auto-Fix */}
        {active === 'autofix' && <AutoFixPanel analysis={analysis} autoFixData={autoData}/>}

        {/* Dedupe */}
        {active === 'dedupe' && (
          <DedupePanel sampleRows={sampleRows} columns={columns}/>
        )}

        {/* Rules */}
        {active === 'rules' && (
          <RuleBuilder columns={columns} sample={sampleRows}/>
        )}

        {/* Schedule */}
        {active === 'schedule' && <SchedulePanel/>}

        {/* Jobs */}
        {active === 'jobs' && <JobsPanel/>}
      </main>

      <ChatDrawer open={aiOpen} onClose={() => setAiOpen(false)} analysis={analysis}/>
    </div>
  )
}
