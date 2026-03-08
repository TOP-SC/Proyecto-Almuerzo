// CONFIGURACIÓN BÁSICA
// IMPORTANTE: Usar la URL de PRODUCCIÓN de Vercel (la que se actualiza con cada push), no una URL de deployment/preview.
// En Vercel: proyecto → Settings → Domains → la que sea tipo "tu-proyecto.vercel.app"
const APP_BASE_URL = 'https://top-proyecto-almuerzo.vercel.app';
const SHEET_NAME = 'Hoja 1'; // cambia si tu pestaña se llama distinto
const CARPETA_DRIVE_COCINA_ID = '1tiH7zZ8yZHWbiDD8e64basLJPAfxrrHm'; // Carpeta donde se genera el archivo para cocina
const HOJA_RESPUESTAS = 'Respuestas';

function generateToken_() {
  return Utilities.getUuid();
}

// Obtiene la hoja de usuarios (por nombre o la primera si no existe)
function obtenerHojaUsuarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];
  return sheet;
}

// Genera tokens para todos los usuarios que no tengan uno en la columna "token"
function generarTokensSiFaltan() {
  const sheet = obtenerHojaUsuarios();
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

// ENVÍA UN MAIL A CADA USUARIO CON SU LINK PERSONALIZADO (incluye turno)
function enviarLinksMenuSemanal() {
  const sheet = obtenerHojaUsuarios();

  generarTokensSiFaltan();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Leer 4 columnas: A=email, B=nombre, C=token, D=turno
  const data = sheet.getRange(2, 1, lastRow, 4).getValues();

  const TEST_EMAILS = [
    'giselle.morbello@sommiercenter.com',
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
    const body = [
      'Buen día ' + nombre + ',',
      '',
      'Ya está disponible el menú semanal para que elijas tus opciones.',
      'Por favor ingresá al siguiente enlace para seleccionar tu menú:',
      '',
      url,
      '',
      'Recordá que podés modificar tu elección hasta la fecha/hora límite establecida.',
      '',
      'Saludos,',
      'RRHH / Organización de Almuerzos'
    ].join('\n');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body
    });
  });
}

// Para que la URL no dé error al abrirla en el navegador (GET)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Backend menú semanal activo' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Obtiene o crea la hoja "Respuestas" y devuelve referencia
function obtenerHojaRespuestas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOJA_RESPUESTAS);
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_RESPUESTAS);
    sheet.getRange(1, 1, 1, 10).setValues([['Semana', 'Token', 'Nombre', 'Email', 'Turno', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }
  return sheet;
}

// Guarda o actualiza la respuesta en la hoja (una fila por usuario por semana)
function guardarRespuestaEnSheet(data) {
  var sheet = obtenerHojaRespuestas();
  var headers = sheet.getRange(1, 1, 1, 10).getValues()[0];
  var lastRow = sheet.getLastRow();
  var weekKey = data.weekKey || data.weekNumber || '';
  var token = (data.userToken || '').toString();
  var nombre = data.userName || 'Colaborador';
  var email = data.userEmail || '';
  var turno = data.userTurn || '';
  var selections = data.selections || {};
  var dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
  var row = [weekKey, token, nombre, email, turno];
  for (var i = 0; i < 5; i++) {
    var sel = selections[i];
    row.push(sel ? (sel.name + ' - ' + sel.dish) : '');
  }
  var dataRows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow, 2).getValues() : [];
  var rowIndex = -1;
  for (var r = 0; r < dataRows.length; r++) {
    if (String(dataRows[r][0]) === String(weekKey) && String(dataRows[r][1]) === token) {
      rowIndex = r + 2;
      break;
    }
  }
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, rowIndex, 10).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

// === WEB APP: recibe la selección final desde la app ===
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error('Sin cuerpo en la petición');
    }

    var data = JSON.parse(e.postData.contents);

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
      .setResponseCode(500);
  }
}

// --- Informe para cocina: crear archivo en Drive (ejecutar lunes 9:00 Argentina) ---
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
  var datos = sheet.getRange(2, 1, sheet.getLastRow(), 10).getValues();
  var semanaFiltrada = datos.filter(function(row) { return String(row[0]) === strFecha; });
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
  var ssNew = SpreadsheetApp.create(nombreArchivo);
  var hoja = ssNew.getSheets()[0];
  hoja.setName('Resumen');
  var filas = [];
  filas.push(['TURNO 1 (13:00 - 14:00)']);
  filas.push(['Nombre', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']);
  turno1.forEach(function(row) {
    filas.push([row[2], row[5], row[6], row[7], row[8], row[9]]);
  });
  filas.push([]);
  filas.push(['TURNO 2 (14:00 - 15:00)']);
  filas.push(['Nombre', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']);
  turno2.forEach(function(row) {
    filas.push([row[2], row[5], row[6], row[7], row[8], row[9]]);
  });
  if (filas.length > 0) {
    hoja.getRange(1, 1, filas.length, 6).setValues(filas);
    hoja.getRange(1, 1, 2, 6).setFontWeight('bold');
  }
  var folder = DriveApp.getFolderById(CARPETA_DRIVE_COCINA_ID);
  var file = DriveApp.getFileById(ssNew.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  Logger.log('Informe creado: ' + nombreArchivo + ' en carpeta cocina.');
}
