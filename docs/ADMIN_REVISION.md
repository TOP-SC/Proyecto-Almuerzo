# Revisión del Panel Admin – Estado actual

Revisión realizada para preparar la ampliación de funcionalidades. Correcciones aplicadas y puntos a tener en cuenta.

---

## Correcciones aplicadas

### 1. Key duplicado en lista de usuarios
- **Problema:** Si un usuario tenía entradas en varias semanas (mismo token), React usaba `user.token` como key y podía haber duplicados.
- **Solución:** Key único: `` `${user.token}-${user.semana || ''}` ``

### 2. Filtro en handleCancel
- **Problema:** Al anular, se filtraba solo por `token`, eliminando todas las filas de ese usuario en lugar de la fila específica.
- **Solución:** Filtro por `token` + `semana`: solo se quita la fila anulada.

### 3. EditForm con usuarios duplicados
- **Problema:** Al editar, se comparaba solo `editingUser?.token === user.token`, pudiendo afectar a varias filas.
- **Solución:** Comparación por `token` y `semana`.

---

## Estado actual del admin

### Frontend (AdminApp.jsx)

| Acción | Estado |
|--------|--------|
| Login con contraseña | OK |
| Listar usuarios (por semana o todas) | OK |
| Buscar por nombre/email | OK |
| Modificar menú | OK |
| Anular menú | OK |
| Agregar invitado | OK |
| Probar conexión | OK |
| Selector de semana | OK (requiere clic en Actualizar) |

### Backend (Apps Script)

| Acción | Función | Estado |
|--------|---------|--------|
| Listar | `admin_list` | OK |
| Anular | `admin_cancel` | OK |
| Modificar | `admin_update` | OK |
| Agregar | `admin_add` | OK |
| Ping | `admin_ping` | OK |

### Dependencias

- **DriveService:** El admin usa `DriveService` para cargar el menú en los formularios de agregar/editar. Si Drive falla, `weeklyMenu` queda vacío y los selects no muestran opciones.
- **API_URL:** `/api/selection` (o `VITE_API_URL` si está definida).

---

## Posibles ampliaciones futuras

Para cuando agreguen más funcionalidades:

1. **Nuevas acciones admin:** Agregar en `handleAdminAction` y en el frontend.
2. **Estructura:** El patrón actual (action + payload → API → Apps Script) es escalable.
3. **Manejo de errores:** `res.text()` + parse + `lastDebug` ya está implementado.
4. **Menú vacío:** Si `weeklyMenu` está vacío, agregar/editar no tendrá opciones; validar o mostrar mensaje al usuario.

---

## Archivos relacionados

- `src/AdminApp.jsx` – UI del admin
- `src/main.jsx` – Ruta `/admin` → AdminApp
- `docs/AppsScript_Completo.gs` – `handleAdminAction`, `adminList`, `adminCancel`, `adminUpdate`, `adminAdd`
- `api/selection.js` – Proxy a Apps Script

---

*Revisión: preparado para ampliar el admin con más funcionalidades.*
