// netlify/functions/analyze.js

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

const PROMPT = `Analise esta imagem de forma objetiva. Responda APENAS com JSON válido, sem markdown, sem texto extra.
Formato obrigatório:
{"borrada":false,"escura":false,"screenshot":false,"duplicata":false,"meme":false,"documento":false,"tem_celular":false,"ruim":false,"util":false,"descricao":"frase curta"}

Definições:
- borrada: desfocada, tremida, sem nitidez
- escura: muito subexposta, quase invisível
- screenshot: captura de tela de app, WhatsApp, navegador, jogo
- duplicata: parece cópia/similar a outra foto comum
- meme: imagem de humor, texto sobre foto
- documento: RG, CPF, comprovante, nota fiscal
- tem_celular: aparece celular físico na cena (não screenshot)
- ruim: baixa qualidade geral, sem valor aparente
- util: boa qualidade, valor sentimental ou informativo
- descricao: máximo 60 chars descrevendo o conteúdo

RESPONDA APENAS O JSON:`

exports.handler = async (event) => {
  const origin = event.headers.origin || '*'
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' }
  }

  // Get session
  const session = getSession(event.headers.cookie || '')
  if (!session?.geminiKey) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' })
    }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { body = {} }
  const { thumbnailUrl } = body

  if (!thumbnailUrl) {
    return { statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'thumbnailUrl obrigatório.' }) }
  }

  try {
    // Download thumbnail
    const imgRes = await fetch(thumbnailUrl)
    if (!imgRes.ok) throw new Error(`Falha ao baixar thumbnail: ${imgRes.status}`)
    const imgBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'

    // Call Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${session.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType, data: base64 } }
            ]
          }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.1 }
        })
      }
    )

    const geminiData = await geminiRes.json()
    if (!geminiRes.ok) throw new Error(geminiData?.error?.message || 'Erro Gemini')

    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse JSON
    let analysis
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim()
      analysis = JSON.parse(cleaned)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) analysis = JSON.parse(match[0])
      else throw new Error('Gemini retornou formato inválido')
    }

    const result = {
      borrada: Boolean(analysis.borrada),
      escura: Boolean(analysis.escura),
      screenshot: Boolean(analysis.screenshot),
      duplicata: Boolean(analysis.duplicata),
      meme: Boolean(analysis.meme),
      documento: Boolean(analysis.documento),
      tem_celular: Boolean(analysis.tem_celular),
      ruim: Boolean(analysis.ruim),
      util: Boolean(analysis.util),
      descricao: String(analysis.descricao || '').slice(0, 100),
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    }
  } catch (e) {
    console.error('[analyze]', e.message)
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    }
  }
}
