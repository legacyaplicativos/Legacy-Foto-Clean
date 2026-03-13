// netlify/functions/photos-delete.js
const crypto = require('crypto')
const SECRET = process.env.SESSION_SECRET || 'photoclean-dev-secret'
const COOKIE_NAME = 'pc_session'

function decrypt(text) {
  try {
    const [ivHex, encHex] = text.split(':')
    const key = crypto.scryptSync(SECRET, 'salt', 32)
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()])
    return JSON.parse(dec.toString('utf8'))
  } catch { return null }
}

function getSession(cookieHeader = '') {
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    })
  )
  const raw = cookies[COOKIE_NAME]
  if (!raw) return null
  return decrypt(decodeURIComponent(raw))
}

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

exports.handler = async (event) => {
  const origin = event.headers.origin || '*'
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: '' }

  const session = getSession(event.headers.cookie || '')
  if (!session?.googleToken) {
    return { statusCode: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Sessão expirada.' }) }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { body = {} }
  const { photoIds } = body

  if (!Array.isArray(photoIds) || !photoIds.length) {
    return { statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'photoIds obrigatório.' }) }
  }

  try {
    const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:batchDelete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.googleToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaItemIds: photoIds })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error?.message || `Erro ${res.status}`)
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, deleted: photoIds.length })
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    }
  }
}
