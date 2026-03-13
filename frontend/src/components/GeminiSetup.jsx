import { useState } from 'react'
import { ExternalLink, Key, ChevronRight, CheckCircle, Sparkles, LogOut, AlertCircle } from 'lucide-react'

const STEPS = [
  { num: '01', text: 'Acesse aistudio.google.com/app/apikey' },
  { num: '02', text: 'Clique em "Create API Key"' },
  { num: '03', text: 'Copie a chave gerada (começa com AIzaSy…)' },
  { num: '04', text: 'Cole aqui embaixo e clique em Continuar' },
]

export default function GeminiSetup({ userInfo, googleToken, onReady, onLogout }) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validated, setValidated] = useState(false)

  const handleSubmit = async () => {
    const trimmed = key.trim()
    if (!trimmed.startsWith('AIza')) {
      setError('A chave Gemini deve começar com "AIza". Verifique e tente novamente.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiKey: trimmed, googleToken }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Chave inválida')
      }
      setValidated(true)
      setTimeout(onReady, 800)
    } catch (e) {
      setError(e.message || 'Erro ao validar a chave. Verifique se é válida.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-ink-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-ink-950" />
          </div>
          <span className="font-display font-700 text-lg tracking-tight">PhotoClean</span>
        </div>

        {userInfo && (
          <div className="flex items-center gap-3">
            <img
              src={userInfo.picture}
              alt={userInfo.name}
              className="w-8 h-8 rounded-full ring-2 ring-mint-400/40"
            />
            <span className="text-sm text-white/60 hidden sm:block">{userInfo.name}</span>
            <button onClick={onLogout} className="text-white/30 hover:text-coral-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          {/* Progress */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center gap-2 text-mint-400">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-500">Google conectado</span>
            </div>
            <div className="flex-1 h-px bg-ink-700" />
            <div className="flex items-center gap-2 text-amber-400">
              <Key className="w-5 h-5" />
              <span className="text-sm font-500">Configurar Gemini</span>
            </div>
            <div className="flex-1 h-px bg-ink-800" />
            <div className="text-white/20 text-sm">Dashboard</div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Microtutorial */}
            <div>
              <h2 className="font-display font-700 text-2xl mb-2">
                Configure sua chave Gemini
              </h2>
              <p className="text-white/50 text-sm mb-6 leading-relaxed">
                O PhotoClean usa o Gemini 1.5 Flash — modelo gratuito do Google com
                até <strong className="text-amber-400">1.500 requests/dia</strong> no
                plano grátis. Você precisa de uma chave pessoal.
              </p>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mb-8 w-full justify-center py-3.5"
              >
                <ExternalLink className="w-4 h-4" />
                Gerar minha chave Gemini agora
              </a>

              {/* Steps */}
              <div className="space-y-3">
                {STEPS.map((s, i) => (
                  <div key={s.num} className="flex items-start gap-3">
                    <span className="font-mono text-xs text-amber-400/60 mt-0.5 shrink-0 w-6">
                      {s.num}
                    </span>
                    <span className="text-white/60 text-sm">{s.text}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-start gap-2 bg-ink-800/50 border border-ink-700 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-white/50 leading-relaxed">
                  Sua chave é enviada ao nosso backend apenas para fazer chamadas à API Gemini.
                  Ela fica salva somente na sessão atual e nunca é armazenada permanentemente.
                </p>
              </div>
            </div>

            {/* Input form */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6">
                <Key className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-700">Cole sua chave aqui</h3>
              </div>

              <label className="block text-sm text-white/50 mb-2 font-500">
                Chave da API Gemini
              </label>
              <input
                type="password"
                value={key}
                onChange={e => { setKey(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="ex: AIzaSyD3f8G..."
                className="input-field mb-1"
                autoComplete="off"
                spellCheck="false"
              />
              <p className="text-xs text-white/30 mb-6">
                A chave fica visível como •••• por segurança
              </p>

              {error && (
                <div className="flex items-start gap-2 bg-coral-400/10 border border-coral-400/20 rounded-xl p-3 mb-4">
                  <AlertCircle className="w-4 h-4 text-coral-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-coral-400">{error}</p>
                </div>
              )}

              {validated ? (
                <div className="flex items-center gap-2 justify-center py-3 bg-mint-400/10 border border-mint-400/20 rounded-xl text-mint-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-500">Chave validada! Entrando...</span>
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !key.trim()}
                  className="w-full btn-primary justify-center py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" />
                      Validando...
                    </>
                  ) : (
                    <>
                      Continuar
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}

              <div className="mt-4 pt-4 border-t border-ink-700">
                <div className="flex items-center justify-between text-xs text-white/30">
                  <span>Quota gratuita</span>
                  <span className="text-amber-400">~1.500 req/dia</span>
                </div>
                <div className="flex items-center justify-between text-xs text-white/30 mt-1">
                  <span>Modelo</span>
                  <span>gemini-1.5-flash</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
