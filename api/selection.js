const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoLc6_riQVmGI-XiJ-Er_3svaWx5dF59eRTov8ZsvhdhUHg7TOmbnr_1p_4kroTyXe/exec'

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
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      let errMsg = 'El backend no devolvió JSON válido'
      if (text.trim().startsWith('<!')) {
        const m = text.match(/class="errorMessage"[^>]*>([^<]+)/) || text.match(/Exception:[^<]*/i)
        if (m) errMsg = 'Error Apps Script: ' + (m[1] || m[0]).trim().slice(0, 150)
      }
      data = { ok: false, error: errMsg, raw: text.slice(0, 500) }
    }
    const status = data.ok === false && !response.ok ? 500 : (response.ok ? 200 : 500)
    res.status(status).json(data)
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
