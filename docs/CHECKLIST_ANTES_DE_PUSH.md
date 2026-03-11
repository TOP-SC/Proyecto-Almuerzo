# Checklist antes de hacer push

Guía para verificar que todo esté configurado antes de desplegar la actualización.

---

## 1. Apps Script – Web App desplegada

1. Abrí el proyecto de Apps Script vinculado al Spreadsheet.
2. **Implementar** → **Implementaciones** → verificá que haya una implementación activa tipo "Aplicación web".
3. **IMPORTANTE – Si cambiaste el script (ej. contraseña admin):** Guardá el archivo y luego **Implementar** → **Gestionar implementaciones** → **Editar** (ícono lápiz) → **Versión** → **Nueva versión** → **Desplegar**. Sin esto, la Web App sigue usando la versión anterior.
4. Si no existe implementación o querés crear una nueva:
   - **Implementar** → **Nueva implementación**
   - Tipo: **Aplicación web**
   - Descripción: "Menú semanal - recepción de pedidos"
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona** (para que la app en Vercel pueda enviar POST)
   - **Implementar**
5. Copiá la **URL de la implementación** (ej: `https://script.google.com/macros/s/XXXXX/exec`).

---

## 2. Actualizar URL del Apps Script en el proyecto

La URL del Apps Script debe estar en dos archivos:

| Archivo | Variable / ruta |
|---------|------------------|
| `api/selection.js` | `APPS_SCRIPT_URL` (línea 1) |
| `vite.config.js` | `APPS_SCRIPT_PATH` (línea 4) |

**En `api/selection.js`:** reemplazá la URL completa por la de tu implementación.

**En `vite.config.js`:** usá solo la ruta después de `script.google.com`, ej: `/macros/s/TU_ID/exec`.

---

## 3. Apps Script – URL de la app (emails)

En `docs/AppsScript_Completo.gs`, línea 4:

```javascript
const APP_BASE_URL = 'https://proyecto-almuerzo.vercel.app';
```

Verificá que sea la URL de producción de Vercel (la que se actualiza con cada push). Si tenés dominio propio, usá esa.

---

## 4. Trigger – Lunes 9:00 Argentina

1. En Apps Script: **Editor** (ícono de reloj) → **Activadores**.
2. **+ Agregar activador**.
3. Configuración:
   - Función: **`generarInformeSemanal`**
   - Tipo: **Activador basado en tiempo**
   - Intervalo: **Semanal**
   - Día: **Lunes**
   - Hora: **9:00 a 10:00**
   - Zona horaria: **America/Argentina/Buenos_Aires**
4. Guardar (puede pedir autorización la primera vez).

---

## 5. Spreadsheet – Hoja "Respuestas"

- La hoja **Respuestas** se crea automáticamente la primera vez que llega un pedido.
- Columnas: Semana, Token, Nombre, Email, Turno, Lunes, Martes, Miércoles, Jueves, Viernes.
- No hace falta crearla a mano.

---

## 6. Carpeta de Drive para cocina

- Carpeta: [Menú cocina](https://drive.google.com/drive/folders/1tiH7zZ8yZHWbiDD8e64basLJPAfxrrHm)
- El script debe tener permiso para crear archivos ahí.
- Si el script corre con tu cuenta, asegurate de que tu cuenta tenga acceso de escritura a esa carpeta.

---

## 7. Vercel – Variables de entorno (opcional)

Si quisieras usar una URL distinta para el backend, podrías definir `VITE_API_URL` en Vercel. Por defecto la app usa `/api/selection`, que ya apunta al Apps Script vía la función serverless. No es obligatorio configurar nada extra.

---

## 8. Prueba rápida antes del push

1. **Local:** `npm run dev` → elegir menú → enviar. Debería llegar el mail de confirmación.
2. **Apps Script:** Revisar la hoja "Respuestas" y que se haya guardado una fila.
3. **Trigger manual:** En Apps Script, ejecutar `generarInformeSemanal` (solo si hoy es lunes, o cambiar temporalmente la validación de día). Verificar que se cree el archivo en la carpeta de Drive.

---

## 9. Flujo de datos (resumen)

```
Usuario elige menú → Click "Sí, enviar"
    ↓
App (Vercel) POST /api/selection
    ↓
Función serverless (api/selection.js) reenvía a Apps Script
    ↓
Apps Script doPost:
  - Guarda en hoja "Respuestas"
  - Envía mail al usuario
  - Envía mail al organizador
    ↓
Lunes 9:00 Argentina: generarInformeSemanal()
  - Lee "Respuestas"
  - Crea Sheet con resumen por turno
  - Lo guarda en carpeta Drive
    ↓
Envío manual del archivo a cocina
```

---

## 10. Después del push

1. Esperar el deploy en Vercel (1–2 min).
2. Probar con un link real de la app en producción.
3. Confirmar que los mails lleguen y que se guarde en la hoja "Respuestas".
