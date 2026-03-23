# Solución al error 500 "Unable to open the file"

## Qué se implementó (ya hecho)

Se añadió un **fallback** en `api/selection.js`: cuando Apps Script falla, la app usa respuestas por defecto para que al menos cargue:

- **get_cycle_status** → ciclo abierto (la app se ve)
- **admin_ping** → OK (el admin carga)
- **admin_list** / **admin_list_empresa** → listas vacías

**El envío (submit) sigue dependiendo de Apps Script.** Si el backend falla, el pedido no se registrará.

---

## Arreglar la causa del error

El mensaje "Unable to open the file" suele indicar que el script no puede usar el spreadsheet. Revisar:

### 1. El spreadsheet existe y es accesible

- Abrí: https://docs.google.com/spreadsheets/d/1l9E5kuJVmUrei6PLUnBdwpGoGvTDSRIH0k0GapdfZyk/edit
- Comprobá que abra sin problemas con la cuenta que creó el script
- Si no existe o está en papelera: restaurarlo o crear uno nuevo y actualizar `USUARIOS_SPREADSHEET_ID` en el script

### 2. Misma cuenta para script y spreadsheet

El script y el spreadsheet deben estar en la **misma** cuenta de Google. Si usás cuenta personal y corporativa, ambos deben vivir en la misma.

### 3. Probar con un script mínimo

- En script.google.com: **Archivo > Nuevo > Proyecto**
- Pegá el contenido de `docs/AppsScript_Minimal_Test.gs`
- **Implementar > Nueva implementación > Aplicación web**
- Configuración: **Ejecutar como: Yo**, **Quién puede acceder: Cualquier persona**
- Abrí la URL `.../exec` en el navegador

Si este script responde bien, el fallo está en el script completo o en el spreadsheet. Si también da error, el problema está en la configuración de la cuenta/deployment.

### 4. Recrear el deployment

- En tu script completo: **Implementar > Gestionar implementaciones**
- Eliminá el deployment actual
- Creá uno nuevo con la misma configuración
- Actualizá la URL en `api/selection.js` si cambia
