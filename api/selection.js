const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxe1O-qQNS9Fs0gxSm22sHfhmDQyGtxHn0Qjk0bvQqcdYF_qbQqdGNONfh9mHe2rcrF/exec'

async function getBody(req) {
  if (req.body != null && typeof req.body === 'object') return req.body
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

/** Fallback cuando Apps Script falla: permite que la app cargue para acciones no críticas */
function getFallbackResponse(body) {
  const action = (body?.action || '').toString().trim()
  if (action === 'get_cycle_status') return { ok: true, abierto: true }
  if (action === 'admin_ping') return { ok: true, message: 'pong' }
  if (action === 'admin_list') return { ok: true, users: [], debug: { fallback: true } }
  if (action === 'admin_list_empresa') return { ok: true, users: [], debug: 'fallback' }
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = await getBody(req)
    let response
    try {
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (fetchErr) {
      const fallback = getFallbackResponse(body)
      if (fallback) {
        return res.status(200).json(fallback)
      }
      return res.status(500).json({ ok: false, error: 'No se pudo conectar al backend. Revisá la URL de Apps Script.' })
    }

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      const fallback = getFallbackResponse(body)
      if (fallback && (response.status === 500 || text.includes('unable to open the file'))) {
        return res.status(200).json(fallback)
      }
      let errMsg = 'El backend no devolvió JSON válido'
      if (text.trim().startsWith('<!')) {
        const m = text.match(/class="errorMessage"[^>]*>([^<]+)/) || text.match(/Exception:[^<]*/i)
        if (m) errMsg = 'Error Apps Script: ' + (m[1] || m[0]).trim().slice(0, 150)
      }
      data = { ok: false, error: errMsg, raw: text.slice(0, 500) }
    }

    if (data.ok === false && response.status === 500) {
      const fallback = getFallbackResponse(body)
      if (fallback) {
        return res.status(200).json(fallback)
      }
    }

    const status = data.ok === false && !response.ok ? 500 : (response.ok ? 200 : 500)
    res.status(status).json(data)
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
