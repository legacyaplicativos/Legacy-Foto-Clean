const KEY = 'photoclean_session'

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveProgress(data) {
  try {
    if (data === null) {
      localStorage.removeItem(KEY)
    } else {
      // Trim photos array to save space (keep max 500 photos, no baseUrl cached)
      const toSave = { ...data }
      if (toSave.photos?.length > 500) {
        toSave.photos = toSave.photos.slice(0, 500)
      }
      // Strip baseUrls from cached photos (they expire)
      if (toSave.photos) {
        toSave.photos = toSave.photos.map(p => ({
          id: p.id,
          filename: p.filename,
          mediaMetadata: p.mediaMetadata,
          // baseUrl intentionally omitted — expires after 1 hour
        }))
      }
      localStorage.setItem(KEY, JSON.stringify(toSave))
    }
  } catch (e) {
    // localStorage full — clear old data
    try { localStorage.removeItem(KEY) } catch {}
  }
}

export function clearProgress() {
  try { localStorage.removeItem(KEY) } catch {}
}
