// api/analyze.js — Vercel Serverless Function
// Wraps the analyze logic without Express session (uses cookie-based auth)

const fetch = require('node-fetch')

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

async function callGemini(apiKey, parts) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Gemini error')
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function downloadAsBase64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Download failed')
  const buf = await res.buffer()
  return { base64: buf.toString('base64'), mimeType: 'image/jpeg' }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()

  const geminiKey = req.headers['x-gemini-key']
  const { thumbnailUrl } = req.body

  if (!geminiKey || !thumbnailUrl) {
    return res.status(400).json({ error: 'Missing geminiKey or thumbnailUrl' })
  }

  try {
    const { base64, mimeType } = await downloadAsBase64(thumbnailUrl)
    const prompt = `Analise esta imagem e responda APENAS com JSON válido (sem markdown):
{"borrada":bool,"escura":bool,"screenshot":bool,"duplicata":bool,"meme":bool,"documento":bool,"tem_celular":bool,"ruim":bool,"util":bool,"descricao":"frase curta"}`

    const text = await callGemini(geminiKey, [
      { text: prompt },
      { inlineData: { mimeType, data: base64 } },
    ])

    const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim()
    const analysis = JSON.parse(cleaned)
    res.json(analysis)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
