// CONFIGURACIÓN BÁSICA
// IMPORTANTE: Usar la URL de PRODUCCIÓN de Vercel (la que se actualiza con cada push), no una URL de deployment/preview.
// En Vercel: proyecto → Settings → Domains → la que sea tipo "tu-proyecto.vercel.app"
const APP_BASE_URL = 'https://proyecto-almuerzo.vercel.app';
const SHEET_NAME = 'usuarios_completos'; // Hoja con A=email, B=nombre, C=token, D=turno
const CARPETA_DRIVE_COCINA_ID = '1tiH7zZ8yZHWbiDD8e64basLJPAfxrrHm'; // Carpeta donde se genera el archivo para cocina
const HOJA_RESPUESTAS = 'Respuestas';
const HOJA_CONFIG = 'Config';
const COCINA_EMAIL = 'juan.billiot@sommiercenter.com'; // Email de la gente de viandas/cocina (confirmar)
const ADMIN_SECRET = 'Admin.2026'; // Contraseña admin
// Spreadsheet con la lista de usuarios. Vacío = spreadsheet activo.
const USUARIOS_SPREADSHEET_ID = '1l9E5kuJVmUrei6PLUnBdwpGoGvTDSRIH0k0GapdfZyk';
// GID de la hoja de usuarios (número en la URL #gid=). 0 = detectar automático.
const USUARIOS_SHEET_GID = 877468020;

function generateToken_() {
  return Utilities.getUuid();
}

// Obtiene la hoja de usuarios. Si USUARIOS_SPREADSHEET_ID está definido, usa ese (evita getActiveSpreadsheet en scripts standalone).
function obtenerHojaUsuarios() {
  var ssConst = null;
  if (typeof USUARIOS_SPREADSHEET_ID === 'string' && USUARIOS_SPREADSHEET_ID.trim()) {
    try { ssConst = SpreadsheetApp.openById(USUARIOS_SPREADSHEET_ID.trim()); } catch (e) {}
  }
  if (!ssConst) {
    try { ssConst = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { return null; }
  }
  try {
    var cfgSs = obtenerSpreadsheetPrincipal();
    var cfg = cfgSs ? cfgSs.getSheetByName(HOJA_CONFIG) : null;
    if (cfg && cfg.getLastRow && cfg.getLastRow() >= 1) {
      var cfgData = cfg.getRange(1, 1, cfg.getLastRow(), 2).getValues();
      for (var c = 0; c < cfgData.length; c++) {
        if ((cfgData[c][0] || '').toString().trim().toLowerCase() === 'hojausuarios') {
          var sheetName = (cfgData[c][1] || '').toString().trim();
          if (sheetName) {
            var s = ssConst.getSheetByName(sheetName);
            if (s) return s;
          }
          break;
        }
      }
    }
  } catch (e) {}
  if (USUARIOS_SHEET_GID && USUARIOS_SHEET_GID > 0) {
    var sheets = ssConst.getSheets();
    for (var g = 0; g < sheets.length; g++) {
      try { if (sheets[g].getSheetId() == USUARIOS_SHEET_GID) return sheets[g]; } catch (gidErr) {}
    }
    var ssAlt = null;
    try { ssAlt = SpreadsheetApp.getActiveSpreadsheet(); } catch (ea) {}
    if (ssAlt && ssAlt.getId() !== ssConst.getId()) {
      sheets = ssAlt.getSheets();
      for (var g2 = 0; g2 < sheets.length; g2++) {
        try { if (sheets[g2].getSheetId() == USUARIOS_SHEET_GID) return sheets[g2]; } catch (gidErr2) {}
      }
    }
  }
  var sheet = ssConst.getSheetByName(SHEET_NAME);
  if (sheet) return sheet;
  var sheets = ssConst.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = (sheets[i].getName() || '').toString();
    if (name === HOJA_RESPUESTAS || name === HOJA_CONFIG) continue;
    var a1 = (sheets[i].getRange(1, 1).getValue() || '').toString().toLowerCase().trim();
    if (a1 === 'email' || a1 === 'correo' || a1 === 'e-mail') return sheets[i];
  }
  for (var k = 0; k < sheets.length; k++) {
    var sk = sheets[k];
    var nk = (sk.getName() || '').toString();
    if (nk === HOJA_RESPUESTAS || nk === HOJA_CONFIG) continue;
    var lr = sk.getLastRow();
    if (lr >= 2) {
      var colA = sk.getRange(2, 1, Math.min(lr, 100), 1).getValues();
      for (var r = 0; r < colA.length; r++) {
        var val = (colA[r][0] || '').toString();
        if (val.indexOf('@') !== -1) return sk;
      }
    }
  }
  for (var j = 0; j < sheets.length; j++) {
    var n = (sheets[j].getName() || '').toString();
    if (n === HOJA_RESPUESTAS || n === HOJA_CONFIG) continue;
    if (sheets[j].getLastRow() >= 2) return sheets[j];
  }
  return (sheets && sheets.length > 0) ? sheets[0] : null;
}

// Genera tokens para todos los usuarios que no tengan uno en la columna "token"
function generarTokensSiFaltan() {
  const sheet = obtenerHojaUsuarios();
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow, 3).getValues();
  const updates = [];

  data.forEach((row, index) => {
    const email = row[0];
    const nombre = row[1];
    let token = row[2];

    if (!email) return;

    if (!token) {
      token = generateToken_();
      updates.push({ rowIndex: index, token: token });
    }
  });

  if (updates.length > 0) {
    updates.forEach(function(u) {
      sheet.getRange(2 + u.rowIndex, 3).setValue(u.token);
    });
  }
}

// Mail de apertura - diseño cuidado
function crearHtmlMailUsuario(nombre, url) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:\'Segoe UI\',Tahoma,Geneva,Verdana,sans-serif;background:linear-gradient(135deg,#e8f0fe 0%,#f1f5f9 100%);">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;"><tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;border:1px solid rgba(0,0,0,0.04);">' +
    '<tr><td style="background:linear-gradient(135deg,#1a73e8 0%,#0d47a1 100%);padding:28px 24px;text-align:center;">' +
    '<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">Menú Semanal</h1>' +
    '<p style="margin:8px 0 0;color:rgba(255,255,255,0.95);font-size:15px;">Elegí tu menú para la semana</p>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 24px;">' +
    '<p style="margin:0 0 16px;color:#1e293b;font-size:16px;line-height:1.5;">Hola <strong>' + nombre + '</strong>,</p>' +
    '<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">Ya está disponible el menú semanal. Hacé clic en el botón para ingresar y elegir tus opciones.</p>' +
    '<p style="margin:0 0 20px;text-align:center;">' +
    '<a href="' + url + '" style="display:inline-block;padding:14px 32px;background:#1a73e8;color:#ffffff!important;text-decoration:none;font-size:16px;font-weight:600;border-radius:10px;box-shadow:0 4px 14px rgba(26,115,232,0.4);">Elegir mi menú</a>' +
    '</p>' +
    '<p style="margin:0;color:#64748b;font-size:13px;text-align:center;">Podés modificar tu elección hasta el cierre del período.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">' +
    '<p style="margin:0;color:#94a3b8;font-size:12px;">RRHH · Organización de Almuerzos</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

// ENVÍA UN MAIL A CADA USUARIO CON SU LINK PERSONALIZADO (incluye turno)
function enviarLinksMenuSemanal() {
  const sheet = obtenerHojaUsuarios();

  generarTokensSiFaltan();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Leer 4 columnas: A=email, B=nombre, C=token, D=turno
  const data = sheet.getRange(2, 1, lastRow, 4).getValues();

  const TEST_EMAILS = [
    'juan.billiot@sommiercenter.com',
  ];

  data.forEach((row) => {
    const email = row[0];
    const nombre = row[1] || 'Colaborador';
    const token = row[2];
    const turno = (row[3] === 2 || row[3] === '2') ? 2 : 1;

    if (!email || !token) return;

    if (TEST_EMAILS.indexOf(email) === -1) {
      return;
    }

    const url = APP_BASE_URL
      + '?u=' + encodeURIComponent(token)
      + '&email=' + encodeURIComponent(email)
      + '&name=' + encodeURIComponent(nombre)
      + '&turno=' + turno;

    const subject = 'Menú semanal disponible';
    const htmlBody = crearHtmlMailUsuario(nombre, url);

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: 'Buen día ' + nombre + ',\n\nYa está disponible el menú semanal. Ingresá al siguiente enlace para elegir tu menú:\n\n' + url + '\n\nSaludos,\nRRHH / Organización de Almuerzos',
      htmlBody: htmlBody
    });
  });
}

// Para que la URL no dé error al abrirla en el navegador (GET)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Backend menú semanal activo' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// === CICLO APERTURA/CIERRE ===
function obtenerSpreadsheetPrincipal() {
  if (typeof USUARIOS_SPREADSHEET_ID === 'string' && USUARIOS_SPREADSHEET_ID.trim()) {
    try { return SpreadsheetApp.openById(USUARIOS_SPREADSHEET_ID.trim()); } catch (e) {}
  }
  try { return SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { return null; }
}

function obtenerHojaConfig() {
  var ss = obtenerSpreadsheetPrincipal();
  if (!ss) return null;
  var sheet = ss.getSheetByName(HOJA_CONFIG);
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_CONFIG);
    if (!sheet) return null;
    sheet.getRange(1, 1, 1, 2).setValues([['Semana', 'Estado']]);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  return sheet;
}

function getCycleStatus(weekKey) {
  var wk = normalizarSemana(weekKey || '');
  var sheet = obtenerHojaConfig();
  if (!sheet) return true;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true; // Por defecto abierto si no hay config
  var data = sheet.getRange(2, 1, lastRow, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (normalizarSemana(data[i][0]) === wk) {
      return (data[i][1] || '').toString().toLowerCase() === 'abierto';
    }
  }
  return true; // Si no hay fila para esta semana, abierto por defecto
}

function setCycleState(weekKey, abierto) {
  var wk = normalizarSemana(weekKey || '');
  var sheet = obtenerHojaConfig();
  if (!sheet) return false;
  var lastRow = sheet.getLastRow();
  var estado = abierto ? 'abierto' : 'cerrado';
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (normalizarSemana(data[i][0]) === wk) {
        sheet.getRange(2 + i, 2).setValue(estado);
        return true;
      }
    }
  }
  sheet.appendRow([wk, estado]);
  return true;
}

// Normaliza semana para comparación (Date o string -> YYYY-MM-DD)
function normalizarSemana(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  var s = String(val).trim();
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : s;
}

// Obtiene o crea la hoja "Respuestas" (col 11 = Estado, col 12 = Detalle JSON)
function obtenerHojaRespuestas() {
  var ss = obtenerSpreadsheetPrincipal();
  if (!ss) return null;
  var sheet = ss.getSheetByName(HOJA_RESPUESTAS);
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_RESPUESTAS);
    sheet.getRange(1, 1, 1, 12).setValues([['Semana', 'Token', 'Nombre', 'Email', 'Turno', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Estado', 'Detalle']]);
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold');
  } else if (sheet.getLastRow() >= 1 && sheet.getRange(1, 11).getValue() !== 'Estado') {
    sheet.getRange(1, 11).setValue('Estado');
    sheet.getRange(1, 11).setFontWeight('bold');
  }
  return sheet;
}

// Guarda o actualiza la respuesta en la hoja (una fila por usuario por semana)
// Busca por token+semana; si no encuentra, por email+semana para evitar duplicados
function guardarRespuestaEnSheet(data) {
  var sheet = obtenerHojaRespuestas();
  if (!sheet) throw new Error('No se pudo acceder al spreadsheet. Verificá USUARIOS_SPREADSHEET_ID.');
  var lastRow = sheet.getLastRow();
  var weekKey = normalizarSemana(data.weekKey || data.weekNumber || '');
  var token = (data.userToken || '').toString();
  var nombre = data.userName || 'Colaborador';
  var email = (data.userEmail || '').toString().trim().toLowerCase();
  var turno = data.userTurn || '';
  var selections = data.selections || {};
  var details = data.details || {};
  var row = [weekKey, token, nombre, data.userEmail || '', turno];
  for (var i = 0; i < 5; i++) {
    var sel = selections[i];
    row.push(sel ? (sel.name + ' - ' + sel.dish) : '');
  }
  row.push('activo');
  row.push(typeof details === 'object' ? JSON.stringify(details) : (details || ''));
  var rowIndex = -1;
  if (lastRow >= 2) {
    var dataRows = sheet.getRange(2, 1, lastRow, 4).getValues();
    for (var r = dataRows.length - 1; r >= 0; r--) {
      var rWk = normalizarSemana(dataRows[r][0]);
      var rToken = String(dataRows[r][1]);
      var rEmail = (dataRows[r][3] || '').toString().trim().toLowerCase();
      if (rWk === weekKey && (rToken === token || (email && rEmail === email))) {
        rowIndex = r + 2;
        break;
      }
    }
  }
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, rowIndex, 12).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

// === WEB APP: recibe la selección final desde la app (o acciones admin) ===
function doPost(e) {
  try {
    return doPostImpl(e);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + (err && err.message ? err.message : String(err)) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPostImpl(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Sin cuerpo en la petición');
    }

    var data = JSON.parse(e.postData.contents);
    var action = (data && data.action) ? String(data.action).trim() : 'submit';

    if (action === 'get_cycle_status') {
      var wk = normalizarSemana(data.weekKey || '');
      var abierto = getCycleStatus(wk);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, abierto: abierto })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'admin_cycle_open' || action === 'admin_cycle_close') {
      var sec = (data.adminSecret || '').toString().trim();
      if (sec !== ADMIN_SECRET) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Acceso denegado' })).setMimeType(ContentService.MimeType.JSON);
      }
      var abierto = (action === 'admin_cycle_open');
      var ok = setCycleState(data.weekKey || '', abierto);
      if (ok === false) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet. Verificá USUARIOS_SPREADSHEET_ID y permisos.' })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, abierto: abierto })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action !== 'submit') {
      return handleAdminAction(data);
    }

    var weekKey = data.weekKey || data.weekNumber || '';
    if (!getCycleStatus(weekKey)) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'El período de elección está cerrado.' })).setMimeType(ContentService.MimeType.JSON);
    }

    var userName   = data.userName   || 'Colaborador';
    var userEmail  = data.userEmail  || '';
    var userToken  = data.userToken  || '';
    var weekNumber = data.weekNumber || '';
    var userTurn   = data.userTurn   || '';
    var selections = data.selections || {};
    var weeklyMenu = data.weeklyMenu || [];

    guardarRespuestaEnSheet(data);

    var summaryLines = weeklyMenu.map(function(day, index) {
      var sel = selections[index];
      if (!sel) {
        return day.day + ': SIN SELECCIÓN';
      }
      return day.day + ': ' + sel.name + ' - ' + sel.dish + ' (' + sel.category + ')';
    });

    var summaryText = summaryLines.join('\n');

    // Mail de confirmación al usuario
    if (userEmail) {
      var subjectUser = 'Confirmación de tu menú semanal';
      var bodyUser = [
        'Hola ' + userName + ',',
        '',
        'Tu selección de menú semanal ha sido registrada correctamente.',
        '',
        'Semana: ' + weekNumber,
        'Turno: ' + userTurn,
        '',
        'Detalle de tu selección:',
        '',
        summaryText,
        '',
        'Si detectás algún error, por favor contactá a RRHH / organización de almuerzos.',
        '',
        'Saludos,',
        'RRHH / Organización de Almuerzos'
      ].join('\n');

      MailApp.sendEmail({
        to: userEmail,
        subject: subjectUser,
        body: bodyUser
      });
    }

    // Mail al organizador
    var adminEmail = 'juan.billiot@sommiercenter.com';
    var subjectAdmin = 'Nueva selección de menú - ' + userName;
    var bodyAdmin = [
      'Usuario: ' + userName,
      'Email: ' + (userEmail || '(no informado)'),
      'Token: ' + (userToken || '(sin token)'),
      'Semana: ' + weekNumber,
      'Turno: ' + userTurn,
      '',
      'Selección:',
      '',
      summaryText
    ].join('\n');

    MailApp.sendEmail({
      to: adminEmail,
      subject: subjectAdmin,
      body: bodyAdmin
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('Error en doPost: ' + err);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}

// --- ADMIN: verifica contraseña y ejecuta acción ---
function handleAdminAction(data) {
  var secret = (data.adminSecret || '').toString().trim();
  if (secret !== ADMIN_SECRET) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'Acceso denegado. Contraseña incorrecta.'
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var action = (data.action || '').toString().trim();
    if (action === 'admin_ping') {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'pong' })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'admin_list') {
      return adminList(data.weekKey);
    }
    if (action === 'admin_cancel') {
      return adminCancel(data.token, data.weekKey, data.nombre);
    }
    if (action === 'admin_update') {
      return adminUpdate(data.token, data.weekKey, data.selections, data.nombre, data.details);
    }
    if (action === 'admin_add') {
      return adminAdd(data.nombre, data.turno, data.weekKey, data.selections, data.weeklyMenu);
    }
    if (action === 'admin_list_empresa') {
      return adminListEmpresa();
    }
    if (action === 'admin_send_opening') {
      return adminSendOpening();
    }
    if (action === 'admin_pdf_gmail') {
      return adminPdfGmail(data.weekKey);
    }
    if (action === 'admin_send_reminder') {
      return adminSendReminder(data.weekKey);
    }
    if (action === 'admin_cycle_open' || String(action).indexOf('admin_cycle_open') === 0) {
      setCycleState(data.weekKey || '', true);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, abierto: true })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'admin_cycle_close' || String(action).indexOf('admin_cycle_close') === 0) {
      setCycleState(data.weekKey || '', false);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, abierto: false })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'admin_cycle_status') {
      var abierto = getCycleStatus(data.weekKey);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, abierto: abierto })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Acción desconocida' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('handleAdminAction error: ' + err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error en admin: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function adminList(weekKey) {
  var sheet = obtenerHojaRespuestas();
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true, users: [], debug: 'lastRow<2' })).setMimeType(ContentService.MimeType.JSON);
  }
  var numCols = Math.max(sheet.getLastColumn(), 12);
  var datos = sheet.getRange(2, 1, lastRow, numCols).getValues();
  var wk = normalizarSemana(weekKey || '');
  var filtrados = datos.filter(function(row) {
    var rowSemana = normalizarSemana(row[0]);
    if (wk && rowSemana !== wk) return false;
    if (!row[1] && !row[2]) return false;
    return (row[10] || '').toString().toLowerCase() !== 'anulado';
  });
  var users = filtrados.map(function(row) {
    var det = {};
    try {
      var dStr = (row[11] || '').toString();
      if (dStr) det = JSON.parse(dStr);
    } catch (e) {}
    return {
      token: row[1], nombre: row[2], email: row[3], turno: row[4],
      lunes: row[5], martes: row[6], miercoles: row[7], jueves: row[8], viernes: row[9],
      estado: row[10] || 'activo', semana: normalizarSemana(row[0]), details: det
    };
  });
  // Deduplicar por email+semana (quedarse con el último = más reciente)
  users = users.reverse();
  var seen = {};
  users = users.filter(function(u) {
    var key = ((u.email || '').toLowerCase() || (u.token || '')) + '|' + (u.semana || '');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  users = users.reverse();
  return ContentService.createTextOutput(JSON.stringify({ ok: true, users: users, debug: { totalRows: datos.length, filtered: filtrados.length, weekKey: wk } })).setMimeType(ContentService.MimeType.JSON);
}

function adminCancel(token, weekKey, nombre) {
  try {
  var sheet = obtenerHojaRespuestas();
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sin datos' })).setMimeType(ContentService.MimeType.JSON);
  var datos = sheet.getRange(2, 1, lastRow, 11).getValues();
  var wk = normalizarSemana(weekKey);
  for (var r = 0; r < datos.length; r++) {
    if (normalizarSemana(datos[r][0]) === wk && String(datos[r][1]) === String(token)) {
      sheet.getRange(2 + r, 11).setValue('anulado');
      try { enviarCorreccionCocina('anulado', { nombre: nombre || datos[r][2], turno: datos[r][4], lunes: datos[r][5], martes: datos[r][6], miercoles: datos[r][7], jueves: datos[r][8], viernes: datos[r][9] }, null); } catch (e) { Logger.log('Corrección cocina: ' + e); }
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Usuario no encontrado' })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminCancel: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function adminUpdate(token, weekKey, selections, nombre, details) {
  try {
  var sheet = obtenerHojaRespuestas();
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sin datos' })).setMimeType(ContentService.MimeType.JSON);
  var datos = sheet.getRange(2, 1, lastRow, 12).getValues();
  var wk = normalizarSemana(weekKey);
  for (var r = 0; r < datos.length; r++) {
    if (normalizarSemana(datos[r][0]) === wk && String(datos[r][1]) === String(token)) {
      var row = datos[r];
      var antes = { lunes: row[5], martes: row[6], miercoles: row[7], jueves: row[8], viernes: row[9] };
      var nuevos = [];
      for (var i = 0; i < 5; i++) {
        var sel = (selections && selections[i]);
        var s = sel && typeof sel === 'object' ? ((sel.name || '') + ' - ' + (sel.dish || '')) : '';
        nuevos.push(s || '');
      }
      sheet.getRange(2 + r, 6, 2 + r, 10).setValues([nuevos]);
      var detStr = (details && typeof details === 'object') ? JSON.stringify(details) : (row[11] || '');
      sheet.getRange(2 + r, 12).setValue(detStr);
      try { enviarCorreccionCocina('modificado', { nombre: nombre || row[2], turno: row[4], lunes: nuevos[0], martes: nuevos[1], miercoles: nuevos[2], jueves: nuevos[3], viernes: nuevos[4] }, antes); } catch (e) { Logger.log('Corrección cocina: ' + e); }
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Usuario no encontrado' })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminUpdate: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function adminAdd(nombre, turno, weekKey, selections, weeklyMenu) {
  try {
  var sheet = obtenerHojaRespuestas();
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
  var token = 'invitado-' + Utilities.getUuid().toString().slice(0, 8);
  var row = [weekKey || '', token, nombre || 'Invitado', '', turno || '1', '', '', '', '', '', 'activo'];
  for (var i = 0; i < 5; i++) {
    var sel = (selections && selections[i]);
    var s = sel && typeof sel === 'object' ? ((sel.name || '') + ' - ' + (sel.dish || '')) : '';
    row[5 + i] = s;
  }
  sheet.appendRow(row);
  try { enviarCorreccionCocina('agregado', { nombre: nombre || 'Invitado', turno: turno || '1', lunes: row[5], martes: row[6], miercoles: row[7], jueves: row[8], viernes: row[9] }, null); } catch (e) { Logger.log('Corrección cocina: ' + e); }
  return ContentService.createTextOutput(JSON.stringify({ ok: true, token: token })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminAdd: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Lista usuarios de la hoja de empresa (para comparar quién pidió / no pidió)
function adminListEmpresa() {
  try {
    var sheet = obtenerHojaUsuarios();
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder a la hoja de usuarios. Verificá USUARIOS_SPREADSHEET_ID y que el script tenga permisos.', users: [] })).setMimeType(ContentService.MimeType.JSON);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, users: [], debug: 'lastRow<2', sheetName: sheet.getName() })).setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getRange(2, 1, lastRow, 4).getValues();
    var users = [];
    data.forEach(function(row) {
      var email = (row[0] || '').toString().trim();
      if (!email || email.indexOf('@') === -1) return;
      users.push({
        email: email,
        nombre: (row[1] || '').toString().trim(),
        token: (row[2] || '').toString(),
        turno: (row[3] === 2 || row[3] === '2') ? '2' : '1'
      });
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true, users: users })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminListEmpresa: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Envía mails de apertura a TODA la empresa (sin filtro TEST_EMAILS)
function adminSendOpening() {
  try {
    var sheet = obtenerHojaUsuarios();
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder a la hoja de usuarios' })).setMimeType(ContentService.MimeType.JSON);
    generarTokensSiFaltan();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No hay usuarios en la hoja' })).setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getRange(2, 1, lastRow, 4).getValues();
    var enviados = 0;
    data.forEach(function(row) {
      var email = (row[0] || '').toString().trim();
      var nombre = (row[1] || '').toString().trim() || 'Colaborador';
      var token = (row[2] || '').toString();
      var turno = (row[3] === 2 || row[3] === '2') ? 2 : 1;
      if (!email || !token) return;
      var url = APP_BASE_URL + '?u=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email) + '&name=' + encodeURIComponent(nombre) + '&turno=' + turno;
      var subject = 'Menú semanal disponible';
      var htmlBody = crearHtmlMailUsuario(nombre, url);
      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: 'Buen día ' + nombre + ',\n\nYa está disponible el menú semanal. Ingresá al siguiente enlace para elegir tu menú:\n\n' + url + '\n\nSaludos,\nRRHH / Organización de Almuerzos',
        htmlBody: htmlBody
      });
      enviados++;
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true, enviados: enviados })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminSendOpening: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Genera PDF del resumen y devuelve URL de Gmail para enviarlo
function adminPdfGmail(weekKey) {
  try {
    var sheet = obtenerHojaRespuestas();
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sin datos para la semana' })).setMimeType(ContentService.MimeType.JSON);
    }
    var wk = normalizarSemana(weekKey || '');
    var datos = sheet.getRange(2, 1, lastRow, Math.max(sheet.getLastColumn(), 12)).getValues();
    var filtrados = datos.filter(function(row) {
      if (wk && normalizarSemana(row[0]) !== wk) return false;
      return (row[10] || '').toString().toLowerCase() !== 'anulado';
    });
    if (filtrados.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sin respuestas para esta semana' })).setMimeType(ContentService.MimeType.JSON);
    }
    var ssNew = SpreadsheetApp.create('Resumen Menus ' + (wk || 'semana'));
    var hoja = ssNew.getSheets()[0];
    var filas = [['Usuario', 'Turno', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Detalle']];
    filtrados.forEach(function(row) {
      var det = {};
      try { var dStr = (row[11] || '').toString(); if (dStr) det = JSON.parse(dStr); } catch (e) {}
      var detStr = [];
      for (var i = 0; i < 5; i++) { if (det[i]) detStr.push(['Lun','Mar','Mié','Jue','Vie'][i] + ': ' + det[i]); }
      filas.push([
        (row[2] || '').toString(),
        (row[4] || '').toString(),
        extraerNumeroMenu(row[5]),
        extraerNumeroMenu(row[6]),
        extraerNumeroMenu(row[7]),
        extraerNumeroMenu(row[8]),
        extraerNumeroMenu(row[9]),
        detStr.join(' | ') || ''
      ]);
    });
    hoja.getRange(1, 1, filas.length, 8).setValues(filas);
    hoja.getRange(1, 1, 1, 8).setFontWeight('bold');
    var pdfBlob = ssNew.getAs('application/pdf');
    var folder = DriveApp.getFolderById(CARPETA_DRIVE_COCINA_ID);
    var pdfFile = folder.createFile(pdfBlob.setName('Menus ' + (wk || 'semana') + '.pdf'));
    DriveApp.getRootFolder().removeFile(DriveApp.getFileById(ssNew.getId()));
    var pdfUrl = pdfFile.getUrl();
    var subject = 'Menú semanal - ' + (wk || 'semana');
    var body = 'Adjunto el resumen de menús elegidos para la semana.\n\nLink al PDF: ' + pdfUrl;
    var gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, gmailUrl: gmailUrl, pdfUrl: pdfUrl })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminPdfGmail: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Envía recordatorio a quienes no pidieron menú
function adminSendReminder(weekKey) {
  try {
    var sheetResp = obtenerHojaRespuestas();
    var sheetEmp = obtenerHojaUsuarios();
    if (!sheetResp || !sheetEmp) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet o a la hoja de usuarios' })).setMimeType(ContentService.MimeType.JSON);
    var lastRow = sheetResp.getLastRow();
    var wk = normalizarSemana(weekKey || '');
    var quienesPidieron = {};
    if (lastRow >= 2) {
      var datos = sheetResp.getRange(2, 1, lastRow, 11).getValues();
      for (var r = 0; r < datos.length; r++) {
        var row = datos[r];
        if (wk && normalizarSemana(row[0]) !== wk) continue;
        if ((row[10] || '').toString().toLowerCase() === 'anulado') continue;
        var em = (row[3] || '').toString().toLowerCase();
        if (em) quienesPidieron[em] = true;
      }
    }
    var lastEmp = sheetEmp.getLastRow();
    if (lastEmp < 2) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No hay lista de empresa' })).setMimeType(ContentService.MimeType.JSON);
    }
    var dataEmp = sheetEmp.getRange(2, 1, lastEmp, 4).getValues();
    var enviados = 0;
    dataEmp.forEach(function(row) {
      var email = (row[0] || '').toString().trim().toLowerCase();
      if (!email || quienesPidieron[email]) return;
      var nombre = (row[1] || '').toString().trim() || 'Colaborador';
      var token = (row[2] || '').toString();
      if (!token) return;
      var turno = (row[3] === 2 || row[3] === '2') ? 2 : 1;
      var url = APP_BASE_URL + '?u=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(row[0]) + '&name=' + encodeURIComponent(nombre) + '&turno=' + turno;
      var subject = 'Recordatorio: Menú semanal pendiente';
      var body = 'Hola ' + nombre + ',\n\nAún no hemos recibido tu selección de menú para esta semana. Por favor ingresá al siguiente enlace para elegir:\n\n' + url + '\n\nSaludos,\nRRHH / Organización de Almuerzos';
      MailApp.sendEmail({ to: row[0], subject: subject, body: body });
      enviados++;
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true, enviados: enviados })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminSendReminder: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function enviarCorreccionCocina(tipo, datos, antes) {
  var lineas = ['CORRECCIÓN - Menú semanal', '', 'Tipo: ' + tipo.toUpperCase(), 'Nombre: ' + datos.nombre, 'Turno: ' + datos.turno, '', 'Menú actual:'];
  lineas.push('Lunes: ' + (datos.lunes || '-'));
  lineas.push('Martes: ' + (datos.martes || '-'));
  lineas.push('Miércoles: ' + (datos.miercoles || '-'));
  lineas.push('Jueves: ' + (datos.jueves || '-'));
  lineas.push('Viernes: ' + (datos.viernes || '-'));
  if (antes && tipo === 'modificado') {
    lineas.push('', 'Antes:');
    lineas.push('Lunes: ' + (antes.lunes || '-'));
    lineas.push('Martes: ' + (antes.martes || '-'));
    lineas.push('Miércoles: ' + (antes.miercoles || '-'));
    lineas.push('Jueves: ' + (antes.jueves || '-'));
    lineas.push('Viernes: ' + (antes.viernes || '-'));
  }
  MailApp.sendEmail({
    to: COCINA_EMAIL,
    subject: 'Corrección menú - ' + tipo + ' - ' + datos.nombre,
    body: lineas.join('\n')
  });
}

// Extrae solo el número de menú de "MENU 1 - Milanesa" -> "Menu 1"
function extraerNumeroMenu(celda) {
  if (!celda || typeof celda !== 'string') return '';
  var m = celda.match(/MENU\s*(\d+)/i);
  return m ? 'Menu ' + m[1] : celda;
}

// --- Informe para cocina: crear archivo en Drive + email (ejecutar lunes 9:00 Argentina) ---
function generarInformeSemanal() {
  var ahora = new Date();
  var tz = 'America/Argentina/Buenos_Aires';
  var strFecha = Utilities.formatDate(ahora, tz, 'yyyy-MM-dd');
  var diaSemana = Utilities.formatDate(ahora, tz, 'u'); // 1=Lunes, 7=Domingo
  if (diaSemana !== '1') {
    Logger.log('No es lunes; no se genera informe.');
    return;
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOJA_RESPUESTAS);
  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('Sin datos en Respuestas.');
    return;
  }
  var numCols = sheet.getLastColumn();
  var datos = sheet.getRange(2, 1, sheet.getLastRow(), Math.max(numCols, 11)).getValues();
  var semanaFiltrada = datos.filter(function(row) {
    if (String(row[0]) !== strFecha) return false;
    var estado = (row[10] || '').toString().toLowerCase();
    return estado !== 'anulado';
  });
  if (semanaFiltrada.length === 0) {
    Logger.log('Sin respuestas para la semana ' + strFecha);
    return;
  }
  var turno1 = semanaFiltrada.filter(function(row) { return String(row[4]).indexOf('1') !== -1; });
  var turno2 = semanaFiltrada.filter(function(row) { return String(row[4]).indexOf('2') !== -1; });
  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var parts = strFecha.split('-');
  var d1 = parseInt(parts[2], 10);
  var d2 = d1 + 4;
  var mes = meses[parseInt(parts[1], 10) - 1];
  var anio = parts[0];
  var nombreArchivo = 'Menus Semana ' + d1 + '-' + d2 + ' ' + mes + ' ' + anio;

  // Contador de menús (todos los días, todos los usuarios)
  var contadorMenus = {};
  var todosLosDatos = turno1.concat(turno2);
  todosLosDatos.forEach(function(row) {
    for (var c = 5; c <= 9; c++) {
      var num = extraerNumeroMenu(String(row[c] || ''));
      if (num) {
        contadorMenus[num] = (contadorMenus[num] || 0) + 1;
      }
    }
  });

  // 1. Crear Sheet en Drive (solo Semana, Nombre, Turno, Lunes, Martes, etc. con número de menú)
  var ssNew = SpreadsheetApp.create(nombreArchivo);
  var hoja = ssNew.getSheets()[0];
  hoja.setName('Resumen');
  var filas = [];
  filas.push(['TURNO 1 (13:00 - 14:00)']);
  filas.push(['Semana', 'Nombre', 'Turno', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']);
  turno1.forEach(function(row) {
    filas.push([
      row[0], row[2], row[4],
      extraerNumeroMenu(row[5]), extraerNumeroMenu(row[6]), extraerNumeroMenu(row[7]),
      extraerNumeroMenu(row[8]), extraerNumeroMenu(row[9])
    ]);
  });
  filas.push([]);
  filas.push(['TURNO 2 (14:00 - 15:00)']);
  filas.push(['Semana', 'Nombre', 'Turno', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']);
  turno2.forEach(function(row) {
    filas.push([
      row[0], row[2], row[4],
      extraerNumeroMenu(row[5]), extraerNumeroMenu(row[6]), extraerNumeroMenu(row[7]),
      extraerNumeroMenu(row[8]), extraerNumeroMenu(row[9])
    ]);
  });
  // Agregar contador al final del Sheet (cada fila debe tener 8 columnas)
  filas.push(['', '', '', '', '', '', '', '']);
  filas.push(['CONTADOR DE MENÚS', '', '', '', '', '', '', '']);
  var keys = Object.keys(contadorMenus).sort();
  keys.forEach(function(k) {
    filas.push([k + ': ' + contadorMenus[k], '', '', '', '', '', '', '']);
  });
  if (filas.length > 0) {
    hoja.getRange(1, 1, filas.length, 8).setValues(filas);
    hoja.getRange(1, 1, 2, 8).setFontWeight('bold');
  }
  var folder = DriveApp.getFolderById(CARPETA_DRIVE_COCINA_ID);
  var file = DriveApp.getFileById(ssNew.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  Logger.log('Informe creado: ' + nombreArchivo + ' en carpeta cocina.');

  // 2. Enviar email a cocina (formato simplificado + contador)
  var lineasEmail = [];
  lineasEmail.push('Menú semanal - Semana del ' + d1 + ' al ' + d2 + ' de ' + mes + ' ' + anio);
  lineasEmail.push('');
  lineasEmail.push('TURNO 1 (13:00 - 14:00)');
  lineasEmail.push('Semana | Nombre | Turno | Lunes | Martes | Miercoles | Jueves | Viernes');
  lineasEmail.push('---');
  turno1.forEach(function(row) {
    lineasEmail.push([
      row[0], row[2], row[4],
      extraerNumeroMenu(row[5]), extraerNumeroMenu(row[6]), extraerNumeroMenu(row[7]),
      extraerNumeroMenu(row[8]), extraerNumeroMenu(row[9])
    ].join(' | '));
  });
  lineasEmail.push('');
  lineasEmail.push('TURNO 2 (14:00 - 15:00)');
  lineasEmail.push('Semana | Nombre | Turno | Lunes | Martes | Miercoles | Jueves | Viernes');
  lineasEmail.push('---');
  turno2.forEach(function(row) {
    lineasEmail.push([
      row[0], row[2], row[4],
      extraerNumeroMenu(row[5]), extraerNumeroMenu(row[6]), extraerNumeroMenu(row[7]),
      extraerNumeroMenu(row[8]), extraerNumeroMenu(row[9])
    ].join(' | '));
  });
  lineasEmail.push('');
  lineasEmail.push('---');
  lineasEmail.push('CONTADOR DE MENÚS');
  keys.forEach(function(k) {
    lineasEmail.push(k + ': ' + contadorMenus[k]);
  });
  MailApp.sendEmail({
    to: COCINA_EMAIL,
    subject: 'Menú semanal viandas - ' + d1 + '-' + d2 + ' ' + mes + ' ' + anio,
    body: lineasEmail.join('\n')
  });
  Logger.log('Email enviado a cocina.');
}

// PRUEBA: Ejecutar desde el editor (Run > testAdminUpdate_) para ver el error en la consola
function testAdminUpdate_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_RESPUESTAS);
  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('No hay datos en Respuestas');
    return;
  }
  var row = sheet.getRange(2, 1, 2, 11).getValues()[0];
  var token = String(row[1]);
  var weekKey = normalizarSemana(row[0]);
  var selections = [
    { name: 'MENU 1', dish: 'Prueba' },
    null, null, null, null
  ];
  Logger.log('Probando con token=' + token + ' weekKey=' + weekKey);
  try {
    var result = adminUpdate(token, weekKey, selections, row[2]);
    Logger.log('OK: ' + result.getContent());
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
    Logger.log('Stack: ' + e.stack);
  }
}
