import React from 'react'

export default function DataTable({ columns, rows }: { columns: string[], rows: string[][] }) {
  return (
    <div className="bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
      <div className="bg-gray-800 px-4 py-2 text-sm text-gray-300">Aperçu</div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-300 border-r border-gray-800 last:border-r-0">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-900/50">
                {r.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-sm text-gray-200 border-r border-gray-900 last:border-r-0">
                    {cell || <span className="text-gray-600 italic">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
