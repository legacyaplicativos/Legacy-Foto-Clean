// netlify/functions/photos.js
// Uses Google Drive API (drive.photos.readonly) - less restricted than Photos Library API

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Google-Token, x-google-token',
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
      body: JSON.stringify({ error: 'Token do Google não encontrado. Faça login novamente.' })
    }
  }

  const pageSize = event.queryStringParameters?.pageSize || '50'
  const pageToken = event.queryStringParameters?.pageToken || null

  // Use Google Drive API with drive.photos.readonly scope
  // This fetches images/videos from Google Photos via Drive
  const params = new URLSearchParams({
    q: "mimeType contains 'image/' or mimeType contains 'video/'",
    fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,imageMediaMetadata,videoMediaMetadata,createdTime,size)',
    pageSize: pageSize,
    orderBy: 'createdTime desc',
    spaces: 'photos',
  })
  if (pageToken) params.set('pageToken', pageToken)

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    )

    const data = await response.json()

    if (!response.ok) {
      const googleError = data?.error?.message || JSON.stringify(data)
      return {
        statusCode: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Google Drive API: ${googleError}` })
      }
    }

    const photos = (data.files || []).map(item => ({
      id: item.id,
      baseUrl: item.thumbnailLink ? item.thumbnailLink.replace('=s220', '=s512') : null,
      filename: item.name,
      mimeType: item.mimeType,
      productUrl: item.webViewLink,
      mediaMetadata: {
        creationTime: item.createdTime,
        width: item.imageMediaMetadata?.width,
        height: item.imageMediaMetadata?.height,
      }
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
      body: JSON.stringify({ error: `Erro interno: ${e.message}` })
    }
  }
}
