const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxe1O-qQNS9Fs0gxSm22sHfhmDQyGtxHn0Qjk0bvQqcdYF_qbQqdGNONfh9mHe2rcrF/exec'

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
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    })
    const text = await response.text()
    const data = (() => { try { return JSON.parse(text) } catch { return {} } })()
    res.status(response.ok ? 200 : 500).json(data)
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
