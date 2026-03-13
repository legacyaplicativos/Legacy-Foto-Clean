import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles, LogOut, RefreshCw, Trash2, MessageSquare,
  LayoutGrid, Filter, CheckSquare, AlertTriangle
} from 'lucide-react'
import PhotoGrid from './PhotoGrid'
import ChatInterface from './ChatInterface'
import AnalysisProgress from './AnalysisProgress'
import { loadProgress, saveProgress } from '../utils/storage'
import { fetchPhotos, analyzePhotos } from '../utils/api'

const BATCH_SIZE = 50

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todas', emoji: '📷' },
  { key: 'ruim', label: 'Ruins', emoji: '🗑️' },
  { key: 'borrada', label: 'Borradas', emoji: '💨' },
  { key: 'escura', label: 'Escuras', emoji: '🌑' },
  { key: 'screenshot', label: 'Screenshots', emoji: '📸' },
  { key: 'duplicata', label: 'Duplicatas', emoji: '🔁' },
  { key: 'meme', label: 'Memes', emoji: '😂' },
  { key: 'documento', label: 'Documentos', emoji: '📄' },
  { key: 'util', label: 'Úteis', emoji: '⭐' },
]

export default function Dashboard({ userInfo, googleToken, onLogout }) {
  const [photos, setPhotos] = useState([])
  const [analyzed, setAnalyzed] = useState({}) // id -> analysis result
  const [selected, setSelected] = useState(new Set())
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('grid') // 'grid' | 'chat'
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [nextPageToken, setNextPageToken] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState('')
  const [error, setError] = useState('')

  // Load cached analysis
  useEffect(() => {
    const saved = loadProgress()
    if (saved?.analyzed) setAnalyzed(saved.analyzed)
    if (saved?.photos) setPhotos(saved.photos)
  }, [])

  const loadPhotos = useCallback(async (pageToken = null) => {
    setLoadingPhotos(true)
    setError('')
    try {
      const result = await fetchPhotos(googleToken, pageToken, 100)
      const newPhotos = pageToken ? [...photos, ...result.photos] : result.photos
      setPhotos(newPhotos)
      setNextPageToken(result.nextPageToken || null)
      const saved = loadProgress()
      saveProgress({ ...saved, photos: newPhotos })
    } catch (e) {
      setError('Erro ao carregar fotos. Verifique sua conexão.')
    } finally {
      setLoadingPhotos(false)
    }
  }, [googleToken, photos])

  useEffect(() => {
    if (photos.length === 0) loadPhotos()
  }, [])

  const startAnalysis = async () => {
    const unanalyzed = photos.filter(p => !analyzed[p.id]).slice(0, BATCH_SIZE)
    if (!unanalyzed.length) return

    setAnalyzing(true)
    setProgress({ current: 0, total: unanalyzed.length })

    const newAnalyzed = { ...analyzed }
    for (let i = 0; i < unanalyzed.length; i++) {
      const photo = unanalyzed[i]
      try {
        const result = await analyzePhotos(photo)
        newAnalyzed[photo.id] = result
        setAnalyzed({ ...newAnalyzed })
        setProgress({ current: i + 1, total: unanalyzed.length })
        const saved = loadProgress()
        saveProgress({ ...saved, analyzed: newAnalyzed })
      } catch {
        newAnalyzed[photo.id] = { error: true }
      }
    }
    setAnalyzing(false)
  }

  const filteredPhotos = photos.filter(p => {
    const analysis = analyzed[p.id]
    if (filter === 'all') return true
    if (filter === 'util') return analysis?.util === true
    return analysis?.[filter] === true
  })

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const ids = filteredPhotos.map(p => p.id)
    setSelected(prev => {
      if (ids.every(id => prev.has(id))) return new Set()
      return new Set(ids)
    })
  }

  const selectAllBad = () => {
    const badIds = filteredPhotos
      .filter(p => analyzed[p.id]?.ruim)
      .map(p => p.id)
    setSelected(new Set(badIds))
  }

  const deleteSelected = async () => {
    if (!selected.size) return
    setDeleteStatus('Movendo para lixeira...')
    try {
      const ids = Array.from(selected)
      const res = await fetch('/api/photos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ photoIds: ids }),
      })
      if (!res.ok) throw new Error('Erro na API')
      const remaining = photos.filter(p => !selected.has(p.id))
      setPhotos(remaining)
      setSelected(new Set())
      setDeleteStatus(`✓ ${ids.length} foto(s) enviadas para a lixeira`)
      setTimeout(() => setDeleteStatus(''), 3000)
      const newAnalyzed = { ...analyzed }
      ids.forEach(id => delete newAnalyzed[id])
      setAnalyzed(newAnalyzed)
      const saved = loadProgress()
      saveProgress({ ...saved, photos: remaining, analyzed: newAnalyzed })
    } catch {
      setDeleteStatus('Erro ao deletar. Tente novamente.')
      setTimeout(() => setDeleteStatus(''), 4000)
    }
  }

  const analyzedCount = Object.keys(analyzed).length
  const badCount = Object.values(analyzed).filter(a => a.ruim).length

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-ink-950/90 backdrop-blur-sm border-b border-ink-800/60 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-ink-950" />
            </div>
            <span className="font-display font-700 text-base tracking-tight">PhotoClean</span>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-white/40">
            <span><strong className="text-white">{photos.length}</strong> fotos</span>
            <span><strong className="text-amber-400">{analyzedCount}</strong> analisadas</span>
            {badCount > 0 && (
              <span><strong className="text-coral-400">{badCount}</strong> ruins</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-ink-800 rounded-lg p-1 gap-1">
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-ink-600 text-white' : 'text-white/40 hover:text-white'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView('chat')}
                className={`p-1.5 rounded-md transition-colors ${view === 'chat' ? 'bg-ink-600 text-white' : 'text-white/40 hover:text-white'}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            </div>

            {userInfo && (
              <img src={userInfo.picture} alt="" className="w-7 h-7 rounded-full ring-2 ring-ink-700" />
            )}
            <button onClick={onLogout} className="text-white/30 hover:text-coral-400 transition-colors p-1">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Quota warning */}
      <div className="bg-amber-400/5 border-b border-amber-400/15 px-4 py-2">
        <p className="text-xs text-amber-400/70 text-center max-w-7xl mx-auto">
          ⚡ Isso usa sua quota Gemini gratuita (até ~1.500 requests/dia).
          Cada análise consome 1 request. Processe em batches de 50 por vez.
        </p>
      </div>

      <div className="max-w-7xl mx-auto w-full flex-1 px-4 py-4">
        {view === 'chat' ? (
          <ChatInterface
            photos={photos}
            analyzed={analyzed}
            googleToken={googleToken}
            onPhotosFiltered={(filteredIds) => {
              setSelected(new Set(filteredIds))
              setView('grid')
            }}
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Analyze button */}
              <button
                onClick={startAnalysis}
                disabled={analyzing || loadingPhotos || photos.length === 0}
                className="btn-primary py-2 px-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Analisar com IA
                    {photos.filter(p => !analyzed[p.id]).length > 0 && (
                      <span className="ml-1 bg-ink-950/20 rounded-full px-1.5 text-xs">
                        {Math.min(photos.filter(p => !analyzed[p.id]).length, BATCH_SIZE)}
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Load more */}
              <button
                onClick={() => loadPhotos(nextPageToken)}
                disabled={loadingPhotos || !nextPageToken}
                className="btn-ghost py-2 px-4 text-sm disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPhotos ? 'animate-spin' : ''}`} />
                {loadingPhotos ? 'Carregando...' : 'Carregar mais'}
              </button>

              <div className="flex-1 min-w-0" />

              {/* Select actions */}
              {analyzedCount > 0 && (
                <button onClick={selectAllBad} className="btn-ghost py-2 px-3 text-sm text-coral-400 border-coral-400/30">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Selecionar ruins
                </button>
              )}

              {filteredPhotos.length > 0 && (
                <button onClick={selectAll} className="btn-ghost py-2 px-3 text-sm">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {filteredPhotos.every(p => selected.has(p.id)) ? 'Desmarcar' : 'Selecionar'} todos
                </button>
              )}

              {selected.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-2 px-4 py-2 bg-coral-500 hover:bg-coral-400 text-white rounded-xl text-sm font-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Deletar {selected.size} selecionada{selected.size > 1 ? 's' : ''}
                </button>
              )}
            </div>

            {/* Progress bar */}
            {analyzing && (
              <AnalysisProgress current={progress.current} total={progress.total} />
            )}

            {/* Delete status */}
            {deleteStatus && (
              <div className={`mb-3 px-4 py-2 rounded-xl text-sm ${
                deleteStatus.startsWith('✓')
                  ? 'bg-mint-400/10 border border-mint-400/20 text-mint-400'
                  : 'bg-amber-400/10 border border-amber-400/20 text-amber-400'
              }`}>
                {deleteStatus}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-3 px-4 py-2 rounded-xl text-sm bg-coral-400/10 border border-coral-400/20 text-coral-400">
                {error}
              </div>
            )}

            {/* Filters */}
            {analyzedCount > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
                {FILTER_OPTIONS.map(f => {
                  const count = f.key === 'all'
                    ? photos.length
                    : f.key === 'util'
                    ? Object.values(analyzed).filter(a => a.util).length
                    : Object.values(analyzed).filter(a => a[f.key]).length
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-500 whitespace-nowrap transition-all ${
                        filter === f.key
                          ? 'bg-amber-400 text-ink-950'
                          : 'bg-ink-800 text-white/50 hover:text-white border border-ink-700'
                      }`}
                    >
                      <span>{f.emoji}</span>
                      {f.label}
                      <span className={`ml-1 ${filter === f.key ? 'text-ink-700' : 'text-white/30'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Photo grid */}
            <PhotoGrid
              photos={filteredPhotos}
              analyzed={analyzed}
              selected={selected}
              onToggle={toggleSelect}
              loading={loadingPhotos && photos.length === 0}
            />
          </>
        )}
      </div>
    </div>
  )
}
