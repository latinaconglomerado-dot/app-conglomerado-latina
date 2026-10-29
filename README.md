# Conglomerado Latina – Landing + formulario de clientes

App web en español (Ecuador): página promocional + formulario de reserva validado + panel `/admin` con exportación CSV.
Stack: Node.js (≥18) + Express. Los datos se guardan en un archivo JSON (`data/solicitudes.json`) con marca de tiempo.

## Ejecutar localmente
```bash
npm install
cp .env.example .env     # y define ADMIN_PASSWORD (ya existe un .env generado en este equipo)
npm start                # http://localhost:3000
```
- Página pública: `/`
- Admin: `/admin` (usuario: cualquiera, p. ej. `admin`; clave: `ADMIN_PASSWORD`) · CSV: `/admin/export.csv`
- API: `POST /api/solicitudes` (JSON)

## Variables de entorno
| Variable | Descripción |
|---|---|
| `ADMIN_PASSWORD` | **Obligatoria.** Clave del panel admin. |
| `PORT` | Puerto (por defecto 3000; las plataformas lo inyectan). |
| `DATA_DIR` | Carpeta de datos (por defecto `./data`). En producción apúntala a un disco persistente. |

## Publicarla en internet
> Importante: el archivo JSON necesita **almacenamiento persistente**; si no, los datos se pierden en cada despliegue.

**Render** (recomendado, simple)

Con el Blueprint incluido (`render.yaml`): Render → New → Blueprint → conecta este repo. Crea un servicio web gratuito (Node) con build `npm install`, start `npm start` y genera `ADMIN_PASSWORD` solo.

Manual, si prefieres configurarlo a mano:
1. Sube la carpeta a un repo de GitHub (`.env` y `data/` están en `.gitignore`).
2. Render → New → Web Service → conecta el repo. Build: `npm install` · Start: `npm start`.
3. En *Environment* agrega `ADMIN_PASSWORD` y `DATA_DIR=/var/data`.
4. En *Disks* agrega un disco montado en `/var/data` (plan de pago). Deploy.

**Railway**: New Project → Deploy from GitHub. Variables: `ADMIN_PASSWORD`, `DATA_DIR=/data`. Agrega un *Volume* montado en `/data`.

**Fly.io**: `fly launch`, `fly volumes create datos --size 1`, en `fly.toml` monta `[mounts] source="datos" destination="/data"`, `fly secrets set ADMIN_PASSWORD=... ` y `fly.toml` `[env] DATA_DIR="/data"`. `fly deploy`.

Luego puedes conectar un dominio propio desde el panel de la plataforma (HTTPS incluido).

## Personalización pendiente
- **WhatsApp**: edita `WHATSAPP_NUMERO` en `public/script.js` (formato `593XXXXXXXXX`).
- Textos `[por completar]` en `public/index.html` (dirección, horario, teléfono, historia, condiciones del 10%, política de privacidad).
- Logo (reemplaza el cuadro "CL" en `index.html`/`styles.css`) y colores (variables `:root` en `public/styles.css`).
- Tarifas por tipo de vehículo.

## Seguridad / privacidad
- No se piden números de tarjeta; solo el método de pago preferido.
- Validación en cliente y servidor (cédula ecuatoriana módulo 10, teléfono, correo, fechas).
- Admin con HTTP Basic: usa HTTPS en producción. CSV protegido contra inyección de fórmulas.
- Se almacenan datos personales: cumple la LOPDP (política de privacidad, finalidad, derechos de los titulares).
