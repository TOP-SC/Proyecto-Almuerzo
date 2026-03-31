// En Vercel: Project → Settings → Environment Variables → APPS_SCRIPT_URL = URL /exec (script.google.com o script.googleusercontent.com)
function normalizeAppsScriptUrl(raw) {
  if (raw == null || raw === '') return ''
  let s = String(raw).replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  if (s.startsWith('http://')) s = 'https://' + s.slice('http://'.length)
  s = s.replace(/\/exec\/+$/i, '/exec')
  return s.trim()
}

const APPS_SCRIPT_URL = normalizeAppsScriptUrl(
  (typeof process !== 'undefined' && process.env && process.env.APPS_SCRIPT_URL) ||
    'https://script.google.com/macros/s/AKfycbzGT2wpze1xsDR4AdFHHPOmHq5p9tpizMgCVeti364Dajk4A5cBb7_EKlyKGwLPBQ/exec'
)

/** Para el GET de diagnóstico: validar formato y últimos caracteres del ID (sin exponer la URL completa). */
function describeExecUrl(u) {
  const m = typeof u === 'string' && u.match(/https?:\/\/script\.google(?:usercontent)?\.com\/macros\/s\/([^/]+)\/exec/i)
  if (!m) {
    return {
      execUrlFormatOk: false,
      hint: 'La URL debe ser exactamente https://script.google.com/macros/s/ID_LARGO/exec (copiada desde Implementar → Aplicación web). No uses enlace del editor ni del Sheet.',
    }
  }
  const id = m[1]
  return {
    execUrlFormatOk: true,
    deploymentIdLength: id.length,
    deploymentIdTail: id.length > 12 ? id.slice(-12) : id,
    hint: 'Compará deploymentIdTail con el ID de la URL en Apps Script (deben coincidir los últimos caracteres).',
  }
}

/** Quita BOM UTF-8 y espacios; a veces Google/Apps Script devuelve JSON válido pero con \uFEFF delante. */
function stripJsonBom(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/^\uFEFF/, '').trim()
}

/**
 * Variantes de URL /exec.
 * Desde servidores (Vercel), script.google.com a veces redirige mal y termina en HTML de Drive;
 * script.googleusercontent.com suele responder doPost sin ese problema → probarlo primero.
 */
function execUrlCandidates() {
  const u = APPS_SCRIPT_URL
  const list = []
  if (u.includes('script.google.com')) {
    list.push(u.replace('script.google.com', 'script.googleusercontent.com'))
  }
  list.push(u)
  if (u.includes('script.googleusercontent.com')) {
    const alt = u.replace('script.googleusercontent.com', 'script.google.com')
    if (alt !== u) list.push(alt)
  }
  return [...new Set(list)]
}

function requestHeadersForAppsScript(baseUrl, headers) {
  return {
    ...headers,
    Referer: baseUrl,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
}

async function postOnceWithRedirects(baseUrl, payload, headers) {
  let url = baseUrl
  let res = await fetch(url, {
    method: 'POST',
    headers: requestHeadersForAppsScript(baseUrl, headers),
    body: payload,
    redirect: 'manual',
  })
  for (let hop = 0; hop < 5; hop++) {
    if (res.status !== 301 && res.status !== 302 && res.status !== 303 && res.status !== 307 && res.status !== 308) break
    const loc = res.headers.get('location')
    if (!loc) break
    const nextUrl = loc.startsWith('http') ? loc : new URL(loc, url).href
    // No seguir hacia Drive/Docs con POST: devuelve HTML "Page Not Found" y rompe JSON.
    if (
      /docs\.google\.com|drive\.google\.com|accounts\.google\.com/i.test(nextUrl) &&
      !/script\.google/i.test(nextUrl)
    ) {
      break
    }
    url = nextUrl
    res = await fetch(nextUrl, {
      method: 'POST',
      headers: requestHeadersForAppsScript(baseUrl, headers),
      body: payload,
      redirect: 'manual',
    })
  }
  return res
}

/**
 * POST a Web App: prueba usercontent primero; si la respuesta no es JSON, prueba la URL original.
 * Devuelve intentos (host, status) para depurar HTML de Google sin ejecutar tu doPost.
 */
async function postToAppsScript(bodyObj) {
  const payload = JSON.stringify(bodyObj)
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json',
  }
  const fetchAttempts = []
  let lastRes = null
  let lastText = ''
  for (const baseUrl of execUrlCandidates()) {
    let host = '?'
    try {
      host = new URL(baseUrl).hostname
    } catch (_) {}
    try {
      const res = await postOnceWithRedirects(baseUrl, payload, headers)
      const text = await res.text()
      lastRes = res
      lastText = text
      const t = stripJsonBom(text)
      const looksHtml = t.startsWith('<!') || t.startsWith('<html')
      fetchAttempts.push({
        host,
        status: res.status,
        ok: res.ok,
        contentType: (res.headers.get('content-type') || '').slice(0, 80),
        looksHtml,
        bodyPreview: t.slice(0, 100).replace(/\s+/g, ' '),
      })
      try {
        JSON.parse(t)
        return {
          response: new Response(t, { status: res.status, headers: { 'Content-Type': 'application/json' } }),
          fetchAttempts,
        }
      } catch (_) {
        /* siguiente candidato */
      }
    } catch (e) {
      fetchAttempts.push({ host, error: (e && e.message) ? String(e.message).slice(0, 120) : 'fetch_error' })
    }
  }
  return {
    response: new Response(lastText, { status: lastRes ? lastRes.status : 502 }),
    fetchAttempts,
  }
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
    const execInfo = describeExecUrl(APPS_SCRIPT_URL)
    return res.status(200).json({
      ok: true,
      proxy: 'api/selection',
      appsScriptUrlFromEnv: envSet,
      ...execInfo,
      message:
        'Ruta OK. Si POST falla con HTML de Google, el ID en APPS_SCRIPT_URL no coincide con un Web App activo: copiá de nuevo la URL desde Apps Script → Implementar → Aplicación web (solo …/exec). Probá POST { "action":"admin_ping","adminSecret":"..." }.',
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
    let fetchAttempts = []
    try {
      const postResult = await postToAppsScript(body)
      response = postResult.response
      fetchAttempts = postResult.fetchAttempts || []
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
        if (/unable to open the file|Page Not Found/i.test(text)) {
          tip =
            'Google devolvió página de error (no es tu Web App): el ID en …/macros/s/ID/exec no existe o la implementación fue borrada. En Apps Script: Implementar → Gestionar implementaciones → **Aplicación web** → copiar URL que termina en /exec. No uses enlace del editor, del Sheet ni «Probar» del código. Pegá en Vercel (Production) y redeploy.'
        }
      }
      const envSet = !!(typeof process !== 'undefined' && process.env && String(process.env.APPS_SCRIPT_URL || '').trim())
      if (!envSet) {
        tip =
          'En Vercel no está definida APPS_SCRIPT_URL (o está vacía): el proxy usa la URL por defecto del código, que puede ser vieja. Configurá la variable con la URL /exec del despliegue actual.'
      }
      const execInfo = describeExecUrl(APPS_SCRIPT_URL)
      data = {
        ok: false,
        error: 'El servidor no devolvió datos válidos. Revisá APPS_SCRIPT_URL en Vercel (URL /exec del despliegue).',
        debug: {
          proxyReason: 'invalid_json',
          status: response.status,
          tip,
          notaAppsscriptJson:
            'appsscript.json (V8 y scopes) no provoca esta página HTML de Drive: esa respuesta la genera Google antes de ejecutar tu .gs. Revisá fetchAttempts (host/status/looksHtml).',
          snippet: text.slice(0, 600),
          appsScriptUrlFromEnv: envSet,
          fetchAttempts,
          ...execInfo,
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
