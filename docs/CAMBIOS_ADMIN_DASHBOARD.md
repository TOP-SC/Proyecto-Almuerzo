# Cambios Admin Dashboard – Resumen

## Nuevo layout

- **Sidebar izquierdo** con navegación:
  - Listado de pedidos (vista principal)
  - Dashboard

## Dashboard

### Gráficos de torta
1. **Menús elegidos:** cantidad por tipo (MENU 1, MENU 2, REMOTO, SIN VIANDA, etc.)
2. **Confirmó / No confirmó:** personas que enviaron su menú vs. las que no

### Contador por dominio
- @sommiercenter
- @btime

### Quién pidió / Quién no pidió
- Lista de personas que no enviaron su menú
- Botón **Enviar recordatorio** para enviar mail con el link a quienes no pidieron

### Acciones
- **Enviar mails de apertura:** envía a toda la empresa el mail con link personalizado (manual, cuando quieran)
- **PDF + Abrir Gmail:** genera PDF del resumen (usuario-turno-menu-detalle) y abre Gmail para enviarlo

## Campo detalle/comentario

- En la app de usuario: al confirmar pedido, cada día tiene un campo opcional "Detalle (ej: no quiero papas)"
- Se guarda en la hoja Respuestas (columna Detalle)
- Aparece en el PDF final y en el listado admin
- El admin puede editar los detalles en el formulario de modificación

## Backend (Apps Script)

Nuevas acciones:
- `admin_list_empresa`: lista usuarios de la hoja (para comparar quién pidió/no pidió)
- `admin_send_opening`: envía mails de apertura a toda la empresa
- `admin_pdf_gmail`: genera PDF y devuelve URL de Gmail compose
- `admin_send_reminder`: envía recordatorio a quienes no pidieron

## Hoja Respuestas

- Nueva columna 12: **Detalle** (JSON con comentarios por día)

## Drive menu-semanal

- La app sigue tomando el menú del Doc de Google Drive (o backup local `menu-semanal.txt`)
- Solo hay que editar ese archivo para actualizar el menú

## Pasos para desplegar

1. Copiar `docs/AppsScript_Completo.gs` en el editor de Apps Script
2. Guardar y crear nueva versión de implementación
3. Push del frontend a Vercel (deploy automático)
