// PRUEBA MÍNIMA - Para diagnosticar si el problema es el script o el spreadsheet
// 1. Creá un NUEVO proyecto en script.google.com (Archivo > Nuevo > Proyecto)
// 2. Pegá SOLO este código
// 3. Implementar > Nueva implementación > Aplicación web
// 4. Ejecutar como: Yo | Quién: Cualquier persona
// 5. Si este script funciona (devuelve JSON al abrir /exec), el problema está en el script completo o el spreadsheet

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Script de prueba funcionando',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
  } catch (err) {}
  var action = (data.action || '').toString();
  var out = { ok: true, action: action };
  if (action === 'get_cycle_status') {
    out.abierto = true;
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
