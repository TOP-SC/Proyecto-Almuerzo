import React, { useState, useEffect } from 'react';
import { Shield, LogOut, Search, XCircle, Edit2, UserPlus, Check, Loader2, LayoutDashboard, Users, Mail, FileText, PieChart, Send } from 'lucide-react';
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
  const [activeView, setActiveView] = useState('listado');

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
    if (isAuth && activeView === 'dashboard') {
      loadEmpresaUsers();
    }
  }, [isAuth, activeView]);

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

  const handleSendReminder = async () => {
    if (!confirm('¿Enviar recordatorio a las personas que no pidieron menú?')) return;
    setActionLoading('reminder');
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_send_reminder', adminSecret, weekKey: activeWeekKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        alert('Recordatorios enviados.');
      } else {
        setError(data.error || 'Error al enviar');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u =>
    !search || u.nombre?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const weekForDashboard = activeWeekKey || menuWeek.weekKey;
  const usersThisWeek = users.filter(u => (u.semana || '') === weekForDashboard);
  const usersWhoOrdered = usersThisWeek.map(u => (u.email || '').toLowerCase()).filter(Boolean);
  const usersWhoNotOrdered = empresaUsers.filter(e => {
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
    { id: 'listado', label: 'Listado de pedidos', icon: Users },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: '#f5f5f5' }}>
      <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6" style={{ color: '#1a73e8' }} />
            <span className="font-semibold text-slate-800">Admin</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{menuWeek.label}</p>
        </div>
        <nav className="flex-1 p-2">
          {sidebarItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeView === id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-100">
          <button
            onClick={() => { sessionStorage.removeItem('adminSecret'); setIsAuth(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
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

        <div className="flex-1 p-4 overflow-auto">
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
            />
          )}

          {activeView === 'dashboard' && (
            <DashboardView
              menuChartData={menuChartData}
              confirmChartData={confirmChartData}
              sommierCount={sommierCount}
              btimeCount={btimeCount}
              usersWhoNotOrdered={usersWhoNotOrdered}
              handleSendOpening={handleSendOpening}
              handlePdfGmail={handlePdfGmail}
              handleSendReminder={handleSendReminder}
              actionLoading={actionLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function ListView({ filteredUsers, loading, search, setSearch, showAddForm, setShowAddForm, addForm, setAddForm, weeklyMenu, editingUser, setEditingUser, handleAdd, handleCancel, handleUpdate, actionLoading, lastDebug }) {
  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: '#34a853' }}
        >
          <UserPlus className="w-4 h-4" /> Agregar invitado
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
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
            <div key={`${user.token}-${user.semana || ''}`} className="bg-white rounded-xl shadow p-4">
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
                      <p className="text-xs text-slate-400 mt-1">Turno {user.turno}</p>
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

function DashboardView({ menuChartData, confirmChartData, sommierCount, btimeCount, usersWhoNotOrdered, handleSendOpening, handlePdfGmail, handleSendReminder, actionLoading }) {
  return (
    <div className="max-w-5xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4" /> Menús elegidos
          </h3>
          {menuChartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={menuChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {menuChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-500 text-sm py-8 text-center">Sin datos aún</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4" /> Confirmó / No confirmó
          </h3>
          {confirmChartData.some(d => d.value > 0) ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={confirmChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {confirmChartData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-500 text-sm py-8 text-center">Sin datos aún</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Por dominio</h3>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span>@sommiercenter: <strong>{sommierCount}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span>@btime: <strong>{btimeCount}</strong></span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Quién pidió / Quién no pidió</h3>
        <p className="text-slate-600 text-sm mb-3">Personas que aún no enviaron su menú:</p>
        {usersWhoNotOrdered.length > 0 ? (
          <>
            <ul className="list-disc list-inside text-sm text-slate-600 mb-4 max-h-40 overflow-y-auto">
              {usersWhoNotOrdered.map((u, i) => (
                <li key={i}>{u.nombre || u.email} {u.email && <span className="text-slate-400">({u.email})</span>}</li>
              ))}
            </ul>
            <button
              onClick={handleSendReminder}
              disabled={actionLoading === 'reminder'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: '#ea4335' }}
            >
              {actionLoading === 'reminder' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar recordatorio
            </button>
          </>
        ) : (
          <p className="text-slate-500 text-sm">Todos ya pidieron o no hay lista de empresa cargada.</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Acciones</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSendOpening}
            disabled={actionLoading === 'opening'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white"
            style={{ background: '#1a73e8' }}
          >
            {actionLoading === 'opening' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Enviar mails de apertura
          </button>
          <button
            onClick={handlePdfGmail}
            disabled={actionLoading === 'pdf'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white"
            style={{ background: '#34a853' }}
          >
            {actionLoading === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            PDF + Abrir Gmail
          </button>
        </div>
      </div>
    </div>
  );
}

function extraerMenuShort(str) {
  if (!str) return '-';
  const m = str.match(/MENU\s*(\d+)/i);
  return m ? `Menu ${m[1]}` : str.slice(0, 15);
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
