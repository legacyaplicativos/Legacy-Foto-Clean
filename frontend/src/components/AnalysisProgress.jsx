import { Sparkles } from 'lucide-react'

export default function AnalysisProgress({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="mb-4 bg-ink-900 border border-ink-700 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-amber-400">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="font-display font-700 text-sm">Gemini analisando fotos...</span>
        </div>
        <span className="font-mono text-sm text-white/50">
          {current} / {total}
        </span>
      </div>

      <div className="relative h-2 bg-ink-800 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 progress-shimmer rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-white/30 mt-2">
        {pct}% concluído · Processa thumbnails 512×512 via Gemini 1.5 Flash
      </p>
    </div>
  )
}
