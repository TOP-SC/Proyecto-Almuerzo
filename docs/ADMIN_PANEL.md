# Panel Admin - Menú Semanal

## Acceso

- **URL:** `https://proyecto-almuerzo.vercel.app/admin`
- **Contraseña:** Configurada en Apps Script como `ADMIN_SECRET`

## Funciones

1. **Ver usuarios** anotados para la semana actual
2. **Buscar** por nombre o email
3. **Anular** menú de un usuario (envía corrección a cocina)
4. **Modificar** menú de un usuario (envía corrección a cocina)
5. **Agregar invitado** (persona que no está en la lista, no recibió mail)

## Cambiar la contraseña

En `docs/AppsScript_Completo.gs`, línea ~9:

```javascript
const ADMIN_SECRET = 'Admin.2026'; // Contraseña admin
```

Pegar el script actualizado en Apps Script y guardar.

## Flujo de correcciones a cocina

Cada acción del admin (anular, modificar, agregar) envía un mail a `COCINA_EMAIL` con el detalle del cambio.
