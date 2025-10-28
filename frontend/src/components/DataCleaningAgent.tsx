// frontend/src/DataCleaningAgent.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CountryCode } from 'libphonenumber-js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  UploadCloud, Check, X, FileDown, History, Zap, Brain, Calendar, ChevronDown, Loader2, Info, Linkedin, ShieldCheck, FileText, Download, Replace
} from 'lucide-react';

import { 
  processDataCleaning, 
  getColumnTypes,
  CleaningReport, 
  RawData, 
  ColTypeMap,
  SemanticType 
} from './lib/cleaning';
import { 
  qualityScoreV2, 
  computeQualityReportBefore,
  computeQualityReportAfter, 
  QualityMetrics 
} from './lib/quality';

// --- i18n (Internationalization) ---
type Translations = {
  [key: string]: {
    // Header
    heroTitle: string;
    heroSubtitle: string;
    localBadge: string;
    shareLinkedIn: string;
    // Tabs
    tabAnalyze: string;
    tabIntelligence: string;
    tabSchedule: string;
    tabJobs: string;
    // Uploader
    uploaderTitle: string;
    uploaderSubtitle: string;
    uploaderSecurity: string;
    tryDemo: string;
    countryCodeLabel: string;
    countryFR: string;
    countryUS: string;
    countryGB: string;
    // Options
    imputeMissing: string;
    removeDuplicates: string;
    // Actions
    validateAll: string;
    downloadCSV: string;
    downloadJSONL: string;
    processing: string;
    // Preview
    previewTitle: string;
    previewBefore: string;
    previewAfter: string;
    badgeDuplicate: string;
    badgeInvalid: string;
    badgeOutlier: string;
    // Intelligence
    kpiQualityScore: string;
    kpiScoreBefore: string;
    kpiScoreAfter: string;
    kpiTotalCorrections: string;
    kpiTotalDuplicates: string;
    kpiTotalInvalids: string;
    kpiRowsProcessed: string;
    chartInvalidTitle: string;
    chartValidityTitle: string;
    chartLabelValid: string;
    chartLabelInvalid: string;
    outlierTitle: string;
    outlierDesc: string;
    // Placeholders
    scheduleTitle: string;
    scheduleDesc: string;
    jobsTitle: string;
    jobsDesc: string;
  };
};

const translations: Translations = {
  en: {
    heroTitle: "DataClean AI — Real data cleaning. Local. Private. Audited.",
    heroSubtitle: "Domain-fixed emails, E.164 phones, ISO dates, deduplication, imputation, Quality Score.",
    localBadge: "100% Local / No Cloud Upload",
    shareLinkedIn: "Share on LinkedIn",
    tabAnalyze: "Analyze",
    tabIntelligence: "Intelligence",
    tabSchedule: "Schedule",
    tabJobs: "Jobs",
    uploaderTitle: "Drop your files or click here",
    uploaderSubtitle: "CSV, Excel, JSON, TXT (≤ 50 MB). Your data stays in your browser.",
    uploaderSecurity: "Secure Local Processing",
    tryDemo: "Try demo dataset",
    countryCodeLabel: "Phone Country Hint",
    countryFR: "France (FR)",
    countryUS: "USA (US)",
    countryGB: "UK (GB)",
    imputeMissing: "Impute missing/invalid (median/mode)",
    removeDuplicates: "Remove duplicates",
    validateAll: "Validate Corrections",
    downloadCSV: "Download Clean CSV",
    downloadJSONL: "Download Audit Log (JSONL)",
    processing: "Processing...",
    previewTitle: "Preview (first 10 rows)",
    previewBefore: "Before",
    previewAfter: "After",
    badgeDuplicate: "Duplicate",
    badgeInvalid: "Invalid",
    badgeOutlier: "Outlier",
    kpiQualityScore: "Quality Score",
    kpiScoreBefore: "Before",
    kpiScoreAfter: "After",
    kpiTotalCorrections: "Total Corrections",
    kpiTotalDuplicates: "Total Duplicates",
    kpiTotalInvalids: "Total Invalids",
    kpiRowsProcessed: "Rows Processed",
    chartInvalidTitle: "Top 7 Columns with Invalids",
    chartValidityTitle: "Global Validity",
    chartLabelValid: "Valid Cells",
    chartLabelInvalid: "Invalid Cells",
    outlierTitle: "Detected Outliers (by row index)",
    outlierDesc: "These numeric values are statistically unusual (IQR method).",
    scheduleTitle: "Schedule (Pro Feature)",
    scheduleDesc: "This feature is not available in the MVP. In a 'Pro' version, you could schedule recurring cleaning jobs.",
    jobsTitle: "Jobs History (Pro Feature)",
    jobsDesc: "This feature is not available in the MVP. In a 'Pro' version, you would see a history of all your cleaning jobs.",
  },
  fr: {
    heroTitle: "DataClean AI — Nettoyage de données VRAI. Local. Privé. Audité.",
    heroSubtitle: "Emails corrigés (domaines), Téléphones E.164, Dates ISO, Déduplication, Imputation, Score Qualité.",
    localBadge: "100% Local / Sans Upload",
    shareLinkedIn: "Partager sur LinkedIn",
    tabAnalyze: "Analyser",
    tabIntelligence: "Intelligence",
    tabSchedule: "Planifier",
    tabJobs: "Jobs",
    uploaderTitle: "Déposez vos fichiers ou cliquez ici",
    uploaderSubtitle: "CSV, Excel, JSON, TXT (≤ 50 Mo). Vos données restent dans votre navigateur.",
    uploaderSecurity: "Traitement local sécurisé",
    tryDemo: "Essayer le jeu de démo",
    countryCodeLabel: "Pays (pour téléphones)",
    countryFR: "France (FR)",
    countryUS: "USA (US)",
    countryGB: "Royaume-Uni (GB)",
    imputeMissing: "Imputer manquants/invalides (médiane/mode)",
    removeDuplicates: "Supprimer les doublons",
    validateAll: "Valider les corrections",
    downloadCSV: "Télécharger CSV propre",
    downloadJSONL: "Télécharger Log d'Audit (JSONL)",
    processing: "Traitement...",
    previewTitle: "Aperçu (10 premières lignes)",
    previewBefore: "Avant",
    previewAfter: "Après",
    badgeDuplicate: "Doublon",
    badgeInvalid: "Invalide",
    badgeOutlier: "Outlier",
    kpiQualityScore: "Score de Qualité",
    kpiScoreBefore: "Avant",
    kpiScoreAfter: "Après",
    kpiTotalCorrections: "Corrections totales",
    kpiTotalDuplicates: "Doublons totaux",
    kpiTotalInvalids: "Invalides totaux",
    kpiLignesTraitées: "Lignes traitées",
    chartInvalidTitle: "Top 7 Colonnes avec invalides",
    chartValidityTitle: "Validité Globale",
    chartLabelValid: "Cellules valides",
    chartLabelInvalid: "Cellules invalides",
    outlierTitle: "Outliers Détectés (par index de ligne)",
    outlierDesc: "Ces valeurs numériques sont statistiquement inhabituelles (méthode IQR).",
    scheduleTitle: "Planifier (Fonction Pro)",
    scheduleDesc: "Cette fonction n'est pas disponible dans le MVP. En version 'Pro', vous pourriez planifier des nettoyages récurrents.",
    jobsTitle: "Historique des Jobs (Fonction Pro)",
    jobsDesc: "Cette fonction n'est pas disponible dans le MVP. En version 'Pro', vous verriez l'historique de vos nettoyages.",
  }
};

// --- Composants UI "Futuristes" ---

const GlassCard: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg ${className}`}>
    {children}
  </div>
);

const NeonButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
  disabled?: boolean;
}> = ({ onClick, children, icon: Icon, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold
      text-white transition-all duration-300
      bg-cyan-600 hover:bg-cyan-500
      shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:shadow-[0_0_25px_rgba(6,182,212,0.8)]
      disabled:bg-gray-600 disabled:opacity-50 disabled:shadow-none
      ${className}
    `}
  >
    {Icon && <Icon size={18} />}
    {children}
  </button>
);

const TabButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ElementType;
  isActive: boolean;
}> = ({ onClick, children, icon: Icon, isActive }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium
      transition-all duration-300
      ${isActive
        ? 'text-cyan-300 bg-white/10 border-b-2 border-cyan-400'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
      }
    `}
  >
    <Icon size={18} />
    {children}
  </button>
);

const StatCard: React.FC<{ title: string; value: string | number; subtitle?: string; className?: string }> = ({ title, value, subtitle, className = '' }) => (
  <GlassCard className={`p-4 ${className}`}>
    <div className="text-sm font-medium text-cyan-300 uppercase tracking-wider">{title}</div>
    <div className="text-4xl font-bold text-white mt-1">{value}</div>
    {subtitle && <div className="text-sm text-gray-400 mt-1">{subtitle}</div>}
  </GlassCard>
);

const PrivacyBadge: React.FC<{ text: string, className?: string }> = ({ text, className = '' }) => (
  <div className={`
    inline-flex items-center gap-2 px-3 py-1
    bg-emerald-900/50 border border-emerald-400/50 rounded-full
    text-sm text-emerald-300 font-medium
    ${className}
  `}>
    <ShieldCheck size={16} />
    {text}
  </div>
);

const TypeBadge: React.FC<{ type: SemanticType, onClick: () => void }> = ({ type, onClick }) => {
  const colors: Record<SemanticType, string> = {
    text: "bg-gray-600 text-gray-100",
    number: "bg-blue-600 text-blue-100",
    date: "bg-purple-600 text-purple-100",
    email: "bg-green-600 text-green-100",
    phone: "bg-yellow-600 text-yellow-100",
    unknown: "bg-red-600 text-red-100"
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-1 ${colors[type]} px-2 py-0.5 rounded text-xs font-semibold uppercase transition-transform hover:scale-105`}>
      {type}
      <ChevronDown size={14} />
    </button>
  );
};

// --- Composant Principal ---

export function DataCleaningAgent() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [isLoading, setIsLoading] = useState(false);
  const [originalData, setOriginalData] = useState<RawData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [colTypes, setColTypes] = useState<ColTypeMap>({});
  
  const [countryCode, setCountryCode] = useState<CountryCode>('FR');
  const [options, setOptions] = useState({
    imputeMissing: false,
    removeDuplicates: false,
  });
  
  const [activeTab, setActiveTab] = useState('analyze');
  const [finalRows, setFinalRows] = useState<RawData[] | null>(null);
  
  // --- Traduction ---
  const t = useCallback((key: keyof Translations['en']) => {
    return translations[lang][key] || translations['en'][key];
  }, [lang]);

  // --- Handlers ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setIsLoading(true);
    setFinalRows(null);
    const file = acceptedFiles[0];
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let parsedData: RawData[];
        
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          const result = Papa.parse(data as string, { header: true, skipEmptyLines: true });
          parsedData = result.data as RawData[];
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          parsedData = XLSX.utils.sheet_to_json(worksheet) as RawData[];
        } else if (file.name.endsWith('.json')) {
          parsedData = JSON.parse(data as string);
        } else {
          throw new Error("Format de fichier non supporté");
        }

        const newHeaders = Object.keys(parsedData[0] || {});
        setHeaders(newHeaders);
        setColTypes(getColumnTypes(newHeaders));
        setOriginalData(parsedData);
      } catch (err) {
        console.error("Erreur de parsing:", err);
        alert(`Erreur: ${err instanceof Error ? err.message : 'Parsing failed'}`);
      }
      setIsLoading(false);
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
    },
    maxFiles: 1,
  });

  const loadDemo = async () => {
    setIsLoading(true);
    setFinalRows(null);
    try {
      const response = await fetch('/demo.csv');
      const text = await response.text();
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      const parsedData = result.data as RawData[];
      
      const newHeaders = Object.keys(parsedData[0] || {});
      setHeaders(newHeaders);
      setColTypes(getColumnTypes(newHeaders));
      setOriginalData(parsedData);
    } catch (err) {
      console.error("Erreur chargement démo:", err);
      alert("Impossible de charger le fichier de démo.");
    }
    setIsLoading(false);
  };
  
  const handleTypeOverride = (header: string, newType: SemanticType) => {
    setColTypes(prev => ({ ...prev, [header]: newType }));
  };

  // --- Moteur de Nettoyage (Memoized) ---
  const cleaningReport = useMemo((): (CleaningReport & {
    qualityBefore: { metrics: QualityMetrics, score: number };
    qualityAfter: { metrics: QualityMetrics, score: number };
  }) | null => {
    if (originalData.length === 0) return null;
    
    setIsLoading(true);
    
    // Rapport "Avant"
    const qualityBefore = computeQualityReportBefore(originalData, colTypes);
    const scoreBefore = qualityScoreV2(qualityBefore.metrics);
    
    // Rapport "Après"
    const report = processDataCleaning(originalData, colTypes, { ...options, countryCode });
    const qualityAfter = computeQualityReportAfter(report);
    const scoreAfter = qualityScoreV2(qualityAfter.metrics);
    
    // Note: setIsLoading(false) est délicat dans useMemo. 
    // On va le faire dans un effet ou accepter un court délai.
    // Pour cet UI, on va le laisser "isLoading" pendant le render.
    // Hack pour enlever le loader après le calcul
    Promise.resolve().then(() => setIsLoading(false));
    
    return {
      ...report,
      qualityBefore: { metrics: qualityBefore.metrics, score: scoreBefore },
      qualityAfter: { metrics: qualityAfter.metrics, score: scoreAfter },
    };
  }, [originalData, colTypes, options, countryCode]);

  // --- Actions ---
  const handleValidate = () => {
    if (!cleaningReport) return;
    setFinalRows(cleaningReport.proposalRows);
  };
  
  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!cleaningReport) return;
    const dataToExport = finalRows ?? cleaningReport.proposalRows;
    const csv = Papa.unparse(dataToExport);
    downloadFile('cleaned_data.csv', csv, 'text/csv;charset=utf-8;');
  };
  
  const handleDownloadJSONL = () => {
    if (!cleaningReport) return;
    const jsonl = cleaningReport.diffs.map(log => JSON.stringify(log)).join('\n');
    downloadFile('audit_log.jsonl', jsonl, 'application/jsonl;charset=utf-8;');
  };

  const handleShareLinkedIn = () => {
    const text = `J'teste cet outil IA de Data Cleaning 🤯 - 100% local, il corrige les emails, normalise les téléphones en E.164, unifie les dates... Très propre ! #DataQuality #DataCleaning #Analytics #AI #React`;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };
  
  // --- Données pour Graphiques ---
  const chartData = useMemo(() => {
    if (!cleaningReport) return { invalidBar: [], validityPie: [] };
    
    const invalidBar = Array.from(cleaningReport.invalidMap.entries())
      .map(([col, indices]) => ({ col, invalids: indices.length }))
      .sort((a, b) => b.invalids - a.invalids)
      .slice(0, 7);
      
    const totalCells = cleaningReport.stats.rowCount * cleaningReport.stats.colCount;
    const totalInvalids = cleaningReport.stats.invalids;
    const validityPie = [
      { name: t('chartLabelValid'), value: totalCells - totalInvalids },
      { name: t('chartLabelInvalid'), value: totalInvalids },
    ];
    
    return { invalidBar, validityPie };
  }, [cleaningReport, t]);

  const PIE_COLORS = ['#059669', '#DC2626']; // Vert Émeraude, Rouge

  // --- Rendu ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1220] to-[#0C1024] text-gray-200 font-sans p-4 md:p-8">
      {/* --- Header --- */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold text-white">{t('heroTitle')}</h1>
          <p className="text-cyan-300 mt-1">{t('heroSubtitle')}</p>
          <div className="mt-2 flex gap-4 justify-center md:justify-start">
            <PrivacyBadge text={t('localBadge')} />
            <button
              onClick={handleShareLinkedIn}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Linkedin size={16} /> {t('shareLinkedIn')}
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button onClick={() => setLang('fr')} className={`px-3 py-1 rounded ${lang === 'fr' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10'}`}>FR</button>
          <button onClick={() => setLang('en')} className={`px-3 py-1 rounded ${lang === 'en' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10'}`}>EN</button>
        </div>
      </header>

      {/* --- Tabs --- */}
      <nav className="flex border-b border-white/10 mb-6">
        <TabButton icon={Zap} isActive={activeTab === 'analyze'} onClick={() => setActiveTab('analyze')}>{t('tabAnalyze')}</TabButton>
        <TabButton icon={Brain} isActive={activeTab === 'intelligence'} onClick={() => setActiveTab('intelligence')}>{t('tabIntelligence')}</TabButton>
        <TabButton icon={Calendar} isActive={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')}>{t('tabSchedule')}</TabButton>
        <TabButton icon={History} isActive={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')}>{t('tabJobs')}</TabButton>
      </nav>

      {/* --- Contenu des Onglets --- */}
      
      {/* ====== ONGLET ANALYSER ====== */}
      {activeTab === 'analyze' && (
        <section>
          {/* --- Uploader --- */}
          <GlassCard className="p-6">
            <div 
              {...getRootProps()} 
              className={`
                p-8 border-2 border-dashed rounded-2xl cursor-pointer
                transition-colors duration-300 text-center
                ${isDragActive 
                  ? 'border-cyan-400 bg-cyan-900/30' 
                  : 'border-gray-600 hover:border-cyan-500 hover:bg-white/5'
                }
              `}
            >
              <input {...getInputProps()} />
              <UploadCloud size={48} className="mx-auto text-cyan-400" />
              <p className="text-xl font-semibold text-white mt-4">{t('uploaderTitle')}</p>
              <p className="text-gray-400 mt-1">{t('uploaderSubtitle')}</p>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between mt-4 gap-4">
              <NeonButton onClick={loadDemo} icon={FileText} className="bg-violet-600 hover:bg-violet-500 shadow-violet-500/50 hover:shadow-violet-500/80 w-full md:w-auto">
                {t('tryDemo')}
              </NeonButton>
              
              <div className="flex items-center gap-2">
                <label htmlFor="country" className="text-sm font-medium text-gray-300">{t('countryCodeLabel')}:</label>
                <select 
                  id="country"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value as CountryCode)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="FR">{t('countryFR')}</option>
                  <option value="US">{t('countryUS')}</option>
                  <option value="GB">{t('countryGB')}</option>
                </select>
              </div>

              <PrivacyBadge text={t('uploaderSecurity')} />
            </div>
          </GlassCard>

          {/* --- Options & Actions --- */}
          {cleaningReport && !isLoading && (
            <GlassCard className="p-6 mt-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="impute" checked={options.imputeMissing} onChange={e => setOptions(o => ({...o, imputeMissing: e.target.checked}))} className="h-4 w-4 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500" />
                    <label htmlFor="impute" className="text-gray-200">{t('imputeMissing')}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="dedupe" checked={options.removeDuplicates} onChange={e => setOptions(o => ({...o, removeDuplicates: e.target.checked}))} className="h-4 w-4 rounded text-cyan-500 bg-gray-700 border-gray-600 focus:ring-cyan-500" />
                    <label htmlFor="dedupe" className="text-gray-200">{t('removeDuplicates')}</label>
                  </div>
                </div>
                
                <div className="flex gap-2 flex-wrap justify-center">
                  <NeonButton onClick={handleValidate} icon={Check} className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/50 hover:shadow-emerald-500/80">
                    {t('validateAll')}
                  </NeonButton>
                  <NeonButton onClick={handleDownloadCSV} icon={Download} disabled={!cleaningReport}>
                    {t('downloadCSV')}
                  </NeonButton>
                  <NeonButton onClick={handleDownloadJSONL} icon={FileDown} className="bg-gray-600 hover:bg-gray-500 shadow-gray-500/50 hover:shadow-gray-500/80">
                    {t('downloadJSONL')}
                  </NeonButton>
                </div>
              </div>
            </GlassCard>
          )}

          {/* --- Loader --- */}
          {isLoading && (
            <div className="flex justify-center items-center gap-3 p-10 text-xl text-cyan-300">
              <Loader2 size={24} className="animate-spin" />
              {t('processing')}
            </div>
          )}

          {/* --- Aperçu Avant/Après --- */}
          {cleaningReport && !isLoading && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-white mb-3">{t('previewTitle')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/20">
                      {headers.map(h => (
                        <th key={h} className="p-3 text-left text-sm font-semibold text-cyan-300 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            {h}
                            <TypeBadge 
                              type={colTypes[h] || 'unknown'} 
                              onClick={() => {
                                // Simple dropdown (pourrait être un vrai menu)
                                const newType = prompt(`New type for ${h} (text, number, date, email, phone):`, colTypes[h]) as SemanticType;
                                if (newType && ['text', 'number', 'date', 'email', 'phone'].includes(newType)) {
                                  handleTypeOverride(h, newType);
                                }
                              }} 
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cleaningReport.proposalRows.slice(0, 10).map((proposalRow, rowIdx) => {
                      const originalRow = originalData[rowIdx];
                      const isDuplicate = cleaningReport.duplicateIndices.has(rowIdx);
                      
                      return (
                        <tr key={rowIdx} className={`border-b border-white/10 ${isDuplicate ? 'bg-red-900/20' : ''}`}>
                          {headers.map(h => {
                            const originalValue = originalRow ? String(originalRow[h] ?? '') : '';
                            const proposalValue = proposalRow[h];
                            const displayValue = String(proposalValue ?? '');
                            
                            const isChanged = originalValue !== displayValue;
                            const isInvalid = cleaningReport.invalidMap.get(h)?.includes(rowIdx);
                            const isOutlier = cleaningReport.outlierIdxByCol.get(h)?.includes(rowIdx);
                            
                            return (
                              <td key={`${rowIdx}-${h}`} className="p-3 text-sm text-gray-200 font-mono whitespace-nowrap align-top">
                                <div>
                                  {isChanged && !isInvalid && (
                                    <>
                                      <del className="text-red-400/70">{originalValue}</del>
                                      <br />
                                      <ins className="text-emerald-400 no-underline">{displayValue}</ins>
                                    </>
                                  )}
                                  {!isChanged && !isInvalid && (
                                    <span>{displayValue}</span>
                                  )}
                                  {isInvalid && (
                                     <>
                                      <del className="text-red-400/70">{originalValue}</del>
                                      <br />
                                      <ins className="text-red-400 no-underline font-bold">{displayValue}</ins>
                                    </>
                                  )}
                                </div>
                                <div className="flex gap-1 mt-1">
                                  {isDuplicate && <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">{t('badgeDuplicate')}</span>}
                                  {isInvalid && <span className="text-xs bg-yellow-600 text-black px-1.5 py-0.5 rounded font-bold">{t('badgeInvalid')}</span>}
                                  {isOutlier && <span className="text-xs bg-purple-500 text-white px-1.5 py-0.5 rounded font-bold">{t('badgeOutlier')}</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
      
      {/* ====== ONGLET INTELLIGENCE ====== */}
      {activeTab === 'intelligence' && (
        <section>
          {!cleaningReport && (
            <GlassCard className="p-8 text-center text-gray-400">
              <Brain size={48} className="mx-auto mb-4 text-cyan-500" />
              {t('uploaderTitle')} {t('tabAnalyze')} {t('tabIntelligence')}.
            </GlassCard>
          )}
          
          {cleaningReport && !isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title={t('kpiQualityScore')} value={`${cleaningReport.qualityAfter.score}%`} subtitle={`${t('kpiScoreBefore')}: ${cleaningReport.qualityBefore.score}%`} className="lg:col-span-2" />
              <StatCard title={t('kpiTotalCorrections')} value={cleaningReport.stats.corrections} />
              <StatCard title={t('kpiTotalDuplicates')} value={cleaningReport.stats.duplicates} />
              <StatCard title={t('kpiTotalInvalids')} value={cleaningReport.stats.invalids} />
              <StatCard title={t('kpiRowsProcessed')} value={cleaningReport.stats.rowCount} />
              
              {/* --- Graphiques --- */}
              <GlassCard className="p-6 md:col-span-2 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-4">{t('chartInvalidTitle')}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.invalidBar} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="col" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(20, 30, 50, 0.8)', border: '1px solid #38bdf8', borderRadius: '8px' }}
                      labelStyle={{ color: '#e0f2fe' }}
                    />
                    <Bar dataKey="invalids" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>
              
              <GlassCard className="p-6 md:col-span-2 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-4">{t('chartValidityTitle')}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData.validityPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                    >
                      {chartData.validityPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(20, 30, 50, 0.8)', border: '1px solid #38bdf8', borderRadius: '8px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </GlassCard>

              {/* --- Outliers --- */}
              {cleaningReport.outlierIdxByCol.size > 0 && (
                <GlassCard className="p-6 md:col-span-2 lg:col-span-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('outlierTitle')}</h3>
                  <p className="text-sm text-gray-400 mb-4">{t('outlierDesc')}</p>
                  <div className="max-h-60 overflow-y-auto font-mono text-sm">
                    {Array.from(cleaningReport.outlierIdxByCol.entries()).map(([col, indices]) => (
                      <div key={col} className="mb-2">
                        <strong className="text-purple-300">{col}:</strong>
                        <span className="text-gray-300 ml-2">{indices.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          )}
        </section>
      )}

      {/* ====== ONGLET PLANIFIER ====== */}
      {activeTab === 'schedule' && (
         <GlassCard className="p-8 text-center text-gray-400">
            <Calendar size={48} className="mx-auto mb-4 text-cyan-500" />
            <h2 className="text-2xl font-semibold text-white mb-2">{t('scheduleTitle')}</h2>
            <p>{t('scheduleDesc')}</p>
          </GlassCard>
      )}

      {/* ====== ONGLET JOBS ====== */}
      {activeTab === 'jobs' && (
         <GlassCard className="p-8 text-center text-gray-400">
            <History size={48} className="mx-auto mb-4 text-cyan-500" />
            <h2 className="text-2xl font-semibold text-white mb-2">{t('jobsTitle')}</h2>
            <p>{t('jobsDesc')}</p>
          </GlassCard>
      )}
    </div>
  );
}
