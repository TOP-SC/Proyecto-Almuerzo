# Cómo crear el Sheet y el Apps Script

## Qué tenés que crear

**Un solo archivo: un Google Spreadsheet (Sheet).**  
El Apps Script va **dentro** de ese Sheet, no es un archivo aparte.

---

## Paso a paso

### 1. Crear el Spreadsheet

1. Entrá a [Google Drive](https://drive.google.com).
2. **Nuevo** → **Google Sheets** → **Hoja de cálculo en blanco**.
3. Poné un nombre, por ejemplo: **"Menú Semanal - Base"**.

### 2. Preparar la hoja de usuarios

1. En la primera pestaña, asegurate de tener estas columnas en la fila 1:
   - **A:** email  
   - **B:** nombre  
   - **C:** token  
   - **D:** turno  

2. Opcional: importar la plantilla  
   - En esta carpeta está `plantilla_usuarios.csv`.  
   - En el Sheet: **Archivo** → **Importar** → **Subir** → elegí el CSV.  
   - O cargá a mano los usuarios en las columnas A y B (email y nombre).  
   - Las columnas C (token) y D (turno) las completa el script.

### 3. Agregar el Apps Script

1. En el Sheet: **Extensiones** → **Apps Script**.
2. Se abre el editor de Apps Script.
3. Borrá todo el código que aparece por defecto.
4. Copiá todo el contenido de `docs/AppsScript_Completo.gs` y pegálo ahí.
5. **Guardar** (Ctrl+S).
6. Revisá que `SHEET_NAME` en el script coincida con el nombre de tu pestaña (por defecto "Hoja 1").

### 4. Desplegar como Web App

1. En Apps Script: **Implementar** → **Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Descripción: "Menú semanal".
4. Ejecutar como: **Yo**.
5. Quién tiene acceso: **Cualquier persona**.
6. **Implementar**.
7. Copiá la URL que te da (ej: `https://script.google.com/macros/s/XXXXX/exec`).

### 5. Conectar con el proyecto

Pegá esa URL en:
- `api/selection.js` → variable `APPS_SCRIPT_URL`
- `vite.config.js` → variable `APPS_SCRIPT_PATH` (solo la parte `/macros/s/XXXXX/exec`)

---

## Resumen

| Qué | Dónde |
|-----|-------|
| **Google Sheet** | Lo creás en Drive (Nuevo → Google Sheets) |
| **Apps Script** | Extensiones → Apps Script dentro del Sheet |
| **Código** | Copiás de `docs/AppsScript_Completo.gs` |
| **Hoja Respuestas** | Se crea sola cuando llega el primer pedido |

No hace falta crear un Form ni otro tipo de archivo. Solo el Sheet con el script adentro.

---

## Sheet en uso

- **Enlace:** https://docs.google.com/spreadsheets/d/1l9E5kuJVmUrei6PLUnBdwpGoGvTDSRIH0k0GapdfZyk/edit?usp=sharing
- **ID:** `1l9E5kuJVmUrei6PLUnBdwpGoGvTDSRIH0k0GapdfZyk`
