# Solución definitiva al error 500 – Script DENTRO del Spreadsheet

El error "Unable to open the file" suele aparecer cuando el script es **standalone** e intenta abrir el spreadsheet por ID. Si el script vive **dentro** del spreadsheet, eso se evita.

---

## Pasos (5 minutos)

### 1. Abrir el spreadsheet
Abrí:
```
https://docs.google.com/spreadsheets/d/1l9E5kuJVmUrei6PLUnBdwpGoGvTDSRIH0k0GapdfZyk/edit
```
(Tu hoja de usuarios).

### 2. Crear el script dentro del spreadsheet
- Menú: **Extensiones** → **Apps Script**
- Se abre el editor. Borrá TODO el código que haya.

### 3. Pegar el código
- Abrí `docs/AppsScript_ContainerBound.gs` y pegá **TODO** en el editor de Apps Script.
- Ya tiene `USUARIOS_SPREADSHEET_ID = ''` (evita el error de "unable to open the file").
- Guardá (Ctrl+S).

### 4. Implementar
- **Implementar** → **Nueva implementación**
- Tipo: **Aplicación web**
- **Ejecutar como:** Yo
- **Quién puede acceder:** Cualquier persona con cuenta de Google
- **Implementar**
- Copiá la URL (termina en `/exec`).

### 5. Actualizar la app
- Decime la nueva URL.
- O bien, cambiá manualmente en `api/selection.js` la constante `APPS_SCRIPT_URL` por la nueva URL.
- Luego hacé push para que Vercel la use.

---

## Por qué funciona
Cuando el script está **dentro** del spreadsheet (Extensions → Apps Script), usa `getActiveSpreadsheet()` en lugar de `openById()`, así que no tiene que “abrir” el archivo. El script y el spreadsheet son el mismo recurso.
