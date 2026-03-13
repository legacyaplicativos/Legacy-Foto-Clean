import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2 } from 'lucide-react'

const SUGGESTIONS = [
  'Mostra fotos borradas',
  'Quais são as piores fotos?',
  'Encontra screenshots de WhatsApp',
  'Seleciona fotos escuras',
  'Mostra memes antigos',
  'Quantas duplicatas tenho?',
]

export default function ChatInterface({ photos, analyzed, googleToken, onPhotosFiltered }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Olá! 👋 Sou seu assistente de limpeza de fotos. Tenho acesso a ${photos.length} fotos suas com ${Object.keys(analyzed).length} analisadas.\n\nPosso te ajudar a encontrar e selecionar fotos específicas. Por exemplo: *"mostra fotos borradas"* ou *"quais são as piores fotos?"*`
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userText = text || input.trim()
    if (!userText || loading) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userText,
          photos: photos.map(p => ({ id: p.id, filename: p.filename })),
          analyzed,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessages(prev => [...prev, { role: 'assistant', content: data.response, filteredIds: data.filteredIds }])

      if (data.filteredIds?.length) {
        onPhotosFiltered(data.filteredIds)
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Erro: ${e.message || 'Algo deu errado'}. Verifique sua chave Gemini.`
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center mr-2 mt-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-ink-950" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-amber-400 text-ink-950 font-500'
                : 'bg-ink-800 border border-ink-700 text-white/80'
            }`}>
              {msg.content.split('\n').map((line, j) => (
                <span key={j}>
                  {line.replace(/\*(.*?)\*/g, (_, t) => t)}
                  {j < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
              {msg.filteredIds?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-ink-700">
                  <span className="text-xs text-amber-400">
                    ✓ {msg.filteredIds.length} foto(s) selecionadas na galeria
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-ink-950" />
            </div>
            <div className="bg-ink-800 border border-ink-700 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span className="text-sm text-white/50">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex gap-2 flex-wrap py-3">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-xs px-3 py-1.5 bg-ink-800 border border-ink-700 rounded-full text-white/50 hover:text-white hover:border-amber-400/40 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-ink-800">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ex: mostra fotos borradas, deleta prints antigos..."
          className="input-field flex-1 py-3"
          disabled={loading}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-4 h-4 text-ink-950" />
        </button>
      </div>
    </div>
  )
}
