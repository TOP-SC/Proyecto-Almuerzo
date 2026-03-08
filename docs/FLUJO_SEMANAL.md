# Flujo semanal del menú

## Resumen

| Día | Acción |
|-----|--------|
| **Lunes a Jueves** | Admin carga/actualiza el menú en el Doc de Drive |
| **Jueves** (antes de X hora) | Se envían los links a todos los usuarios |
| **Jueves a Lunes** | Los usuarios eligen su menú (4 días) |
| **Lunes** (9:00 Argentina) | Se cierra la anotación, se envía el resumen a cocina |

---

## Detalle

### 1. Menú en Drive

- **Documento:** https://docs.google.com/document/d/1I0rImxiunxeQWVqs0ZTsx3fftwdt0rF9ZJnLPyN9rfE/edit?usp=sharing
- La app lee el menú desde ese Doc (export txt).
- El admin lo modifica de **lunes a jueves** antes del envío de links.

### 2. Jueves: apertura y envío de links

- **Trigger:** Configurar `enviarLinksMenuSemanal` para que se ejecute el **jueves** a la hora indicada (ej: 10:00 Argentina).
- Antes de esa hora: el admin debe tener el menú actualizado en el Doc.
- La app toma el menú del Doc y los usuarios ven el menú actualizado al abrir el link.
- Se envían los mails con el link personalizado a todos los usuarios.

### 3. Jueves a Lunes: período de elección

- Los usuarios tienen **4 días** para elegir su menú.
- Cada uno entra con su link, elige para los 5 días y confirma.
- Las respuestas se guardan en la hoja "Respuestas".

### 4. Lunes: cierre y envío a cocina

- **Trigger:** `generarInformeSemanal` se ejecuta el **lunes** a las 9:00 (Argentina).
- Se cierra la posibilidad de anotarse (los usuarios ya no pueden modificar).
- Se genera:
  1. **Archivo en Drive:** Sheet con Semana, Nombre, Turno, Lunes (Menu X), Martes, etc. + contador de menús.
  2. **Email a cocina:** Mismo formato (sin token ni email) + contador al final.

### Formato del informe para cocina

- **Columnas:** Semana | Nombre | Turno | Lunes | Martes | Miércoles | Jueves | Viernes
- **Valores:** Solo el número de menú (ej: "Menu 1", "Menu 2").
- **Al final:** Contador, ej. Menu 1: 20, Menu 2: 35, Menu 3: 15, etc.

---

## Triggers a configurar en Apps Script

1. **enviarLinksMenuSemanal:** Jueves, hora a definir (ej: 10:00), zona America/Argentina/Buenos_Aires.
2. **generarInformeSemanal:** Lunes 9:00–10:00, zona America/Argentina/Buenos_Aires.

---

## Configuración

- `COCINA_EMAIL` en el script: email de la gente de viandas (actualmente juan.billiot@sommiercenter.com).
- `CARPETA_DRIVE_COCINA_ID`: carpeta donde se guarda el archivo generado el lunes.
