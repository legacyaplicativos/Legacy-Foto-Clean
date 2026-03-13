require('dotenv').config()
const express = require('express')
const session = require('express-session')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const fetch = require('node-fetch')
const axios = require('axios')

const app = express()
const PORT = process.env.PORT || 3001

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json({ limit: '10mb' }))

// CORS — allow frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))

// Session (in-memory; for production use Redis or similar)
app.use(session({
  secret: process.env.SESSION_SECRET || 'photoclean-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}))

// Rate limiter for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Muitas requisições. Aguarde um momento.' },
})

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function requireSession(req, res, next) {
  if (!req.session.geminiKey) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' })
  }
  next()
}

async function callGemini(apiKey, parts, maxTokens = 512) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const body = {
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.1,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok) {
    const msg = data?.error?.message || 'Erro na API Gemini'
    throw new Error(msg)
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return text
}

async function downloadImageAsBase64(url) {
  const res = await fetch(url, { timeout: 15000 })
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`)
  const buffer = await res.buffer()
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  return { base64: buffer.toString('base64'), mimeType: contentType }
}

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

// POST /api/session — save Gemini key + validate
app.post('/api/session', async (req, res) => {
  const { geminiKey, googleToken } = req.body
  if (!geminiKey || !googleToken) {
    return res.status(400).json({ error: 'Dados incompletos.' })
  }
  if (!geminiKey.startsWith('AIza')) {
    return res.status(400).json({ error: 'Chave Gemini inválida.' })
  }

  // Validate key with a minimal call
  try {
    await callGemini(geminiKey, [{ text: 'responda apenas: ok' }], 10)
  } catch (e) {
    return res.status(401).json({ error: `Chave Gemini inválida: ${e.message}` })
  }

  req.session.geminiKey = geminiKey
  req.session.googleToken = googleToken
  res.json({ ok: true })
})

// DELETE /api/session — logout
app.delete('/api/session', (req, res) => {
  req.session.destroy()
  res.json({ ok: true })
})

// GET /api/photos — list photos from Google Photos
app.get('/api/photos', async (req, res) => {
  const googleToken = req.headers['x-google-token'] || req.session.googleToken
  if (!googleToken) {
    return res.status(401).json({ error: 'Token Google ausente.' })
  }

  const { pageToken, pageSize = '100' } = req.query
  const params = new URLSearchParams({ pageSize })
  if (pageToken) params.set('pageToken', pageToken)

  try {
    const response = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems?${params}`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    )
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro ao buscar fotos')
    }

    const photos = (data.mediaItems || []).map(item => ({
      id: item.id,
      baseUrl: item.baseUrl,
      filename: item.filename,
      mediaMetadata: item.mediaMetadata,
      productUrl: item.productUrl,
    }))

    res.json({
      photos,
      nextPageToken: data.nextPageToken || null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/analyze — analyze a single photo with Gemini
app.post('/api/analyze', aiLimiter, requireSession, async (req, res) => {
  const { thumbnailUrl, photoId } = req.body
  if (!thumbnailUrl) {
    return res.status(400).json({ error: 'thumbnailUrl obrigatório.' })
  }

  const geminiKey = req.session.geminiKey

  try {
    // Download thumbnail
    const { base64, mimeType } = await downloadImageAsBase64(thumbnailUrl)

    // Build Gemini prompt
    const prompt = `Analise esta imagem de forma objetiva e responda APENAS com um JSON válido, sem markdown, sem explicações.
O JSON deve ter exatamente estas chaves booleanas e uma string:
{
  "borrada": boolean,
  "escura": boolean,
  "screenshot": boolean,
  "duplicata": boolean,
  "meme": boolean,
  "documento": boolean,
  "tem_celular": boolean,
  "ruim": boolean,
  "util": boolean,
  "descricao": "uma frase curta descrevendo a foto"
}

Definições:
- borrada: foto desfocada, tremida, sem nitidez
- escura: muito subexposta, quase invisível
- screenshot: captura de tela de app, WhatsApp, navegador, etc
- duplicata: parece ser cópia de outra foto (conteúdo muito similar ao típico)
- meme: imagem de meme, humor, texto sobre foto
- documento: RG, CPF, comprovante, nota fiscal, texto importante
- tem_celular: aparece celular na cena (não é screenshot, é foto de alguém com celular)
- ruim: foto de baixa qualidade geral que provavelmente não tem valor
- util: foto com valor sentimental ou informativo, boa qualidade
- descricao: máximo 60 caracteres

RESPONDA APENAS O JSON:`

    const text = await callGemini(geminiKey, [
      { text: prompt },
      { inlineData: { mimeType, data: base64 } },
    ])

    // Parse JSON from response
    let analysis
    try {
      // Strip any accidental markdown
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim()
      analysis = JSON.parse(cleaned)
    } catch {
      // Fallback: try to extract JSON
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        analysis = JSON.parse(match[0])
      } else {
        throw new Error('Gemini retornou resposta inválida')
      }
    }

    // Ensure all expected fields exist
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

    res.json(result)
  } catch (e) {
    console.error('[analyze] Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/chat — natural language photo search via Gemini
app.post('/api/chat', aiLimiter, requireSession, async (req, res) => {
  const { message, photos, analyzed } = req.body
  if (!message) return res.status(400).json({ error: 'Mensagem obrigatória.' })

  const geminiKey = req.session.geminiKey
  const totalPhotos = photos?.length || 0
  const totalAnalyzed = Object.keys(analyzed || {}).length

  // Summarize analysis for context
  const analysisStats = {
    total: totalPhotos,
    analisadas: totalAnalyzed,
    borradas: Object.values(analyzed || {}).filter(a => a.borrada).length,
    escuras: Object.values(analyzed || {}).filter(a => a.escura).length,
    screenshots: Object.values(analyzed || {}).filter(a => a.screenshot).length,
    duplicatas: Object.values(analyzed || {}).filter(a => a.duplicata).length,
    memes: Object.values(analyzed || {}).filter(a => a.meme).length,
    documentos: Object.values(analyzed || {}).filter(a => a.documento).length,
    ruins: Object.values(analyzed || {}).filter(a => a.ruim).length,
    uteis: Object.values(analyzed || {}).filter(a => a.util).length,
  }

  // Build list of photo+analysis for filtering
  const photoList = (photos || []).slice(0, 200).map(p => ({
    id: p.id,
    filename: p.filename || '',
    ...((analyzed || {})[p.id] || {}),
  }))

  const systemPrompt = `Você é um assistente inteligente de limpeza de fotos do Google Photos.
O usuário tem ${totalPhotos} fotos, sendo ${totalAnalyzed} analisadas.

Estatísticas:
${JSON.stringify(analysisStats, null, 2)}

Lista de fotos (id + análise):
${JSON.stringify(photoList, null, 2)}

Ao responder:
1. Responda em português, de forma amigável e concisa
2. Se o usuário pedir para "mostrar", "filtrar" ou "selecionar" fotos, inclua no final do JSON a lista de IDs correspondentes
3. Sempre responda com JSON no formato:
{
  "response": "sua resposta em texto aqui",
  "filteredIds": ["id1", "id2"] // ou array vazio se não houver seleção
}
4. Não repita os IDs na resposta textual
5. Se perguntar sobre estatísticas, responda sem filtrar fotos`

  try {
    const text = await callGemini(geminiKey, [
      { text: systemPrompt + '\n\nUsuário: ' + message }
    ], 1000)

    let parsed
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        parsed = { response: text, filteredIds: [] }
      }
    }

    res.json({
      response: parsed.response || text,
      filteredIds: Array.isArray(parsed.filteredIds) ? parsed.filteredIds : [],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/photos/delete — move photos to trash via Google Photos API
app.post('/api/photos/delete', requireSession, async (req, res) => {
  const { photoIds } = req.body
  const googleToken = req.session.googleToken

  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return res.status(400).json({ error: 'Lista de IDs obrigatória.' })
  }
  if (photoIds.length > 200) {
    return res.status(400).json({ error: 'Máximo de 200 fotos por vez.' })
  }
  if (!googleToken) {
    return res.status(401).json({ error: 'Token Google ausente.' })
  }

  try {
    // Google Photos API: batchDelete moves to trash
    const response = await fetch(
      'https://photoslibrary.googleapis.com/v1/mediaItems:batchDelete',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mediaItemIds: photoIds }),
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error?.message || 'Erro ao deletar fotos')
    }

    res.json({ ok: true, deleted: photoIds.length })
  } catch (e) {
    console.error('[delete] Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ──────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 PhotoClean backend running on http://localhost:${PORT}`)
})

module.exports = app
