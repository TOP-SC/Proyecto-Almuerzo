import React, { useState, useEffect } from 'react';
import { Calendar, Home, X, ArrowRight, Check, Send, Pizza, Beef, Fish, Apple, Cookie, Soup, Salad, Sandwich } from 'lucide-react';
import { DriveService } from './driveService.js';
import { GitHubService } from './driveService.js';

function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [selections, setSelections] = useState({});
  const [particles, setParticles] = useState([]);
  const [weeklyMenu, setWeeklyMenu] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [userName, setUserName] = useState('Invitado');
  const [userEmail, setUserEmail] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [userTurn, setUserTurn] = useState('Turno 1 (13:00 - 14:00)');
  const [mobileDayTab, setMobileDayTab] = useState(0);
  const [details, setDetails] = useState({});
  const [cycleOpen, setCycleOpen] = useState(null);

  const TURNO_LABELS = { '1': 'Turno 1 (13:00 - 14:00)', '2': 'Turno 2 (14:00 - 15:00)' };
  const API_URL = import.meta.env.VITE_API_URL || '/api/selection';

  // Semana del menú: lunes a viernes (hora Argentina; mostramos "del lunes X al viernes Y")
  const getMenuWeek = () => {
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
      friday: weekEnd,
    };
  };
  const menuWeek = getMenuWeek();
  const weekNumber = menuWeek.label;
  const weekKey = menuWeek.weekKey;
  const fridayStr = menuWeek.friday.getDate().toString().padStart(2,'0') + '/' + (menuWeek.friday.getMonth()+1).toString().padStart(2,'0');

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Color distintivo por menú (marco del color del menú + ribete esquina + iluminación al elegir)
  const MENU_COLORS = {
    1: { border: 'border-red-400/60 hover:border-red-400/85', selected: 'selected-tint-red', accent: 'text-red-400', banner: 'bg-red-500/20 border-red-500/30', shimmer: '#ef4444' },
    2: { border: 'border-green-400/60 hover:border-green-400/85', selected: 'selected-tint-green', accent: 'text-green-400', banner: 'bg-green-500/20 border-green-500/30', shimmer: '#22c55e' },
    3: { border: 'border-blue-400/60 hover:border-blue-400/85', selected: 'selected-tint-blue', accent: 'text-blue-400', banner: 'bg-blue-500/20 border-blue-500/30', shimmer: '#3b82f6' },
    4: { border: 'border-amber-400/60 hover:border-amber-400/85', selected: 'selected-tint-amber', accent: 'text-amber-400', banner: 'bg-amber-500/20 border-amber-500/30', shimmer: '#f59e0b' },
    5: { border: 'border-violet-400/60 hover:border-violet-400/85', selected: 'selected-tint-violet', accent: 'text-violet-400', banner: 'bg-violet-500/20 border-violet-500/30', shimmer: '#8b5cf6' },
    6: { border: 'border-cyan-400/60 hover:border-cyan-400/85', selected: 'selected-tint-cyan', accent: 'text-cyan-400', banner: 'bg-cyan-500/20 border-cyan-500/30', shimmer: '#06b6d4' },
    7: { border: 'border-slate-300/60 hover:border-slate-300/85', selected: 'selected-tint-slate', accent: 'text-slate-300', banner: 'bg-slate-500/20 border-slate-400/30', shimmer: '#94a3b8' }
  };

  // Inicializar servicio (Google Drive prioritario)
  const menuService = new DriveService(); // Cambiar a GitHubService como backup

  // Cargar menú desde el servicio
  useEffect(() => {
    loadMenuFromService();
    
    // Verificar actualizaciones cada 5 minutos
    const interval = setInterval(() => {
      checkForMenuUpdates();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const loadMenuFromService = async () => {
    try {
      setIsLoading(true);
      const menuData = await menuService.processAndSaveMenu();
      setWeeklyMenu(menuData);
      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading menu:', error);
      // Cargar menú de ejemplo como fallback
      loadFallbackMenu();
      setIsLoading(false);
    }
  };

  const checkForMenuUpdates = async () => {
    const hasUpdates = await menuService.checkForUpdates();
    if (hasUpdates) {
      loadMenuFromService();
    }
  };

  const loadFallbackMenu = () => {
    // Menú de ejemplo actual
    setWeeklyMenu([
      {
        day: "LUNES 09/03",
        menus: [
          { id: 1, name: "MENU 1", dish: "Pollo a la portuguesa con arroz", icon: Beef, category: "CLÁSICO" },
          { id: 2, name: "MENU 2", dish: "Buñuelitos de acelga", icon: Cookie, category: "VEGETARIANO" },
          { id: 3, name: "MENU 3", dish: "Ensalada completa", icon: Apple, category: "SALUDABLE" },
          { id: 4, name: "MENU 4", dish: "Zapallito relleno", icon: Soup, category: "VEGETARIANO" },
          { id: 5, name: "MENU 5", dish: "Pollo", icon: Beef, category: "SIMPLE" },
          { id: 6, name: "REMOTO", dish: "Trabajo desde casa", icon: Home, category: "HOME OFFICE" },
          { id: 7, name: "SIN VIANDA", dish: "No requiere almuerzo", icon: X, category: "SIN SELECCIÓN" }
        ]
      },
      {
        day: "MARTES 10/03",
        menus: [
          { id: 1, name: "MENU 1", dish: "Espaguetis con estofado", icon: Pizza, category: "PASTA" },
          { id: 2, name: "MENU 2", dish: "Costillitas de cerdo con puré", icon: Beef, category: "CARNE" },
          { id: 3, name: "MENU 3", dish: "Ensalada gourmet", icon: Apple, category: "SALUDABLE" },
          { id: 4, name: "MENU 4", dish: "Pasta con vegetales", icon: Soup, category: "VEGETARIANO" },
          { id: 5, name: "MENU 5", dish: "Pollo", icon: Beef, category: "SIMPLE" },
          { id: 6, name: "REMOTO", dish: "Trabajo desde casa", icon: Home, category: "HOME OFFICE" },
          { id: 7, name: "SIN VIANDA", dish: "No requiere almuerzo", icon: X, category: "SIN SELECCIÓN" }
        ]
      },
      {
        day: "MIÉRCOLES 11/03",
        menus: [
          { id: 1, name: "MENU 1", dish: "Canelones a la rossini", icon: Pizza, category: "PASTA" },
          { id: 2, name: "MENU 2", dish: "Crepe de verdura", icon: Soup, category: "VEGETARIANO" },
          { id: 3, name: "MENU 3", dish: "Ensalada especial", icon: Fish, category: "SALUDABLE" },
          { id: 4, name: "MENU 4", dish: "Albóndigas de lenteja", icon: Sandwich, category: "VEGETARIANO" },
          { id: 5, name: "MENU 5", dish: "Pollo", icon: Beef, category: "SIMPLE" },
          { id: 6, name: "REMOTO", dish: "Trabajo desde casa", icon: Home, category: "HOME OFFICE" },
          { id: 7, name: "SIN VIANDA", dish: "No requiere almuerzo", icon: X, category: "SIN SELECCIÓN" }
        ]
      },
      {
        day: "JUEVES 12/03",
        menus: [
          { id: 1, name: "MENU 1", dish: "Milanesa napolitana", icon: Beef, category: "CLÁSICO" },
          { id: 2, name: "MENU 2", dish: "Milanesitas de verduras", icon: Cookie, category: "VEGETARIANO" },
          { id: 3, name: "MENU 3", dish: "Ensalada penne", icon: Fish, category: "SALUDABLE" },
          { id: 4, name: "MENU 4", dish: "Risotto de verduras", icon: Soup, category: "VEGETARIANO" },
          { id: 5, name: "MENU 5", dish: "Pollo", icon: Beef, category: "SIMPLE" },
          { id: 6, name: "REMOTO", dish: "Trabajo desde casa", icon: Home, category: "HOME OFFICE" },
          { id: 7, name: "SIN VIANDA", dish: "No requiere almuerzo", icon: X, category: "SIN SELECCIÓN" }
        ]
      },
      {
        day: "VIERNES 13/03",
        menus: [
          { id: 1, name: "MENU 1", dish: "Sandwich de bondiola", icon: Sandwich, category: "SÁNDWICH" },
          { id: 2, name: "MENU 2", dish: "Churrasquito de pollo", icon: Beef, category: "CARNE" },
          { id: 3, name: "MENU 3", dish: "Ensalada capresse", icon: Apple, category: "SALUDABLE" },
          { id: 4, name: "MENU 4", dish: "Hamburguesa vegetal", icon: Soup, category: "VEGETARIANO" },
          { id: 5, name: "MENU 5", dish: "Pollo", icon: Beef, category: "SIMPLE" },
          { id: 6, name: "REMOTO", dish: "Trabajo desde casa", icon: Home, category: "HOME OFFICE" },
          { id: 7, name: "SIN VIANDA", dish: "No requiere almuerzo", icon: X, category: "SIN SELECCIÓN" }
        ]
      }
    ]);
  };

  useEffect(() => {
    if (userToken && weekKey) {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_cycle_status', weekKey }),
      })
        .then(r => r.json())
        .then(d => { if (d && d.ok !== undefined) setCycleOpen(d.abierto); })
        .catch(() => setCycleOpen(true));
    } else {
      setCycleOpen(true);
    }
  }, [userToken, weekKey]);

  useEffect(() => {
    // Leer token, nombre y email de usuario desde la URL (?u=...&name=...&email=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('u');
      if (tokenFromUrl) {
        setUserToken(tokenFromUrl);
      }

      const nameFromUrl = params.get('name');
      const emailFromUrl = params.get('email');

      if (emailFromUrl) {
        setUserEmail(emailFromUrl);
      }

      if (nameFromUrl && nameFromUrl.trim().length > 0) {
        setUserName(nameFromUrl.trim());
      } else if (emailFromUrl) {
        const localPart = emailFromUrl.split('@')[0] || '';
        if (localPart) {
          const prettyName = localPart
            .split(/[._-]+/)
            .filter(Boolean)
            .map(
              (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
            )
            .join(' ');
          if (prettyName) {
            setUserName(prettyName);
          }
        }
      }

      const turnoFromUrl = params.get('turno');
      if (turnoFromUrl === '1' || turnoFromUrl === '2') {
        setUserTurn(TURNO_LABELS[turnoFromUrl] || TURNO_LABELS['1']);
      }
    } catch (e) {
      console.error('No se pudo leer el token de usuario desde la URL', e);
    }

    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 15,
      duration: 15 + Math.random() * 8
    }));
    setParticles(newParticles);
  }, []);

  const handleDayMenuSelect = (dayIndex, menu) => {
    setSelections(prev => ({ ...prev, [dayIndex]: menu }));
  };

  const allDaysSelected = [0, 1, 2, 3, 4].every(i => selections[i] != null);
  const daysCompleted = [0, 1, 2, 3, 4].filter(i => selections[i] != null).length;

  const STORAGE_KEY = `menuSelections_${weekKey}`;

  useEffect(() => {
    if (Object.keys(selections).length === 0 && Object.keys(details).length === 0) return;
    try {
      const toStore = {};
      Object.entries(selections).forEach(([dayIdx, menu]) => {
        if (menu) toStore[dayIdx] = { id: menu.id, name: menu.name, dish: menu.dish, category: menu.category };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      if (Object.keys(details).length > 0) {
        localStorage.setItem(STORAGE_KEY + '_details', JSON.stringify(details));
      }
    } catch (_) {}
  }, [selections, details, STORAGE_KEY]);

  useEffect(() => {
    if (!weeklyMenu?.length) return;
    setSelections(prev => {
      if (Object.keys(prev).length > 0) return prev;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return prev;
        const parsed = JSON.parse(stored);
        const restored = {};
        Object.entries(parsed).forEach(([dayIdx, data]) => {
          const idx = parseInt(dayIdx, 10);
          const menu = weeklyMenu[idx]?.menus?.find(m => m.id === data.id);
          if (menu) restored[idx] = menu;
        });
        return Object.keys(restored).length > 0 ? restored : prev;
      } catch (_) {
        return prev;
      }
    });
    setDetails(prev => {
      try {
        const d = localStorage.getItem(STORAGE_KEY + '_details');
        if (!d) return prev;
        return JSON.parse(d) || prev;
      } catch (_) { return prev; }
    });
  }, [weeklyMenu, STORAGE_KEY]);

  const handleConfirmSelection = () => {
    setCurrentScreen('selection');
  };

  const handleFinalSubmit = () => {
    // Enviar selecciones al backend (Apps Script Web App)
    // Usar proxy local (/api/selection) para evitar CORS; en producción usar VITE_API_URL o función serverless
    const apiUrl =
      import.meta.env.VITE_API_URL ||
      '/api/selection';
    const payload = {
      userToken,
      userName,
      userEmail,
      weekNumber,
      weekKey,
      userTurn,
      selections,
      weeklyMenu,
    };

    setIsSubmitting(true);
    setSubmitError(null);

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'Error al enviar la selección');
        }
        return res.json().catch(() => ({}));
      })
      .then(() => {
        setShowConfirmModal(false);
        try {
          localStorage.removeItem(`menuSelections_${weekKey}`);
          localStorage.removeItem(`menuSelections_${weekKey}_details`);
        } catch (_) {}
        setShowSuccessToast(true);
        setTimeout(() => {
          setShowSuccessToast(false);
          setCurrentScreen('thankyou');
        }, 1200);
      })
      .catch((err) => {
        console.error('Error enviando selección:', err);
        setSubmitError('No pudimos registrar tu selección. Intenta de nuevo en unos minutos.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const renderCerradoScreen = () => (
    <div className="min-h-screen app-bg flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200 flex items-center justify-center">
          <span className="text-2xl">🔒</span>
        </div>
        <h1 className="text-2xl font-medium text-slate-800 mb-2">Período cerrado</h1>
        <p className="text-slate-600 mb-4">El período para elegir el menú de esta semana ya finalizó.</p>
        <p className="text-slate-500 text-sm">{weekNumber}</p>
        <p className="text-slate-400 text-sm mt-4">Si tenés dudas, contactá a RRHH.</p>
      </div>
    </div>
  );

  const renderWelcomeScreen = () => (
    <div className="min-h-screen app-bg flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--google-blue)' }} aria-hidden />
        <h1 className="text-3xl font-medium text-slate-800 mb-2">Menú Semanal</h1>
        <p className="text-slate-600 mb-6">{weekNumber}</p>
        <p className="text-xl text-slate-700 mb-1">¡Hola {userName}!</p>
        <p className="text-slate-500 text-sm mb-8">Elegí tu menú para cada día de la semana</p>
        <button
          onClick={handleConfirmSelection}
          className="app-button app-button-primary inline-flex items-center gap-2"
          aria-label="Comenzar a elegir menú"
        >
          <span>Comenzar</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-slate-400 text-xs mt-4">{userTurn} · Hasta viernes {fridayStr} 9:00</p>
      </div>
    </div>
  );

  const renderSelectionScreen = () => {
    if (!weeklyMenu || weeklyMenu.length === 0) {
      return (
        <div className="min-h-screen app-bg flex flex-col items-center justify-center gap-4">
          <div className="spinner-material" aria-label="Cargando menú" />
          <p className="text-slate-600 text-sm">Cargando menú...</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col app-bg overflow-hidden">
        <header className="flex-shrink-0 px-4 py-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-medium text-slate-800">Elegí tu menú por día</h1>
            <p className="text-xs text-slate-500">{weekNumber} · {daysCompleted}/5 días</p>
          </div>
          {allDaysSelected && (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="app-button app-button-primary flex items-center gap-2 shadow-md hover:shadow-lg transition-all flex-shrink-0 animate-fade-in"
              aria-label="Confirmar pedido"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar pedido</span>
            </button>
          )}
        </header>
        <div className="flex-1 flex items-center justify-center p-5 min-h-0 overflow-auto">
          {/* Móvil: tabs por día */}
          <div className="lg:hidden w-full max-w-2xl">
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {weeklyMenu.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMobileDayTab(i)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mobileDayTab === i ? 'bg-[var(--google-blue)] text-white' : 'bg-white/80 text-slate-600 border border-slate-200'
                  }`}
                  aria-label={`Ver menú del ${day.day}`}
                  aria-pressed={mobileDayTab === i}
                >
                  {day.day.split(' ')[0]}
                </button>
              ))}
            </div>
            <div className="day-column h-full">
              <div className="text-sm font-semibold text-slate-600 mb-3 text-center border-b border-slate-100 pb-2">
                {weeklyMenu[mobileDayTab]?.day}
              </div>
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                {weeklyMenu[mobileDayTab]?.menus.map((menu) => {
                  const Icon = menu.icon;
                  const isSelected = selections[mobileDayTab]?.id === menu.id;
                  const theme = MENU_COLORS[menu.id] || MENU_COLORS[1];
                  return (
                    <button
                      key={menu.id}
                      type="button"
                      onClick={() => handleDayMenuSelect(mobileDayTab, menu)}
                      className="menu-option flex items-center gap-2 text-left relative pl-4"
                      style={isSelected ? { background: hexToRgba(theme.shimmer, 0.18), borderColor: hexToRgba(theme.shimmer, 0.4) } : undefined}
                      aria-label={`${menu.name}: ${menu.dish}${isSelected ? ', seleccionado' : ''}`}
                      aria-pressed={isSelected}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ backgroundColor: theme.shimmer }} aria-hidden />
                      {isSelected ? (
                        <Check className="w-5 h-5 flex-shrink-0" style={{ color: theme.shimmer }} />
                      ) : (
                        <Icon className="w-5 h-5 flex-shrink-0 opacity-80" style={{ color: theme.shimmer }} />
                      )}
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="font-medium text-slate-800 text-sm">{menu.name}</div>
                        <div className="text-slate-500 text-sm leading-snug break-words line-clamp-3">{menu.dish}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Detalle (ej: no papas)"
                  value={details[mobileDayTab] || ''}
                  onChange={e => setDetails(d => ({ ...d, [mobileDayTab]: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          {/* Desktop: grid 5 columnas */}
          <div className="hidden lg:grid grid-cols-5 gap-4 max-w-6xl w-full h-full max-h-[calc(100vh-120px)]">
            {weeklyMenu.map((day, dayIndex) => {
              const selected = selections[dayIndex];
              return (
                <div key={dayIndex} className="day-column h-full flex flex-col">
                  <div className="text-sm font-semibold text-slate-600 mb-3 text-center border-b border-slate-100 pb-2 flex-shrink-0">
                    {day.day}
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-auto">
                  {day.menus.map((menu) => {
                    const Icon = menu.icon;
                    const isSelected = selected?.id === menu.id;
                    const theme = MENU_COLORS[menu.id] || MENU_COLORS[1];
                    return (
                      <button
                        key={menu.id}
                        type="button"
                        onClick={() => handleDayMenuSelect(dayIndex, menu)}
                        className="menu-option flex items-center gap-2 text-left flex-1 min-h-0 relative pl-4"
                        style={isSelected ? { background: hexToRgba(theme.shimmer, 0.18), borderColor: hexToRgba(theme.shimmer, 0.4) } : undefined}
                        aria-label={`${menu.name}: ${menu.dish}${isSelected ? ', seleccionado' : ''}`}
                        aria-pressed={isSelected}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ backgroundColor: theme.shimmer }} aria-hidden />
                        {isSelected ? (
                          <Check className="w-5 h-5 flex-shrink-0" style={{ color: theme.shimmer }} />
                        ) : (
                          <Icon className="w-5 h-5 flex-shrink-0 opacity-80" style={{ color: theme.shimmer }} />
                        )}
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="font-medium text-slate-800 text-sm">{menu.name}</div>
                          <div className="text-slate-500 text-sm leading-snug break-words line-clamp-3">{menu.dish}</div>
                        </div>
                      </button>
                    );
                  })}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Detalle"
                      value={details[dayIndex] || ''}
                      onChange={e => setDetails(d => ({ ...d, [dayIndex]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => !isSubmitting && setShowConfirmModal(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-medium text-slate-800 mb-2">¿Enviar pedido?</h3>
              <p className="text-slate-600 text-sm mb-4">Confirmá tu selección para enviar.</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="app-button app-button-primary w-full flex items-center justify-center gap-2"
                  aria-label="Enviar pedido"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Enviando...' : 'Sí, enviar pedido'}
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="app-button w-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Seguir eligiendo
                </button>
              </div>
              {submitError && <p className="text-xs text-red-600 mt-4 text-center">{submitError}</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderThankYouScreen = () => (
    <div className="min-h-screen app-bg flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <Check className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--google-green)' }} aria-hidden />
        <h1 className="text-2xl font-medium text-slate-800 mb-2">¡Listo!</h1>
        <p className="text-slate-600 mb-4">Tu pedido fue enviado correctamente.</p>
        <p className="text-slate-500 text-sm">{userTurn}</p>
        <p className="text-slate-500 text-sm mt-1">{weekNumber}</p>
        <p className="text-slate-400 text-sm mt-6">Recibirás un correo de confirmación. ¡Buen provecho!</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Firma visible de la app */}
      <div className="fixed bottom-4 right-4 text-slate-500 text-sm font-medium pointer-events-none select-none z-50">
        Create by Proyectos y Transformación Operativa
      </div>
      
      {userToken && cycleOpen === null && (
        <div className="min-h-screen app-bg flex items-center justify-center">
          <div className="spinner-material" aria-label="Cargando" />
        </div>
      )}
      {userToken && cycleOpen === false && renderCerradoScreen()}
      {!(userToken && cycleOpen === null) && !(userToken && cycleOpen === false) && currentScreen === 'welcome' && renderWelcomeScreen()}
      {!(userToken && cycleOpen === null) && !(userToken && cycleOpen === false) && currentScreen === 'selection' && renderSelectionScreen()}
      {currentScreen === 'thankyou' && renderThankYouScreen()}

      {showSuccessToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-xl bg-[var(--google-green)] text-white font-medium shadow-lg animate-fade-in flex items-center gap-2" role="status" aria-live="polite">
          <Check className="w-5 h-5" />
          Pedido enviado correctamente
        </div>
      )}
    </>
  );
}

export default App;
