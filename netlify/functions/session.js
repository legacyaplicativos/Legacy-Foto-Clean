// netlify/functions/session.js
// Manages Gemini key storage in an encrypted cookie

const crypto = require('crypto')

const SECRET = process.env.SESSION_SECRET || 'photoclean-dev-secret'
const COOKIE_NAME = 'pc_session'
const CORS_ORIGIN = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:5173'

function encrypt(text) {
  const key = crypto.scryptSync(SECRET, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(text) {
  try {
    const [ivHex, encHex] = text.split(':')
    const key = crypto.scryptSync(SECRET, 'salt', 32)
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()])
    return dec.toString('utf8')
  } catch { return null }
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  )
}

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Google-Token',
  }
}

exports.handler = async (event) => {
  const origin = event.headers.origin || CORS_ORIGIN
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  // POST — save session
  if (event.httpMethod === 'POST') {
    let body
    try { body = JSON.parse(event.body || '{}') } catch { body = {} }

    const { geminiKey, googleToken } = body
    if (!geminiKey || !googleToken) {
      return { statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Dados incompletos.' }) }
    }
    if (!geminiKey.startsWith('AIza')) {
      return { statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Chave Gemini inválida.' }) }
    }

    // Validate key
    try {
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'ok' }] }], generationConfig: { maxOutputTokens: 5 } })
        }
      )
      if (!testRes.ok) {
        const err = await testRes.json()
        throw new Error(err?.error?.message || 'Chave inválida')
      }
    } catch (e) {
      return { statusCode: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: `Chave Gemini inválida: ${e.message}` }) }
    }

    // Store encrypted in cookie
    const payload = JSON.stringify({ geminiKey, googleToken, ts: Date.now() })
    const encrypted = encrypt(payload)
    const isSecure = origin.startsWith('https')

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(encrypted)}; Path=/; HttpOnly; Max-Age=86400; SameSite=${isSecure ? 'None' : 'Lax'}${isSecure ? '; Secure' : ''}`,
      },
      body: JSON.stringify({ ok: true })
    }
  }

  // DELETE — logout
  if (event.httpMethod === 'DELETE') {
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`,
      },
      body: JSON.stringify({ ok: true })
    }
  }

  return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' }
}
