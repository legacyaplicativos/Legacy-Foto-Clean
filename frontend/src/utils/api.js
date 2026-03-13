/**
 * Base URL — in dev uses Vite proxy (/api → backend)
 * In production (Netlify) /api/* redirects to /.netlify/functions/*
 */
const BASE = ''

/**
 * Fetch photos from Google Photos via backend proxy
 */
export async function fetchPhotos(googleToken, pageToken = null, pageSize = 100) {
  const params = new URLSearchParams({ pageSize: String(pageSize) })
  if (pageToken) params.set('pageToken', pageToken)

  const res = await fetch(`${BASE}/api/photos?${params}`, {
    headers: { 'X-Google-Token': googleToken },
    credentials: 'include',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Erro ao buscar fotos')
  }

  return res.json()
}

/**
 * Analyze a single photo via backend Gemini proxy
 */
export async function analyzePhotos(photo) {
  const thumbnailUrl = photo.baseUrl ? `${photo.baseUrl}=w512-h512-c` : null
  if (!thumbnailUrl) throw new Error('Foto sem URL de thumbnail')

  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ photoId: photo.id, thumbnailUrl }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Erro na análise')
  }

  return res.json()
}
