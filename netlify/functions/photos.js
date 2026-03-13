// netlify/functions/photos.js

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Google-Token',
  }
}

exports.handler = async (event) => {
  const origin = event.headers.origin || '*'
  const corsHeaders = getCorsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const googleToken = event.headers['x-google-token']
  if (!googleToken) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Token Google ausente.' })
    }
  }

  const { pageToken, pageSize = '100' } = event.queryStringParameters || {}
  const params = new URLSearchParams({ pageSize })
  if (pageToken) params.set('pageToken', pageToken)

  try {
    const res = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems?${params}`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    )
    const data = await res.json()

    if (!res.ok) throw new Error(data.error?.message || 'Erro ao buscar fotos')

    const photos = (data.mediaItems || []).map(item => ({
      id: item.id,
      baseUrl: item.baseUrl,
      filename: item.filename,
      mediaMetadata: item.mediaMetadata,
      productUrl: item.productUrl,
    }))

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos, nextPageToken: data.nextPageToken || null })
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    }
  }
}
