import React, { useState } from "react";
import { BarChart3, Crown, Globe } from "lucide-react";
import DataCleaningAgent from "./components/DataCleaningAgent";

export default function App() {
  const [lang, setLang] = useState<"fr" | "en">("fr");

  const t = {
    fr: { title: "DataClean AI", subtitle: "Assistant IA pour nettoyage de données d'entreprise" },
    en: { title: "DataClean AI", subtitle: "AI Assistant for Enterprise Data Cleaning" },
  }[lang];

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-neon">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {t.title}
                </h1>
                <p className="text-sm text-gray-400">{t.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLang(lang === "fr" ? "en" : "fr")}
                className="btn-ghost flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">{lang.toUpperCase()}</span>
              </button>
              <button className="btn bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white hidden md:flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Pro
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <DataCleaningAgent lang={lang} />
      </main>
    </div>
  );
}
