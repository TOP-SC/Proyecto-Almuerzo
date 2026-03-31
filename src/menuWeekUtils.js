/**
 * Semana de menú alineada con Argentina (misma lógica en toda la app).
 * El encabezado "Semana del X al Y" y las etiquetas LUNES dd/mm … VIERNES dd/mm
 * deben salir de aquí para no mezclar TZ del navegador con otra regla de "lunes".
 */

const TZ_ARG = 'America/Argentina/Buenos_Aires';

export function getMenuWeek() {
  const now = new Date();
  let y, mo, d;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ_ARG,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    y = parseInt(parts.find((p) => p.type === 'year').value, 10);
    mo = parseInt(parts.find((p) => p.type === 'month').value, 10);
    d = parseInt(parts.find((p) => p.type === 'day').value, 10);
  } catch (_) {
    y = now.getFullYear();
    mo = now.getMonth() + 1;
    d = now.getDate();
  }
  const dayOfWeek = new Date(y, mo - 1, d).getDay();
  const daysToMonday = (8 - dayOfWeek) % 7;
  const weekStart = new Date(y, mo - 1, d + daysToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const d1 = weekStart.getDate();
  const d2 = weekEnd.getDate();
  const mes = meses[weekEnd.getMonth()];
  const weekKeyStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
  return {
    label: `Semana del ${d1} al ${d2} de ${mes}`,
    weekKey: weekKeyStr,
    friday: weekEnd,
    weekStart,
  };
}

/** Fechas DD/MM de lunes a viernes de la misma semana que `getMenuWeek()` (para títulos LUNES 30/03 …). */
export function getMenuWeekDayDatesDDMM() {
  const { weekStart } = getMenuWeek();
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    dates.push(`${day}/${month}`);
  }
  return dates;
}

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * `weekKeyStr`: lunes en formato YYYY-MM-DD (misma convención que `getMenuWeek().weekKey`).
 * Devuelve un texto corto tipo "3–7 mar" (lun–vie).
 */
export function weekRangeLabelFromMondayKey(weekKeyStr) {
  if (!weekKeyStr || !/^\d{4}-\d{2}-\d{2}$/.test(weekKeyStr)) return '';
  const [y, m, d] = weekKeyStr.split('-').map(Number);
  const weekStart = new Date(y, m - 1, d);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const d1 = weekStart.getDate();
  const d2 = weekEnd.getDate();
  const mes = MESES_CORTO[weekEnd.getMonth()];
  return `${d1}–${d2} ${mes}`;
}

/**
 * Misma forma que `getMenuWeek().label` pero para cualquier lunes (YYYY-MM-DD).
 */
export function weekLongLabelFromMondayKey(weekKeyStr) {
  if (!weekKeyStr || !/^\d{4}-\d{2}-\d{2}$/.test(weekKeyStr)) return '';
  const [y, m, d] = weekKeyStr.split('-').map(Number);
  const weekStart = new Date(y, m - 1, d);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `Semana del ${weekStart.getDate()} al ${weekEnd.getDate()} de ${meses[weekEnd.getMonth()]}`;
}

/**
 * Lista de claves de lunes desde `anchorMondayKey` hacia atrás (`count` semanas).
 */
export function getWeekMondayKeysFrom(anchorMondayKey, count) {
  if (!anchorMondayKey || !/^\d{4}-\d{2}-\d{2}$/.test(anchorMondayKey)) return [];
  const [y, m, d] = anchorMondayKey.split('-').map(Number);
  const cur = new Date(y, m - 1, d);
  const keys = [];
  for (let i = 0; i < count; i++) {
    keys.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    );
    cur.setDate(cur.getDate() - 7);
  }
  return keys;
}
