import { useState } from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

const TAG_CONFIG = {
  borrada:   { label: 'Borrada',    color: 'badge-red' },
  escura:    { label: 'Escura',     color: 'badge-red' },
  screenshot:{ label: 'Screenshot', color: 'badge-yellow' },
  duplicata: { label: 'Duplicata',  color: 'badge-yellow' },
  meme:      { label: 'Meme',       color: 'badge-yellow' },
  documento: { label: 'Documento',  color: 'badge-yellow' },
  tem_celular:{ label: 'Celular',   color: 'badge-yellow' },
  util:      { label: 'Útil ⭐',    color: 'badge-green' },
}

export default function PhotoCard({ photo, analysis, selected, onToggle }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  // Build thumbnail URL: Google Photos baseUrl + =w512-h512-c
  const thumbUrl = photo.baseUrl
    ? `${photo.baseUrl}=w300-h300-c`
    : null

  const tags = analysis
    ? Object.entries(TAG_CONFIG).filter(([key]) => analysis[key] === true)
    : []

  const isBad = analysis?.ruim
  const isAnalyzing = !analysis

  return (
    <div
      className={`photo-card relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 ${
        selected
          ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-ink-950 scale-[0.97]'
          : 'hover:scale-[1.02]'
      } ${isBad ? 'ring-1 ring-coral-500/40' : ''}`}
      onClick={onToggle}
      style={{ aspectRatio: '1' }}
    >
      {/* Image */}
      {thumbUrl ? (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 bg-ink-800 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-ink-600 animate-spin" />
            </div>
          )}
          <img
            src={thumbUrl}
            alt={photo.filename || ''}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-ink-800 flex items-center justify-center text-3xl">
          📷
        </div>
      )}

      {/* Overlay on hover */}
      <div className="photo-overlay absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent opacity-0 transition-opacity duration-200" />

      {/* Selected check */}
      <div className={`absolute top-2 right-2 transition-all duration-150 ${selected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
          selected ? 'bg-amber-400' : 'bg-ink-950/70 border border-white/30'
        }`}>
          {selected && <CheckCircle2 className="w-4 h-4 text-ink-950" />}
        </div>
      </div>

      {/* Analysis tags */}
      {tags.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-2 flex flex-wrap gap-1">
          {tags.slice(0, 2).map(([key, config]) => (
            <span key={key} className={config.color}>
              {config.label}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="badge bg-ink-800/80 text-white/50 border border-ink-700">
              +{tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Analyzing indicator */}
      {!analysis && (
        <div className="absolute bottom-2 left-2">
          <span className="badge bg-ink-800/80 text-white/40 border border-ink-700">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ...
          </span>
        </div>
      )}

      {/* Description tooltip on hover */}
      {analysis?.descricao && (
        <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-ink-950/90 backdrop-blur-sm rounded-lg p-2 text-xs text-white/70 leading-tight">
            {analysis.descricao}
          </div>
        </div>
      )}
    </div>
  )
}
