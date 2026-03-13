// netlify/functions/chat.js
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
  if (!session?.geminiKey) {
    return { statusCode: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Sessão expirada.' }) }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { body = {} }
  const { message, photos = [], analyzed = {} } = body

  if (!message) return { statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Mensagem obrigatória.' }) }

  const stats = {
    total: photos.length,
    analisadas: Object.keys(analyzed).length,
    borradas: Object.values(analyzed).filter(a => a.borrada).length,
    escuras: Object.values(analyzed).filter(a => a.escura).length,
    screenshots: Object.values(analyzed).filter(a => a.screenshot).length,
    ruins: Object.values(analyzed).filter(a => a.ruim).length,
    uteis: Object.values(analyzed).filter(a => a.util).length,
  }

  const photoList = photos.slice(0, 150).map(p => ({
    id: p.id, filename: p.filename || '', ...(analyzed[p.id] || {})
  }))

  const prompt = `Você é assistente de limpeza de fotos. O usuário tem ${photos.length} fotos (${Object.keys(analyzed).length} analisadas).
Stats: ${JSON.stringify(stats)}
Fotos: ${JSON.stringify(photoList)}

Responda em português, de forma amigável. Se pedir para "mostrar/selecionar/filtrar" fotos, inclua os IDs.
Responda APENAS com JSON: {"response":"texto da resposta","filteredIds":["id1","id2"]}
Se não houver seleção, use filteredIds:[].
Usuário: ${message}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${session.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.3 }
        })
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message || 'Erro Gemini')

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    let parsed
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { response: text, filteredIds: [] }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: parsed.response || text, filteredIds: parsed.filteredIds || [] })
    }
  } catch (e) {
    return { statusCode: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) }
  }
}
