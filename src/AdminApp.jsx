import React, { useState, useEffect } from 'react';
import { Shield, LogOut, Search, XCircle, Edit2, UserPlus, Check, Loader2, LayoutDashboard, Users, Mail, FileText, PieChart, Send, Building2, Lock, Unlock } from 'lucide-react';
import { DriveService } from './driveService.js';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '/api/selection';
const APP_BASE_URL = import.meta.env.VITE_APP_URL || 'https://proyecto-almuerzo.vercel.app';

function getMenuWeek() {
  const now = new Date();
  let y, mo, d;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(now);
    y = parseInt(parts.find(p => p.type === 'year').value, 10);
    mo = parseInt(parts.find(p => p.type === 'month').value, 10);
    d = parseInt(parts.find(p => p.type === 'day').value, 10);
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
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d1 = weekStart.getDate();
  const d2 = weekEnd.getDate();
  const mes = meses[weekEnd.getMonth()];
  const weekKeyStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
  return {
    label: `Semana del ${d1} al ${d2} de ${mes}`,
    weekKey: weekKeyStr,
  };
}

function parseMenuStr(str) {
  if (!str) return null;
  const m = str.match(/MENU\s*(\d+)\s*-\s*(.+)/i) || str.match(/REMOTO/i) || str.match(/SIN VIANDA/i);
  if (!m) return null;
  if (str.toUpperCase().includes('REMOTO')) return { id: 6, name: 'REMOTO', dish: 'Trabajo desde casa', category: 'HOME OFFICE' };
  if (str.toUpperCase().includes('SIN VIANDA')) return { id: 7, name: 'SIN VIANDA', dish: 'No requiere almuerzo', category: 'SIN SELECCIÓN' };
  return { id: parseInt(m[1], 10), name: 'MENU ' + m[1], dish: m[2]?.trim() || '', category: '' };
}

const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#8b5cf6', '#06b6d4', '#94a3b8'];

function AdminApp() {
  const [isAuth, setIsAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [empresaUsers, setEmpresaUsers] = useState([]);
  const [weeklyMenu, setWeeklyMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ nombre: '', turno: '1', selections: {} });
  const [actionLoading, setActionLoading] = useState(null);
  const [weekKeyOverride, setWeekKeyOverride] = useState('');
  const [lastDebug, setLastDebug] = useState(null);
  const [connectionOk, setConnectionOk] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [manualEmpresaUsers, setManualEmpresaUsers] = useState([]);
  const [selectedReminderEmails, setSelectedReminderEmails] = useState([]);

  const menuWeek = getMenuWeek();
  const activeWeekKey = weekKeyOverride.trim() || menuWeek.weekKey;

  useEffect(() => {
    const stored = sessionStorage.getItem('adminSecret');
    if (stored) {
      setAdminSecret(stored);
      setIsAuth(true);
    }
  }, []);

  useEffect(() => {
    if (isAuth && adminSecret) {
      loadUsers();
      loadMenu();
      loadEmpresaUsers();
    }
  }, [isAuth, adminSecret]);

  useEffect(() => {
    if (isAuth && (activeView === 'dashboard' || activeView === 'empresa' || activeView === 'pendientes' || activeView === 'listado')) {
      loadEmpresaUsers();
    }
    if (isAuth && activeView === 'listado') {
      loadUsers();
      const iv = setInterval(loadUsers, 30000);
      return () => clearInterval(iv);
    }
  }, [isAuth, activeView]);

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
      if (data.ok && data.users) {
        setEmpresaUsers(data.users);
      }
    } catch (_) {}
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

  const handleSendOpening = async () => {
    if (!confirm('¿Enviar mails de apertura a toda la empresa? Cada persona recibirá su link personalizado.')) return;
    setActionLoading('opening');
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_send_opening', adminSecret }),
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
        setError(data.error || 'Error al generar PDF');
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
      const body = { action: 'admin_send_reminder', adminSecret, weekKey: activeWeekKey };
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

  const weekForDashboard = activeWeekKey || menuWeek.weekKey;
  const usersThisWeekRaw = users.filter(u => (u.semana || '') === weekForDashboard);
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
  const empresaUsersEffective = (empresaUsers && empresaUsers.length > 0) ? empresaUsers : manualEmpresaUsers;
  const usersWhoNotOrdered = empresaUsersEffective.filter(e => {
    const em = (e.email || '').toLowerCase();
    return em && !usersWhoOrdered.includes(em);
  });

  const menuCounts = {};
  usersThisWeek.forEach(u => {
    ['lunes','martes','miercoles','jueves','viernes'].forEach(d => {
      const val = u[d] || '';
      const m = val.match(/MENU\s*(\d+)/i) || val.match(/REMOTO/i) || val.match(/SIN VIANDA/i);
      const key = m ? (m[1] ? `MENU ${m[1]}` : (val.toUpperCase().includes('REMOTO') ? 'REMOTO' : 'SIN VIANDA')) : null;
      if (key) {
        menuCounts[key] = (menuCounts[key] || 0) + 1;
      }
    });
  });
  const menuChartData = Object.entries(menuCounts).map(([name, value]) => ({ name, value }));

  const confirmChartData = [
    { name: 'Confirmó', value: usersThisWeek.length, color: '#34a853' },
    { name: 'No confirmó', value: usersWhoNotOrdered.length, color: '#ea4335' },
  ];

  const sommierCount = usersThisWeek.filter(u => (u.email || '').toLowerCase().includes('@sommiercenter')).length;
  const btimeCount = usersThisWeek.filter(u => (u.email || '').toLowerCase().includes('@btime')).length;

  if (!isAuth) {
    return (
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
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <aside className="w-52 flex-shrink-0 bg-white/90 backdrop-blur-sm border-r border-slate-200/80 shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-slate-800">Admin</span>
              <p className="text-[11px] text-slate-500 leading-tight">{menuWeek.label}</p>
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
        <header className="bg-white/80 backdrop-blur border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Semana:</label>
            <input
              type="text"
              value={weekKeyOverride}
              onChange={e => setWeekKeyOverride(e.target.value)}
              placeholder={menuWeek.weekKey}
              className="w-36 px-2 py-1 border border-slate-200 rounded text-sm"
              title="Vacío=todas. Ej: 2026-03-09"
            />
            <button onClick={loadUsers} className="text-sm text-blue-600 hover:underline">Actualizar</button>
          </div>
          <button
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
              actionLoading={actionLoading}
              cycleOpen={cycleOpen}
              handleCycleOpen={handleCycleOpen}
              handleCycleClose={handleCycleClose}
              weekLabel={menuWeek.label}
            />
          )}
          {activeView === 'menus' && (
            <MenusView menuCounts={menuCounts} />
          )}
          {activeView === 'empresa' && (
            <EmpresaView
              sommierUsers={usersThisWeek.filter(u => (u.email || '').toLowerCase().includes('@sommiercenter'))}
              btimeUsers={usersThisWeek.filter(u => (u.email || '').toLowerCase().includes('@btime'))}
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
            />
          )}
        </div>
      </main>
    </div>
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

function ListView({ filteredUsers, loading, search, setSearch, showAddForm, setShowAddForm, addForm, setAddForm, weeklyMenu, editingUser, setEditingUser, handleAdd, handleCancel, handleUpdate, actionLoading, lastDebug, empresaUsers, usersThisWeek, onLoadManualUsers, empresaUsersFromApi }) {
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

  return (
    <div className="max-w-4xl">
      {empresaUsersFromApi && empresaUsersFromApi.length === 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
          <span className="text-amber-800 text-sm">La lista de usuarios no se cargó desde el Sheet. Cargá la hoja <strong>usuarios_completos</strong> o pegá la lista manualmente.</span>
          <button onClick={() => setShowPasteModal(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700">Pegar lista</button>
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
            <div className="text-center py-8 text-slate-500">No hay usuarios anotados para esta semana.</div>
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

function DashboardView({ menuChartData, confirmChartData, handleSendOpening, handlePdfGmail, actionLoading, cycleOpen, handleCycleOpen, handleCycleClose, weekLabel }) {
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
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
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
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
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
          disabled={actionLoading === 'pdf'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all bg-gradient-to-r from-green-500 to-emerald-600"
        >
          {actionLoading === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          PDF + Abrir Gmail
        </button>
      </div>
    </div>
  );
}

function MenusView({ menuCounts }) {
  const total = Object.values(menuCounts).reduce((a, b) => a + b, 0);
  const entries = Object.entries(menuCounts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Cantidad por menú</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {entries.map(([name, count]) => {
          const t = MENU_CARD_COLORS[name] || { bg: 'from-slate-400 to-slate-500', shadow: 'shadow-slate-400/30', text: 'text-white' };
          return (
            <div
              key={name}
              className={`rounded-2xl bg-gradient-to-br ${t.bg} p-5 shadow-lg ${t.shadow} flex flex-col items-center justify-center min-h-[120px]`}
            >
              <span className="text-3xl font-bold text-white drop-shadow-sm">{count}</span>
              <span className="text-sm font-medium text-white/90 mt-1 text-center">{name}</span>
            </div>
          );
        })}
      </div>
      {total > 0 && (
        <p className="mt-4 text-sm text-slate-500">Total: {total} selecciones</p>
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
          @btime ({btimeUsers.length})
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

function PendientesView({ usersWhoNotOrdered, handleSendReminder, selectedReminderEmails, setSelectedReminderEmails, actionLoading, empresaUsers, onLoadManualUsers, empresaUsersFromApi }) {
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

  return (
    <div className="max-w-4xl">
      {empresaUsersFromApi && empresaUsersFromApi.length === 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
          <span className="text-amber-800 text-sm">La lista no se cargó desde el Sheet. Cargá <strong>usuarios_completos</strong> o usá "Pegar lista" en Listado pedidos.</span>
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
        ) : empresaUsers && empresaUsers.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">Cargá la lista de empleados en la hoja <strong>usuarios_completos</strong> (A=email, B=nombre, C=token, D=turno) del Sheet.</p>
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
