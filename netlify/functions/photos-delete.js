// netlify/functions/photos-delete.js
// Moves photos to trash via Google Drive API

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      body: JSON.stringify({ error: 'Token não encontrado.' })
    }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Body inválido' }) }
  }

  const { mediaItemIds } = body
  if (!Array.isArray(mediaItemIds) || mediaItemIds.length === 0) {
    return { statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Nenhum ID fornecido' }) }
  }

  // Trash each file via Drive API
  const results = await Promise.allSettled(
    mediaItemIds.map(id =>
      fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true })
      })
    )
  )

  const failed = results.filter(r => r.status === 'rejected' || !r.value?.ok).length

  return {
    statusCode: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, deleted: mediaItemIds.length - failed, failed })
  }
}
