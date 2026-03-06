import React, { useState, useEffect } from 'react';
import { Calendar, Utensils, Coffee, Salad, Soup, Sandwich, ChefHat, User, Clock, Home, X, ArrowRight, Check, Edit2, Send, Pizza, Beef, Fish, Apple, Cookie } from 'lucide-react';
import { DriveService } from './driveService.js';
import { GitHubService } from './driveService.js';

function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [selections, setSelections] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [particles, setParticles] = useState([]);
  const [weeklyMenu, setWeeklyMenu] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [userName, setUserName] = useState('Invitado');
  const [userEmail, setUserEmail] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userTurn, setUserTurn] = useState('Turno 1 (13:00 - 14:00)');

  const TURNO_LABELS = { '1': 'Turno 1 (13:00 - 14:00)', '2': 'Turno 2 (14:00 - 15:00)' };

  // Semana del menú: lunes a viernes (regla: jueves a lunes 9h Argentina abierto; mostramos "del lunes X al viernes Y")
  const getMenuWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
    const daysToMonday = (8 - dayOfWeek) % 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysToMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4);
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const d1 = weekStart.getDate();
    const d2 = weekEnd.getDate();
    const mes = meses[weekEnd.getMonth()];
    return {
      label: `Semana del ${d1} al ${d2} de ${mes}`,
      weekKey: weekStart.toISOString().slice(0, 10), // YYYY-MM-DD para el backend
      friday: weekEnd,
    };
  };
  const menuWeek = getMenuWeek();
  const weekNumber = menuWeek.label;
  const weekKey = menuWeek.weekKey;
  const fridayStr = menuWeek.friday.getDate().toString().padStart(2,'0') + '/' + (menuWeek.friday.getMonth()+1).toString().padStart(2,'0');

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
          { id: 5, name: "MENU 5", dish: "Pollo al horno", icon: Beef, category: "SIMPLE" },
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
          { id: 5, name: "MENU 5", dish: "Pollo al horno", icon: Beef, category: "SIMPLE" },
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
          { id: 5, name: "MENU 5", dish: "Pollo al horno", icon: Beef, category: "SIMPLE" },
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
          { id: 5, name: "MENU 5", dish: "Pollo al horno", icon: Beef, category: "SIMPLE" },
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
          { id: 5, name: "MENU 5", dish: "Pollo al horno", icon: Beef, category: "SIMPLE" },
          { id: 6, name: "REMOTO", dish: "Trabajo desde casa", icon: Home, category: "HOME OFFICE" },
          { id: 7, name: "SIN VIANDA", dish: "No requiere almuerzo", icon: X, category: "SIN SELECCIÓN" }
        ]
      }
    ]);
  };

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

  const handleMenuSelect = (menuId) => {
    const selectedMenu = weeklyMenu[currentDayIndex].menus.find(m => m.id === menuId);
    setSelections(prev => ({
      ...prev,
      [currentDayIndex]: selectedMenu
    }));
    
    if (isEditing) {
      setTimeout(() => {
        setCurrentScreen('summary');
        setIsEditing(false);
      }, 1500);
    } else if (currentDayIndex < weeklyMenu.length - 1) {
      setTimeout(() => {
        setCurrentDayIndex(currentDayIndex + 1);
      }, 1500);
    } else {
      setTimeout(() => {
        setCurrentScreen('summary');
      }, 1500);
    }
  };

  const handleConfirmSelection = () => {
    setCurrentScreen('menu');
    setIsEditing(false);
  };

  const handleEditDay = (dayIndex) => {
    setCurrentDayIndex(dayIndex);
    setCurrentScreen('menu');
    setIsEditing(true);
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
        setCurrentScreen('thankyou');
      })
      .catch((err) => {
        console.error('Error enviando selección:', err);
        setSubmitError('No pudimos registrar tu selección. Intenta de nuevo en unos minutos.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const renderWelcomeScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 relative overflow-hidden flex items-center justify-center">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="floating-particle"
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            '--delay': `${particle.delay}s`,
            '--duration': `${particle.duration}s`
          }}
        />
      ))}
      
      <div className="text-center z-10 px-8">
        <div className="mb-8">
          <Calendar className="w-20 h-20 text-blue-400 mx-auto mb-6 animate-pulse" />
          <h1 className="text-6xl font-light pastel-text tracking-wide mb-4">
            Menú Semanal
          </h1>
          <div className="h-px w-64 bg-gradient-to-r from-transparent via-blue-400 to-transparent mx-auto mb-8"></div>
        </div>
        
        <div className="mb-8">
          <p className="text-3xl text-gray-200 font-light tracking-wide mb-2">
            ¡Bienvenida {userName}!
          </p>
          <p className="text-gray-400 text-lg font-medium tracking-widest uppercase mb-4">
            {weekNumber}
          </p>
          <p className="text-gray-300 text-lg font-light">
            al sistema de selección de menús
          </p>
        </div>
        
        <button
          onClick={handleConfirmSelection}
          className="office-button group text-xl px-16 py-6"
        >
          <span className="flex items-center gap-4">
            <span>COMENZAR</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
          </span>
        </button>
        
        <p className="text-gray-400 text-sm mt-6 tracking-widest uppercase">
          {userTurn} • Modifica hasta el viernes {fridayStr} 9:00 AM
        </p>
      </div>
    </div>
  );

  const renderMenuScreen = () => {
    // Validar primero antes de usar currentDay
    if (!weeklyMenu || weeklyMenu.length === 0 || currentDayIndex >= weeklyMenu.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 relative overflow-hidden flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-300 text-lg mb-4">Cargando menú...</div>
            <div className="text-gray-400 text-sm">Por favor, espera un momento</div>
          </div>
        </div>
      );
    }
    
    const currentDay = weeklyMenu[currentDayIndex];
    const isSelected = selections[currentDayIndex];
    
    if (!currentDay) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 relative overflow-hidden flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-300 text-lg mb-4">Cargando día...</div>
            <div className="text-gray-400 text-sm">Por favor, espera un momento</div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 relative overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="floating-particle"
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            '--delay': `${particle.delay}s`,
            '--duration': `${particle.duration}s`
          }}
        />
      ))}
      
      <div className="relative z-10 container mx-auto px-2 py-3 max-w-4xl">
        <header className="text-center mb-3">
          <div className="mb-4">
            <h1 className="text-4xl font-light text-gray-200 mb-2">
              {currentDay.day}
            </h1>
            <div className="h-px w-48 bg-gradient-to-r from-transparent via-blue-400 to-transparent mx-auto"></div>
          </div>
          <p className="text-gray-300 text-base font-light">
            Selecciona tu menú para hoy
          </p>
        </header>

          <div className="grid grid-cols-3 gap-1 mb-1">
            {currentDay.menus.slice(0, 3).map((menu) => {
              const Icon = menu.icon;
              const isCurrentlySelected = isSelected?.id === menu.id;
              const theme = MENU_COLORS[menu.id] || MENU_COLORS[1];
              return (
                <div
                  key={menu.id}
                  onClick={() => handleMenuSelect(menu.id)}
                  className={`weekly-menu-item ${isCurrentlySelected ? 'selected ' + theme.selected : ''} p-1.5 cursor-pointer transition-all duration-300 aspect-[4/3] flex flex-col justify-between relative overflow-hidden ${theme.border}`}
                  style={{ '--selected-color': theme.shimmer, '--card-color': theme.shimmer }}
                >
                  <div className="absolute top-0 right-0 w-0 h-0 border-[18px] border-t-transparent border-b-transparent border-l-transparent opacity-50 pointer-events-none z-[1]" style={{ borderRightColor: theme.shimmer }} aria-hidden />
                  <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none opacity-[0.06]">
                    <Icon className="w-32 h-32 text-blue-300/20" />
                  </div>
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="mb-1">
                      <Icon className={`w-5 h-5 opacity-80 ${theme.accent}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-200 mb-1">{menu.name}</h3>
                      <p className="text-gray-400 text-xs mb-1">{menu.category}</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{menu.dish}</p>
                    </div>
                  </div>
                  {isCurrentlySelected && (
                    <div className={`flex items-center justify-center gap-1 mt-1 relative z-20 ${theme.accent}`}>
                      <Check className="w-3 h-3" />
                      <span className="font-semibold text-xs">¡ELEGIDO!</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="grid grid-cols-3 gap-1 mb-1">
            {currentDay.menus.slice(3, 6).map((menu) => {
              const Icon = menu.icon;
              const isCurrentlySelected = isSelected?.id === menu.id;
              const theme = MENU_COLORS[menu.id] || MENU_COLORS[4];
              return (
                <div
                  key={menu.id}
                  onClick={() => handleMenuSelect(menu.id)}
                  className={`weekly-menu-item ${isCurrentlySelected ? 'selected ' + theme.selected : ''} p-1.5 cursor-pointer transition-all duration-300 aspect-[4/3] flex flex-col justify-between relative overflow-hidden ${theme.border}`}
                  style={{ '--selected-color': theme.shimmer, '--card-color': theme.shimmer }}
                >
                  <div className="absolute top-0 right-0 w-0 h-0 border-[18px] border-t-transparent border-b-transparent border-l-transparent opacity-50 pointer-events-none z-[1]" style={{ borderRightColor: theme.shimmer }} aria-hidden />
                  <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none opacity-[0.06]">
                    <Icon className="w-32 h-32 text-blue-300/20" />
                  </div>
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="mb-1">
                      <Icon className={`w-5 h-5 opacity-80 ${theme.accent}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-200 mb-1">{menu.name}</h3>
                      <p className="text-gray-400 text-xs mb-1">{menu.category}</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{menu.dish}</p>
                    </div>
                  </div>
                  {isCurrentlySelected && (
                    <div className={`flex items-center justify-center gap-1 mt-1 relative z-20 ${theme.accent}`}>
                      <Check className="w-3 h-3" />
                      <span className="font-semibold text-xs">¡ELEGIDO!</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* SIN VIANDA - Card especial alargada abajo */}
          <div className="mb-1">
            {currentDay.menus[6] && (() => {
              const menu = currentDay.menus[6];
              const isCurrentlySelected = isSelected?.id === menu.id;
              const theme = MENU_COLORS[7];
              return (
                <div
                  onClick={() => handleMenuSelect(menu.id)}
                  className={`weekly-menu-item ${isCurrentlySelected ? 'selected ' + theme.selected : ''} p-1 cursor-pointer transition-all duration-300 aspect-[6/1] flex items-center justify-between relative overflow-hidden ${theme.border}`}
                  style={{ '--selected-color': theme.shimmer, '--card-color': theme.shimmer }}
                >
                  <div className="absolute top-0 right-0 w-0 h-0 border-[18px] border-t-transparent border-b-transparent border-l-transparent opacity-50 pointer-events-none z-[1]" style={{ borderRightColor: theme.shimmer }} aria-hidden />
                  <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none opacity-[0.06]">
                    <X className="w-36 h-36 text-slate-300/20" />
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="mb-1">
                      <X className={`w-4 h-4 opacity-80 ${theme.accent}`} />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-200 mb-1">{menu.name}</h3>
                      <p className="text-gray-400 text-xs mb-1">{menu.category}</p>
                      <p className="text-gray-300 text-xs">{menu.dish}</p>
                      <p className="text-gray-400 text-xs mt-1 italic">Opción para quienes no almuerzan</p>
                    </div>
                  </div>
                  {isCurrentlySelected && (
                    <div className={`flex items-center gap-2 relative z-20 ${theme.accent}`}>
                      <Check className="w-3 h-3" />
                      <span className="font-semibold text-xs">¡ELEGIDO!</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {isSelected && (() => {
            const theme = MENU_COLORS[isSelected.id] || MENU_COLORS[2];
            return (
              <div className="text-center animate-fade-in">
                <div className={`inline-flex items-center gap-3 px-6 py-3 border rounded-full mb-4 ${theme.banner} ${theme.accent}`}>
                  <Check className="w-5 h-5" />
                  <span className="font-medium">
                    Has elegido {isSelected.name} - {isSelected.dish}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  Avanzando al siguiente día...
                </p>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderSummaryScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 relative overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="floating-particle"
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            '--delay': `${particle.delay}s`,
            '--duration': `${particle.duration}s`
          }}
        />
      ))}
      
      <div className="relative z-10 container mx-auto px-4 py-6 max-w-5xl">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-light text-gray-200 mb-3">
            Resumen de tu Semana
          </h1>
          <div className="h-px w-48 bg-gradient-to-r from-transparent via-blue-400 to-transparent mx-auto mb-4"></div>
          <p className="text-gray-300 text-base">
            Revisa tus selecciones antes de confirmar
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {weeklyMenu.map((day, index) => {
            const selection = selections[index];
            const Icon = selection?.icon;
            const theme = selection ? (MENU_COLORS[selection.id] || MENU_COLORS[2]) : null;
            return (
              <div key={index} className="weekly-table border-l-4" style={theme ? { borderLeftColor: theme.shimmer } : { borderLeftColor: 'rgba(75, 85, 99, 0.5)' }}>
                <div className="day-header">
                  <span>{day.day}</span>
                </div>
                <div className="p-4">
                  {selection ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className={`w-5 h-5 ${theme?.accent || 'text-blue-400'}`} />
                        <div>
                          <h4 className="text-base font-light text-gray-200">
                            {selection.name}
                          </h4>
                          <p className="text-xs text-gray-400">
                            {selection.category}
                          </p>
                        </div>
                      </div>
                      <p className="text-gray-300 text-sm mb-3">
                        {selection.dish}
                      </p>
                      <button
                        onClick={() => handleEditDay(index)}
                        className={`flex items-center gap-2 transition-colors ${theme ? theme.accent + ' hover:opacity-80' : 'text-blue-400 hover:text-blue-300'}`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span className="text-xs">Cambiar</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <p className="text-sm">No seleccionado</p>
                      <button
                        onClick={() => handleEditDay(index)}
                        className="mt-2 text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Seleccionar ahora
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={handleFinalSubmit}
            className="office-button group text-lg px-12 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            <span className="flex items-center gap-3">
              <Send className="w-5 h-5" />
              <span>{isSubmitting ? 'ENVIANDO...' : 'CONFIRMAR Y ENVIAR'}</span>
            </span>
          </button>
          {submitError && (
            <p className="text-red-400 text-xs mt-2">
              {submitError}
            </p>
          )}
          <p className="text-gray-400 text-xs mt-3">
            Una vez enviado, no podrás modificar tu selección
          </p>
        </div>
      </div>
    </div>
  );

  const renderThankYouScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 relative overflow-hidden flex items-center justify-center">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="floating-particle"
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            '--delay': `${particle.delay}s`,
            '--duration': `${particle.duration}s`
          }}
        />
      ))}
      
      <div className="text-center z-10 px-8">
        <div className="mb-8">
          <Check className="w-20 h-20 text-green-400 mx-auto mb-6 animate-pulse" />
          <h1 className="text-6xl font-light text-green-400 mb-4">
            ¡Gracias!
          </h1>
          <div className="h-px w-64 bg-gradient-to-r from-transparent via-green-400 to-transparent mx-auto mb-8"></div>
        </div>
        
        <div className="mb-8">
          <p className="text-3xl text-gray-200 font-light mb-4">
            Tu selección ha sido confirmada
          </p>
          <p className="text-gray-400 text-lg">
            Te esperamos en {userTurn}
          </p>
          <p className="text-gray-400 text-lg">
            {weekNumber}
          </p>
        </div>
        
        <div className="text-gray-500 text-sm">
          <p>Recibirás un correo de confirmación</p>
          <p className="mt-2">¡Buen provecho!</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Firma visible de la app */}
      <div className="fixed bottom-4 right-4 text-white/80 text-sm font-semibold drop-shadow pointer-events-none select-none z-50">
        Create By TOP
      </div>
      
      {currentScreen === 'welcome' && renderWelcomeScreen()}
      {currentScreen === 'menu' && renderMenuScreen()}
      {currentScreen === 'summary' && renderSummaryScreen()}
      {currentScreen === 'thankyou' && renderThankYouScreen()}
      
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .weekly-menu-item {
          background: rgba(31, 41, 55, 0.3);
          backdrop-filter: blur(20px);
          border-width: 1px;
          border-style: solid;
          border-radius: 16px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          min-height: 95px;
        }
        .weekly-menu-item:hover {
          transform: translateY(-2px);
        }
        .weekly-menu-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        }
        .weekly-menu-item.selected::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--selected-color), transparent);
          animation: shimmer 2s infinite;
        }
        .selected-tint-red.selected { border-color: rgba(239,68,68,0.75); background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06)); box-shadow: 0 6px 28px rgba(239,68,68,0.35); }
        .selected-tint-green.selected { border-color: rgba(34,197,94,0.75); background: linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.06)); box-shadow: 0 6px 28px rgba(34,197,94,0.35); }
        .selected-tint-blue.selected { border-color: rgba(59,130,246,0.75); background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06)); box-shadow: 0 6px 28px rgba(59,130,246,0.35); }
        .selected-tint-amber.selected { border-color: rgba(245,158,11,0.75); background: linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06)); box-shadow: 0 6px 28px rgba(245,158,11,0.35); }
        .selected-tint-violet.selected { border-color: rgba(139,92,246,0.75); background: linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.06)); box-shadow: 0 6px 28px rgba(139,92,246,0.35); }
        .selected-tint-cyan.selected { border-color: rgba(6,182,212,0.75); background: linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.06)); box-shadow: 0 6px 28px rgba(6,182,212,0.35); }
        .selected-tint-slate.selected { border-color: rgba(148,163,184,0.75); background: linear-gradient(135deg, rgba(148,163,184,0.12), rgba(148,163,184,0.06)); box-shadow: 0 6px 28px rgba(148,163,184,0.35); }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes float-up {
          0% { 
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          100% { 
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }
        
        .floating-particle {
          animation: float-up var(--duration) linear infinite;
          animation-delay: var(--delay);
        }
      `}</style>
    </>
  );
}

export default App;
