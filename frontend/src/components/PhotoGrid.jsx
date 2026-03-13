import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import PhotoCard from './PhotoCard'

export default function PhotoGrid({ photos, analyzed, selected, onToggle, loading }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-white/30">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-amber-400" />
        <p className="text-sm">Carregando suas fotos...</p>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-white/30">
        <span className="text-5xl mb-4">📭</span>
        <p className="text-base font-500">Nenhuma foto nessa categoria</p>
        <p className="text-sm mt-1">Tente outro filtro ou analise mais fotos</p>
      </div>
    )
  }

  return (
    <div className="grid-photo">
      {photos.map(photo => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          analysis={analyzed[photo.id]}
          selected={selected.has(photo.id)}
          onToggle={() => onToggle(photo.id)}
        />
      ))}
    </div>
  )
}
