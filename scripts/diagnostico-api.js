/**
 * Script de diagnóstico para identificar el error 500.
 * Ejecutar: node scripts/diagnostico-api.js
 *
 * Hace las mismas peticiones que la app y muestra la respuesta cruda.
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzFtSIXEUaSRyygEwCHrdHlg1l3CX0DkPxYeUnUUhUB60zuSmPhPdt9MzOXlFWccU7e/exec'
const ADMIN_SECRET = 'Admin.2026'

async function test(name, body) {
  console.log('\n' + '='.repeat(60))
  console.log('PRUEBA:', name)
  console.log('Body:', JSON.stringify(body, null, 2))
  console.log('-'.repeat(60))

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const text = await res.text()
    console.log('Status:', res.status, res.statusText)
    console.log('Content-Type:', res.headers.get('content-type'))
    console.log('Body length:', text.length)
    console.log('Body (primeros 800 chars):')
    console.log(text.slice(0, 800))
    if (text.length > 800) console.log('... [truncado]')

    try {
      const json = JSON.parse(text)
      console.log('\nJSON parseado:', JSON.stringify(json, null, 2))
    } catch {
      console.log('\n⚠️ NO es JSON válido - Apps Script probablemente devolvió HTML de error')
    }
  } catch (err) {
    console.error('Error de fetch:', err.message)
  }
}

async function main() {
  console.log('DIAGNÓSTICO API - Llamando directo a Apps Script (sin proxy Vercel)')
  console.log('URL:', APPS_SCRIPT_URL)

  // 1. admin_cycle_open (abrir ciclo)
  await test('admin_cycle_open', {
    action: 'admin_cycle_open',
    adminSecret: ADMIN_SECRET,
    weekKey: '2025-03-17'
  })

  // 2. admin_list_empresa (quién no pidió)
  await test('admin_list_empresa', {
    action: 'admin_list_empresa',
    adminSecret: ADMIN_SECRET
  })

  // 3. admin_cycle_status
  await test('admin_cycle_status', {
    action: 'admin_cycle_status',
    adminSecret: ADMIN_SECRET,
    weekKey: '2025-03-17'
  })

  // 4. admin_ping (mínimo para ver si responde)
  await test('admin_ping', {
    action: 'admin_ping',
    adminSecret: ADMIN_SECRET
  })

  console.log('\n' + '='.repeat(60))
  console.log('FIN DIAGNÓSTICO')
}

main()
