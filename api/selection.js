// En Vercel: Project → Settings → Environment Variables → APPS_SCRIPT_URL = URL /exec (script.google.com o script.googleusercontent.com)
const APPS_SCRIPT_URL = (
  (typeof process !== 'undefined' && process.env && String(process.env.APPS_SCRIPT_URL || '').trim()) ||
  'https://script.google.com/macros/s/AKfycbzGT2wpze1xsDR4AdFHHPOmHq5p9tpizMgCVeti364Dajk4A5cBb7_EKlyKGwLPBQ/exec'
).trim()

/** Quita BOM UTF-8 y espacios; a veces Google/Apps Script devuelve JSON válido pero con \uFEFF delante. */
function stripJsonBom(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/^\uFEFF/, '').trim()
}

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
    headers: {
      ...headers,
      // Algunos entornos bloquean peticiones sin User-Agent; Apps Script suele aceptar igual.
      'User-Agent': 'Mozilla/5.0 (compatible; MaidaMenu/1.0; +https://vercel.com)',
    },
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
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0 (compatible; MaidaMenu/1.0; +https://vercel.com)',
      },
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
      const normalized = stripJsonBom(text)
      try {
        JSON.parse(normalized)
        return new Response(normalized, { status: res.status, headers: { 'Content-Type': 'application/json' } })
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
  // Vercel suele parsear JSON y dejar req.body como objeto; a veces viene como string o Buffer.
  const raw = req.body
  if (raw != null) {
    if (typeof raw === 'string') {
      try {
        return raw ? JSON.parse(raw) : {}
      } catch {
        return {}
      }
    }
    if (Buffer.isBuffer(raw)) {
      try {
        const s = raw.toString('utf8')
        return s ? JSON.parse(s) : {}
      } catch {
        return {}
      }
    }
    if (typeof raw === 'object') return raw
  }
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
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
  const method = String(req.method || '').toUpperCase()

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    return res.status(200).end()
  }

  /** HEAD (algunos chequeos / proxies) sin cuerpo */
  if (method === 'HEAD') {
    return res.status(200).end()
  }

  /** Abrí en el navegador: https://tu-dominio.vercel.app/api/selection — si ves JSON, la función existe y no te devolvió el index.html del SPA. */
  if (method === 'GET') {
    const envSet = !!(typeof process !== 'undefined' && process.env && String(process.env.APPS_SCRIPT_URL || '').trim())
    return res.status(200).json({
      ok: true,
      proxy: 'api/selection',
      appsScriptUrlFromEnv: envSet,
      message:
        'Ruta OK. Si ves HTML en vez de esto, el deploy no incluye /api o el rewrite tapa la API. En Vercel: APPS_SCRIPT_URL en Production + redeploy. Probá POST con JSON { "action":"admin_ping","adminSecret":"..." }.',
    })
  }

  if (method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido',
      methodReceived: method || '(vacío)',
      hint: 'Usá GET en el navegador para diagnóstico, o POST con JSON. Si GET da 405, hacé deploy del último código (api/selection.js con soporte GET).',
    })
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
    const normalized = stripJsonBom(text)
    let data
    try {
      data = JSON.parse(normalized)
    } catch {
      const fallback = getFallbackResponse(body)
      if (fallback && (response.status >= 400 || normalized.startsWith('<!'))) {
        const dbg = typeof fallback.debug === 'object' && fallback.debug ? fallback.debug : {}
        return res.status(200).json({ ...fallback, debug: { ...dbg, proxyReason: 'invalid_json' } })
      }
      let tip =
        'En Vercel: APPS_SCRIPT_URL = URL /exec actual. Desplegar como «Cualquier persona». Probar también URL script.googleusercontent.com/...'
      if (normalized.startsWith('<!')) {
        const m = text.match(/class="errorMessage"[^>]*>([^<]+)/) || text.match(/Exception:[^<]*/i)
        if (m) tip = 'Apps Script: ' + (m[1] || m[0]).trim().slice(0, 200)
      }
      const envSet = !!(typeof process !== 'undefined' && process.env && String(process.env.APPS_SCRIPT_URL || '').trim())
      if (!envSet) {
        tip =
          'En Vercel no está definida APPS_SCRIPT_URL (o está vacía): el proxy usa la URL por defecto del código, que puede ser vieja. Configurá la variable con la URL /exec del despliegue actual.'
      }
      data = {
        ok: false,
        error: 'El servidor no devolvió datos válidos. Revisá APPS_SCRIPT_URL en Vercel (URL /exec del despliegue).',
        debug: {
          proxyReason: 'invalid_json',
          status: response.status,
          tip,
          snippet: text.slice(0, 600),
          appsScriptUrlFromEnv: envSet,
        },
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
