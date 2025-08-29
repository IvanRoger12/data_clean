import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload, FileText, BarChart3, Calendar, Settings, Download, Play, Clock, CheckCircle,
  XCircle, Crown, Globe, RefreshCw, Bot, Brain, Sparkles, MessageCircle, Zap,
  Target, ArrowRight, Eye, TrendingUp
} from "lucide-react";
import { getJSON, postJSON, postForm } from "../lib/api";

type Preview = { columns: string[]; data: string[][]; totalRows: number; totalCols: number; fileName?: string; };
type KPI = { rows: number; cols: number; dupPct: number; anomalies?: number; qualityScore: number; };
type AnalysisColumn = { name: string; type: string; quality: number; issues: number; missing: number; invalid: number; aiSuggestion: string; corrections: {row:number; old:string; new:string; confidence:number}[]; };
type AnalysisData = { globalScore: number; improvements: number; columns: AnalysisColumn[]; insights: {type:string;title:string;message:string;priority:string}[]; };

const DataCleaningAgent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"analyze"|"schedule"|"jobs">("analyze");
  const [language, setLanguage] = useState<"fr"|"en">("fr");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Preview | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role:"user"|"assistant"; message:string; timestamp:number}[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [autoFixResult, setAutoFixResult] = useState<any>(null);
  const [icsContent, setIcsContent] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const texts = {
    fr: {
      title: "DataClean AI",
      subtitle: "Assistant IA pour nettoyage de données d'entreprise",
      tabs: { analyze: "Analyser", schedule: "Planifier", jobs: "Jobs" },
      upload: { title: "Déposez vos fichiers ou cliquez ici", formats: "CSV, Excel, JSON, TXT, YAML", maxSize: "Taille max: 50 Mo", freeLimit: "Analyse gratuite - 1000 lignes", privacy: "Traitement sécurisé" },
      preview: { title: "Aperçu des données", rows: "lignes", columns: "colonnes", startAnalysis: "Commencer l'analyse IA" }
    },
    en: {
      title: "DataClean AI",
      subtitle: "AI Assistant for Enterprise Data Cleaning",
      tabs: { analyze: "Analyze", schedule: "Schedule", jobs: "Jobs" },
      upload: { title: "Drop your files here or click", formats: "CSV, Excel, JSON, TXT, YAML", maxSize: "Max size: 50 MB", freeLimit: "Free analysis - 1k rows", privacy: "Secure processing" },
      preview: { title: "Data Preview", rows: "rows", columns: "columns", startAnalysis: "Start AI Analysis" }
    }
  };
  const t = texts[language];

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files[0]) handleFileUpload(files[0]);
  }, []);

  const handleFileUpload = (f: File) => {
    setFile(f);
    setPreviewData(null);
    setAnalysisData(null);
    setAutoFixResult(null);
    setAiMessages(prev => [...prev, { role: "assistant", message: language==="fr" ? `Fichier "${f.name}" prêt. Clique "${t.preview.startAnalysis}".` : `File "${f.name}" ready. Click "${t.preview.startAnalysis}".`, timestamp: Date.now() }]);
  };

  async function startAnalysis() {
    if (!file) return;
    setIsAnalyzing(true);
    setAnalysisStep(language==="fr" ? "Lecture du fichier..." : "Reading file...");

    try {
      const fd = new FormData();
      fd.append("file", file);

      // 1) Analyse de base
      const res = await postForm<{ preview:Preview; kpi:KPI; profile:any; detected:Record<string,string> }>("/api/analyze", fd);
      setPreviewData({ ...res.preview });

      // 2) Insights IA
      setAnalysisStep(language==="fr" ? "Génération des insights..." : "Generating insights...");
      const insightsRes = await postJSON<{insights:string[]}>("/api/insights", {
        profile: res.profile,
        kpi: res.kpi,
        prompt: language==="fr" ? "Quelles priorités de correction ?" : "Top cleaning priorities?"
      });

      // 3) Map vers structure UI
      const mapped: AnalysisData = {
        globalScore: Math.round(res.kpi.qualityScore ?? 70),
        improvements: Math.max(0, 100 - Math.round(res.kpi.qualityScore ?? 70)),
        columns: Object.keys(res.detected).map((name) => ({
          name,
          type: res.detected[name],
          quality: 70,
          issues: 0,
          missing: res.profile?.columns?.[name]?.missingPct ?? 0,
          invalid: 0,
          aiSuggestion: language==="fr" ? `Standardiser "${name}" (${res.detected[name]}).` : `Standardize "${name}" (${res.detected[name]}).`,
          corrections: []
        })),
        insights: (insightsRes.insights || []).map((m) => ({ type:"quality", title:"Insight", message: m, priority:"medium" }))
      };
      setAnalysisData(mapped);

      // 4) Mode Auto (fixes sûrs)
      if (autoMode) {
        setAnalysisStep(language==="fr" ? "Application des fixes sûrs..." : "Applying safe fixes...");
        const auto = await postForm("/api/tools/auto_fix", fd, { region: "FR" });
        setAutoFixResult(auto);

        // Injecter un aperçu des corrections dans les colonnes
        const byCol: Record<string, any[]> = {};
        (auto.diff_sample || []).forEach((d: any) => {
          byCol[d.column] = byCol[d.column] || [];
          byCol[d.column].push({ row: d.row, old: d.old, new: d.new, confidence: 90 });
        });
        setAnalysisData((prev) => prev ? {
          ...prev,
          columns: prev.columns.map((c) => byCol[c.name]?.length ? { ...c, corrections: byCol[c.name].slice(0,5) } : c)
        } : prev);
      }

      setAiMessages(prev => [...prev, { role:"assistant", message: language==="fr" ? `Analyse terminée. Score: ${mapped.globalScore}%` : `Analysis done. Score: ${mapped.globalScore}%`, timestamp: Date.now() }]);
      setAiChatOpen(true);
    } catch (e:any) {
      setAiMessages(prev => [...prev, { role:"assistant", message: (language==="fr" ? "Erreur d'analyse: " : "Analysis error: ") + (e?.message || e), timestamp: Date.now() }]);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep("");
    }
  }

  function downloadCSVFromCleanedPreview() {
    if (!autoFixResult?.cleaned_preview) return;
    const rows = autoFixResult.cleaned_preview as Record<string,string>[];
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const csv = [
      cols.join(","),
      ...rows.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g,'""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dataclean_cleaned.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function generateICS(rule: string) {
    try {
      const res = await postJSON<{ics:string}>("/api/schedule/ics", { rule });
      setIcsContent(res.ics || "");
    } catch (e:any) {
      setIcsContent(`Erreur: ${e?.message || e}`);
    }
  }

  async function loadJobs() {
    try {
      const res = await getJSON<{jobs:any[]}>("/api/jobs");
      setJobs(res.jobs || []);
    } catch {
      setJobs([]);
    }
  }
  useEffect(() => { if (activeTab === "jobs") loadJobs(); }, [activeTab]);

  const running = jobs.filter(j => j.status === "running").length;
  const completed = jobs.filter(j => j.status === "completed").length;
  const pending = jobs.filter(j => j.status === "pending").length;
  const failed = jobs.filter(j => j.status === "failed").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl grid place-items-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">DataClean AI</h1>
              <p className="text-sm text-gray-400">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-xl text-sm">
              <Globe className="w-4 h-4" />
              <select value={language} onChange={(e)=>setLanguage(e.target.value as any)} className="bg-transparent outline-none">
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
            </label>
            <button onClick={()=>setShowUpgradeModal(true)} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl">
              <Crown className="w-4 h-4" /><span>Pro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          {[
            { id: "analyze", label: t.tabs.analyze, icon: BarChart3 },
            { id: "schedule", label: t.tabs.schedule, icon: Calendar },
            { id: "jobs", label: t.tabs.jobs, icon: Settings },
          ].map((tab:any)=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex items-center gap-2 py-4 border-b-2 text-sm ${activeTab===tab.id ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-gray-200"}`}>
              <tab.icon className="w-4 h-4" /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab==="analyze" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3 space-y-8">
              {!file && !isAnalyzing && !analysisData && (
                <div className="text-center">
                  <div
                    onDrop={onDrop}
                    onDragOver={(e)=>e.preventDefault()}
                    onClick={()=>fileInputRef.current?.click()}
                    className="relative border-2 border-dashed border-gray-600 hover:border-blue-400 rounded-3xl p-16 cursor-pointer bg-gradient-to-br from-gray-900/50 to-gray-800/50"
                  >
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept=".csv,.xlsx,.xls,.json,.txt,.yaml"
                      onChange={(e)=> e.target.files?.[0] && handleFileUpload(e.target.files[0])}/>
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl grid place-items-center mx-auto mb-6">
                      <Upload className="w-12 h-12 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-semibold mb-3">{t.upload.title}</h3>
                    <p className="text-gray-400 mb-6">{t.upload.formats}</p>
                    <div className="flex justify-center gap-8 text-sm text-gray-500">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div><span>{t.upload.maxSize}</span></div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div><span>{t.upload.freeLimit}</span></div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-purple-500 rounded-full"></div><span>{t.upload.privacy}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {file && !isAnalyzing && !analysisData && (
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-blue-600/20 rounded-xl grid place-items-center">
                        <FileText className="w-6 h-6 text-green-400"/>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{file.name}</h3>
                        <p className="text-gray-400">{(file.size/1024).toFixed(1)} KB</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="text-sm text-gray-400 flex items-center gap-2">
                        <input type="checkbox" checked={autoMode} onChange={(e)=>setAutoMode(e.target.checked)} className="accent-purple-600"/>
                        {language==='fr' ? 'Mode Auto (fixes sûrs)' : 'Auto Mode (safe fixes)'}
                      </label>
                      <button onClick={startAnalysis} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center gap-2">
                        <Brain className="w-5 h-5" /><span>{t.preview.startAnalysis}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-400">{language==='fr'?'Clique pour lancer l’analyse IA.':'Click to start AI analysis.'}</p>
                </div>
              )}

              {isAnalyzing && (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl grid place-items-center mx-auto mb-8 animate-pulse">
                    <Brain className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-4">{language==='fr'?"L'IA analyse vos données":"AI is analyzing your data"}</h3>
                  <p className="text-blue-400 mb-8 text-lg">{analysisStep}</p>
                  <div className="max-w-md mx-auto bg-gray-800 rounded-full h-3">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                  </div>
                </div>
              )}

              {analysisData && (
                <div className="space-y-8">
                  {/* KPI header */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">{language==='fr'?'Analyse Qualité':'Quality Analysis'}</h2>
                      <p className="text-gray-400">{language==='fr'?'Évaluation complète par l’IA':'Full AI evaluation'}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-5xl font-bold mb-2">{analysisData.globalScore}%</div>
                      <div className="flex items-center text-green-400 font-medium">
                        <TrendingUp className="w-4 h-4 mr-1" /> +{analysisData.improvements}%
                      </div>
                    </div>
                  </div>

                  {/* Preview grid */}
                  {previewData && (
                    <div className="bg-gray-950 rounded-xl overflow-hidden border border-gray-700">
                      <div className="bg-gray-800 px-6 py-3 border-b border-gray-700">
                        <h4 className="font-medium">{t.preview.title} — {previewData.fileName || file?.name}</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-900">
                            <tr>{previewData.columns.map((c, i)=><th key={i} className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-r border-gray-700 last:border-r-0">{c}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {previewData.data.map((row, i)=>(
                              <tr key={i} className="hover:bg-gray-900/50">
                                {row.map((cell, j)=><td key={j} className="px-4 py-3 text-sm text-gray-300 border-r border-gray-800 last:border-r-0 font-mono">{cell || <span className="text-gray-600 italic">null</span>}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-gray-800 px-6 py-3 text-sm text-gray-400 border-t border-gray-700">
                        {language==='fr'?'Affichage de':'Showing'} {previewData.data.length} {language==='fr'?'lignes sur':'rows of'} {previewData.totalRows}
                      </div>
                    </div>
                  )}

                  {/* Suggested corrections */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                        <span>{language==='fr'?'Corrections suggérées par l’IA':'AI Suggested Corrections'}</span>
                      </h3>
                    </div>

                    {analysisData.columns.map((col) => col.corrections.length > 0 && (
                      <div key={col.name} className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${col.quality>=80?'bg-green-500':col.quality>=60?'bg-yellow-500':'bg-red-500'}`}></div>
                            <div>
                              <h4 className="text-lg font-semibold">{col.name}</h4>
                              <p className="text-sm text-gray-400">{col.aiSuggestion}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold">{col.quality}%</div>
                            <div className="text-sm text-gray-400">{col.issues} issues</div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {col.corrections.map((cor, i) => (
                            <div key={i} className="bg-gray-950 rounded-xl p-4 border border-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                                  <div>
                                    <span className="text-xs text-gray-500">Row {cor.row}</span>
                                    <div className="font-mono text-sm text-red-400 bg-red-900/20 px-2 py-1 rounded mt-1">{cor.old}</div>
                                  </div>
                                  <div className="flex justify-center"><ArrowRight className="w-5 h-5 text-gray-500" /></div>
                                  <div>
                                    <span className="text-xs text-gray-500">{language==='fr'?'Correction':'Fix'}</span>
                                    <div className="font-mono text-sm text-green-400 bg-green-900/20 px-2 py-1 rounded mt-1">{cor.new}</div>
                                  </div>
                                </div>
                                <div className="ml-6 text-right text-xs text-gray-500">confidence: {cor.confidence}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Insights */}
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-400" />
                      <span>{language==='fr'?'Insights Business':'Business Insights'}</span>
                    </h3>
                    <div className="space-y-4">
                      {analysisData.insights.map((ins, i)=>(
                        <div key={i} className="bg-gray-950 rounded-xl p-4 border border-gray-700">
                          <h4 className="font-semibold mb-1">{ins.title}</h4>
                          <p className="text-gray-400 text-sm">{ins.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onClick={downloadCSVFromCleanedPreview} className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl">
                      <Download className="w-5 h-5" /><span>{language==='fr'?'CSV Nettoyé':'Cleaned CSV'}</span>
                    </button>
                    <button onClick={()=>setShowUpgradeModal(true)} className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl">
                      <FileText className="w-5 h-5" /><span>PDF (Pro)</span>
                    </button>
                    <button onClick={()=>{
                      setFile(null); setPreviewData(null); setAnalysisData(null); setAutoFixResult(null); setAiMessages([]);
                    }} className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-xl">
                      <RefreshCw className="w-5 h-5" /><span>{language==='fr'?'Nouveau Fichier':'New File'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Chat side panel */}
            <div className="xl:col-span-1">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700 p-6 sticky top-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl grid place-items-center">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Assistant IA</h3>
                      <p className="text-xs text-gray-400">Realtime</p>
                    </div>
                  </div>
                  <button onClick={()=>setAiChatOpen(!aiChatOpen)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                  {aiMessages.length===0 ? (
                    <div className="text-center py-8">
                      <Brain className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">{language==='fr'?'L’IA parlera ici.':'AI will talk here.'}</p>
                    </div>
                  ) : aiMessages.map((m,i)=>(
                    <div key={i} className={`p-3 rounded-xl text-sm ${m.role==="user" ? "bg-blue-600 text-white ml-4" : "bg-gray-800 text-gray-200 mr-4 border border-gray-700"}`}>
                      <p className="text-xs leading-relaxed">{m.message}</p>
                    </div>
                  ))}
                  {aiThinking && (
                    <div className="bg-gray-800 border border-gray-700 p-3 rounded-xl mr-4">
                      <div className="flex items-center gap-2">
                        <Brain className="w-3 h-3 text-purple-400 animate-pulse" />
                        <span className="text-xs text-gray-300">{language==='fr'?'L’IA réfléchit…':'Thinking…'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {aiChatOpen && (
                  <div className="flex gap-2">
                    <input value={aiInput} onChange={(e)=>setAiInput(e.target.value)}
                      onKeyDown={(e)=>{ if (e.key==="Enter" && aiInput.trim()) {
                        setAiMessages(prev=>[...prev,{role:"user", message: aiInput, timestamp: Date.now()}]); setAiInput("");
                        setAiThinking(true);
                        setTimeout(()=>{ setAiMessages(prev=>[...prev,{role:"assistant", message: language==='fr'?'Je recommande de corriger les colonnes à faible qualité.':'Start with low-quality columns.', timestamp: Date.now()}]); setAiThinking(false); }, 800);
                      }}}
                      placeholder={language==='fr'?'Posez une question…':'Ask something…'}
                      className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"/>
                    <button onClick={()=>{
                      if (!aiInput.trim()) return;
                      setAiMessages(prev=>[...prev,{role:"user", message: aiInput, timestamp: Date.now()}]); setAiInput("");
                      setAiThinking(true);
                      setTimeout(()=>{ setAiMessages(prev=>[...prev,{role:"assistant", message: language==='fr'?'Je recommande de corriger les colonnes à faible qualité.':'Start with low-quality columns.', timestamp: Date.now()}]); setAiThinking(false); }, 800);
                    }} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg">
                      <Zap className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Auto diff panel */}
              {autoFixResult && (
                <div className="mt-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">{language==='fr'?'Diff (Mode Auto)':'Diff (Auto Mode)'}</h3>
                  <p className="text-gray-400 mb-3">
                    {language==='fr'?'Doublons exacts supprimés':'Exact duplicates removed'}: {autoFixResult.removed_exact_duplicates}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-900">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Column</th>
                          <th className="px-3 py-2 text-left">Old</th>
                          <th className="px-3 py-2 text-left">New</th>
                          <th className="px-3 py-2 text-left">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {(autoFixResult.diff_sample || []).slice(0, 50).map((d:any, i:number)=>(
                          <tr key={i}>
                            <td className="px-3 py-2">{d.row}</td>
                            <td className="px-3 py-2">{d.column}</td>
                            <td className="px-3 py-2 text-red-300">{d.old}</td>
                            <td className="px-3 py-2 text-green-300">{d.new}</td>
                            <td className="px-3 py-2">{d.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab==="schedule" && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
              <Calendar className="mx-auto h-16 w-16 text-gray-400 mb-4"/>
              <h3 className="text-2xl font-semibold mb-2">{language==='fr'?'Planification IA':'AI Scheduling'}</h3>
              <p className="text-gray-400">{language==='fr'?'Générez un fichier .ICS à importer dans votre agenda.':'Generate an .ICS file for your calendar.'}</p>
            </div>

            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
              <h4 className="text-xl font-semibold mb-6">{language==='fr'?'Créer une tâche':'Create a task'}</h4>
              <div className="flex gap-3">
                <input id="ics-rule" defaultValue="DAILY 09:00" className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl"/>
                <button onClick={()=>generateICS((document.getElementById('ics-rule') as HTMLInputElement).value)} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl">
                  {language==='fr'?'Générer .ICS':'Generate .ICS'}
                </button>
              </div>
              {icsContent && (<pre className="mt-6 bg-gray-900 p-4 rounded-xl text-xs overflow-x-auto">{icsContent}</pre>)}
            </div>
          </div>
        )}

        {activeTab==="jobs" && (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Jobs</h2>
              <div className="flex gap-3">
                <button onClick={loadJobs} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /><span>{language==='fr'?'Actualiser':'Refresh'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[{ label: language==='fr'?'En cours':'Running', count: running, icon: Clock },
                { label: language==='fr'?'Terminés':'Completed', count: completed, icon: CheckCircle },
                { label: language==='fr'?'En attente':'Pending', count: pending, icon: Target },
                { label: language==='fr'?'Échecs':'Failed', count: failed, icon: XCircle }].map((stat, idx)=>(
                  <div key={idx} className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <stat.icon className="w-8 h-8 text-blue-400" />
                      <span className="text-2xl font-bold">{stat.count}</span>
                    </div>
                    <div className="text-gray-400">{stat.label}</div>
                  </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold">{language==='fr'?'Historique des Jobs':'Job History'}</h3>
              </div>
              <div className="p-8 text-center">
                <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-400 mb-2">{language==='fr'?'Mode Démonstration':'Demo Mode'}</h4>
                <p className="text-gray-500 mb-6">
                  {language==='fr'?'Les jobs réels seront disponibles après configuration Pro.':'Real jobs will be available in Pro mode.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/70 grid place-items-center z-50" onClick={()=>setShowUpgradeModal(false)}>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4" onClick={(e)=>e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl grid place-items-center mx-auto mb-6">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">{language==='fr'?'Passez au Pro':'Upgrade to Pro'}</h3>
              <p className="text-gray-400 mb-8">{language==='fr'?'Débloquez toutes les fonctionnalités avancées':'Unlock advanced features'}</p>
            </div>
            <div className="space-y-4 mb-8">
              {[
                language==='fr'?'Fichiers jusqu\'à 100k lignes':'Files up to 100k rows',
                language==='fr'?'Scheduling 24/7':'24/7 Scheduling',
                language==='fr'?'Connexions bases de données':'Database connectors',
                language==='fr'?'Stockage cloud sécurisé':'Secure cloud storage',
                'Priority support'
              ].map((feature, idx)=>(
                <div key={idx} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={()=>setShowUpgradeModal(false)} className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl">Fermer</button>
              <button className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl">Demo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataCleaningAgent;
