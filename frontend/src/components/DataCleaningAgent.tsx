import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload, FileText, BarChart3, Calendar, Settings, Download, Play,
  Clock, CheckCircle, XCircle, Crown, Globe, RefreshCw, Eye, TrendingUp,
  Sparkles, MessageCircle, Zap, Target, ArrowRight, ShieldCheck, Wand2, ListChecks
} from "lucide-react";
import { api } from "../utils/api";
import { arrayToCSV, downloadText } from "../utils/csv";
import { buildPdfReport } from "../utils/pdf";
import type { Preview, KPI } from "../types";

type Props = { lang: "fr" | "en" };

const TXT = {
  fr: {
    tabs: { analyze: "Analyser", dedupe: "Dédoublonner", rules: "Règles", schedule: "Planifier", jobs: "Jobs" },
    drop: "Déposez vos fichiers ou cliquez ici",
    formats: "CSV, Excel, JSON, TXT",
    max: "Taille max: 50 Mo",
    free: "Analyse gratuite - 1000 lignes",
    privacy: "Traitement local sécurisé",
    start: "Commencer l'analyse IA",
    insights: "Insights IA",
    aiThinking: "L'IA réfléchit...",
    autoMode: "Mode Auto (fixes sûrs)",
    diff: "Diff & validations",
    export: { csv: "CSV (échantillon)", pdf: "Rapport PDF", ics: "Télécharger .ICS" },
    dedupe: { title: "Fuzzy Dedupe", keys: "Clés composites", threshold: "Seuil de similarité", run: "Détecter", pairs: "Paires détectées" },
    rules: { title: "Rule Builder", required: "Obligatoire", regex: "Regex", presets: "Presets", save: "Sauvegarder règles" },
    schedule: { title: "Planification", rule: "Règle ICS (ex: DAILY 09:00)", gen: "Générer .ICS" },
    jobs: { title: "Gestion des Jobs" },
  },
  en: {
    tabs: { analyze: "Analyze", dedupe: "Dedupe", rules: "Rules", schedule: "Schedule", jobs: "Jobs" },
    drop: "Drop your files here or click",
    formats: "CSV, Excel, JSON, TXT",
    max: "Max size: 50 MB",
    free: "Free analysis - 1000 rows",
    privacy: "Secure local processing",
    start: "Start AI Analysis",
    insights: "AI Insights",
    aiThinking: "AI is thinking...",
    autoMode: "Auto Mode (safe fixes)",
    diff: "Diff & validations",
    export: { csv: "CSV (sample)", pdf: "PDF Report", ics: "Download .ICS" },
    dedupe: { title: "Fuzzy Dedupe", keys: "Composite keys", threshold: "Similarity threshold", run: "Detect", pairs: "Pairs detected" },
    rules: { title: "Rule Builder", required: "Required", regex: "Regex", presets: "Presets", save: "Save rules" },
    schedule: { title: "Schedule", rule: "ICS Rule (e.g., DAILY 09:00)", gen: "Generate .ICS" },
    jobs: { title: "Jobs" },
  }
};

const PRESETS = [
  { name: "Emails essentiels", rules: [{ column: "email", required: true, regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }] },
  { name: "Téléphones E.164", rules: [{ column: "phone", required: false, regex: "^\\+\\d{8,15}$" }] },
  { name: "Dates ISO", rules: [{ column: "date_created", required: false, regex: "^\\d{4}-\\d{2}-\\d{2}$" }] },
];

export default function DataCleaningAgent({ lang }: Props) {
  const t = TXT[lang];
  const [active, setActive] = useState<"analyze" | "dedupe" | "rules" | "schedule" | "jobs">("analyze");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [detected, setDetected] = useState<Record<string, string>>({});
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [isAnalyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [autoFix, setAutoFix] = useState<{ cleaned_preview?: Record<string, any>[]; diff_sample?: any[]; removed_exact_duplicates?: number } | null>(null);

  // Dedupe UI
  const [dupeKeys, setDupeKeys] = useState<string[]>([]);
  const [dupeThreshold, setDupeThreshold] = useState(90);
  const [dupePairs, setDupePairs] = useState<{ i: number; j: number; score: number }[]>([]);

  // Rules UI
  const [rules, setRules] = useState<{ column: string; required?: boolean; regex?: string }[]>(() => {
    const raw = localStorage.getItem("dca_rules");
    return raw ? JSON.parse(raw) : [];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = preview?.columns || [];
  const previewRecords = useMemo(() => {
    if (!preview) return [];
    return preview.data.map((row) => {
      const obj: Record<string, any> = {};
      row.forEach((val, i) => (obj[headers[i]] = val));
      return obj;
    });
  }, [preview, headers]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files[0]) handleUpload(files[0]);
  }, []);

  async function handleUpload(f: File) {
    setFile(f);
    setPreview(null);
    setDetected({});
    setKpi(null);
    setInsights([]);
    setAutoFix(null);
    setDupePairs([]);
    setActive("analyze");

    setAnalysisStep("Upload...");
    try {
      const res = await api.analyze(f);
      setPreview(res.preview);
      setKpi(res.kpi);
      setDetected(res.detected || {});
      setAnalysisStep("Analyse IA...");
      setAnalyzing(true);

      // Insights (LLM)
      setAiThinking(true);
      try {
        const ii = await api.insights(res.profile, res.kpi);
        setInsights(ii.insights || []);
      } catch (err) {
        setInsights(["LLM indisponible. Affichage des heuristiques."]);
      } finally {
        setAiThinking(false);
      }

      // Auto-fix si activé
      if (autoMode) {
        setAnalysisStep("Auto-fix (trim, ISO date, E.164, dedup exact)...");
        try {
          const fx = await api.autoFix(f);
          setAutoFix(fx);
        } catch (e: any) {
          console.warn("AutoFix error", e?.message);
        }
      }

      setAnalysisStep("Terminé");
    } catch (e: any) {
      alert("Erreur d'analyse: " + e?.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function renderTable() {
    if (!preview) return null;
    return (
      <div className="bg-gray-950 rounded-xl overflow-hidden border border-gray-700">
        <div className="bg-gray-800 px-6 py-3 border-b border-gray-700 flex items-center justify-between">
          <h4 className="font-medium text-gray-200">Aperçu</h4>
          <span className="text-xs text-gray-400">{preview.totalRows} lignes • {preview.totalCols} colonnes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-r border-gray-700 last:border-r-0">
                    <div className="flex items-center gap-2">
                      <span>{h}</span>
                      {detected[h] && (
                        <span className="badge border-blue-500 text-blue-300">{detected[h]}</span>
                      )}
                      {rules.find(r => r.column === h && (r.required || r.regex)) && (
                        <span className="badge border-purple-500 text-purple-300">rule</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {preview.data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-900/50 transition-colors">
                  {row.map((cell, j) => {
                    const col = headers[j];
                    const rule = rules.find(r => r.column === col);
                    let invalid = false;
                    if (rule?.required && (cell === "" || cell === null || cell === undefined)) invalid = true;
                    if (rule?.regex) {
                      try { if (!new RegExp(rule.regex).test(String(cell ?? ""))) invalid = true; }
                      catch { /* ignore bad regex */ }
                    }
                    return (
                      <td key={j} className={`px-4 py-3 text-sm border-r border-gray-800 last:border-r-0 font-mono ${invalid ? "text-red-300 bg-red-900/10" : "text-gray-300"}`}>
                        {String(cell ?? "") || <span className="text-gray-600 italic">null</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-800 px-6 py-3 text-sm text-gray-400 border-t border-gray-700">
          Affichage de {preview.data.length} lignes sur {preview.totalRows} total
        </div>
      </div>
    );
  }

  function exportPDF() {
    if (!kpi) return;
    const doc = buildPdfReport({
      fileName: preview?.fileName,
      kpi,
      insights,
      diffSample: autoFix?.diff_sample,
      cleanedPreview: autoFix?.cleaned_preview
    });
    doc.save(`DataClean_Report_${Date.now()}.pdf`);
  }

  function exportCSVSample() {
    if (!autoFix?.cleaned_preview?.length) {
      alert("Aucun échantillon nettoyé disponible (lancez l'auto-fix).");
      return;
    }
    const csv = arrayToCSV(autoFix.cleaned_preview);
    downloadText("cleaned_sample.csv", csv, "text/csv");
  }

  function addRule() {
    const column = prompt("Nom de la colonne ?");
    if (!column) return;
    const required = confirm("Rendre obligatoire ?");
    const regex = prompt("Regex (laisser vide si non) ?");
    const newRules = [...rules, { column, required, regex: regex || undefined }];
    setRules(newRules);
    localStorage.setItem("dca_rules", JSON.stringify(newRules));
  }

  function applyPreset(p: typeof PRESETS[number]) {
    const merged = [...rules];
    for (const r of p.rules) {
      const idx = merged.findIndex(x => x.column === r.column);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...r };
      else merged.push(r);
    }
    setRules(merged);
    localStorage.setItem("dca_rules", JSON.stringify(merged));
  }

  async function runFuzzy() {
    if (!dupeKeys.length) { alert("Choisis au moins une clé."); return; }
    try {
      const rows = previewRecords.slice(0, 300); // échantillon pour vitesse
      const res = await api.fuzzy(rows, dupeKeys, dupeThreshold);
      setDupePairs(res.pairs);
    } catch (e: any) {
      alert("Erreur fuzzy: " + e?.message);
    }
  }

  return (
    <>
      {/* Onglets */}
      <nav className="border-b border-gray-800 bg-gray-900/50 -mt-4 -mx-6 px-6 mb-8">
        <div className="flex space-x-8">
          {[
            { id: "analyze", label: TXT[lang].tabs.analyze, icon: BarChart3 },
            { id: "dedupe", label: TXT[lang].tabs.dedupe, icon: Target },
            { id: "rules", label: TXT[lang].tabs.rules, icon: ListChecks },
            { id: "schedule", label: TXT[lang].tabs.schedule, icon: Calendar },
            { id: "jobs", label: TXT[lang].tabs.jobs, icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors ${
                active === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ANALYZE */}
      {active === "analyze" && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3 space-y-8">
            {!preview && !isAnalyzing && (
              <div className="text-center">
                <div
                  onDrop={onDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="relative border-2 border-dashed border-gray-600 hover:border-blue-400 rounded-3xl p-16 cursor-pointer transition-all duration-300 group bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-sm"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls,.json,.txt"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-12 h-12 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-3">{TXT[lang].drop}</h3>
                  <p className="text-gray-400 mb-6">{TXT[lang].formats}</p>
                  <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>{TXT[lang].max}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>{TXT[lang].free}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span>{TXT[lang].privacy}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {preview && (
              <>
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-blue-600/20 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{preview.fileName || "Fichier"}</h3>
                        <p className="text-gray-400">{preview.totalRows} lignes • {preview.totalCols} colonnes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800 px-3 py-2 rounded-xl border border-gray-700">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        <span>{TXT[lang].autoMode}</span>
                        <input type="checkbox" className="accent-blue-500" checked={autoMode} onChange={e => setAutoMode(e.target.checked)} />
                      </label>
                      <button onClick={() => handleUpload(file!)} className="btn-primary flex items-center gap-2">
                        <Wand2 className="w-4 h-4" />
                        {TXT[lang].start}
                      </button>
                    </div>
                  </div>

                  {kpi && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="card p-4">
                        <div className="text-gray-400 text-sm">Score</div>
                        <div className="text-2xl font-bold">{kpi.qualityScore}%</div>
                        <div className="text-green-400 text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +possible</div>
                      </div>
                      <div className="card p-4">
                        <div className="text-gray-400 text-sm">Lignes</div>
                        <div className="text-2xl font-bold">{kpi.rows}</div>
                      </div>
                      <div className="card p-4">
                        <div className="text-gray-400 text-sm">Colonnes</div>
                        <div className="text-2xl font-bold">{kpi.cols}</div>
                      </div>
                      <div className="card p-4">
                        <div className="text-gray-400 text-sm">Duplicats</div>
                        <div className="text-2xl font-bold">{kpi.dupPct}%</div>
                      </div>
                    </div>
                  )}

                  {renderTable()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button onClick={exportCSVSample} className="btn bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" />
                    {TXT[lang].export.csv}
                  </button>
                  <button onClick={exportPDF} className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5" />
                    {TXT[lang].export.pdf}
                  </button>
                  <button onClick={() => { setPreview(null); setFile(null); setAutoFix(null); setDupePairs([]); }} className="btn-ghost flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5" />
                    Nouveau Fichier
                  </button>
                </div>

                {/* Insights + Diff */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      {TXT[lang].insights}
                    </h3>
                    <div className="space-y-2">
                      {aiThinking && (
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          {TXT[lang].aiThinking}
                        </div>
                      )}
                      {insights.map((line, i) => (
                        <div key={i} className="bg-gray-950 border border-gray-700 rounded-xl p-3 text-sm">{line}</div>
                      ))}
                    </div>
                  </div>

                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-400" />
                      {TXT[lang].diff}
                    </h3>
                    {!autoFix?.diff_sample?.length && (
                      <div className="text-gray-400 text-sm">Aucun diff (lancez l'auto-fix ou activez le Mode Auto).</div>
                    )}
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {autoFix?.diff_sample?.map((d, idx) => (
                        <div key={idx} className="bg-gray-950 rounded-xl p-3 border border-gray-700">
                          <div className="text-xs text-gray-500 mb-1">Ligne {d.row} • Colonne {d.column} • {d.reason}</div>
                          <div className="grid grid-cols-3 gap-3 items-center">
                            <div className="font-mono text-xs text-red-300 bg-red-900/20 px-2 py-1 rounded">{String(d.old)}</div>
                            <ArrowRight className="w-4 h-4 text-gray-500 mx-auto" />
                            <div className="font-mono text-xs text-green-300 bg-green-900/20 px-2 py-1 rounded">{String(d.new)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {autoFix?.removed_exact_duplicates ? (
                      <div className="text-xs text-gray-400 mt-3">
                        Doublons exacts supprimés: {autoFix.removed_exact_duplicates}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            {isAnalyzing && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-pulse">
                  <BarChart3 className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">Analyse en cours…</h3>
                <p className="text-blue-400 mb-8 text-lg">{analysisStep}</p>
                <div className="max-w-md mx-auto bg-gray-800 rounded-full h-3">
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full animate-pulse" style={{ width: "70%" }} />
                </div>
              </div>
            )}
          </div>

          {/* Panneau latéral mini-chat/statut */}
          <div className="xl:col-span-1">
            <div className="card p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Assistant IA</h3>
                    <p className="text-xs text-gray-400">Conseils instantanés</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="text-gray-300">
                  {file ? <>Fichier: <span className="text-gray-400">{file.name}</span></> : "Aucun fichier"}
                </div>
                <div className="text-gray-300">
                  Backend: <span className="text-gray-400">{(import.meta as any).env.VITE_API_BASE_URL || "HF Space"}</span>
                </div>
                <button className="btn-ghost mt-4 w-full" onClick={() => setActive("rules")}>
                  Configurer des règles
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDUPE */}
      {active === "dedupe" && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-yellow-400" /> {TXT[lang].dedupe.title}
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-300 mb-2">{TXT[lang].dedupe.keys}</div>
                <div className="flex flex-wrap gap-2">
                  {headers.map((h) => {
                    const active = dupeKeys.includes(h);
                    return (
                      <button
                        key={h}
                        onClick={() => setDupeKeys(active ? dupeKeys.filter(k => k !== h) : [...dupeKeys, h])}
                        className={`badge ${active ? "border-blue-500 text-blue-300" : "border-gray-600 text-gray-400"}`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-300 mb-2">{TXT[lang].dedupe.threshold}: {dupeThreshold}</div>
                <input type="range" min={70} max={100} value={dupeThreshold} onChange={e => setDupeThreshold(Number(e.target.value))} className="w-full" />
              </div>
              <div className="flex items-end">
                <button onClick={runFuzzy} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" /> {TXT[lang].dedupe.run}
                </button>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h4 className="font-semibold mb-3">{TXT[lang].dedupe.pairs}</h4>
            {!dupePairs.length && <div className="text-gray-400 text-sm">Aucune paire (ajuste les clés et le seuil).</div>}
            <div className="space-y-3">
              {dupePairs.map((p, idx) => (
                <div key={idx} className="bg-gray-950 border border-gray-700 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-2">Score: {p.score}</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <pre className="text-xs bg-gray-900 p-2 rounded-lg overflow-auto">{JSON.stringify(previewRecords[p.i], null, 2)}</pre>
                    <pre className="text-xs bg-gray-900 p-2 rounded-lg overflow-auto">{JSON.stringify(previewRecords[p.j], null, 2)}</pre>
                  </div>
                  <div className="mt-2 text-right">
                    <button className="btn-ghost">Fusionner (mock)</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RULES */}
      {active === "rules" && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-green-400" /> {TXT[lang].rules.title}
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {headers.map((h) => (
                <span key={h} className="badge border-gray-600 text-gray-400">{h}</span>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={addRule} className="btn-primary">+ Règle</button>
              <div className="relative">
                <details className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 cursor-pointer">
                  <summary className="text-sm">{TXT[lang].rules.presets}</summary>
                  <div className="mt-2 space-y-2">
                    {PRESETS.map((p) => (
                      <button key={p.name} onClick={() => applyPreset(p)} className="btn-ghost w-full text-left">
                        {p.name}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              <button
                onClick={() => { localStorage.setItem("dca_rules", JSON.stringify(rules)); alert("Règles sauvegardées."); }}
                className="btn-ghost"
              >
                {TXT[lang].rules.save}
              </button>
            </div>
            <div className="mt-4">
              <pre className="text-xs bg-gray-900 p-3 rounded-xl overflow-auto">{JSON.stringify(rules, null, 2)}</pre>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Les règles s’appliquent visuellement à la preview (rouge = invalide). Pour l’application totale (serveur/CSV complet), activera un job “Pro”.
          </div>
        </div>
      )}

      {/* SCHEDULE */}
      {active === "schedule" && (
        <div className="max-w-3xl space-y-6">
          <div className="text-center">
            <Calendar className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-2xl font-semibold">Planification IA</h3>
            <p className="text-gray-400">Générez un .ICS (ex: DAILY 09:00)</p>
          </div>
          <div className="card p-6">
            <div className="flex gap-3">
              <input id="icsRule" type="text" defaultValue="DAILY 09:00" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white" />
              <button
                className="btn-primary"
                onClick={async () => {
                  const val = (document.getElementById("icsRule") as HTMLInputElement).value || "DAILY 09:00";
                  try {
                    const { ics } = await api.ics(val);
                    downloadText("dataclean_schedule.ics", ics, "text/calendar");
                  } catch (e: any) {
                    alert("Erreur ICS: " + e?.message);
                  }
                }}
              >
                {TXT[lang].export.ics}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOBS */}
      {active === "jobs" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{TXT[lang].jobs.title}</h2>
            <div className="flex gap-3">
              <button className="btn bg-green-600 hover:bg-green-700 text-white flex items-center gap-2">
                <Play className="w-4 h-4" /> Lancer Test
              </button>
              <button onClick={async () => {
                try {
                  const res = await api.jobs();
                  alert("Jobs: " + JSON.stringify(res.jobs));
                } catch (e: any) {
                  alert("Erreur jobs: " + e?.message);
                }
              }} className="btn-ghost flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Actualiser
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "En cours", count: 2, icon: Clock },
              { label: "Terminés", count: 47, icon: CheckCircle },
              { label: "En attente", count: 5, icon: Target },
              { label: "Échecs", count: 1, icon: XCircle }
            ].map((stat, idx) => (
              <div key={idx} className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <stat.icon className="w-8 h-8 text-blue-400" />
                  <span className="text-2xl font-bold text-white">{stat.count}</span>
                </div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold">Historique des Jobs</h3>
            </div>
            <div className="p-8 text-center">
              <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-400 mb-2">Mode Démonstration</h4>
              <p className="text-gray-500 mb-6">Les jobs réels seront disponibles après mise en place du scheduler serveur (Pro).</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
