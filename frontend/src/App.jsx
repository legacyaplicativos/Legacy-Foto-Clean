import { useState, useEffect, useCallback, Component } from 'react'
import LandingPage from './components/LandingPage'
import GeminiSetup from './components/GeminiSetup'
import Dashboard from './components/Dashboard'
import { loadProgress, saveProgress } from './utils/storage'

// ──── Error Boundary ────
class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Algo deu errado</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', maxWidth: '400px' }}>
            {this.state.error?.message || 'Erro desconhecido'}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{ background: '#fbbf24', color: '#0a0a0f', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1.5rem', cursor: 'pointer', fontWeight: 700 }}
          >
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ──── App state machine ────
// 'landing'   → not connected
// 'gemini'    → Google connected, need Gemini key
// 'dashboard' → fully ready

function AppInner() {
  const [step, setStep] = useState('landing')
  const [googleToken, setGoogleToken] = useState(null)
  const [userInfo, setUserInfo] = useState(null)

  // Restore session on mount
  useEffect(() => {
    try {
      const saved = loadProgress()
      if (saved?.geminiReady && saved?.googleToken) {
        setGoogleToken(saved.googleToken)
        setUserInfo(saved.userInfo || null)
        setStep('dashboard')
      }
      // Don't restore partial states - force fresh login for security
    } catch {
      // ignore storage errors
    }
  }, [])

  const handleGoogleSuccess = useCallback((token, info) => {
    setGoogleToken(token)
    setUserInfo(info)
    setStep('gemini')
  }, [])

  const handleGeminiReady = useCallback(() => {
    saveProgress({ googleToken, userInfo, geminiReady: true })
    setStep('dashboard')
  }, [googleToken, userInfo])

  const handleLogout = useCallback(() => {
    if (googleToken) {
      try { window.google?.accounts?.oauth2?.revoke(googleToken, () => {}) } catch {}
    }
    fetch('/api/session', { method: 'DELETE' }).catch(() => {})
    setGoogleToken(null)
    setUserInfo(null)
    saveProgress(null)
    setStep('landing')
  }, [googleToken])

  return (
    <div style={{ minHeight: '100vh' }}>
      {step === 'landing' && (
        <LandingPage onSuccess={handleGoogleSuccess} />
      )}
      {step === 'gemini' && (
        <GeminiSetup
          userInfo={userInfo}
          googleToken={googleToken}
          onReady={handleGeminiReady}
          onLogout={handleLogout}
        />
      )}
      {step === 'dashboard' && (
        <Dashboard
          userInfo={userInfo}
          googleToken={googleToken}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
