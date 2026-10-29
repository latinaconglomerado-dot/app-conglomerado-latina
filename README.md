# Renta Car Ecuador

App web en español (Ecuador): página de renta, elección de vehículo y formulario de reserva. Stack: Node.js (≥18) + Express. Cada solicitud se guarda en JSON y en un Excel dentro de `DATA_DIR`. Si configuras el webhook, también se agrega una fila a Google Sheets.

## Ejecutar localmente
```bash
npm install
cp .env.example .env     # define ADMIN_PASSWORD
npm start                # http://localhost:3000
```
- Página pública: `/`
- Admin: `/admin` (usuario cualquiera, p. ej. `admin`; clave: `ADMIN_PASSWORD`)
- CSV: `/admin/export.csv` · Excel: `/admin/export.xlsx`
- API: `POST /api/solicitudes` (JSON)

## Variables de entorno
| Variable | Descripción |
|---|---|
| `ADMIN_PASSWORD` | **Obligatoria.** Clave del panel admin. |
| `PORT` | Puerto (por defecto 3000; las plataformas lo inyectan). |
| `DATA_DIR` | Carpeta de datos (por defecto `./data`). Ahí viven `solicitudes.json` y `solicitudes.xlsx`. |
| `GOOGLE_SHEETS_WEBHOOK_URL` | URL del Web App de Apps Script. Si está vacía, no se envía nada a Sheets. |
| `GOOGLE_SHEETS_TOKEN` | Secreto compartido con `TOKEN` en `google-apps-script/Code.gs`. |

## Precios y flota
Los precios y las unidades están en `public/vehiculos.json`.

- **Sedán:** `tipos[].precioDia` = `55` → se muestra `$55 / día`.
- **SUV:** `precioDia` en null, `precioDesde` = `60` y `precioHasta` = `85`. El botón del tipo dice `Desde $60 / día` y cada SUV sin precio propio muestra `$60–$85 / día`.
- **Camionetas:** `precioDia` = `90` → `$90 / día`.
- Para un precio fijo de una unidad, pon `precioDia` en ese vehículo. Si sigue en `null`, hereda el precio del tipo o el rango. No escribas un número por modelo si aún no existe.
- Los nombres `[por completar]` son espacios editables, no la flota real. Cambia `nombre`, `imagen` y `specs`.

## Entregas (galería)
Las fotos de `Entregas a nuestros clientes` salen de `public/entregas/entregas.json` y de los archivos en `public/entregas/`.

1. Sustituye `entrega-1.svg` (y las demás) por la foto real, o cambia el campo `imagen`.
2. Escribe la descripción en `titulo`.
3. Pon `"referencial": false` para quitar la leyenda «Imagen referencial». Mientras sea `true`, la foto no se presenta como un cliente real.

## Google Sheets
La hoja ya existe (id `1s_uKwkZUrm7KUX_lQ6FH47KZ4lNG-s5VlBKUU8NyWRc`, pestaña `Solicitudes`). El servidor solo escribe ahí si las dos variables de entorno están definidas. Si faltan, la reserva se guarda igual en JSON y Excel.

1. Abre la hoja de cálculo.
2. Menú **Extensiones → Apps Script**.
3. Borra el código de ejemplo y pega el archivo `google-apps-script/Code.gs` de este repositorio.
4. En la constante `TOKEN`, pon una clave larga. Tiene que ser **la misma** que `GOOGLE_SHEETS_TOKEN` en Render.
5. **Implementar → Nueva implementación → Tipo: Aplicación web**.
6. **Ejecutar como:** Yo · **Quién tiene acceso:** Cualquier persona. Implementar y autorizar.
7. Copia la URL de la aplicación web (`/exec`, no `/dev`).
8. En Render → Environment, pega esa URL en `GOOGLE_SHEETS_WEBHOOK_URL` y la misma clave en `GOOGLE_SHEETS_TOKEN`.

La fila se agrega en este orden: Fecha de registro, Nombre completo, Cédula, Teléfono/WhatsApp, Correo, Tipo de vehículo, Vehículo, Fecha inicio renta, Fecha fin renta, Días, Lugar retiro/entrega, Conductor, Persona a cargo, Método de pago.

## Publicarla en internet
En el plan gratuito de Render el disco es **efímero**: `solicitudes.json` y `solicitudes.xlsx` se pierden al redesplegar o al reiniciar el servicio. Para no perder reservas, monta un disco persistente (plan de pago) en `DATA_DIR` o deja activo el envío a Google Sheets, que vive en la cuenta de Google.

Con el Blueprint (`render.yaml`): Render → New → Blueprint. Servicio web gratuito, Node, build `npm install`, start `npm start`. `ADMIN_PASSWORD` se genera sola. `GOOGLE_SHEETS_WEBHOOK_URL` y `GOOGLE_SHEETS_TOKEN` quedan para completarlas a mano (`sync: false`).

Manual:
1. Web Service, build `npm install`, start `npm start`.
2. Environment: `ADMIN_PASSWORD` y, si hay disco, `DATA_DIR=/var/data`.
3. En un plan de pago, Disk montado en `/var/data`.

**Railway**: `ADMIN_PASSWORD`, `DATA_DIR=/data` y un Volume en `/data`.

**Fly.io**: `fly volumes create datos --size 1`, monta el volumen en `/data`, `DATA_DIR=/data` y `ADMIN_PASSWORD` como secreto.

## Imágenes de la página
`public/images` y `public/og.jpg` son fotografías ilustrativas de vehículos (Unsplash), no la flota. La galería de entregas usa gráficos de relleno hasta que se reemplacen.

## Personalización pendiente
- **WhatsApp**: `WHATSAPP_NUMERO` en `public/script.js` (formato `593XXXXXXXXX`).
- Textos `[por completar]` (dirección, horario, teléfono, condiciones del 10%, política de privacidad, nombres de unidades).
- Colores en `:root` de `public/styles.css` (carbón `#1b1e23`, carmesí `#9f1239`, papel `#f7f4f0`).

## Seguridad / privacidad
- No se piden números de tarjeta; solo el método de pago preferido.
- Validación en cliente y servidor (cédula ecuatoriana módulo 10, teléfono, correo, fechas).
- Admin con HTTP Basic: usa HTTPS en producción. CSV protegido contra inyección de fórmulas.
- Se almacenan datos personales: cumple la LOPDP (política de privacidad, finalidad, derechos de los titulares).
