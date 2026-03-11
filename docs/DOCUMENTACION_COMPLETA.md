# Documentación completa – Menú Semanal 

Guía integral del proyecto: herramientas, arquitectura, flujo de trabajo y pasos para crear la app desde cero.

---

## 1. Resumen del proyecto

**Menú Semanal ** es una aplicación web para gestionar la elección de menús semanales de viandas en una empresa. Los colaboradores reciben un link personalizado por email, eligen su menú para cada día de la semana (lunes a viernes) y las respuestas se guardan en un Google Sheet. Un informe se envía automáticamente a cocina cada lunes.

### Funcionalidades principales

- **Usuarios:** Link personalizado con token, nombre, email y turno
- **Selección:** Menú por día (L–V), con opciones como Menu 1, Menu 2, REMOTO, SIN VIANDA
- **Admin:** Panel para listar, modificar, anular y agregar invitados
- **Cocina:** Informe semanal con formato simplificado y contador de menús
- **Correcciones:** Emails a cocina cuando se anula, modifica o agrega un pedido

---

## 2. Herramientas y tecnologías

### Frontend

| Herramienta | Versión | Uso |
|-------------|---------|-----|
| **React** | 18.2 | UI y componentes |
| **Vite** | 4.4 | Build, dev server, HMR |
| **TailwindCSS** | 3.3 | Estilos, diseño responsive |
| **Lucide React** | 0.263 | Iconos |
| **PostCSS** | 8.4 | Procesamiento CSS |
| **ESLint** | 8.45 | Linting |

### Backend

| Herramienta | Uso |
|-------------|-----|
| **Google Apps Script** | Lógica de negocio, Sheet, emails, informe |
| **Google Sheets** | Base de datos (usuarios, respuestas) |
| **Google Drive** | Menú semanal (Doc exportado como txt) |
| **Vercel Serverless** | Proxy API (evita CORS) |

### Hosting y despliegue

| Herramienta | Uso |
|-------------|-----|
| **Vercel** | Hosting frontend + función serverless |
| **GitHub** | Repositorio y CI/CD con Vercel |

### Servicios de Google

- **Spreadsheet:** Usuarios (email, nombre, token, turno) y Respuestas (selecciones)
- **Apps Script:** Web App que recibe POST y ejecuta la lógica
- **Drive:** Documento con el menú semanal (formato texto)
- **MailApp:** Envío de emails (links, confirmaciones, correcciones, informe)

---

## 3. Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USUARIO / ADMIN                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VERCEL (https://proyecto-almuerzo.vercel.app)                       │
│  ├── SPA (React) → /, /admin                                            │
│  └── API → POST /api/selection                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  api/selection.js (Serverless)                                           │
│  Reenvía body a Apps Script                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT (Web App)                                           │
│  doPost → submit | admin_list | admin_cancel | admin_update | admin_add   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │ Google Sheet│ │  MailApp     │ │ Google Drive │
            │ Respuestas  │ │  (emails)    │ │ (informe)    │
            └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 4. Estructura del proyecto

```
Maida/
├── api/
│   └── selection.js          # Función serverless (proxy a Apps Script)
├── docs/
│   ├── AppsScript_Completo.gs # Script completo para Google Apps Script
│   ├── DOCUMENTACION_COMPLETA.md  # Este archivo
│   ├── COMO_CREAR_EL_SHEET_Y_SCRIPT.md
│   ├── ADMIN_PANEL.md
│   ├── FLUJO_SEMANAL.md
│   ├── APPS_SCRIPT_TURNOS.md
│   ├── CHECKLIST_ANTES_DE_PUSH.md
│   └── plantilla_usuarios.csv
├── public/
│   ├── menu-semanal.txt      # Backup local del menú
│   └── favicon.svg
├── src/
│   ├── App.jsx               # App principal (selección de menú)
│   ├── AdminApp.jsx          # Panel de administración
│   ├── main.jsx              # Punto de entrada, ruteo / vs /admin
│   ├── driveService.js       # Lectura del menú desde Google Drive
│   ├── menuProcessor.js      # Parser texto → JSON
│   └── index.css             # Estilos globales
├── index.html
├── package.json
├── vite.config.js            # Proxy /api/selection en dev
├── vercel.json               # Build y rewrites SPA
├── tailwind.config.js
└── postcss.config.js
```

---

## 5. Camino para crear la app (paso a paso)

### Fase 1: Preparación del entorno

1. **Crear repositorio en GitHub**
   - Nuevo repo (ej: `TOP-Proyecto-almuerzo`)
   - Conectar con Vercel para deploy automático

2. **Crear proyecto local**
   ```bash
   npm create vite@latest maida-menu-app -- --template react
   cd maida-menu-app
   npm install
   npm install lucide-react
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

3. **Configurar Tailwind**
   - En `tailwind.config.js`: content, theme (colores pastel)
   - En `index.css`: directivas `@tailwind`

### Fase 2: Google Sheet y Apps Script

1. **Crear Google Sheet**
   - Drive → Nuevo → Google Sheets
   - Nombre: "Menú Semanal - Base"
   - Hoja 1: columnas A=email, B=nombre, C=token, D=turno

2. **Agregar Apps Script**
   - Extensiones → Apps Script
   - Pegar código de `docs/AppsScript_Completo.gs`
   - Configurar: `APP_BASE_URL`, `SHEET_NAME`, `CARPETA_DRIVE_COCINA_ID`, `COCINA_EMAIL`, `ADMIN_SECRET`

3. **Desplegar Web App**
   - Implementar → Nueva implementación
   - Tipo: Aplicación web
   - Ejecutar como: Yo
   - Quién tiene acceso: Cualquier persona
   - Copiar URL de la implementación

### Fase 3: Frontend (React)

1. **App principal (`App.jsx`)**
   - Pantallas: welcome → selection → thankyou
   - Leer parámetros de URL: `?u=token&name=...&email=...&turno=...`
   - Cargar menú desde Drive (o fallback local)
   - Guardar selección en localStorage por semana
   - Enviar POST a `/api/selection` con action `submit`

2. **Servicio de menú (`driveService.js`)**
   - Fetch al Doc de Drive (export txt)
   - `menuProcessor.js` parsea el texto a JSON semanal

3. **Ruteo (`main.jsx`)**
   - `/admin` → AdminApp
   - Resto → App

### Fase 4: API y proxy

1. **Función serverless (`api/selection.js`)**
   - Recibe POST con body JSON
   - Reenvía a URL de Apps Script
   - Devuelve respuesta JSON (o error si no es JSON)

2. **Proxy en desarrollo (`vite.config.js`)**
   - `/api/selection` → `https://script.google.com/macros/s/.../exec`

3. **Vercel (`vercel.json`)**
   - Build: `npm run build`
   - Output: `dist`
   - Rewrites: todo excepto `/api/*` → `/index.html`

### Fase 5: Panel admin

1. **AdminApp.jsx**
   - Login con contraseña (sessionStorage)
   - Acciones: admin_list, admin_cancel, admin_update, admin_add, admin_ping
   - Selector de semana, búsqueda, formularios de edición/agregar

2. **Backend (Apps Script)**
   - `handleAdminAction`: verifica contraseña, ejecuta acción
   - `adminList`, `adminCancel`, `adminUpdate`, `adminAdd`
   - `enviarCorreccionCocina`: email a cocina en cada cambio

### Fase 6: Triggers y automatización

1. **enviarLinksMenuSemanal**
   - Trigger: Jueves, hora definida (ej: 10:00), zona Argentina
   - Envía emails con link personalizado a usuarios en TEST_EMAILS (o todos si se quita el filtro)

2. **generarInformeSemanal**
   - Trigger: Lunes 9:00, zona Argentina
   - Genera Sheet en Drive + email a cocina con formato simplificado

---

## 6. Configuración clave

### Variables en Apps Script (`docs/AppsScript_Completo.gs`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `APP_BASE_URL` | URL de producción (Vercel) | `https://proyecto-almuerzo.vercel.app` |
| `SHEET_NAME` | Nombre de la pestaña de usuarios | `Hoja 1` |
| `HOJA_RESPUESTAS` | Nombre de la hoja de respuestas | `Respuestas` |
| `CARPETA_DRIVE_COCINA_ID` | ID de carpeta Drive para informe | `1tiH7zZ8yZHWbiDD8e64basLJPAfxrrHm` |
| `COCINA_EMAIL` | Email de cocina | `juan.billiot@sommiercenter.com` |
| `ADMIN_SECRET` | Contraseña del panel admin | `Admin.2026` |

### URLs a actualizar

| Archivo | Variable | Descripción |
|---------|----------|-------------|
| `api/selection.js` | `APPS_SCRIPT_URL` | URL completa de la Web App |
| `vite.config.js` | `APPS_SCRIPT_PATH` | Ruta `/macros/s/.../exec` |

### TEST_EMAILS (modo prueba)

En `enviarLinksMenuSemanal`, la variable `TEST_EMAILS` limita el envío a ciertos emails. Para producción, quitar el filtro o vaciar el array y enviar a todos.

---

## 7. Flujo de datos

### Usuario elige menú

1. Usuario abre link: `https://app.vercel.app/?u=TOKEN&name=Nombre&email=...&turno=1`
2. App carga menú desde Drive (Doc export txt)
3. `menuProcessor` parsea texto → JSON con 5 días × N menús
4. Usuario elige menú por día (L–V)
5. Click "Confirmar pedido" → POST `/api/selection` con `action: 'submit'`
6. Serverless reenvía a Apps Script
7. Apps Script: guarda en hoja "Respuestas", envía mail al usuario y al admin

### Admin modifica/anula

1. Admin entra a `/admin`, ingresa contraseña
2. POST con `action: 'admin_list'` → lista usuarios
3. Admin hace click en Modificar o Anular
4. POST con `action: 'admin_update'` o `admin_cancel`
5. Apps Script actualiza Sheet, envía corrección a cocina

### Lunes: informe a cocina

1. Trigger ejecuta `generarInformeSemanal`
2. Lee hoja "Respuestas" filtrada por semana
3. Genera Sheet en Drive con formato: Semana | Nombre | Turno | Lunes | Martes | ... | Contador
4. Envía email a cocina con el mismo contenido

---

## 8. Problemas resueltos durante el desarrollo

| Problema | Causa | Solución |
|----------|-------|----------|
| Body vacío en Vercel | `req.body` no parseado | Leer body desde stream en `getBody()` |
| HTML en lugar de JSON | `setResponseCode` no existe en Apps Script | Quitar todas las llamadas a `setResponseCode` |
| Error en setValues | `getRange(fila, col, filaFin, colFin)` mal interpretado | Usar `getRange(fila, col, numFilas, numCols)` → `getRange(2+r, 6, 1, 5)` |
| Fechas no coinciden | Sheet con Date, frontend con string | Función `normalizarSemana()` para formato YYYY-MM-DD |
| Error sin mensaje | Apps Script devuelve HTML de error | Try-catch en doPost, extracción de error en serverless |

---

## 9. Referencias a documentación existente

- **Crear Sheet y Script:** `docs/COMO_CREAR_EL_SHEET_Y_SCRIPT.md`
- **Panel admin:** `docs/ADMIN_PANEL.md`
- **Flujo semanal:** `docs/FLUJO_SEMANAL.md`
- **Turnos:** `docs/APPS_SCRIPT_TURNOS.md`
- **Checklist antes de push:** `docs/CHECKLIST_ANTES_DE_PUSH.md`

---

## 10. Comandos útiles

```bash
npm run dev      # Desarrollo local (http://localhost:5173)
npm run build    # Build para producción
npm run preview  # Vista previa del build
npm run lint     # Linter
```

---

*Documentación generada para el proyecto Menú Semanal Maida – Marzo 2026*
