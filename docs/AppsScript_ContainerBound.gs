// CONFIGURACIÓN BÁSICA
// IMPORTANTE: Usar la URL de PRODUCCIÓN de Vercel (la que se actualiza con cada push), no una URL de deployment/preview.
// En Vercel: proyecto → Settings → Domains → la que sea tipo "tu-proyecto.vercel.app"
const APP_BASE_URL = 'https://proyecto-almuerzo.vercel.app';
const SHEET_NAME = 'usuarios_completos'; // Hoja con A=email, B=nombre, C=token, D=turno
const CARPETA_DRIVE_COCINA_ID = '1tiH7zZ8yZHWbiDD8e64basLJPAfxrrHm'; // Carpeta raíz del proyecto en Drive (Menu Semanal App)
/** Nombre de la subcarpeta donde se guardan PDFs e informes de menú (evita mezclar con otros archivos de la raíz). */
const MENUES_PDF_SUBCARPETA_NOMBRE = 'Menues pdf';

/** Carpeta "Menues pdf" dentro de CARPETA_DRIVE_COCINA_ID; la crea si aún no existe. */
function obtenerCarpetaMenuesPdf_() {
  var parent = DriveApp.getFolderById(CARPETA_DRIVE_COCINA_ID);
  var it = parent.getFoldersByName(MENUES_PDF_SUBCARPETA_NOMBRE);
  if (it.hasNext()) return it.next();
  return parent.createFolder(MENUES_PDF_SUBCARPETA_NOMBRE);
}
const HOJA_RESPUESTAS = 'Respuestas';
const HOJA_CONFIG = 'Config';
const COCINA_EMAIL = 'juan.billiot@sommiercenter.com'; // Email de la gente de viandas/cocina (confirmar)
const ADMIN_SECRET = 'Admin.2026'; // Contraseña admin
// Spreadsheet con la lista de usuarios. Vacío = intenta spreadsheet activo + propiedad SPREADSHEET_ID.
const USUARIOS_SPREADSHEET_ID = '';  // Opcional: pegá el ID de la URL del Sheet. Vacío = contenedor o propiedad.
// GID de la hoja de usuarios (número en la URL #gid=). 0 = detectar automático.
const USUARIOS_SHEET_GID = 877468020;

function generateToken_() {
  return Utilities.getUuid();
}

// Obtiene la hoja de usuarios (mismo spreadsheet que obtenerSpreadsheetPrincipal).
function obtenerHojaUsuarios() {
  var ssConst = obtenerSpreadsheetPrincipal();
  if (!ssConst) return null;
  try {
    var cfg = ssConst.getSheetByName(HOJA_CONFIG);
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

// Mail de apertura - entidades HTML para acentos (evita MenÃº en Gmail)
function crearHtmlMailUsuario(nombre, url) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:\'Segoe UI\',Tahoma,Geneva,Verdana,sans-serif;background:linear-gradient(135deg,#e8f0fe 0%,#f1f5f9 100%);">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;"><tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;border:1px solid rgba(0,0,0,0.04);">' +
    '<tr><td style="background:linear-gradient(135deg,#1a73e8 0%,#0d47a1 100%);padding:28px 24px;text-align:center;">' +
    '<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">Men&uacute; Semanal</h1>' +
    '<p style="margin:8px 0 0;color:rgba(255,255,255,0.95);font-size:15px;">Eleg&iacute; tu men&uacute; para la semana</p>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 24px;">' +
    '<p style="margin:0 0 16px;color:#1e293b;font-size:16px;line-height:1.5;">Hola <strong>' + nombre + '</strong>,</p>' +
    '<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">Ya est&aacute; disponible el men&uacute; semanal. Hac&eacute; clic en el bot&oacute;n para ingresar y elegir tus opciones.</p>' +
    '<p style="margin:0 0 20px;text-align:center;">' +
    '<a href="' + url + '" style="display:inline-block;padding:14px 32px;background:#1a73e8;color:#ffffff!important;text-decoration:none;font-size:16px;font-weight:600;border-radius:10px;box-shadow:0 4px 14px rgba(26,115,232,0.4);">Elegir mi men&uacute;</a>' +
    '</p>' +
    '<p style="margin:0;color:#64748b;font-size:13px;text-align:center;">Pod&eacute;s modificar tu elecci&oacute;n hasta el cierre del per&iacute;odo.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">' +
    '<p style="margin:0;color:#94a3b8;font-size:12px;">RRHH &middot; Organizaci&oacute;n de Almuerzos</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

// Mail de recordatorio - entidades HTML para acentos
function crearHtmlMailRecordatorio(nombre, url) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:\'Segoe UI\',Tahoma,Geneva,Verdana,sans-serif;background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;"><tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;border:1px solid rgba(0,0,0,0.04);">' +
    '<tr><td style="background:linear-gradient(135deg,#ea580c 0%,#c2410c 100%);padding:28px 24px;text-align:center;">' +
    '<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">Recordatorio: Men&uacute; Semanal</h1>' +
    '<p style="margin:8px 0 0;color:rgba(255,255,255,0.95);font-size:15px;">A&uacute;n no recibimos tu selecci&oacute;n</p>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 24px;">' +
    '<p style="margin:0 0 16px;color:#1e293b;font-size:16px;line-height:1.5;">Hola <strong>' + nombre + '</strong>,</p>' +
    '<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">A&uacute;n no hemos recibido tu selecci&oacute;n de men&uacute; para esta semana. Hac&eacute; clic en el bot&oacute;n para ingresar y elegir tus opciones.</p>' +
    '<p style="margin:0 0 20px;text-align:center;">' +
    '<a href="' + url + '" style="display:inline-block;padding:14px 32px;background:#ea580c;color:#ffffff!important;text-decoration:none;font-size:16px;font-weight:600;border-radius:10px;box-shadow:0 4px 14px rgba(234,88,12,0.4);">Elegir mi men&uacute;</a>' +
    '</p>' +
    '<p style="margin:0;color:#64748b;font-size:13px;text-align:center;">Si ya elegiste, pod&eacute;s ignorar este mensaje.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 24px;background:#fff7ed;border-top:1px solid #fed7aa;">' +
    '<p style="margin:0;color:#9a3412;font-size:12px;">RRHH &middot; Organizaci&oacute;n de Almuerzos</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

// Mail al proveedor con link al PDF - entidades HTML para acentos
function crearHtmlMailProveedor(pdfUrl, weekKey) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:\'Segoe UI\',Tahoma,Geneva,Verdana,sans-serif;background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;"><tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;border:1px solid rgba(0,0,0,0.04);">' +
    '<tr><td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px 24px;text-align:center;">' +
    '<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">Men&uacute; Semanal</h1>' +
    '<p style="margin:8px 0 0;color:rgba(255,255,255,0.95);font-size:15px;">Resumen para proveedor</p>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 24px;">' +
    '<p style="margin:0 0 16px;color:#1e293b;font-size:16px;line-height:1.5;">Hac&eacute; clic en el bot&oacute;n para ver el resumen de men&uacute;s elegidos.</p>' +
    '<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">Semana: ' + (weekKey || '') + '</p>' +
    '<p style="margin:0 0 20px;text-align:center;">' +
    '<a href="' + pdfUrl + '" style="display:inline-block;padding:14px 32px;background:#059669;color:#ffffff!important;text-decoration:none;font-size:16px;font-weight:600;border-radius:10px;box-shadow:0 4px 14px rgba(5,150,105,0.4);">Ver PDF</a>' +
    '</p>' +
    '<p style="margin:0;color:#64748b;font-size:13px;text-align:center;">O copi&aacute; este enlace: <a href="' + pdfUrl + '" style="color:#059669;word-break:break-all;">' + pdfUrl + '</a></p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 24px;background:#ecfdf5;border-top:1px solid #a7f3d0;">' +
    '<p style="margin:0;color:#047857;font-size:12px;">RRHH &middot; Organizaci&oacute;n de Almuerzos</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

function crearHtmlMailProveedorDia(pdfUrl, weekKey, dayLabel) {
  var dl = dayLabel || 'd\u00eda';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:\'Segoe UI\',Tahoma,Geneva,Verdana,sans-serif;background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;"><tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;border:1px solid rgba(0,0,0,0.04);">' +
    '<tr><td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px 24px;text-align:center;">' +
    '<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:-0.5px;">Men&uacute; del d&iacute;a</h1>' +
    '<p style="margin:8px 0 0;color:rgba(255,255,255,0.95);font-size:15px;">' + dl + ' &middot; resumen para proveedor</p>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 24px;">' +
    '<p style="margin:0 0 16px;color:#1e293b;font-size:16px;line-height:1.5;">PDF solo con pedidos y cantidades de <strong>' + dl + '</strong> (fecha Argentina).</p>' +
    '<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">Semana: ' + (weekKey || '') + '</p>' +
    '<p style="margin:0 0 20px;text-align:center;">' +
    '<a href="' + pdfUrl + '" style="display:inline-block;padding:14px 32px;background:#059669;color:#ffffff!important;text-decoration:none;font-size:16px;font-weight:600;border-radius:10px;box-shadow:0 4px 14px rgba(5,150,105,0.4);">Ver PDF</a>' +
    '</p>' +
    '<p style="margin:0;color:#64748b;font-size:13px;text-align:center;">O copi&aacute; este enlace: <a href="' + pdfUrl + '" style="color:#059669;word-break:break-all;">' + pdfUrl + '</a></p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 24px;background:#ecfdf5;border-top:1px solid #a7f3d0;">' +
    '<p style="margin:0;color:#047857;font-size:12px;">RRHH &middot; Organizaci&oacute;n de Almuerzos</p>' +
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

    const subject = 'Men\u00fa semanal disponible';
    const htmlBody = crearHtmlMailUsuario(nombre, url);

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: 'Buen d\u00eda ' + nombre + ',\n\nYa est\u00e1 disponible el men\u00fa semanal. Ingres\u00e1 al siguiente enlace para elegir tu men\u00fa:\n\n' + url + '\n\nSaludos,\nRRHH / Organizaci\u00f3n de Almuerzos',
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
/** Abre el Sheet principal: constante USUARIOS_SPREADSHEET_ID, propiedad script SPREADSHEET_ID, o spreadsheet activo (script contenedor). */
function obtenerSpreadsheetPrincipal() {
  if (typeof USUARIOS_SPREADSHEET_ID === 'string' && USUARIOS_SPREADSHEET_ID.trim()) {
    try { return SpreadsheetApp.openById(USUARIOS_SPREADSHEET_ID.trim()); } catch (e) { Logger.log('openById USUARIOS: ' + e); }
  }
  try {
    var pid = (PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '').trim();
    if (pid) {
      try { return SpreadsheetApp.openById(pid); } catch (e2) { Logger.log('openById SPREADSHEET_ID: ' + e2); }
    }
  } catch (eP) {}
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  return null;
}

/**
 * Mails de apertura/recordatorio: remitente opcional (alias "Enviar correo como" en Gmail).
 * Si falla GmailApp con "from", se reintenta con MailApp sin alias.
 */
function enviarMailAdmin_(opts) {
  var to = opts.to;
  var subject = opts.subject;
  var body = opts.body || '';
  var htmlBody = opts.htmlBody;
  var fromAddr = (opts.from || '').toString().trim();
  var fromName = (opts.fromName || '').toString().trim();
  var gOpts = {};
  if (htmlBody) gOpts.htmlBody = htmlBody;
  if (fromName) gOpts.name = fromName;
  if (fromAddr) {
    gOpts.from = fromAddr;
    try {
      GmailApp.sendEmail(to, subject, body, gOpts);
      return;
    } catch (e) {
      Logger.log('GmailApp desde ' + fromAddr + ': ' + e);
    }
  }
  var mOpts = { to: to, subject: subject, body: body };
  if (htmlBody) mOpts.htmlBody = htmlBody;
  if (fromName) mOpts.name = fromName;
  MailApp.sendEmail(mOpts);
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
    // Una fila x 12 columnas: getRange(fila, col, numFilas=1, numCols=12)
    sheet.getRange(rowIndex, 1, 1, 12).setValues([row]);
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
    var details = data.details || {};
    var weeklyMenu = data.weeklyMenu || [];

    guardarRespuestaEnSheet(data);

    var summaryLines = weeklyMenu.map(function(day, index) {
      var sel = selections[index];
      var det = (details[index] || details[index.toString()] || '').toString().trim();
      if (!sel) {
        return day.day + ': SIN SELECCIÓN';
      }
      var line = day.day + ': ' + sel.name + ' - ' + sel.dish + ' (' + sel.category + ')';
      if (det) line += '\n  Detalle: ' + det;
      return line;
    });

    var summaryText = summaryLines.join('\n');

    // Mail de confirmación al usuario
    if (userEmail) {
      var subjectUser = 'Confirmaci\u00f3n de tu men\u00fa semanal';
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
    var subjectAdmin = 'Nueva selecci\u00f3n de men\u00fa - ' + userName;
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
      return adminAdd(data.nombre, data.turno, data.weekKey, data.selections, data.weeklyMenu, data.details);
    }
    if (action === 'admin_list_empresa') {
      return adminListEmpresa();
    }
    if (action === 'admin_send_opening') {
      return adminSendOpening(data);
    }
    if (action === 'admin_pdf_gmail') {
      return adminPdfGmail(data.weekKey);
    }
    if (action === 'admin_pdf_gmail_dia') {
      return adminPdfGmailDia(data.weekKey);
    }
    if (action === 'admin_send_reminder') {
      return adminSendReminder(data.weekKey, data.emails, data);
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
  var users = filtrados.map(function(row, idx) {
    var det = {};
    try {
      var dStr = (row[11] || '').toString();
      if (dStr) det = JSON.parse(dStr);
    } catch (e) {}
    return {
      token: row[1], nombre: row[2], email: row[3], turno: row[4],
      lunes: row[5], martes: row[6], miercoles: row[7], jueves: row[8], viernes: row[9],
      estado: row[10] || 'activo', semana: normalizarSemana(row[0]), details: det,
      _rowIdx: idx
    };
  });
  // Deduplicar: solo el ÚLTIMO por usuario+semana (ordenar por índice descendente, quedarse con el primero de cada key)
  users.sort(function(a, b) { return (b._rowIdx || 0) - (a._rowIdx || 0); });
  var seen = {};
  users = users.filter(function(u) {
    var key = ((u.email || '').toLowerCase() || (u.token || '')) + '|' + (u.semana || '');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  users.forEach(function(u) { delete u._rowIdx; });
  users.sort(function(a, b) { return (a.nombre || '').localeCompare(b.nombre || ''); });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, users: users, debug: { totalRows: datos.length, filtered: filtrados.length, weekKey: wk } })).setMimeType(ContentService.MimeType.JSON);
}

function adminCancel(token, weekKey, nombre) {
  try {
  var sheet = obtenerHojaRespuestas();
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sin datos' })).setMimeType(ContentService.MimeType.JSON);
  var datos = sheet.getRange(2, 1, lastRow, 12).getValues();
  var wk = normalizarSemana(weekKey);
  for (var r = 0; r < datos.length; r++) {
    if (normalizarSemana(datos[r][0]) === wk && String(datos[r][1]) === String(token)) {
      sheet.getRange(2 + r, 11).setValue('anulado');
      var det = {};
      try { var dStr = (datos[r][11] || '').toString(); if (dStr) det = JSON.parse(dStr); } catch (e) {}
      try { enviarCorreccionCocina('anulado', { nombre: nombre || datos[r][2], turno: datos[r][4], lunes: datos[r][5], martes: datos[r][6], miercoles: datos[r][7], jueves: datos[r][8], viernes: datos[r][9], details: det }, null); } catch (e) { Logger.log('Corrección cocina: ' + e); }
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
      // getRange(fila, columna, numFilas, numColumnas) — no usar filaFin/colFin
      sheet.getRange(2 + r, 6, 1, 5).setValues([nuevos]);
      var detStr = (details && typeof details === 'object') ? JSON.stringify(details) : (row[11] || '');
      sheet.getRange(2 + r, 12).setValue(detStr);
      var det = {};
      if (details && typeof details === 'object') det = details;
      else { try { var dStr = (row[11] || '').toString(); if (dStr) det = JSON.parse(dStr); } catch (e) {} }
      try { enviarCorreccionCocina('modificado', { nombre: nombre || row[2], turno: row[4], lunes: nuevos[0], martes: nuevos[1], miercoles: nuevos[2], jueves: nuevos[3], viernes: nuevos[4], details: det }, antes); } catch (e) { Logger.log('Corrección cocina: ' + e); }
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Usuario no encontrado' })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminUpdate: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function adminAdd(nombre, turno, weekKey, selections, weeklyMenu, details) {
  try {
  var sheet = obtenerHojaRespuestas();
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
  var token = 'invitado-' + Utilities.getUuid().toString().slice(0, 8);
  var row = [weekKey || '', token, nombre || 'Invitado', '', turno || '1', '', '', '', '', '', 'activo', ''];
  for (var i = 0; i < 5; i++) {
    var sel = (selections && selections[i]);
    var s = sel && typeof sel === 'object' ? ((sel.name || '') + ' - ' + (sel.dish || '')) : '';
    row[5 + i] = s;
  }
  row[11] = (details && typeof details === 'object') ? JSON.stringify(details) : '{}';
  sheet.appendRow(row);
  var det = (details && typeof details === 'object') ? details : {};
  try { enviarCorreccionCocina('agregado', { nombre: nombre || 'Invitado', turno: turno || '1', lunes: row[5], martes: row[6], miercoles: row[7], jueves: row[8], viernes: row[9], details: det }, null); } catch (e) { Logger.log('Corrección cocina: ' + e); }
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

// Envía mails de apertura a TODA la empresa (sin filtro TEST_EMAILS). data.mailFrom / mailFromName = opcional.
function adminSendOpening(data) {
  data = data || {};
  var mailFrom = (data.mailFrom || '').toString().trim();
  var mailFromName = (data.mailFromName || '').toString().trim();
  try {
    var sheet = obtenerHojaUsuarios();
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder a la hoja de usuarios' })).setMimeType(ContentService.MimeType.JSON);
    generarTokensSiFaltan();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No hay usuarios en la hoja' })).setMimeType(ContentService.MimeType.JSON);
    }
    var dataRows = sheet.getRange(2, 1, lastRow, 4).getValues();
    var enviados = 0;
    dataRows.forEach(function(row) {
      var email = (row[0] || '').toString().trim();
      var nombre = (row[1] || '').toString().trim() || 'Colaborador';
      var token = (row[2] || '').toString();
      var turno = (row[3] === 2 || row[3] === '2') ? 2 : 1;
      if (!email || !token) return;
      var url = APP_BASE_URL + '?u=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email) + '&name=' + encodeURIComponent(nombre) + '&turno=' + turno;
      var subject = 'Men\u00fa semanal disponible';
      var htmlBody = crearHtmlMailUsuario(nombre, url);
      enviarMailAdmin_({
        to: email,
        subject: subject,
        body: 'Buen d\u00eda ' + nombre + ',\n\nYa est\u00e1 disponible el men\u00fa semanal. Ingres\u00e1 al siguiente enlace para elegir tu men\u00fa:\n\n' + url + '\n\nSaludos,\nRRHH / Organizaci\u00f3n de Almuerzos',
        htmlBody: htmlBody,
        from: mailFrom,
        fromName: mailFromName
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
    var wk = normalizarSemana(weekKey || '');
    var pack = obtenerFiltradosOrdenadosParaPdf_(wk);
    if (!pack) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
    var filtrados = pack.filtrados;
    if (filtrados.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sin respuestas para esta semana' })).setMimeType(ContentService.MimeType.JSON);
    }
    var ssNew = SpreadsheetApp.create('Resumen Menus ' + (wk || 'semana'));
    var hoja = ssNew.getSheets()[0];
    hoja.setName('Resumen');
    var filas = [['Usuario', 'Turno', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Detalle']];
    var contadorMenus = {};
    var contadorPorDia = [{}, {}, {}, {}, {}];
    filtrados.forEach(function(row) {
      var det = {};
      try { var dStr = (row[11] || '').toString(); if (dStr) det = JSON.parse(dStr); } catch (e) {}
      var detStr = [];
      for (var i = 0; i < 5; i++) { if (det[i]) detStr.push(['Lun','Mar','Mié','Jue','Vie'][i] + ': ' + det[i]); }
      var m5 = extraerNumeroMenu(row[5]), m6 = extraerNumeroMenu(row[6]), m7 = extraerNumeroMenu(row[7]), m8 = extraerNumeroMenu(row[8]), m9 = extraerNumeroMenu(row[9]);
      var menus = [m5, m6, m7, m8, m9];
      menus.forEach(function(m, i) {
        if (m) {
          contadorMenus[m] = (contadorMenus[m] || 0) + 1;
          contadorPorDia[i][m] = (contadorPorDia[i][m] || 0) + 1;
        }
      });
      filas.push([
        (row[2] || '').toString(),
        soloTurnoPdf_(row[4]),
        m5, m6, m7, m8, m9,
        detStr.join(' | ') || ''
      ]);
    });
    filas.push(['', '', '', '', '', '', '', '']);
    var menuOrden = ['Menu 1', 'Menu 2', 'Menu 3', 'Menu 4', 'Menu 5', 'REMOTO', 'SIN VIANDA'];
    var otros = Object.keys(contadorMenus).filter(function(k) { return menuOrden.indexOf(k) === -1; });
    // Celda vacía entre "RESUMEN POR DÍA" y "Lunes" para alinear Lunes..Viernes con la tabla de arriba
    filas.push(['RESUMEN POR DÍA', '', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', '']);
    menuOrden.concat(otros).forEach(function(m) {
      var tieneAlgo = false;
      var row = [m, ''];
      for (var d = 0; d < 5; d++) {
        var c = contadorPorDia[d][m] || 0;
        row.push(c > 0 ? c : '');
        if (c > 0) tieneAlgo = true;
      }
      row.push('');
      if (tieneAlgo) filas.push(row);
    });
    var totalPorDia = [0, 0, 0, 0, 0];
    for (var td = 0; td < 5; td++) {
      var keysD = Object.keys(contadorPorDia[td]);
      for (var tk = 0; tk < keysD.length; tk++) {
        totalPorDia[td] += contadorPorDia[td][keysD[tk]] || 0;
      }
    }
    filas.push(['TOTAL VIANDAS', '', totalPorDia[0], totalPorDia[1], totalPorDia[2], totalPorDia[3], totalPorDia[4], '']);
    hoja.getRange(1, 1, filas.length, 8).setValues(filas);
    hoja.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    var nUser = filtrados.length;
    for (var r = 2; r <= nUser + 1; r++) {
      hoja.getRange(r, 1, 1, 8).setBackground(r % 2 === 0 ? '#f8fafc' : '#ffffff');
    }
    for (var ri = 0; ri < filas.length; ri++) {
      var lbl = (filas[ri][0] || '').toString();
      if (lbl.indexOf('RESUMEN') !== -1 || lbl.indexOf('TOTAL VIANDAS') !== -1) {
        hoja.getRange(ri + 1, 1, 1, 8).setFontWeight('bold').setBackground('#e2e8f0');
      }
    }
    hoja.autoResizeColumns(1, 8);
    SpreadsheetApp.flush();
    var pdfBlob = ssNew.getAs('application/pdf');
    var folder = obtenerCarpetaMenuesPdf_();
    var pdfFile = folder.createFile(pdfBlob.setName('Menus ' + (wk || 'semana') + '.pdf'));
    DriveApp.getRootFolder().removeFile(DriveApp.getFileById(ssNew.getId()));
    var pdfUrl = pdfFile.getUrl();
    var subject = 'Men\u00fa semanal - ' + (wk || 'semana');
    var htmlBody = crearHtmlMailProveedor(pdfUrl, wk || 'semana');
    var bodyPlain = 'Resumen de menús elegidos para la semana.\n\nVer PDF: ' + pdfUrl;
    try {
      MailApp.sendEmail(COCINA_EMAIL, subject, bodyPlain, { htmlBody: htmlBody });
    } catch (mailErr) {
      Logger.log('Mail proveedor: ' + mailErr);
    }
    var gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(bodyPlain);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, gmailUrl: gmailUrl, pdfUrl: pdfUrl })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminPdfGmail: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function adminPdfGmailDia(weekKey) {
  try {
    var wk = normalizarSemana(weekKey || '');
    var dayIdx = argentinaMenuDayIndex_();
    if (dayIdx === null) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: 'Hoy es fin de semana. El PDF del d\u00eda solo aplica de lunes a viernes (Argentina).'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var pack = obtenerFiltradosOrdenadosParaPdf_(wk);
    if (!pack) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se pudo acceder al spreadsheet' })).setMimeType(ContentService.MimeType.JSON);
    var filtrados = pack.filtrados;
    if (filtrados.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sin respuestas para esta semana' })).setMimeType(ContentService.MimeType.JSON);
    }
    var dayLabels = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
    var dayLabel = dayLabels[dayIdx];
    var ssNew = SpreadsheetApp.create('Menus ' + dayLabel + ' ' + wk);
    var hoja = ssNew.getSheets()[0];
    hoja.setName('Resumen dia');
    var filas = [];
    filas.push(['Pedidos ' + dayLabel + ' - semana ' + wk, '', '', '', '', '', '', '']);
    filas.push(['Usuario', 'Turno', 'Eleccion ' + dayLabel, 'Detalle', '', '', '', '']);
    var contadorDia = {};
    filtrados.forEach(function(row) {
      var det = {};
      try { var dStr = (row[11] || '').toString(); if (dStr) det = JSON.parse(dStr); } catch (e) {}
      var cell = row[5 + dayIdx];
      var m = extraerNumeroMenu(String(cell || ''));
      if (m) contadorDia[m] = (contadorDia[m] || 0) + 1;
      var detTxt = (det[dayIdx] != null ? det[dayIdx] : det[String(dayIdx)] || '').toString();
      filas.push([
        (row[2] || '').toString(),
        soloTurnoPdf_(row[4]),
        String(cell || ''),
        detTxt,
        '', '', '', ''
      ]);
    });
    var menuOrden = ['Menu 1', 'Menu 2', 'Menu 3', 'Menu 4', 'Menu 5', 'REMOTO', 'SIN VIANDA'];
    var otrosList = Object.keys(contadorDia).filter(function(k) { return menuOrden.indexOf(k) === -1; });
    filas.push(['', '', '', '', '', '', '', '']);
    filas.push(['', '', '', '', '', '', '', '']);
    filas.push(['RESUMEN ' + dayLabel, '', '', '', '', '', '', '']);
    filas.push(['', '', '', '', '', '', '', '']);
    var sumTotal = 0;
    menuOrden.concat(otrosList.slice().sort()).forEach(function(m) {
      var c = contadorDia[m] || 0;
      if (c > 0) {
        filas.push(['', m, c, '', '', '', '', '']);
        sumTotal += c;
      }
    });
    filas.push(['', 'TOTAL ' + dayLabel, sumTotal, '', '', '', '', '']);
    hoja.getRange(1, 1, filas.length, 8).setValues(filas);
    hoja.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    hoja.getRange(2, 1, 1, 8).setFontWeight('bold').setBackground('#e2e8f0');
    var nPed = filtrados.length;
    for (var r = 3; r <= nPed + 2; r++) {
      hoja.getRange(r, 1, 1, 8).setBackground(r % 2 === 0 ? '#f8fafc' : '#ffffff');
    }
    for (var ri = 0; ri < filas.length; ri++) {
      var a = (filas[ri][0] || '').toString();
      var b = (filas[ri][1] || '').toString();
      if (ri > 0 && a.indexOf('RESUMEN') !== -1) {
        hoja.getRange(ri + 1, 1, 1, 8).setFontWeight('bold').setBackground('#e2e8f0');
      } else if (b.indexOf('TOTAL ') === 0) {
        hoja.getRange(ri + 1, 1, 1, 8).setFontWeight('bold');
      }
    }
    hoja.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    hoja.getRange(2, 1, 1, 8).setFontWeight('bold').setBackground('#e2e8f0');
    hoja.autoResizeColumns(1, 8);
    SpreadsheetApp.flush();
    var pdfBlob = ssNew.getAs('application/pdf');
    var folder = obtenerCarpetaMenuesPdf_();
    var pdfFile = folder.createFile(pdfBlob.setName('Menus ' + dayLabel + ' ' + (wk || 'semana') + '.pdf'));
    DriveApp.getRootFolder().removeFile(DriveApp.getFileById(ssNew.getId()));
    var pdfUrl = pdfFile.getUrl();
    var subject = 'Men\u00fa d\u00eda (' + dayLabel + ') - ' + (wk || 'semana');
    var htmlBody = crearHtmlMailProveedorDia(pdfUrl, wk || 'semana', dayLabel);
    var bodyPlain = 'Resumen de men\u00fas para ' + dayLabel + ' (semana ' + (wk || '') + ').\n\nVer PDF: ' + pdfUrl;
    try {
      MailApp.sendEmail(COCINA_EMAIL, subject, bodyPlain, { htmlBody: htmlBody });
    } catch (mailErr) {
      Logger.log('Mail proveedor d\u00eda: ' + mailErr);
    }
    var gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(bodyPlain);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, gmailUrl: gmailUrl, pdfUrl: pdfUrl, dayLabel: dayLabel })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    Logger.log('adminPdfGmailDia: ' + e);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Error: ' + e.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Envía recordatorio a quienes no pidieron menú
// emails: array opcional de emails; si se pasa, solo envía a esos; si no, envía a todos los que no pidieron
// data: mailFrom / mailFromName opcional (mismo criterio que adminSendOpening)
function adminSendReminder(weekKey, emailsFiltro, data) {
  data = data || {};
  var mailFrom = (data.mailFrom || '').toString().trim();
  var mailFromName = (data.mailFromName || '').toString().trim();
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
    var setFiltro = null;
    if (Array.isArray(emailsFiltro) && emailsFiltro.length > 0) {
      setFiltro = {};
      emailsFiltro.forEach(function(e) { setFiltro[(e || '').toString().trim().toLowerCase()] = true; });
    }
    var enviados = 0;
    dataEmp.forEach(function(row) {
      var email = (row[0] || '').toString().trim().toLowerCase();
      if (!email || quienesPidieron[email]) return;
      if (setFiltro && !setFiltro[email]) return;
      var nombre = (row[1] || '').toString().trim() || 'Colaborador';
      var token = (row[2] || '').toString();
      if (!token) return;
      var turno = (row[3] === 2 || row[3] === '2') ? 2 : 1;
      var url = APP_BASE_URL + '?u=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(row[0]) + '&name=' + encodeURIComponent(nombre) + '&turno=' + turno;
      var subject = 'Recordatorio: Men\u00fa semanal pendiente';
      var body = 'Hola ' + nombre + ',\n\nA\u00fan no hemos recibido tu selecci\u00f3n de men\u00fa para esta semana. Por favor ingres\u00e1 al siguiente enlace para elegir:\n\n' + url + '\n\nSaludos,\nRRHH / Organizaci\u00f3n de Almuerzos';
      var htmlBody = crearHtmlMailRecordatorio(nombre, url);
      enviarMailAdmin_({
        to: row[0],
        subject: subject,
        body: body,
        htmlBody: htmlBody,
        from: mailFrom,
        fromName: mailFromName
      });
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
  var dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  for (var i = 0; i < dias.length; i++) {
    var d = dias[i];
    var menu = (datos[d] || '-').toString();
    var det = (datos.details && (datos.details[i] || datos.details[i.toString()])) ? String(datos.details[i] || datos.details[i.toString()]).trim() : '';
    lineas.push((d.charAt(0).toUpperCase() + d.slice(1)) + ': ' + menu + (det ? ' (detalle: ' + det + ')' : ''));
  }
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
    subject: 'Correcci\u00f3n men\u00fa - ' + tipo + ' - ' + datos.nombre,
    body: lineas.join('\n')
  });
}

// Extrae solo el número de menú de "MENU 1 - Milanesa" -> "Menu 1", REMOTO -> "REMOTO", etc.
function extraerNumeroMenu(celda) {
  if (!celda || typeof celda !== 'string') return '';
  var m = celda.match(/MENU\s*(\d+)/i);
  if (m) return 'Menu ' + m[1];
  if (/REMOTO/i.test(celda)) return 'REMOTO';
  if (/SIN VIANDA/i.test(celda)) return 'SIN VIANDA';
  return String(celda).slice(0, 30);
}

function soloTurnoPdf_(val) {
  var s = String(val || '').trim();
  if (s.indexOf('2') !== -1) return '2';
  return '1';
}

/** 0=Lunes ... 4=Viernes, null = s\u00e1bado/domingo (Argentina). u: 1=lunes..7=domingo */
function argentinaMenuDayIndex_() {
  var tz = 'America/Argentina/Buenos_Aires';
  var u = parseInt(Utilities.formatDate(new Date(), tz, 'u'), 10);
  if (u >= 6) return null;
  return u - 1;
}

function obtenerFiltradosOrdenadosParaPdf_(wk) {
  var sheet = obtenerHojaRespuestas();
  if (!sheet) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { sheet: sheet, filtrados: [] };
  var wkNorm = normalizarSemana(wk || '');
  var datos = sheet.getRange(2, 1, lastRow, Math.max(sheet.getLastColumn(), 12)).getValues();
  var filtrados = datos.filter(function(row) {
    if (wkNorm && normalizarSemana(row[0]) !== wkNorm) return false;
    return (row[10] || '').toString().toLowerCase() !== 'anulado';
  });
  filtrados.reverse();
  var seenPdf = {};
  filtrados = filtrados.filter(function(row) {
    var key = ((row[3] || '').toString().toLowerCase() || (row[1] || '')) + '|' + normalizarSemana(row[0]);
    if (seenPdf[key]) return false;
    seenPdf[key] = true;
    return true;
  });
  function apellido(nombre) {
    var s = (nombre || '').toString().trim();
    var parts = s.split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : s.toLowerCase();
  }
  filtrados.sort(function(a, b) {
    var t1 = String(a[4] || '').indexOf('2') !== -1 ? 2 : 1;
    var t2 = String(b[4] || '').indexOf('2') !== -1 ? 2 : 1;
    if (t1 !== t2) return t1 - t2;
    return apellido(a[2]).localeCompare(apellido(b[2]));
  });
  return { sheet: sheet, filtrados: filtrados };
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
  var folder = obtenerCarpetaMenuesPdf_();
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
    subject: 'Men\u00fa semanal viandas - ' + d1 + '-' + d2 + ' ' + mes + ' ' + anio,
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
