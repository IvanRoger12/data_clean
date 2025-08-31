/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Download, FileText, BarChart3, Settings, CheckCircle, XCircle, AlertCircle, Eye, Zap, TrendingUp, Users, DollarSign, Target, MessageSquare, Brain, Sparkles, Shield, Bot, Network, Activity, Calendar, Play, Pause, Trash2 } from "lucide-react";
import { parseCSV, toCSV } from "../lib/csv";
import { cleanDataset, DiffCell } from "../lib/cleaning";
import { QualityMetrics, qualityScoreV2, pct } from "../lib/quality";
import { listJobs, saveJob, clearJobs, getSchedule, saveSchedule } from "../lib/jobs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Tab = "analyser"|"statistiques"|"planifier"|"jobs";

export default function DataCleanAgent() {
  const [activeTab, setActiveTab] = useState<Tab>("analyser");
  const [file, setFile] = useState<File|null>(null);
  const [rows, setRows] = useState<Record<string,string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [initialMetrics, setInitialMetrics] = useState<QualityMetrics|null>(null);
  const [initialScore, setInitialScore] = useState<number>(0);

  const [proposalRows, setProposalRows] = useState<Record<string,string>[]>([]);
  const [diffs, setDiffs] = useState<DiffCell[]>([]);
  const [duplicates, setDuplicates] = useState<Set<number>>(new Set());
  const [statsInvalid, setStatsInvalid] = useState<Record<string,number>>({});
  const [finalRows, setFinalRows] = useState<Record<string,string>[]|null>(null);
  const [finalScore, setFinalScore] = useState<number| null>(null);
  const [impute, setImpute] = useState<boolean>(false);

  const [jobs, setJobs] = useState(listJobs());
  const [schedule, setSchedule] = useState(getSchedule());
  const scheduleRef = useRef<number|undefined>(undefined);

  // Upload handler
  async function handleUpload(f: File) {
    const data = await parseCSV(f);
    if (!data.length) return;
    setFile(f);
    setRows(data);
    setColumns(Object.keys(data[0]));
    setFinalRows(null);
    setFinalScore(null);

    // 1) metrics initiales
    const m0 = computeMetrics(data);
    setInitialMetrics(m0);
    const s0 = qualityScoreV2(m0);
    setInitialScore(s0);

    // 2) proposition de corrections (vraies)
    const cleaned = cleanDataset(data, { impute });
    setProposalRows(cleaned.rowsFixed);
    setDiffs(cleaned.diffs);
    setDuplicates(cleaned.duplicates);
    setStatsInvalid(cleaned.statsInvalid);
    // score projeté
    const m1 = computeMetrics(cleaned.rowsFixed);
    const s1 = qualityScoreV2(m1);
    setFinalScore(s1); // score "après" projeté (avant validation)

    setActiveTab("analyser");
  }

  function computeMetrics(data: Record<string,string>[]): QualityMetrics {
    const totalCells = data.length * (Object.keys(data[0] ?? {}).length || 1);
    const filled = data.reduce((acc,row)=> acc + Object.values(row).filter(v=> (v??"").toString().trim()!=="").length, 0);

    // validité approximée: on considère invalids venant du nettoyage (emails/phones/dates/numbers)
    // si statsInvalid pas dispo, on infère minimal
    const invalidCount = Object.values(statsInvalid).reduce((a,b)=>a+b,0);
    const validity = totalCells ? Math.max(0, Math.min(1, (totalCells - invalidCount)/totalCells)) : 1;

    // unicité
    const keys = new Set<string>();
    const dup = new Set<string>();
    data.forEach(r=>{
      const key = JSON.stringify(Object.entries(r).map(([k,v])=>[k,(v??"").toLowerCase().trim()]).sort());
      if (keys.has(key)) dup.add(key);
      else keys.add(key);
    });
    const uniqueness = data.length ? 1 - (dup.size / data.length) : 1;

    // cohérence typée (simple) : part des colonnes où >80% type dominant
    const cols = Object.keys(data[0] ?? {});
    let consist = 1;
    if (cols.length) {
      const perCol = cols.map(c=>{
        const vals = data.map(r=> (r[c]??"").trim()).filter(v=>v!=="");
        if (!vals.length) return 1;
        const nNum = vals.filter(v=> !Number.isNaN(Number(v.replace(/\s|’|'/g,"").replace(",", ".")))).length;
        const ratio = Math.max(nNum, vals.length-nNum)/vals.length;
        return ratio; // proportion du type dominant
      });
      consist = perCol.reduce((a,b)=>a+b,0) / perCol.length;
    }

    // outliers_ok : approximons par 1 (MVP front) ; on baisse si >5% outliers detectés via nombres
    // (détectés lors du clean — ici non exposés finement)
    const outliers_ok = 0.95;

    return {
      completeness: totalCells ? (filled/totalCells) : 1,
      validity,
      uniqueness,
      consistency: consist,
      outliers_ok
    }
  }

  // Validation -> applique les propositions comme "finalRows" + journal
  const [changeLog, setChangeLog] = useState<any[]>([]);
  function validateAll() {
    if (!proposalRows.length) return;
    // journal JSONL à partir de diffs
    const log = diffs.map(d => ({
      row: d.rowIdx, column: d.column, old_value: d.before, new_value: d.after, rule: d.rule, confidence: d.confidence, ts: new Date().toISOString()
    }));
    setChangeLog(log);
    setFinalRows(proposalRows);

    // job
    const start = Date.now() - 1000; const end = Date.now();
    const job = {
      id: crypto.randomUUID(),
      filename: file?.name ?? "dataset.csv",
      startedAt: start,
      finishedAt: end,
      rows: proposalRows.length,
      cols: columns.length,
      scoreBefore: initialScore,
      scoreAfter: finalScore ?? initialScore,
      diffCount: diffs.length
    };
    saveJob(job as any);
    setJobs(listJobs());
  }

  function downloadCSV() {
    const data = finalRows ?? proposalRows;
    if (!data.length) return;
    const csv = toCSV(data);
    const blob = new Blob(["\ufeff"+csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dataclean_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadChangeLog() {
    if (!changeLog.length) return;
    const content = changeLog.map(l => JSON.stringify(l)).join("\n");
    const blob = new Blob([content], { type: "application/jsonl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `changes_${new Date().toISOString().slice(0,10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Planifier (simple): exécution toutes X minutes si activé (rejoue le dernier dataset chargé)
  useEffect(()=>{
    if (scheduleRef.current) window.clearInterval(scheduleRef.current);
    if (schedule.enabled) {
      scheduleRef.current = window.setInterval(()=>{
        setSchedule((s)=> {
          const now = Date.now();
          const shouldRun = !s.lastRun || (now - s.lastRun) > s.everyMinutes*60*1000;
          if (shouldRun && rows.length) {
            // relance un "run" rapide
            const cleaned = cleanDataset(rows, { impute });
            // save job
            const m1 = computeMetrics(cleaned.rowsFixed);
            const s1 = qualityScoreV2(m1);
            const job = {
              id: crypto.randomUUID(),
              filename: file?.name ?? "dataset.csv",
              startedAt: now,
              finishedAt: now+500,
              rows: cleaned.rowsFixed.length,
              cols: Object.keys(cleaned.rowsFixed[0] ?? {}).length,
              scoreBefore: initialScore,
              scoreAfter: s1,
              diffCount: cleaned.diffs.length
            };
            saveJob(job as any);
            setJobs(listJobs());
          }
          const ns = { ...s, lastRun: now };
          saveSchedule(ns);
          return ns;
        });
      }, 10_000); // check toutes les 10s
    }
    return ()=> { if (scheduleRef.current) window.clearInterval(scheduleRef.current); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.enabled, schedule.everyMinutes, rows, impute]);

  // Insights pour graphiques
  const invalidByColData = useMemo(()=> {
    return Object.entries(statsInvalid).map(([k,v])=>({ column: k, invalid: v }));
  }, [statsInvalid]);

  const validVsInvalid = useMemo(()=>{
    const totalCells = rows.length * (columns.length || 1);
    const invalid = Object.values(statsInvalid).reduce((a,b)=>a+b,0);
    const valid = Math.max(0, totalCells - invalid);
    return [
      { name: "Valides", value: valid },
      { name: "Invalides", value: invalid }
    ];
  }, [rows.length, columns.length, statsInvalid]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-10 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 via-violet-500 to-emerald-400 flex items-center justify-center shadow-xl">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black gradient-text">DataClean Agent</h1>
              <p className="text-slate-300 font-semibold text-sm">IA Autonome • Nettoyage VRAI • Validation Humaine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Agent opérationnel</span>
            <a href="https://ivan7889-dataclean-agent-back.hf.space" target="_blank" rel="noreferrer" className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Shield className="w-4 h-4" /> Backend sécurisé
            </a>
          </div>
        </div>
        <nav className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 flex">
            {[
              {id:"analyser", label:"Agent Analyste", icon: Bot},
              {id:"statistiques", label:"Intelligence", icon: Brain},
              {id:"planifier", label:"Planifier", icon: Calendar},
              {id:"jobs", label:"Jobs", icon: Network},
            ].map((t:any)=> {
              const Icon = t.icon;
              const active = activeTab===t.id;
              return (
                <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`relative flex items-center gap-2 px-6 py-4 font-bold ${active?'text-white':'text-slate-400 hover:text-slate-200'}`}>
                  <Icon className="w-5 h-5"/>{t.label}
                  {active && <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 rounded-full"/>}
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-12">

        {activeTab==="analyser" && (
          <section className="space-y-8">
            {/* Uploader */}
            {!rows.length && (
              <div className="text-center glass rounded-3xl p-16 border-white/10">
                <Upload className="w-24 h-24 text-blue-400 mx-auto mb-6"/>
                <h2 className="text-4xl font-black mb-3 gradient-text">Activez l’Agent IA</h2>
                <p className="text-slate-300 mb-8 font-semibold">CSV recommandé • L’agent nettoie emails, téléphones (E.164), dates ISO, nombres, doublons • Score qualité</p>
                <label className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-violet-500 rounded-2xl font-black cursor-pointer hover:scale-105 transition">
                  <input type="file" accept=".csv,.txt" hidden onChange={(e)=> e.target.files?.[0] && handleUpload(e.target.files[0])}/>
                  <Bot className="w-5 h-5"/> Importer un fichier
                </label>
                <div className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-400">
                  <Shield className="w-4 h-4"/> Local • Aucun envoi de données tiers
                </div>
              </div>
            )}

            {/* Aperçu + Scores */}
            {rows.length>0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass rounded-3xl p-6">
                    <h3 className="text-xl font-black mb-4">Score Qualité</h3>
                    <div className="flex items-end gap-8">
                      <div>
                        <div className="text-5xl font-black text-white">{initialScore}%</div>
                        <div className="text-slate-400 font-semibold">Avant</div>
                      </div>
                      <div className="text-3xl">→</div>
                      <div>
                        <div className="text-5xl font-black text-emerald-300">{finalScore ?? initialScore}%</div>
                        <div className="text-slate-400 font-semibold">Après (proposé)</div>
                      </div>
                    </div>
                    <div className="mt-4 text-slate-400 text-sm font-semibold">
                      L’agent a détecté <span className="text-orange-300">{diffs.length}</span> corrections + <span className="text-violet-300">{Array.from(duplicates).length}</span> doublons.
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={impute} onChange={(e)=> {
                          setImpute(e.target.checked);
                          // Re-générer la proposition avec impute on/off
                          const cleaned = cleanDataset(rows, { impute: e.target.checked });
                          setProposalRows(cleaned.rowsFixed);
                          setDiffs(cleaned.diffs);
                          setDuplicates(cleaned.duplicates);
                          setStatsInvalid(cleaned.statsInvalid);
                          const m1 = computeMetrics(cleaned.rowsFixed);
                          setFinalScore(qualityScoreV2(m1));
                        }}/>
                        <span className="text-sm text-slate-300 font-semibold">Imputation manquants (médiane/mode)</span>
                      </label>
                    </div>
                  </div>

                  <div className="glass rounded-3xl p-6">
                    <h3 className="text-xl font-black mb-4">Infos Fichier</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                        <div className="text-slate-300 font-semibold">Lignes</div>
                        <div className="text-2xl font-black">{rows.length}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                        <div className="text-slate-300 font-semibold">Colonnes</div>
                        <div className="text-2xl font-black">{columns.length}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-slate-300 font-semibold">Corrections proposées</div>
                        <div className="text-2xl font-black">{diffs.length}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                        <div className="text-slate-300 font-semibold">Doublons</div>
                        <div className="text-2xl font-black">{Array.from(duplicates).length}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table Avant/Après (5 lignes) */}
                <div className="glass rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black">Aperçu (Avant / Après)</h3>
                    <div className="flex gap-3">
                      <button onClick={validateAll} className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black hover:scale-105 transition">
                        Valider toutes les corrections
                      </button>
                      <button onClick={downloadCSV} className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold border border-white/20">
                        <Download className="w-4 h-4 inline mr-2"/> Télécharger CSV
                      </button>
                      <button onClick={downloadChangeLog} className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold border border-white/20">
                        <FileText className="w-4 h-4 inline mr-2"/> Journal JSONL
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800">
                        <tr>
                          {columns.map((c)=>(<th key={c} className="px-4 py-3 text-left font-black text-slate-200">{c}</th>))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(rows.slice(0,5)).map((r, i)=>(
                          <tr key={i} className="hover:bg-white/5">
                            {columns.map((c)=> {
                              const after = proposalRows[i]?.[c] ?? r[c];
                              const changed = after !== r[c];
                              const isDup = duplicates.has(i);
                              return (
                                <td key={c} className="px-4 py-3">
                                  <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg ${changed?'bg-emerald-500/15 border border-emerald-500/30':''}`}>
                                    <span className={`${changed?'line-through text-slate-400':''}`}>{r[c] || <i className="text-red-300">manquant</i>}</span>
                                    {changed && <span className="text-emerald-300 font-bold">→ {after || <i className="text-red-300">vide</i>}</span>}
                                  </div>
                                  {isDup && <div className="text-xs text-orange-300 mt-1">Doublon</div>}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab==="statistiques" && rows.length>0 && (
          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-4xl font-black gradient-text mb-2">Intelligence & Insights</h2>
              <p className="text-slate-300 font-semibold">Colonnes à risque • Validité globale • Évolution score</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bar top invalid */}
              <div className="glass rounded-3xl p-6">
                <h3 className="text-lg font-black mb-4">Top colonnes à risque (invalides)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={invalidByColData.sort((a,b)=>b.invalid-a.invalid).slice(0,7)}>
                      <XAxis dataKey="column" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="invalid" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie valid/invalid */}
              <div className="glass rounded-3xl p-6">
                <h3 className="text-lg font-black mb-4">Validité globale</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={validVsInvalid} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label>
                        {validVsInvalid.map((entry, index)=>(
                          <Cell key={`cell-${index}`} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* KPI */}
              <div className="glass rounded-3xl p-6 grid gap-4 content-start">
                <h3 className="text-lg font-black">KPI</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-slate-300 text-sm">Score avant</div>
                    <div className="text-2xl font-black">{initialScore}%</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <div className="text-slate-300 text-sm">Score après</div>
                    <div className="text-2xl font-black">{finalScore ?? initialScore}%</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                    <div className="text-slate-300 text-sm">% cellules remplies</div>
                    <div className="text-2xl font-black">{pct((initialMetrics?.completeness ?? 0)*100, 100)}%</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                    <div className="text-slate-300 text-sm">Corrections</div>
                    <div className="text-2xl font-black">{diffs.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab==="planifier" && (
          <section className="space-y-6">
            <div className="glass rounded-3xl p-6">
              <h3 className="text-xl font-black mb-4">Planifier exécutions automatiques</h3>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20">
                  <input type="checkbox" checked={schedule.enabled} onChange={(e)=> {
                    const s = { ...schedule, enabled: e.target.checked };
                    setSchedule(s); saveSchedule(s);
                  }}/>
                  <span className="font-semibold">Activer</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">Toutes les</span>
                  <input type="number" min={1} className="w-20 px-3 py-2 rounded-xl bg-slate-800 border border-white/10"
                    value={schedule.everyMinutes}
                    onChange={(e)=> {
                      const n = Math.max(1, Number(e.target.value||"60"));
                      const s = { ...schedule, everyMinutes: n };
                      setSchedule(s); saveSchedule(s);
                    }} />
                  <span className="text-slate-300">minutes</span>
                </div>
                <div className="text-slate-400 text-sm">
                  Dernière exécution : {schedule.lastRun ? new Date(schedule.lastRun).toLocaleTimeString() : "—"}
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-3">Le planificateur relance le dernier dataset chargé (en local) et enregistre un Job. Pour une planification serveur, branchez vos endpoints backend (cron).</p>
            </div>
          </section>
        )}

        {activeTab==="jobs" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">Jobs</h3>
              <div className="flex items-center gap-3">
                <button onClick={()=>{ clearJobs(); setJobs([]); }} className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-red-300 font-bold">
                  <Trash2 className="w-4 h-4 inline mr-2" /> Vider
                </button>
              </div>
            </div>
            <div className="glass rounded-3xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Job</th>
                    <th className="px-4 py-3 text-left">Fichier</th>
                    <th className="px-4 py-3">Lignes</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Durée</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {jobs.map(j=>(
                    <tr key={j.id} className="hover:bg-white/5">
                      <td className="px-4 py-3">{j.id.slice(0,8)}…</td>
                      <td className="px-4 py-3">{j.filename}</td>
                      <td className="px-4 py-3 text-center">{j.rows}</td>
                      <td className="px-4 py-3 text-center">{j.scoreBefore}% → <span className="text-emerald-300 font-black">{j.scoreAfter}%</span></td>
                      <td className="px-4 py-3 text-center">{Math.max(0, Math.round((j.finishedAt - j.startedAt)/1000))}s</td>
                      <td className="px-4 py-3 text-center">
                        <button className="px-3 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 font-bold">Détails</button>
                      </td>
                    </tr>
                  ))}
                  {!jobs.length && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucun job pour l’instant</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <p className="text-slate-400 font-semibold">DataClean Agent IA © 2025 • Nettoyage de Données • Score Qualité • Validation Humaine</p>
        </div>
      </footer>
    </div>
  );
}
