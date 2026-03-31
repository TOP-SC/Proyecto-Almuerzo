// En Vercel: Project → Settings → Environment Variables → APPS_SCRIPT_URL = URL /exec (script.google.com o script.googleusercontent.com)
const APPS_SCRIPT_URL = (
  (typeof process !== 'undefined' && process.env && String(process.env.APPS_SCRIPT_URL || '').trim()) ||
  'https://script.google.com/macros/s/AKfycbzGT2wpze1xsDR4AdFHHPOmHq5p9tpizMgCVeti364Dajk4A5cBb7_EKlyKGwLPBQ/exec'
).trim()

/** Variantes de URL /exec (usercontent suele responder JSON sin pasar por 302). */
function execUrlCandidates() {
  const u = APPS_SCRIPT_URL
  const list = []
  if (u.includes('script.google.com')) {
    list.push(u.replace('script.google.com', 'script.googleusercontent.com'))
  }
  list.push(u)
  return [...new Set(list)]
}

async function postOnceWithRedirects(baseUrl, payload, headers) {
  let url = baseUrl
  let res = await fetch(url, {
    method: 'POST',
    headers,
    body: payload,
    redirect: 'manual',
  })
  for (let hop = 0; hop < 5; hop++) {
    if (res.status !== 301 && res.status !== 302 && res.status !== 303 && res.status !== 307 && res.status !== 308) break
    const loc = res.headers.get('location')
    if (!loc) break
    const nextUrl = loc.startsWith('http') ? loc : new URL(loc, url).href
    url = nextUrl
    res = await fetch(nextUrl, {
      method: 'POST',
      headers,
      body: payload,
      redirect: 'manual',
    })
  }
  return res
}

/**
 * POST a Web App: prueba usercontent primero; si la respuesta no es JSON, prueba la URL original.
 */
async function postToAppsScript(bodyObj) {
  const payload = JSON.stringify(bodyObj)
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  let lastRes = null
  let lastText = ''
  for (const baseUrl of execUrlCandidates()) {
    try {
      const res = await postOnceWithRedirects(baseUrl, payload, headers)
      const text = await res.text()
      lastRes = res
      lastText = text
      try {
        JSON.parse(text)
        return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } })
      } catch (_) {
        /* seguir con siguiente candidato */
      }
    } catch (_) {
      /* siguiente */
    }
  }
  return new Response(lastText, { status: lastRes ? lastRes.status : 502 })
}

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

/**
 * Fallback solo para acciones públicas cuando Apps Script devuelve HTML o no-JSON.
 * Nunca simular éxito en admin_* (antes devolvía users: [] y el dashboard quedaba vacío sin avisar).
 */
function getFallbackResponse(body) {
  const action = (body?.action || '').toString().trim()
  if (action.startsWith('admin_')) return null
  if (action === 'get_cycle_status') return { ok: true, abierto: true }
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
      response = await postToAppsScript(body)
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
      let tip =
        'En Vercel: APPS_SCRIPT_URL = URL /exec actual. Desplegar como «Cualquier persona». Probar también URL script.googleusercontent.com/...'
      if (text.trim().startsWith('<!')) {
        const m = text.match(/class="errorMessage"[^>]*>([^<]+)/) || text.match(/Exception:[^<]*/i)
        if (m) tip = 'Apps Script: ' + (m[1] || m[0]).trim().slice(0, 200)
      }
      data = {
        ok: false,
        error: 'El servidor no devolvió datos válidos. Revisá APPS_SCRIPT_URL en Vercel (URL /exec del despliegue).',
        debug: { proxyReason: 'invalid_json', status: response.status, tip, snippet: text.slice(0, 600) },
      }
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
