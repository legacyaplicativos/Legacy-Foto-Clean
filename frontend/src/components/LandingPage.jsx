import { useEffect, useRef, useState } from 'react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export default function LandingPage({ onSuccess }) {
  const clientRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = () => {
      if (!window.google?.accounts?.oauth2) return
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) {
            setError('Autorização negada. Tente novamente.')
            setLoading(false)
            return
          }
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` }
            })
            const userInfo = await res.json()
            onSuccess(response.access_token, userInfo)
          } catch {
            setError('Erro ao obter informações do usuário.')
            setLoading(false)
          }
        }
      })
    }

    if (window.google?.accounts) {
      init()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts) { init(); clearInterval(interval) }
      }, 200)
      return () => clearInterval(interval)
    }
  }, [onSuccess])

  const handleConnect = () => {
    setError('')
    if (!GOOGLE_CLIENT_ID) {
      setError('VITE_GOOGLE_CLIENT_ID não configurado. Veja o README.')
      return
    }
    if (!clientRef.current) {
      setError('Google ainda carregando. Aguarde 1s e tente novamente.')
      return
    }
    setLoading(true)
    clientRef.current.requestAccessToken()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem', borderBottom: '1px solid #22223a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#fbbf24',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
          }}>📸</div>
          <span className="font-display" style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
            PhotoClean
          </span>
        </div>
      </header>

      {/* Hero */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '4rem 1.5rem', textAlign: 'center'
      }}>
        {/* Animated icon */}
        <div style={{ position: 'relative', width: 180, height: 180, marginBottom: '3rem' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(251,191,36,0.08)', animation: 'pulse 4s ease-in-out infinite'
          }} />
          <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: '1px solid rgba(251,191,36,0.15)' }} />
          <div className="animate-float" style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 18, background: '#1a1a26',
              border: '1px solid #22223a', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '2.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>📷</div>
          </div>
          {[
            { emoji: '💨', angle: 0 }, { emoji: '🌑', angle: 90 },
            { emoji: '📸', angle: 180 }, { emoji: '🔁', angle: 270 },
          ].map(({ emoji, angle }) => {
            const rad = ((angle - 90) * Math.PI) / 180
            const r = 82
            return (
              <div key={angle} style={{
                position: 'absolute',
                left: `calc(50% + ${r * Math.cos(rad)}px - 18px)`,
                top: `calc(50% + ${r * Math.sin(rad)}px - 18px)`,
                width: 36, height: 36, borderRadius: 10,
                background: '#12121a', border: '1px solid #22223a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
              }}>{emoji}</div>
            )
          })}
        </div>

        <h1 className="font-display text-balance" style={{
          fontWeight: 800, fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          lineHeight: 1.15, letterSpacing: '-0.03em', maxWidth: 700,
          marginBottom: '1rem', marginTop: 0
        }}>
          Seu Google Photos,{' '}
          <span className="shimmer-text">sem a bagunça</span>
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.5)', fontSize: '1.125rem', fontWeight: 300,
          maxWidth: 480, marginBottom: '0.75rem', lineHeight: 1.6
        }}>
          IA analisa cada foto e identifica lixo — prints, duplicatas,
          fotos borradas, memes esquecidos e muito mais.
        </p>

        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem', marginBottom: '2.5rem' }}>
          Grátis · No browser · Suas fotos ficam na sua conta
        </p>

        <button
          onClick={handleConnect}
          disabled={loading}
          className="btn-primary"
          style={{ fontSize: '1rem', padding: '1rem 2rem', borderRadius: 16, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? (
            <>
              <span style={{
                width: 18, height: 18, border: '2px solid rgba(10,10,15,0.3)',
                borderTopColor: '#0a0a0f', borderRadius: '50%', display: 'inline-block',
                animation: 'spin 1s linear infinite', flexShrink: 0
              }} />
              Conectando...
            </>
          ) : (
            <>
              <GoogleIcon />
              Conectar com Google Photos
            </>
          )}
        </button>

        {error && (
          <div style={{
            marginTop: '1rem', padding: '0.625rem 1rem',
            background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: 10, color: '#fb7185', fontSize: '0.875rem', maxWidth: 400
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '2.5rem',
          justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem'
        }}>
          {['🔒 OAuth 2.0 seguro', '⚡ Gemini 1.5 Flash', '📦 Batches de 50 fotos'].map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </main>

      {/* Features */}
      <section style={{ borderTop: '1px solid #1a1a26', padding: '2.5rem 1.5rem' }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem'
        }}>
          {[
            { emoji: '💨', title: 'Borradas', desc: 'Fotos fora de foco detectadas automaticamente' },
            { emoji: '🌑', title: 'Escuras', desc: 'Imagens subexpostas sem utilidade' },
            { emoji: '📸', title: 'Screenshots', desc: 'Prints de apps, WhatsApp e redes sociais' },
            { emoji: '🔁', title: 'Duplicatas', desc: 'Fotos repetidas ocupando espaço' },
          ].map(f => (
            <div key={f.title} style={{
              background: 'rgba(18,18,26,0.5)', border: '1px solid #1a1a26', borderRadius: 12, padding: '1rem'
            }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{f.emoji}</div>
              <div className="font-display" style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{f.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgba(10,10,15,0.8)"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(10,10,15,0.8)"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="rgba(10,10,15,0.8)"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(10,10,15,0.8)"/>
    </svg>
  )
}
