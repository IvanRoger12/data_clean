import React from 'react'
import { Upload } from 'lucide-react'
import { allowedFile, sanitizeName } from '../lib/sanitize'

type Props = {
  onFile: (f: File) => void
}

export default function UploadArea({ onFile }: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!allowedFile(f.name)) {
      alert('Formats acceptés: CSV, Excel, JSON, TXT, YAML')
      return
    }
    const cleanName = sanitizeName(f.name)
    onFile(new File([f], cleanName, { type: f.type }))
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (!allowedFile(f.name)) {
      alert('Formats acceptés: CSV, Excel, JSON, TXT, YAML')
      return
    }
    const cleanName = sanitizeName(f.name)
    onFile(new File([f], cleanName, { type: f.type }))
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="relative border-2 border-dashed border-gray-700 hover:border-brand-500 rounded-3xl p-16 cursor-pointer transition-all duration-300 group bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-sm text-center"
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".csv,.xlsx,.xls,.json,.txt,.yaml,.yml"
        onChange={onPick}
      />
      <div className="w-24 h-24 bg-gradient-to-br from-brand-600/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
        <Upload className="w-12 h-12 text-brand-500 group-hover:text-brand-400 transition-colors" />
      </div>
      <h3 className="text-2xl font-semibold">Dépose ton fichier ici</h3>
      <p className="text-gray-400 mt-2">CSV, Excel, JSON, TXT, YAML • max 50 Mo</p>
      <p className="text-gray-500 text-sm mt-1">Traitement local/serveur sans persistance</p>
    </div>
  )
}
