import React, { useState, useEffect, useMemo } from 'react';
import { Shield, LogOut, Search, XCircle, Edit2, UserPlus, Check, Loader2, LayoutDashboard, Users, Mail, FileText, PieChart, Send, Building2, Lock, Unlock } from 'lucide-react';
import { DriveService } from './driveService.js';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import {
  getMenuWeek,
  weekRangeLabelFromMondayKey,
  weekLongLabelFromMondayKey,
  getWeekMondayKeysFrom,
  MIN_ADMIN_WEEK_MONDAY,
  normalizeWeekKeyToIso,
} from './menuWeekUtils.js';

const API_URL = import.meta.env.VITE_API_URL || '/api/selection';
const APP_BASE_URL = import.meta.env.VITE_APP_URL || 'https://proyecto-almuerzo.vercel.app';

function parseMenuStr(str) {
  if (!str) return null;
  const m = str.match(/MENU\s*(\d+)\s*-\s*(.+)/i) || str.match(/REMOTO/i) || str.match(/SIN VIANDA/i);
  if (!m) return null;
  if (str.toUpperCase().includes('REMOTO')) return { id: 6, name: 'REMOTO', dish: 'Trabajo desde casa', category: 'HOME OFFICE' };
  if (str.toUpperCase().includes('SIN VIANDA')) return { id: 7, name: 'SIN VIANDA', dish: 'No requiere almuerzo', category: 'SIN SELECCIÓN' };
  return { id: parseInt(m[1], 10), name: 'MENU ' + m[1], dish: m[2]?.trim() || '', category: '' };
}

const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#8b5cf6', '#06b6d4', '#94a3b8'];

/** Misma marca que el menú principal (App.jsx) */
function DeptWatermark() {
  return (
    <div className="fixed bottom-4 right-4 text-slate-500 text-sm font-medium pointer-events-none select-none z-50">
      Create by Proyectos y Transformación Operativa
    </div>
  );
}

function AdminApp() {
  const [isAuth, setIsAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  /** null = aún no hubo respuesta del Sheet; [] = cargó vacío o sin filas válidas */
  const [empresaUsers, setEmpresaUsers] = useState(null);
  /** debug del último admin_list_empresa (p. ej. proxy fallback si Apps Script devolvió HTML) */
  const [empresaDebug, setEmpresaDebug] = useState(null);
  const [weeklyMenu, setWeeklyMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ nombre: '', turno: '1', selections: {} });
  const [actionLoading, setActionLoading] = useState(null);
  const [weekKeyOverride, setWeekKeyOverride] = useState(() => getMenuWeek().weekKey);
  /** 'auto' = día hábil actual en Argentina; 0–4 = Lunes–Viernes para Excel del día */
  const [excelDiaIndex, setExcelDiaIndex] = useState('auto');
  const [lastDebug, setLastDebug] = useState(null);
  const [connectionOk, setConnectionOk] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [manualEmpresaUsers, setManualEmpresaUsers] = useState([]);
  const [selectedReminderEmails, setSelectedReminderEmails] = useState([]);
  const [mailFrom, setMailFrom] = useState(() => sessionStorage.getItem('adminMailFrom') || '');
  const [mailFromName, setMailFromName] = useState(() => sessionStorage.getItem('adminMailFromName') || '');

  const menuWeek = getMenuWeek();
  const activeWeekKey = weekKeyOverride.trim() || menuWeek.weekKey;

  /** Primero la vigente; el resto son histórico. Solo desde MIN_ADMIN_WEEK_MONDAY (sin semanas vacías anteriores). */
  const weekSelectGroups = useMemo(() => {
    const raw = getWeekMondayKeysFrom(menuWeek.weekKey, 52);
    const keys = raw.filter((k) => k >= MIN_ADMIN_WEEK_MONDAY);
    const finalKeys = keys.length > 0 ? keys : [menuWeek.weekKey];
    const current = finalKeys[0] || menuWeek.weekKey;
    const previous = finalKeys.slice(1);
    return { current, previous };
  }, [menuWeek.weekKey]);

  useEffect(() => {
    const stored = sessionStorage.getItem('adminSecret');
    if (stored) {
      setAdminSecret(stored);
      setIsAuth(true);
    }
  }, []);

  /** Semanas anteriores al 30/03/2026 ya no están en el desplegable: alinear estado al cargar. */
  useEffect(() => {
    setWeekKeyOverride((prev) => {
      const t = prev.trim();
      if (t && t < MIN_ADMIN_WEEK_MONDAY) return getMenuWeek().weekKey;
      return prev;
    });
  }, []);

  useEffect(() => {
    sessionStorage.setItem('adminMailFrom', mailFrom);
  }, [mailFrom]);
  useEffect(() => {
    sessionStorage.setItem('adminMailFromName', mailFromName);
  }, [mailFromName]);

  useEffect(() => {
    if (isAuth && adminSecret) {
      loadMenu();
      loadEmpresaUsers();
    }
  }, [isAuth, adminSecret]);

  useEffect(() => {
    if (isAuth && adminSecret) {
      loadUsers();
    }
  }, [isAuth, adminSecret, weekKeyOverride]);

  useEffect(() => {
    if (isAuth && (activeView === 'dashboard' || activeView === 'empresa' || activeView === 'pendientes' || activeView === 'listado')) {
      loadEmpresaUsers();
    }
    if (isAuth && activeView === 'listado') {
      const iv = setInterval(loadUsers, 30000);
      return () => clearInterval(iv);
    }
  }, [isAuth, activeView, weekKeyOverride]);

  useEffect(() => {
    if (isAuth && adminSecret && activeView === 'dashboard') {
      loadCycleStatus();
    }
  }, [isAuth, adminSecret, activeView, activeWeekKey]);

  const loadEmpresaUsers = async () => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_list_empresa', adminSecret }),
      });
      const data = await res.json().catch(() => ({}));
      setEmpresaDebug(data.debug || (data.error ? { error: data.error } : null));
      if (data.ok && Array.isArray(data.users)) {
        setEmpresaUsers(data.users);
      } else {
        setEmpresaUsers([]);
      }
    } catch (_) {
      setEmpresaDebug({ proxyReason: 'client_error' });
      setEmpresaUsers([]);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    const secret = password.trim();
    if (!secret) {
      setError('Ingresá la contraseña');
      return;
    }
    setAdminSecret(secret);
    sessionStorage.setItem('adminSecret', secret);
    setIsAuth(true);
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_list', adminSecret, weekKey: weekKeyOverride.trim() || '' }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        setError('La API devolvió HTML en lugar de JSON. ¿El script está desplegado correctamente?');
        setLastDebug({ raw: text.slice(0, 300), status: res.status });
        setUsers([]);
        return;
      }
      setLastDebug(data.debug || (data.error ? { error: data.error } : null));
      if (data.ok) {
        setUsers(data.users || []);
      } else {
        const errMsg = data.error || 'Sin mensaje del servidor';
        setLastDebug({ status: res.status, error: data.error });
        setError(errMsg);
      }
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const loadMenu = async () => {
    try {
      const svc = new DriveService();
      const menu = await svc.processAndSaveMenu();
      setWeeklyMenu(menu || []);
    } catch (_) {
      setWeeklyMenu([]);
    }
  };

  const handleCancel = async (user) => {
    if (!confirm(`¿Anular el menú de ${user.nombre}? Se enviará corrección a cocina.`)) return;
    setActionLoading(user.token);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_cancel', adminSecret, token: user.token, weekKey: user.semana || activeWeekKey || menuWeek.weekKey, nombre: user.nombre }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { ok: false, error: 'Respuesta inválida', raw: text.slice(0, 300) }; }
      if (data.ok) {
        setUsers(users.filter(u => !(u.token === user.token && u.semana === user.semana)));
      } else {
        setError(data.error || 'Error');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdate = async (user, selections, details = {}) => {
    setActionLoading(user.token);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_update', adminSecret, token: user.token, weekKey: user.semana || activeWeekKey || menuWeek.weekKey, nombre: user.nombre, selections, details }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { ok: false, error: 'Respuesta inválida', raw: text.slice(0, 300) }; }
      if (data.ok) {
        setEditingUser(null);
        loadUsers();
      } else {
        setError(data.error || 'Error');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdd = async () => {
    if (!addForm.nombre.trim()) {
      setError('Nombre requerido');
      return;
    }
    const selections = {};
    for (let i = 0; i < 5; i++) {
      if (addForm.selections[i]) selections[i] = addForm.selections[i];
    }
    setActionLoading('add');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_add',
          adminSecret,
          nombre: addForm.nombre.trim(),
          turno: addForm.turno,
          weekKey: activeWeekKey || menuWeek.weekKey,
          selections,
          weeklyMenu,
        }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { ok: false, error: 'Respuesta inválida', raw: text.slice(0, 300) }; }
      if (data.ok) {
        setShowAddForm(false);
        setAddForm({ nombre: '', turno: '1', selections: {} });
        loadUsers();
      } else {
        setError(data.error || 'Error');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const mailPayload = () => {
    const o = {};
    const f = mailFrom.trim();
    const n = mailFromName.trim();
    if (f) o.mailFrom = f;
    if (n) o.mailFromName = n;
    return o;
  };

  const handleSendOpening = async () => {
    if (!confirm('¿Enviar mails de apertura a toda la empresa? Cada persona recibirá su link personalizado.')) return;
    setActionLoading('opening');
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_send_opening', adminSecret, ...mailPayload() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        alert('Mails enviados correctamente.');
      } else {
        setError(data.error || 'Error al enviar');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePdfGmail = async () => {
    setActionLoading('pdf');
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_pdf_gmail', adminSecret, weekKey: activeWeekKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.gmailUrl) {
        window.open(data.gmailUrl, '_blank', 'noopener');
      } else {
        setError(data.error || 'Error al generar Excel');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePdfGmailDia = async () => {
    setActionLoading('pdfdia');
    setError('');
    try {
      const body = { action: 'admin_pdf_gmail_dia', adminSecret, weekKey: activeWeekKey };
      if (excelDiaIndex !== 'auto') body.dayIndex = parseInt(excelDiaIndex, 10);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.gmailUrl) {
        window.open(data.gmailUrl, '_blank', 'noopener');
      } else {
        setError(data.error || 'Error al generar Excel del día');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const [cycleOpen, setCycleOpen] = useState(null);

  const loadCycleStatus = async () => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_cycle_status', adminSecret, weekKey: activeWeekKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) setCycleOpen(data.abierto);
    } catch (_) { setCycleOpen(true); }
  };

  const handleCycleOpen = async () => {
    setActionLoading('cycle');
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_cycle_open', adminSecret, weekKey: activeWeekKey }),
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch { data = { ok: false, error: 'Respuesta inválida del servidor' }; }
      if (data.ok) {
        setCycleOpen(true);
        setError('');
      } else {
        setError(data.error || 'Error al abrir');
      }
    } catch (e) {
      setError(e?.message || 'Error de conexión. Probá en ventana de incógnito si tenés extensiones (adblock, etc.).');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCycleClose = async () => {
    if (!confirm('¿Cerrar el ciclo? Los usuarios no podrán modificar sus menús.')) return;
    setActionLoading('cycle');
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_cycle_close', adminSecret, weekKey: activeWeekKey }),
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch { data = { ok: false, error: 'Respuesta inválida del servidor' }; }
      if (data.ok) {
        setCycleOpen(false);
        setError('');
      } else {
        setError(data.error || 'Error al cerrar');
      }
    } catch (e) {
      setError(e?.message || 'Error de conexión. Probá en ventana de incógnito si tenés extensiones.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReminder = async (emailsToSend) => {
    const count = Array.isArray(emailsToSend) && emailsToSend.length > 0 ? emailsToSend.length : 0;
    const msg = count > 0
      ? `¿Enviar recordatorio a ${count} persona(s) seleccionada(s)?`
      : '¿Enviar recordatorio a todas las personas que no pidieron?';
    if (!confirm(msg)) return;
    setActionLoading('reminder');
    setError('');
    try {
      const body = { action: 'admin_send_reminder', adminSecret, weekKey: activeWeekKey, ...mailPayload() };
      if (count > 0) body.emails = emailsToSend;
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        alert(`Recordatorios enviados: ${data.enviados || 0}`);
        setSelectedReminderEmails([]);
      } else {
        setError(data.error || 'Error al enviar');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const dedupeKey = (u) => ((u.email || '').toLowerCase() || (u.token || '')) + '|' + (u.semana || '');
  const usersDeduped = (() => {
    const seen = {};
    return [...users].reverse().filter(u => {
      const k = dedupeKey(u);
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    }).reverse();
  })();
  const searchWords = (search || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filteredUsers = usersDeduped.filter(u => {
    if (!searchWords.length) return true;
    const nombre = (u.nombre || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const texto = nombre + ' ' + email;
    return searchWords.every(w => texto.includes(w));
  });

  const weekKeyNorm = normalizeWeekKeyToIso(activeWeekKey || menuWeek.weekKey);
  // Si el desplegable tiene una semana concreta, admin_list ya filtró: no volver a filtrar por semana (evita vacíos por desajuste de formato).
  const usersThisWeekRaw =
    weekKeyOverride.trim() === ''
      ? users.filter((u) => normalizeWeekKeyToIso(u.semana || '') === weekKeyNorm)
      : users;
  const usersThisWeek = (() => {
    const seen = {};
    return [...usersThisWeekRaw].reverse().filter(u => {
      const k = dedupeKey(u);
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    }).reverse();
  })();
  const usersWhoOrdered = usersThisWeek.map(u => (u.email || '').toLowerCase()).filter(Boolean);
  const empresaUsersEffective = (empresaUsers != null && empresaUsers.length > 0) ? empresaUsers : manualEmpresaUsers;
  const usersWhoNotOrdered = empresaUsersEffective.filter(e => {
    const em = (e.email || '').toLowerCase();
    return em && !usersWhoOrdered.includes(em);
  });

  const menuCounts = {};
  const menuCountsByDay = { Lunes: {}, Martes: {}, Miércoles: {}, Jueves: {}, Viernes: {} };
  const dayKeys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  const dayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  usersThisWeek.forEach(u => {
    dayKeys.forEach((d, i) => {
      const val = u[d] || '';
      const m = val.match(/MENU\s*(\d+)/i) || val.match(/REMOTO/i) || val.match(/SIN VIANDA/i);
      const key = m ? (m[1] ? `MENU ${m[1]}` : (val.toUpperCase().includes('REMOTO') ? 'REMOTO' : 'SIN VIANDA')) : null;
      if (key) {
        menuCounts[key] = (menuCounts[key] || 0) + 1;
        const label = dayLabels[i];
        menuCountsByDay[label][key] = (menuCountsByDay[label][key] || 0) + 1;
      }
    });
  });
  const menuChartData = Object.entries(menuCounts).map(([name, value]) => ({ name, value }));

  const confirmChartData = [
    { name: 'Confirmó', value: usersThisWeek.length, color: '#34a853' },
    { name: 'No confirmó', value: usersWhoNotOrdered.length, color: '#ea4335' },
  ];

  const sommierCount = usersThisWeek.filter(u => (u.email || '').toLowerCase().includes('@sommiercenter')).length;
  const btimeCount = usersThisWeek.filter(u => (u.email || '').toLowerCase().includes('@bedtime')).length;

  if (!isAuth) {
    return (
      <>
        <div className="min-h-screen app-bg flex items-center justify-center p-6" style={{ background: '#f5f5f5' }}>
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-10 h-10" style={{ color: '#1a73e8' }} />
              <h1 className="text-xl font-semibold text-slate-800">Admin - Menú Semanal</h1>
            </div>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <button type="submit" className="w-full py-3 rounded-lg font-medium text-white" style={{ background: '#1a73e8' }}>
                Entrar
              </button>
            </form>
            <a href="/" className="block mt-4 text-center text-sm text-slate-500 hover:text-slate-700">Volver al menú</a>
          </div>
        </div>
        <DeptWatermark />
      </>
    );
  }

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'menus', label: 'Menús', icon: PieChart },
    { id: 'empresa', label: 'Por empresa', icon: Building2 },
    { id: 'listado', label: 'Listado pedidos', icon: Users },
    { id: 'pendientes', label: 'Quién no pidió', icon: Send },
  ];

  return (
    <>
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <aside className="w-52 flex-shrink-0 bg-white/90 backdrop-blur-sm border-r border-slate-200/80 shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-slate-800">Admin</span>
              <p className="text-[11px] text-slate-500 leading-tight">
                {weekKeyOverride.trim() === ''
                  ? 'Todas las semanas'
                  : activeWeekKey === menuWeek.weekKey
                    ? `Semana vigente · ${weekRangeLabelFromMondayKey(menuWeek.weekKey)}`
                    : weekLongLabelFromMondayKey(activeWeekKey)}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {sidebarItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeView === id
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-100">
          <button
            onClick={() => { sessionStorage.removeItem('adminSecret'); setIsAuth(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur border-b border-slate-200/80 px-4 py-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="admin-week-select" className="text-sm text-slate-600 shrink-0">
                Semana:
              </label>
              <select
                id="admin-week-select"
                value={weekKeyOverride}
                onChange={(e) => setWeekKeyOverride(e.target.value)}
                className="min-w-[240px] max-w-[min(100%,420px)] px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                title="Por defecto: semana vigente. Podés revisar semanas pasadas abajo. «Todas las semanas» al final es opcional (listado sin filtro)."
              >
                <optgroup label="Semana vigente">
                  <option value={weekSelectGroups.current}>
                    {weekRangeLabelFromMondayKey(weekSelectGroups.current)} · {weekSelectGroups.current}
                  </option>
                </optgroup>
                <optgroup label="Semanas anteriores">
                  {weekSelectGroups.previous.map((wk) => (
                    <option key={wk} value={wk}>
                      {weekRangeLabelFromMondayKey(wk)} · {wk}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Opcional">
                  <option value="">Todas las semanas (sin filtro)</option>
                </optgroup>
              </select>
              <span className="text-xs text-slate-500 hidden sm:inline">
                {weekKeyOverride.trim() === ''
                  ? 'Listado sin filtro de semana'
                  : activeWeekKey === menuWeek.weekKey
                    ? 'Semana vigente'
                    : 'Histórico'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setConnectionOk(null);
                  try {
                    const res = await fetch(API_URL, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'admin_ping', adminSecret }),
                    });
                    const data = await res.json();
                    if (data.ok) {
                      setConnectionOk(true);
                      setTimeout(() => setConnectionOk(null), 3000);
                    } else setError(data.error || 'Error');
                  } catch (e) { setError(e.message || 'Error'); }
                }}
                className="text-sm text-slate-600 hover:underline"
              >
                Probar conexión
              </button>
              {connectionOk && <span className="text-sm text-green-600">✓ OK</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2 text-xs border-t border-slate-100 pt-2">
            <span className="text-slate-600 font-medium shrink-0">Enviar apertura y recordatorios como:</span>
            <input
              type="email"
              value={mailFrom}
              onChange={e => setMailFrom(e.target.value)}
              placeholder="ej. soporte@empresa.com"
              className="min-w-[180px] max-w-[280px] flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
              title="Opcional. Debe estar configurado en Gmail del usuario que desplegó el script como «Enviar correo como»."
            />
            <input
              type="text"
              value={mailFromName}
              onChange={e => setMailFromName(e.target.value)}
              placeholder="Nombre visible (opcional)"
              className="min-w-[140px] max-w-[200px] px-2 py-1 border border-slate-200 rounded text-sm"
            />
            <span className="text-slate-400 text-[11px] leading-snug max-w-xl">
              Vacío = cuenta del despliegue de Apps Script. Con alias: el deploy debe tener ese remitente en Gmail.
            </span>
          </div>
        </header>

        {error && (
          <div className="mx-4 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        <div className="flex-1 p-4 overflow-auto min-h-0">
          {activeView === 'dashboard' && (
            <DashboardView
              menuChartData={menuChartData}
              confirmChartData={confirmChartData}
              handleSendOpening={handleSendOpening}
              handlePdfGmail={handlePdfGmail}
              handlePdfGmailDia={handlePdfGmailDia}
              excelDiaIndex={excelDiaIndex}
              onExcelDiaIndexChange={setExcelDiaIndex}
              actionLoading={actionLoading}
              cycleOpen={cycleOpen}
              handleCycleOpen={handleCycleOpen}
              handleCycleClose={handleCycleClose}
              weekLabel={weekLongLabelFromMondayKey(activeWeekKey)}
            />
          )}
          {activeView === 'menus' && (
            <MenusView menuCounts={menuCounts} menuCountsByDay={menuCountsByDay} />
          )}
          {activeView === 'empresa' && (
            <EmpresaView
              sommierUsers={usersThisWeek.filter(u => (u.email || '').toLowerCase().includes('@sommiercenter'))}
              btimeUsers={usersThisWeek.filter(u => (u.email || '').toLowerCase().includes('@bedtime'))}
            />
          )}
          {activeView === 'listado' && (
            <ListView
              filteredUsers={filteredUsers}
              loading={loading}
              search={search}
              setSearch={setSearch}
              showAddForm={showAddForm}
              setShowAddForm={setShowAddForm}
              addForm={addForm}
              setAddForm={setAddForm}
              weeklyMenu={weeklyMenu}
              editingUser={editingUser}
              setEditingUser={setEditingUser}
              handleAdd={handleAdd}
              handleCancel={handleCancel}
              handleUpdate={handleUpdate}
              actionLoading={actionLoading}
              lastDebug={lastDebug}
              empresaUsers={empresaUsersEffective}
              usersThisWeek={usersThisWeek}
              onLoadManualUsers={setManualEmpresaUsers}
              empresaUsersFromApi={empresaUsers}
              empresaListFetched={empresaUsers !== null}
              empresaDebug={empresaDebug}
            />
          )}
          {activeView === 'pendientes' && (
            <PendientesView
              usersWhoNotOrdered={usersWhoNotOrdered}
              handleSendReminder={handleSendReminder}
              selectedReminderEmails={selectedReminderEmails}
              setSelectedReminderEmails={setSelectedReminderEmails}
              actionLoading={actionLoading}
              empresaUsers={empresaUsersEffective}
              onLoadManualUsers={setManualEmpresaUsers}
              empresaUsersFromApi={empresaUsers}
              empresaListFetched={empresaUsers !== null}
              empresaDebug={empresaDebug}
            />
          )}
        </div>
      </main>
    </div>
    <DeptWatermark />
    </>
  );
}

function parsePastedUsers(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[\t,;]/).map(p => p.trim());
    const email = (parts[0] || '').trim();
    if (!email || email.toLowerCase() === 'email' || email.toLowerCase() === 'correo') continue;
    if (!email.includes('@')) continue;
    out.push({ email, nombre: (parts[1] || '').trim() || email, token: (parts[2] || '').trim(), turno: (parts[3] === '2' || parts[3] === 2) ? '2' : '1' });
  }
  return out;
}

function ListView({ filteredUsers, loading, search, setSearch, showAddForm, setShowAddForm, addForm, setAddForm, weeklyMenu, editingUser, setEditingUser, handleAdd, handleCancel, handleUpdate, actionLoading, lastDebug, empresaUsers, usersThisWeek, onLoadManualUsers, empresaUsersFromApi, empresaListFetched, empresaDebug }) {
  const [selectedUserLookup, setSelectedUserLookup] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const allUsersForDropdown = empresaUsers && empresaUsers.length > 0 ? empresaUsers : usersThisWeek.map(u => ({ email: u.email, nombre: u.nombre }));
  const getSelectedFromDropdown = () => {
    if (!selectedUserLookup) return null;
    if (selectedUserLookup.startsWith('idx-')) {
      const i = parseInt(selectedUserLookup.replace('idx-', ''), 10);
      return allUsersForDropdown[i] || null;
    }
    return (empresaUsers || []).find(u => (u.email || '').toLowerCase() === selectedUserLookup) || allUsersForDropdown.find(u => (u.email || '').toLowerCase() === selectedUserLookup);
  };
  const selectedFromDropdown = getSelectedFromDropdown();
  const lookupUser = selectedFromDropdown ? usersThisWeek.find(u =>
    ((selectedFromDropdown.email && (u.email || '').toLowerCase() === (selectedFromDropdown.email || '').toLowerCase()) ||
     ((selectedFromDropdown.nombre || '').toLowerCase() && (u.nombre || '').toLowerCase() === (selectedFromDropdown.nombre || '').toLowerCase()))
  ) : null;
  const selectedEmpresaUser = selectedFromDropdown;

  const proxyFallback = !!(lastDebug && lastDebug.fallback) || !!(empresaDebug && empresaDebug.fallback);
  const proxyReason = (lastDebug && lastDebug.proxyReason) || (empresaDebug && empresaDebug.proxyReason);

  return (
    <div className="max-w-4xl">
      {proxyFallback && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-sm">
          <strong>El servidor (Vercel) no recibió JSON válido desde Apps Script.</strong> Suele pasar si la URL del Web App es vieja, el despliegue fue borrado, o el acceso no es &quot;Cualquier persona&quot;. En Vercel configurá la variable <code className="bg-red-100 px-1 rounded">APPS_SCRIPT_URL</code> con la URL <code className="bg-red-100 px-1 rounded">…/exec</code> nueva. Si el script es una librería o Web App sin contenedor, en Apps Script ejecutá una vez <code className="bg-red-100 px-1 rounded">registrarIdSpreadsheetEnPropiedades</code> (desde el editor, con el Sheet abierto) o definí <code className="bg-red-100 px-1 rounded">USUARIOS_SPREADSHEET_ID</code> en el .gs.
          {proxyReason ? <span className="block mt-1 text-red-800">Motivo proxy: {String(proxyReason)}</span> : null}
        </div>
      )}
      {empresaListFetched && Array.isArray(empresaUsersFromApi) && empresaUsersFromApi.length === 0 && !proxyFallback && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
          <span className="text-amber-800 text-sm">No hay filas en la hoja de usuarios del Sheet (o no se detectaron emails). Revisá <strong>usuarios_completos</strong> (columna A=email) o pegá la lista manualmente.</span>
          <button type="button" onClick={() => setShowPasteModal(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700">Pegar lista</button>
        </div>
      )}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowPasteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-2">Pegar lista de usuarios</h3>
            <p className="text-sm text-slate-500 mb-3">Formato: email, nombre, token, turno (separados por tab o coma). La primera fila puede ser el encabezado.</p>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="email&#10;nombre&#10;token&#10;turno" className="w-full h-40 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { const parsed = parsePastedUsers(pasteText); if (parsed.length) { onLoadManualUsers(parsed); setShowPasteModal(false); setPasteText(''); } else alert('No se detectaron usuarios. Revisá el formato.'); }} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white">Cargar</button>
              <button onClick={() => { setShowPasteModal(false); setPasteText(''); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, apellido, email..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedUserLookup}
          onChange={e => setSelectedUserLookup(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm min-w-[200px]"
          title="Ver elección de un usuario"
        >
          <option value="">Ver usuario...</option>
          {allUsersForDropdown.map((u, i) => (
            <option key={i} value={(u.email || '').toLowerCase() || `idx-${i}`}>
              {u.nombre || u.email || 'Sin nombre'}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white shadow-md shadow-green-500/20 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all"
        >
          <UserPlus className="w-4 h-4" /> Agregar invitado
        </button>
      </div>

      {lookupUser && (
        <div className="mb-4 p-4 bg-white/95 rounded-xl shadow border border-slate-100">
          <h4 className="font-medium text-slate-800 mb-2">{lookupUser.nombre} {lookupUser.email && <span className="text-slate-500 text-sm">({lookupUser.email})</span>}</h4>
          <div className="flex flex-wrap gap-2 text-sm">
            {['lunes','martes','miercoles','jueves','viernes'].map((d, i) => (
              <span key={d} className="px-2 py-1 bg-slate-100 rounded">{d}: {extraerMenuShort(lookupUser[d])}</span>
            ))}
          </div>
        </div>
      )}
      {selectedUserLookup && !lookupUser && (
        <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
          <strong>{selectedEmpresaUser?.nombre || selectedEmpresaUser?.email || 'Usuario'}:</strong> No eligió menú para esta semana.
        </div>
      )}

      {showAddForm && (
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-6 mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Agregar invitado</h3>
          <input
            type="text"
            value={addForm.nombre}
            onChange={e => setAddForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Nombre completo"
            className="w-full px-4 py-2 border border-slate-200 rounded-lg mb-3"
          />
          <select
            value={addForm.turno}
            onChange={e => setAddForm(f => ({ ...f, turno: e.target.value }))}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg mb-4"
          >
            <option value="1">Turno 1 (13:00 - 14:00)</option>
            <option value="2">Turno 2 (14:00 - 15:00)</option>
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((day, i) => (
              <div key={i}>
                <label className="block text-xs text-slate-500 mb-1">{day}</label>
                <select
                  value={addForm.selections[i]?.name || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const dayMenu = weeklyMenu[i]?.menus || [];
                    const sel = dayMenu.find(m => m.name === val);
                    setAddForm(f => ({ ...f, selections: { ...f.selections, [i]: sel || null } }));
                  }}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                >
                  <option value="">-</option>
                  {(weeklyMenu[i]?.menus || []).map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={actionLoading === 'add'} className="px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2" style={{ background: '#34a853' }}>
              {actionLoading === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map(user => (
            <div key={`${user.token}-${user.semana || ''}`} className="bg-white/95 backdrop-blur rounded-xl shadow-md border border-slate-100 p-4 hover:shadow-lg transition-shadow">
                {editingUser?.token === user.token && editingUser?.semana === user.semana ? (
                <EditForm
                  user={user}
                  weeklyMenu={weeklyMenu}
                  onSave={(selections, details) => handleUpdate(user, selections, details)}
                  onCancel={() => setEditingUser(null)}
                  loading={actionLoading === user.token}
                />
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-slate-800">{user.nombre}</p>
                      {user.email && <p className="text-sm text-slate-500">{user.email}</p>}
                      <p className="text-xs text-slate-400 mt-1">{user.turno === '1' || user.turno === '2' ? `Turno ${user.turno}` : (user.turno || '')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingUser(user)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Modificar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleCancel(user)} disabled={actionLoading === user.token} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Anular">
                        {actionLoading === user.token ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].map((d, i) => (
                        <span key={d} className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {d}: {extraerMenuShort(user[d])}
                          {user.details?.[i] && <span className="text-amber-600 ml-1">({user.details[i]})</span>}
                        </span>
                      ))}
                    </div>
                </>
              )}
            </div>
          ))}
          {filteredUsers.length === 0 && !loading && (
            <div className="text-center py-8 text-slate-500">
              {proxyFallback ? 'No se pudieron cargar datos: revisá la conexión con Apps Script (mensaje rojo arriba).' : 'No hay usuarios anotados para esta semana.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MENU_CARD_COLORS = {
  'MENU 1': { bg: 'from-red-500 to-red-600', shadow: 'shadow-red-500/30', text: 'text-white' },
  'MENU 2': { bg: 'from-green-500 to-emerald-600', shadow: 'shadow-green-500/30', text: 'text-white' },
  'MENU 3': { bg: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30', text: 'text-white' },
  'MENU 4': { bg: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/30', text: 'text-white' },
  'MENU 5': { bg: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/30', text: 'text-white' },
  'REMOTO': { bg: 'from-cyan-500 to-teal-500', shadow: 'shadow-cyan-500/30', text: 'text-white' },
  'SIN VIANDA': { bg: 'from-slate-400 to-slate-500', shadow: 'shadow-slate-400/30', text: 'text-white' },
};

function DashboardView({
  menuChartData,
  confirmChartData,
  handleSendOpening,
  handlePdfGmail,
  handlePdfGmailDia,
  excelDiaIndex,
  onExcelDiaIndexChange,
  actionLoading,
  cycleOpen,
  handleCycleOpen,
  handleCycleClose,
  weekLabel,
}) {
  return (
    <div className="max-w-4xl h-full flex flex-col gap-4">
      {/* Ciclo apertura/cierre */}
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-4">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Ciclo de elección
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${cycleOpen ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
            <span className={`w-2 h-2 rounded-full ${cycleOpen ? 'bg-green-500' : 'bg-slate-400'}`} />
            <span className="font-medium">{cycleOpen === null ? '...' : cycleOpen ? 'Abierto' : 'Cerrado'}</span>
          </div>
          <button
            onClick={handleCycleOpen}
            disabled={actionLoading === 'cycle' || cycleOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === 'cycle' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
            Abrir
          </button>
          <button
            onClick={handleCycleClose}
            disabled={actionLoading === 'cycle' || !cycleOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-3 h-3" />
            Cerrar
          </button>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          <h3 className="font-semibold text-slate-700 mb-4 text-sm">Menús elegidos</h3>
          {menuChartData.length > 0 ? (
            <div className="h-64 min-h-[200px]" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height={256} minWidth={0}>
                <RechartsPie>
                  <Pie data={menuChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2} label={false}>
                    {menuChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v, e) => `${v}: ${e.payload?.value ?? ''}`} />
                  <Tooltip formatter={(v) => [v, '']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '12px 16px', fontSize: 14 }} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-slate-400">Sin datos aún</p>
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          <h3 className="font-semibold text-slate-700 mb-4 text-sm">Confirmó / No confirmó</h3>
          {confirmChartData.some(d => d.value > 0) ? (
            <div className="h-64 min-h-[200px]" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height={256} minWidth={0}>
                <RechartsPie>
                  <Pie data={confirmChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2} label={false}>
                    {confirmChartData.map((e, i) => (
                      <Cell key={i} fill={e.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v, e) => `${v}: ${e.payload?.value ?? ''}`} />
                  <Tooltip formatter={(v) => [v, '']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '12px 16px', fontSize: 14 }} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-slate-400">Sin datos aún</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 flex-shrink-0">
        <button
          onClick={handleSendOpening}
          disabled={actionLoading === 'opening'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all bg-gradient-to-r from-blue-500 to-blue-600"
        >
          {actionLoading === 'opening' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Enviar mails de apertura
        </button>
        <button
          onClick={handlePdfGmail}
          disabled={actionLoading === 'pdf' || actionLoading === 'pdfdia'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all bg-gradient-to-r from-green-500 to-emerald-600"
        >
          {actionLoading === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Excel semanal a proveedor
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="excel-dia-select" className="text-sm text-slate-600 whitespace-nowrap">
            Día (Excel diario):
          </label>
          <select
            id="excel-dia-select"
            value={excelDiaIndex}
            onChange={(e) => onExcelDiaIndexChange(e.target.value)}
            className="text-sm px-2 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm min-w-[11rem]"
            title="Semana = arriba en el encabezado. «Hoy» usa el día hábil en Argentina; si elegís un día fijo, podés exportar un día de una semana pasada o un sábado/domingo."
          >
            <option value="auto">Hoy (Argentina)</option>
            <option value="0">Lunes</option>
            <option value="1">Martes</option>
            <option value="2">Miércoles</option>
            <option value="3">Jueves</option>
            <option value="4">Viernes</option>
          </select>
          <button
            onClick={handlePdfGmailDia}
            disabled={actionLoading === 'pdf' || actionLoading === 'pdfdia'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all bg-gradient-to-r from-teal-500 to-emerald-700"
            title="Pedidos de un solo día de la semana elegida en el encabezado. «Hoy» = día actual en Argentina; o elegí Lunes–Viernes."
          >
            {actionLoading === 'pdfdia' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Excel del día a proveedor
          </button>
        </div>
      </div>
    </div>
  );
}

function MenusView({ menuCounts, menuCountsByDay }) {
  const [tab, setTab] = useState('semanal');
  const MENU_ORDER = ['MENU 1', 'MENU 2', 'MENU 3', 'MENU 4', 'MENU 5', 'REMOTO', 'SIN VIANDA'];
  const MENU_ONLY_1_5 = ['MENU 1', 'MENU 2', 'MENU 3', 'MENU 4', 'MENU 5'];
  const dayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const totalMenusOnly = MENU_ONLY_1_5.reduce((a, k) => a + (menuCounts[k] || 0), 0);
  const entries = Object.entries(menuCounts).sort((a, b) => {
    const iA = MENU_ORDER.indexOf(a[0]);
    const iB = MENU_ORDER.indexOf(b[0]);
    if (iA >= 0 && iB >= 0) return iA - iB;
    if (iA >= 0) return -1;
    if (iB >= 0) return 1;
    return (a[0] || '').localeCompare(b[0] || '');
  });

  const renderCard = (name, count, compact) => {
    const t = MENU_CARD_COLORS[name] || { bg: 'from-slate-400 to-slate-500', shadow: 'shadow-slate-400/30', text: 'text-white' };
    return (
      <div
        key={name}
        className={`rounded-xl bg-gradient-to-br ${t.bg} ${t.shadow} flex flex-col items-center justify-center ${compact ? 'p-2 min-h-[64px] shadow-md' : 'p-5 min-h-[120px] shadow-lg rounded-2xl'}`}
      >
        <span className={`font-bold text-white drop-shadow-sm ${compact ? 'text-lg' : 'text-3xl'}`}>{count}</span>
        <span className={`font-medium text-white/90 mt-0.5 text-center ${compact ? 'text-[11px]' : 'text-sm'}`}>{name}</span>
      </div>
    );
  };

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Cantidad por menú</h2>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setTab('semanal')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'semanal' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Conteo semanal
          </button>
          <button
            type="button"
            onClick={() => setTab('diario')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'diario' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Conteo diario
          </button>
        </div>
      </div>

      {tab === 'semanal' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {entries.map(([name, count]) => renderCard(name, count, false))}
          </div>
          {totalMenusOnly > 0 && (
            <p className="mt-4 text-sm text-slate-500">
              Total menús (1–5): <strong>{totalMenusOnly}</strong>
              <span className="text-slate-400"> · REMOTO y SIN VIANDA no suman en este total</span>
            </p>
          )}
        </>
      )}

      {tab === 'diario' && (
        <div className="space-y-4">
          {dayLabels.map((day) => {
            const dayCounts = menuCountsByDay?.[day] || {};
            const dayEntries = Object.entries(dayCounts).sort((a, b) => {
              const iA = MENU_ORDER.indexOf(a[0]);
              const iB = MENU_ORDER.indexOf(b[0]);
              if (iA >= 0 && iB >= 0) return iA - iB;
              if (iA >= 0) return -1;
              if (iB >= 0) return 1;
              return (a[0] || '').localeCompare(b[0] || '');
            });
            const dayTotalMenus = MENU_ONLY_1_5.reduce((a, k) => a + (dayCounts[k] || 0), 0);
            return (
              <div key={day}>
                <h3 className="text-sm font-semibold text-slate-600 mb-2">{day}{dayTotalMenus > 0 && ` · menús 1–5: ${dayTotalMenus}`}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {dayEntries.map(([name, count]) => renderCard(name, count, true))}
                </div>
                {dayEntries.length === 0 && (
                  <p className="text-slate-400 text-sm py-1">Sin pedidos</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function menuSummary(user) {
  const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  return days.map(d => extraerMenuShort(user[d])).join(' · ');
}

function EmpresaView({ sommierUsers, btimeUsers }) {
  return (
    <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-4">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          @sommiercenter ({sommierUsers.length})
        </h3>
        <div className="max-h-[60vh] overflow-y-auto space-y-1.5 text-sm">
          {sommierUsers.map((u, i) => (
            <div key={i} className="flex justify-between items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
              <span className="flex-1 truncate font-medium text-slate-700">{u.nombre || u.email}</span>
              <span className="text-slate-500 text-xs truncate max-w-[200px]">{menuSummary(u)}</span>
            </div>
          ))}
          {sommierUsers.length === 0 && <p className="text-slate-400 py-4">Ninguno</p>}
        </div>
      </div>
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-4">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          @bedtime ({btimeUsers.length})
        </h3>
        <div className="max-h-[60vh] overflow-y-auto space-y-1.5 text-sm">
          {btimeUsers.map((u, i) => (
            <div key={i} className="flex justify-between items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
              <span className="flex-1 truncate font-medium text-slate-700">{u.nombre || u.email}</span>
              <span className="text-slate-500 text-xs truncate max-w-[200px]">{menuSummary(u)}</span>
            </div>
          ))}
          {btimeUsers.length === 0 && <p className="text-slate-400 py-4">Ninguno</p>}
        </div>
      </div>
    </div>
  );
}

function PendientesView({ usersWhoNotOrdered, handleSendReminder, selectedReminderEmails, setSelectedReminderEmails, actionLoading, empresaUsers, onLoadManualUsers, empresaUsersFromApi, empresaListFetched, empresaDebug }) {
  const [searchPendientes, setSearchPendientes] = useState('');
  const searchWords = (searchPendientes || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filteredPendientes = usersWhoNotOrdered.filter(u => {
    if (!searchWords.length) return true;
    const nombre = (u.nombre || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const texto = nombre + ' ' + email;
    return searchWords.every(w => texto.includes(w));
  });
  const emailsSet = new Set((selectedReminderEmails || []).map(e => (e || '').toLowerCase()));
  const toggleEmail = (email) => {
    if (!email) return;
    const em = email.toLowerCase();
    setSelectedReminderEmails(prev => {
      const s = new Set(prev.map(x => x.toLowerCase()));
      if (s.has(em)) s.delete(em); else s.add(em);
      return [...s];
    });
  };
  const selectAll = () => {
    const withEmail = filteredPendientes.filter(u => u.email).map(u => u.email.toLowerCase());
    setSelectedReminderEmails([...new Set(withEmail)]);
  };
  const selectNone = () => setSelectedReminderEmails([]);
  const onSend = () => {
    const toSend = emailsSet.size > 0 ? [...emailsSet] : null;
    handleSendReminder(toSend);
  };

  const proxyFallback = !!(empresaDebug && empresaDebug.fallback);

  return (
    <div className="max-w-4xl">
      {proxyFallback && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-sm">
          <strong>Apps Script no respondió con JSON.</strong> Revisá URL de despliegue <code className="bg-red-100 px-1 rounded">/exec</code> y variable <code className="bg-red-100 px-1 rounded">APPS_SCRIPT_URL</code> en Vercel.
          {empresaDebug?.proxyReason ? <span className="block mt-1">Motivo: {String(empresaDebug.proxyReason)}</span> : null}
        </div>
      )}
      {empresaListFetched && Array.isArray(empresaUsersFromApi) && empresaUsersFromApi.length === 0 && !proxyFallback && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
          <span className="text-amber-800 text-sm">La hoja de usuarios está vacía o sin emails válidos. Cargá <strong>usuarios_completos</strong> o usá &quot;Pegar lista&quot; en Listado pedidos.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Quién no pidió</h2>
        <div className="flex flex-wrap items-center gap-2">
          {usersWhoNotOrdered.length > 0 && (
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchPendientes}
                onChange={e => setSearchPendientes(e.target.value)}
                placeholder="Buscar nombre, apellido, email..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>
          )}
          {usersWhoNotOrdered.length > 0 && (
            <>
              <button
                type="button"
                onClick={selectAll}
                className="text-sm text-slate-600 hover:text-slate-800 underline"
              >
                Seleccionar todos
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-sm text-slate-600 hover:text-slate-800 underline"
              >
                Ninguno
              </button>
              <span className="text-slate-400 text-sm">
                ({emailsSet.size > 0 ? emailsSet.size + ' seleccionados' : 'todos'})
              </span>
            </>
          )}
          <button
            onClick={onSend}
            disabled={actionLoading === 'reminder'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/25"
          >
            {actionLoading === 'reminder' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar recordatorio
          </button>
        </div>
      </div>
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-4 max-h-[60vh] overflow-y-auto">
          {usersWhoNotOrdered.length > 0 ? (
          filteredPendientes.length > 0 ? (
          <ul className="space-y-2">
            {filteredPendientes.map((u, i) => {
              const em = (u.email || '').toLowerCase();
              const hasEmail = !!em;
              const checked = hasEmail && emailsSet.has(em);
              return (
                <li key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  {hasEmail ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEmail(u.email)}
                      className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      aria-label={`Enviar recordatorio a ${u.nombre || u.email}`}
                    />
                  ) : (
                    <span className="w-4 h-4" aria-hidden />
                  )}
                  <span className="font-medium text-slate-700">{u.nombre || u.email}</span>
                  {u.email && <span className="text-slate-400 text-sm truncate">{u.email}</span>}
                </li>
              );
            })}
          </ul>
          ) : (
          <p className="text-slate-500 py-8 text-center">No hay coincidencias con &quot;{searchPendientes}&quot;.</p>
          )
        ) : !empresaListFetched ? (
          <p className="text-slate-500 py-8 text-center">Cargando lista de empresa desde el servidor…</p>
        ) : empresaUsers.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">
            {proxyFallback ? 'No se pudo leer la lista desde el servidor: revisá el mensaje rojo arriba y la URL de Apps Script.' : (
              <>Cargá la lista de empleados en la hoja <strong>usuarios_completos</strong> (A=email, B=nombre, C=token, D=turno) del Sheet.</>
            )}
          </p>
        ) : (
          <p className="text-slate-500 py-8 text-center">Todos ya pidieron.</p>
        )}
      </div>
    </div>
  );
}

function extraerMenuShort(str) {
  if (!str) return '-';
  const m = str.match(/MENU\s*(\d+)/i);
  if (m) return `Menu ${m[1]}`;
  if (/REMOTO/i.test(str)) return 'REMOTO';
  if (/SIN VIANDA/i.test(str)) return 'SIN VIANDA';
  return str.slice(0, 20);
}

function EditForm({ user, weeklyMenu, onSave, onCancel, loading }) {
  const [selections, setSelections] = useState({});
  const [details, setDetails] = useState({});
  useEffect(() => {
    const s = {};
    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].forEach((d, i) => {
      const parsed = parseMenuStr(user[d]);
      if (parsed) s[i] = parsed;
    });
    setSelections(s);
    setDetails(user.details || {});
  }, [user]);

  const handleSave = () => {
    const arr = [];
    for (let i = 0; i < 5; i++) arr[i] = selections[i] || null;
    onSave(arr, details);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((day, i) => (
          <div key={i}>
            <label className="block text-xs text-slate-500 mb-1">{day}</label>
            <select
              value={selections[i]?.name || ''}
              onChange={e => {
                const val = e.target.value;
                const dayMenu = weeklyMenu[i]?.menus || [];
                const sel = dayMenu.find(m => m.name === val);
                setSelections(s => ({ ...s, [i]: sel || null }));
              }}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
            >
              <option value="">-</option>
              {(weeklyMenu[i]?.menus || []).map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Detalle"
              value={details[i] || ''}
              onChange={e => setDetails(d => ({ ...d, [i]: e.target.value }))}
              className="mt-1 w-full px-2 py-1 border border-slate-200 rounded text-xs"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={loading} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white flex items-center gap-1" style={{ background: '#1a73e8' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Guardar
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">Cancelar</button>
      </div>
    </div>
  );
}

export default AdminApp;
