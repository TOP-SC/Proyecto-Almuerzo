// PROCESADOR DE MENÚ SEMANAL DESDE TEXTO DE WHATSAPP

import { Beef, Apple, Salad, Soup, Home, X } from 'lucide-react';
import { getMenuWeekDayDatesDDMM } from './menuWeekUtils.js';

export const processMenuText = (menuText) => {
  console.log('🔄 Procesando texto del menú...');
  
  const lines = menuText.split('\n').filter(line => line.trim());
  const weeklyMenu = [];
  
  // Estructura base para cada día
  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const currentWeekDates = getMenuWeekDayDatesDDMM();
  
  // Mapeo de menús con iconos correctos (importados directamente) y tolerancia a errores
  const menuTypes = {
    'Menú 1: Diario': { name: 'MENU 1', category: 'CLÁSICO', icon: Beef },
    'Menú 2: Sano': { name: 'MENU 2', category: 'SALUDABLE', icon: Apple },
    'Menú 3: Ensalada': { name: 'MENU 3', category: 'SALUDABLE', icon: Salad },
    'Menú 4: Vegetariano': { name: 'MENU 4', category: 'VEGETARIANO', icon: Soup },
    'Menú 5: Opcional': { name: 'MENU 5', category: 'SIMPLE', icon: Beef },
    // Errores comunes de tipeo
    'Menü 4: Vegetariano': { name: 'MENU 4', category: 'VEGETARIANO', icon: Soup }, // ü en lugar de ú
    'Menu 4: Vegetariano': { name: 'MENU 4', category: 'VEGETARIANO', icon: Soup }, // sin tilde
    'Menú 4: Vegetariano': { name: 'MENU 4', category: 'VEGETARIANO', icon: Soup }, // backup
    'Menú 4: Vegetariano': { name: 'MENU 4', category: 'VEGETARIANO', icon: Soup }, // backup
  };
  
  // Parsear el texto
  let currentMenu = null;
  let menuData = {};
  
  console.log('📊 Analizando líneas...');
  console.log('📝 Líneas encontradas:', lines.length);
  console.log('🔍 Menú types disponibles:', Object.keys(menuTypes));
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    console.log(`📄 Línea ${i}: "${line}"`);
    
    // Detectar tipo de menú con tolerancia a errores
    if (line.includes('Menú') || line.includes('Menu')) {
      const menuType = line.split(':')[0];
      console.log(`🔍 Detectado menú type: "${menuType}"`);
      
      // Función de búsqueda flexible con corrección de errores
      const findMenuKey = (searchTerm) => {
        // Búsqueda exacta primero
        if (menuTypes[searchTerm]) return searchTerm;
        
        // Búsqueda por coincidencias parciales
        const foundKey = Object.keys(menuTypes).find(key => 
          key.includes(searchTerm) || searchTerm.includes(key.split(':')[0])
        );
        
        if (foundKey) return foundKey;
        
        // Corrección de errores comunes
      const corrections = {
        'Menü 4': 'Menü 4: Vegetariano', // ü en lugar de ú
        'Menu 4': 'Menu 4: Vegetariano', // sin tilde
        'Menú 4': 'Menú 4: Vegetariano',
        'Menu 1': 'Menu 1: Diario',
        'Menu 2': 'Menu 2: Sano',
        'Menu 3': 'Menu 3: Ensalada',
        'Menu 5': 'Menu 5: Opcional'
      };
      
      return corrections[searchTerm] || null;
      };
      
      const foundMenuKey = findMenuKey(menuType);
      
      if (foundMenuKey && menuTypes[foundMenuKey]) {
        currentMenu = menuTypes[foundMenuKey];
        menuData[currentMenu.name] = {};
        console.log(`✅ Detectado: ${currentMenu.name} - ${currentMenu.category} (key: ${foundMenuKey})`);
      } else {
        console.log(`❌ Menú type no encontrado: "${menuType}"`);
        console.log(`❌ Keys disponibles:`, Object.keys(menuTypes));
      }
      continue;
    }
    
    // Detectar día y plato con tolerancia a errores
    if (currentMenu && line.includes(':')) {
      const [day, dish] = line.split(':').map(s => s.trim());
      
      // Corrección de errores comunes en días
      const dayCorrections = {
        'Miercoles': 'Miércoles',
        'sabado': 'Sábado', 
        'domingo': 'Domingo',
        'Lunes': 'Lunes',
        'Martes': 'Martes',
        'Jueves': 'Jueves',
        'Viernes': 'Viernes'
      };
      
      const correctedDay = dayCorrections[day] || day;
      
      // Para MENU 5, siempre usar "Pollo"
      let finalDish = dish;
      if (currentMenu.name === 'MENU 5' && correctedDay) {
        finalDish = 'Pollo';
        console.log(`🍗️ MENU 5: Forzando "Pollo" para ${correctedDay}`);
      }
      
      if (daysOfWeek.includes(correctedDay)) {
        menuData[currentMenu.name][correctedDay] = finalDish;
        console.log(`🍽️ ${correctedDay}: ${finalDish}`);
        if (day !== correctedDay) {
          console.log(`🔧 Corregido día: "${day}" → "${correctedDay}"`);
        }
      } else {
        console.log(`⚠️ Día no reconocido: "${correctedDay}"`);
      }
    }
  }
  
  console.log('📊 menuData final:', menuData);
  
  // Construir estructura final
  console.log('🏗️ Construyendo estructura final...');
  
  for (let dayIndex = 0; dayIndex < daysOfWeek.length; dayIndex++) {
    const day = daysOfWeek[dayIndex];
    const date = currentWeekDates[dayIndex];
    
    const dayMenus = [];
    
    // Id por nombre de menú (1-7) para que los colores de las cards coincidan siempre
    const menuIdFromName = (name) => {
      const n = name?.replace(/MENU\s*/i, '');
      const num = parseInt(n, 10);
      if (num >= 1 && num <= 5) return num;
      return dayMenus.length + 1;
    };
    Object.keys(menuData).forEach(menuName => {
      if (menuData[menuName][day]) {
        dayMenus.push({
          id: menuIdFromName(menuName),
          name: menuName,
          dish: menuData[menuName][day],
          category: menuTypes[getMenuTypeKey(menuName)]?.category || 'CLÁSICO',
          icon: menuTypes[getMenuTypeKey(menuName)]?.icon || Beef
        });
      }
    });
    
    const expectedMenus = ['MENU 1', 'MENU 2', 'MENU 3', 'MENU 4', 'MENU 5'];
    const foundMenus = dayMenus.map(m => m.name);
    
    expectedMenus.forEach((expectedMenu) => {
      if (!foundMenus.includes(expectedMenu)) {
        console.log(`⚠️ Falta ${expectedMenu} para ${day}, agregando placeholder...`);
        const dish = expectedMenu === 'MENU 5' ? 'Pollo' : 'No disponible esta semana';
        dayMenus.push({
          id: menuIdFromName(expectedMenu),
          name: expectedMenu,
          dish: dish,
          category: menuTypes[getMenuTypeKey(expectedMenu)]?.category || 'CLÁSICO',
          icon: menuTypes[getMenuTypeKey(expectedMenu)]?.icon || Beef
        });
      }
    });
    
    // Agregar opciones fijas
    dayMenus.push(
      { id: 6, name: "REMOTO", dish: "Trabajo desde casa", icon: Home, category: "HOME OFFICE" },
      { id: 7, name: "SIN VIANDA", dish: "No requiere almuerzo", icon: X, category: "SIN SELECCIÓN" }
    );
    
    weeklyMenu.push({
      day: `${day.toUpperCase()} ${date}`,
      menus: dayMenus
    });
    
    console.log(`📅 ${day.toUpperCase()} ${date} - ${dayMenus.length} menús`);
  }
  
  console.log(`✅ Procesamiento completado: ${weeklyMenu.length} días`);
  return weeklyMenu;
};

// Obtener tipo de menú por nombre
function getMenuTypeKey(menuName) {
  const menuNumber = menuName.split(' ')[1];
  return `Menú ${menuNumber}: ${getMenuCategory(menuName)}`;
}

function getMenuCategory(menuName) {
  const categories = {
    'MENU 1': 'Diario',
    'MENU 2': 'Sano', 
    'MENU 3': 'Ensalada',
    'MENU 4': 'Vegetariano',
    'MENU 5': 'Opcional'
  };
  return categories[menuName] || 'Diario';
}

