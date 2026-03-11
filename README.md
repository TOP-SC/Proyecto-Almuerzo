# Maida – Menú Semanal

Aplicación web para gestionar la elección de menús semanales de viandas. Los colaboradores reciben un link personalizado, eligen su menú por día y las respuestas se guardan en Google Sheets. Un informe se envía automáticamente a cocina cada lunes.

## Características

- **Selección de menú** por día (lunes a viernes) con link personalizado
- **Panel admin** para listar, modificar, anular y agregar invitados
- **Informe para cocina** con formato simplificado y contador de menús
- **Correcciones** enviadas por email cuando se modifica o anula un pedido

## Tecnologías

- **Frontend:** React 18, Vite, TailwindCSS, Lucide React
- **Backend:** Google Apps Script (Sheet, Drive, MailApp)
- **Hosting:** Vercel (SPA + función serverless)

## Instalación

```bash
npm install
npm run dev
```

La app se abre en `http://localhost:5173`

## URLs

| Entorno | URL |
|---------|-----|
| Producción | https://proyecto-almuerzo.vercel.app |
| Admin | https://proyecto-almuerzo.vercel.app/admin |

## Documentación completa

Ver **[docs/DOCUMENTACION_COMPLETA.md](docs/DOCUMENTACION_COMPLETA.md)** para:

- Herramientas y tecnologías
- Arquitectura del sistema
- Paso a paso para crear la app desde cero
- Configuración y variables
- Flujo de datos
- Problemas resueltos y troubleshooting

## Documentación por tema

| Archivo | Contenido |
|---------|-----------|
| [COMO_CREAR_EL_SHEET_Y_SCRIPT.md](docs/COMO_CREAR_EL_SHEET_Y_SCRIPT.md) | Crear Sheet, pegar Apps Script, desplegar |
| [ADMIN_PANEL.md](docs/ADMIN_PANEL.md) | Uso del panel admin |
| [FLUJO_SEMANAL.md](docs/FLUJO_SEMANAL.md) | Calendario semanal, triggers |
| [CHECKLIST_ANTES_DE_PUSH.md](docs/CHECKLIST_ANTES_DE_PUSH.md) | Verificaciones antes de desplegar |

## Licencia

MIT License
