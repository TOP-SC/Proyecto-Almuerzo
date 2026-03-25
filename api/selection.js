const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzGT2wpze1xsDR4AdFHHPOmHq5p9tpizMgCVeti364Dajk4A5cBb7_EKlyKGwLPBQ/exec'

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

/** Fallback cuando Apps Script falla (red, HTML, 5xx): la app no debe recibir HTTP 500 vacío */
function getFallbackResponse(body) {
  const action = (body?.action || '').toString().trim()
  if (action === 'get_cycle_status') return { ok: true, abierto: true }
  if (action === 'admin_ping') return { ok: true, message: 'pong' }
  if (action === 'admin_list') return { ok: true, users: [], debug: { fallback: true } }
  if (action === 'admin_list_empresa') return { ok: true, users: [], debug: { fallback: true } }
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
        const dbg = typeof fallback.debug === 'object' && fallback.debug ? fallback.debug : {}
        return res.status(200).json({ ...fallback, debug: { ...dbg, proxyReason: 'fetch_error' } })
      }
      return res.status(200).json({ ok: false, error: 'No se pudo conectar al backend. Revisá la URL de Apps Script.' })
    }

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      const fallback = getFallbackResponse(body)
      if (fallback && (response.status >= 400 || text.trim().startsWith('<!'))) {
        const dbg = typeof fallback.debug === 'object' && fallback.debug ? fallback.debug : {}
        return res.status(200).json({ ...fallback, debug: { ...dbg, proxyReason: 'invalid_json' } })
      }
      let errMsg = 'El backend no devolvió JSON válido'
      if (text.trim().startsWith('<!')) {
        const m = text.match(/class="errorMessage"[^>]*>([^<]+)/) || text.match(/Exception:[^<]*/i)
        if (m) errMsg = 'Error Apps Script: ' + (m[1] || m[0]).trim().slice(0, 150)
      }
      data = { ok: false, error: errMsg, raw: text.slice(0, 500) }
    }

    if (!response.ok) {
      const fallback = getFallbackResponse(body)
      if (fallback) {
        const dbg = typeof fallback.debug === 'object' && fallback.debug ? fallback.debug : {}
        return res.status(200).json({
          ...fallback,
          debug: { ...dbg, proxyReason: 'http_' + response.status, backendSnippet: (data && data.error) || String(text).slice(0, 120) }
        })
      }
    }

    return res.status(200).json(data)
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message })
  }
}
