const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const ExcelJS = require('exceljs');
const { validarCedula } = require('./validators');

// Cargar .env sin dependencias extra
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  });
} catch (_) {}

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { console.error('Falta ADMIN_PASSWORD'); process.exit(1); }
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'solicitudes.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

function leer() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) { return []; }
}
function guardar(rows) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const PAGOS = ['Efectivo', 'Transferencia', 'Tarjeta de crédito/débito', 'Otro'];
const CATALOGO = path.join(__dirname, 'public', 'vehiculos.json');
const XLSX_FILE = path.join(DATA_DIR, 'solicitudes.xlsx');
const ENCABEZADOS = ['Fecha de registro', 'Nombre completo', 'Cédula', 'Teléfono/WhatsApp', 'Correo', 'Tipo de vehículo', 'Vehículo', 'Fecha inicio renta', 'Fecha fin renta', 'Días', 'Lugar retiro/entrega', 'Conductor', 'Persona a cargo', 'Método de pago', 'Precio', 'Consentimiento'];

function catalogo() {
  return JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
}
function precioDe(tipo, vehiculo) {
  if (vehiculo && vehiculo.precioDia != null) return `$${vehiculo.precioDia} / día`;
  if (tipo && tipo.precioDesde != null && tipo.precioHasta != null) return `$${tipo.precioDesde}–$${tipo.precioHasta} / día`;
  if (tipo && tipo.precioDia != null) return `$${tipo.precioDia} / día`;
  return 'Desde $[por definir] / día';
}
function filaExport(r) {
  return [
    r.creado ? fechaEC(r.creado) : '',
    r.nombre ?? '',
    r.cedula ?? '',
    r.telefono ?? '',
    r.correo ?? '',
    r.tipo ?? r.tipoVehiculo ?? '',
    r.vehiculo ?? '',
    r.fechaInicio ?? r.fechaRetiro ?? '',
    r.fechaFin ?? r.fechaEntrega ?? '',
    r.dias ?? '',
    r.lugar ?? '',
    r.conductor ?? '',
    r.encargado ?? '',
    r.metodoPago ?? '',
    r.precio ?? '',
    r.consentimiento ? 'sí' : 'no',
  ];
}
async function escribirExcel(rows) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Solicitudes');
  sheet.addRow(ENCABEZADOS);
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(filaExport(r)));
  sheet.columns.forEach((c) => { c.width = 22; });
  await wb.xlsx.writeFile(XLSX_FILE);
}
function notificarHoja(reg) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const token = process.env.GOOGLE_SHEETS_TOKEN;
  if (!url || !token) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const body = {
    token,
    fechaRegistro: fechaEC(reg.creado),
    nombre: reg.nombre,
    cedula: reg.cedula,
    telefono: reg.telefono,
    correo: reg.correo,
    tipo: reg.tipo,
    vehiculo: reg.vehiculo,
    fechaInicio: reg.fechaInicio,
    fechaFin: reg.fechaFin,
    dias: reg.dias,
    lugar: reg.lugar,
    conductor: reg.conductor,
    encargado: reg.encargado,
    metodoPago: reg.metodoPago,
  };
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  }).then(async (r) => {
    if (!r.ok) console.error('Google Sheets webhook', r.status);
  }).catch((err) => {
    console.error('Google Sheets webhook', err.message);
  }).finally(() => clearTimeout(timer));
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});

// Límite simple de envíos por IP
const hits = new Map();
function limitar(req, res, next) {
  const now = Date.now(), k = req.ip;
  const arr = (hits.get(k) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (arr.length >= 10) return res.status(429).json({ ok: false, errores: { _: 'Demasiados envíos. Intenta más tarde.' } });
  arr.push(now); hits.set(k, arr); next();
}

const hoy = () => new Date().toISOString().slice(0, 10);
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));

function validar(b) {
  const e = {}, d = {};
  const t = (k) => (typeof b[k] === 'string' ? b[k].trim() : '');
  d.nombre = t('nombre').replace(/\s+/g, ' ');
  if (d.nombre.length < 5 || d.nombre.length > 100 || !/^[\p{L}][\p{L}\s'.-]+$/u.test(d.nombre) || d.nombre.split(' ').length < 2)
    e.nombre = 'Ingresa tu nombre y apellido completos.';
  d.cedula = t('cedula');
  if (!validarCedula(d.cedula)) e.cedula = 'Cédula inválida. Debe tener 10 dígitos válidos.';
  d.telefono = t('telefono').replace(/[\s-]/g, '');
  if (!/^(\+593|0)?9\d{8}$|^(\+593|0)[2-7]\d{7}$/.test(d.telefono)) e.telefono = 'Ingresa un teléfono válido (ej. 0991234567).';
  d.correo = t('correo').toLowerCase();
  if (d.correo.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo)) e.correo = 'Ingresa un correo electrónico válido.';
  d.conductor = t('conductor').replace(/\s+/g, ' ');
  if (d.conductor.length < 5 || d.conductor.length > 100 || !/^[\p{L}][\p{L}\s'.-]+$/u.test(d.conductor) || d.conductor.split(' ').length < 2)
    e.conductor = 'Ingresa el nombre y apellido del conductor.';
  d.encargado = t('encargado').replace(/\s+/g, ' ');
  if (d.encargado.length < 5 || d.encargado.length > 100 || !/^[\p{L}][\p{L}\s'.-]+$/u.test(d.encargado) || d.encargado.split(' ').length < 2)
    e.encargado = 'Ingresa el nombre y apellido de la persona a cargo.';
  const cat = catalogo();
  const veh = (cat.vehiculos || []).find((v) => v.id === t('vehiculoId'));
  const tipo = veh && (cat.tipos || []).find((tp) => tp.id === veh.tipo);
  if (!veh || !tipo) e.vehiculoId = 'Elige un vehículo de la lista.';
  else {
    d.vehiculoId = veh.id;
    d.tipo = tipo.nombre;
    d.vehiculo = veh.nombre;
    d.precio = precioDe(tipo, veh);
  }
  d.fechaInicio = t('fechaInicio'); d.fechaFin = t('fechaFin');
  if (!esFecha(d.fechaInicio) || d.fechaInicio < hoy()) e.fechaInicio = 'Selecciona una fecha de inicio válida (hoy o posterior).';
  if (!esFecha(d.fechaFin) || (esFecha(d.fechaInicio) && d.fechaFin < d.fechaInicio)) e.fechaFin = 'La fecha de fin debe ser igual o posterior al inicio.';
  const diasEnviados = parseInt(b.dias, 10);
  const diasOk = Number.isInteger(diasEnviados) && diasEnviados >= 1 && diasEnviados <= 365;
  if (!e.fechaInicio && !e.fechaFin) {
    const diff = Math.round((Date.parse(d.fechaFin + 'T00:00:00Z') - Date.parse(d.fechaInicio + 'T00:00:00Z')) / 86400000);
    const calculados = Math.max(1, diff);
    d.dias = diasOk ? diasEnviados : calculados;
    if (d.dias > 365) e.dias = 'La renta no puede superar 365 días.';
  } else {
    d.dias = diasEnviados;
    if (!diasOk) e.dias = 'Ingresa un número de días entre 1 y 365.';
  }
  d.lugar = t('lugar');
  if (d.lugar.length < 3 || d.lugar.length > 200) e.lugar = 'Indica el lugar de retiro/entrega.';
  d.metodoPago = t('metodoPago');
  if (!PAGOS.includes(d.metodoPago)) e.metodoPago = 'Selecciona un método de pago.';
  if (b.consentimiento !== true && b.consentimiento !== 'true' && b.consentimiento !== 'on') e.consentimiento = 'Debes aceptar el tratamiento de tus datos.';
  return { e, d };
}

app.post('/api/solicitudes', limitar, async (req, res) => {
  const { e, d } = validar(req.body || {});
  if (Object.keys(e).length) return res.status(400).json({ ok: false, errores: e });
  const rows = leer();
  const reg = { id: rows.length ? rows[rows.length - 1].id + 1 : 1, creado: new Date().toISOString(), ...d, consentimiento: true };
  rows.push(reg);
  guardar(rows);
  try {
    await escribirExcel(rows);
  } catch (err) {
    console.error('Excel', err);
    rows.pop();
    guardar(rows);
    return res.status(500).json({ ok: false, errores: { _: 'No se pudo guardar la solicitud. Intenta de nuevo.' } });
  }
  res.status(201).json({ ok: true, id: reg.id });
  notificarHoja(reg);
});

// ---- Admin (HTTP Basic) ----
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const [scheme, val] = h.split(' ');
  if (scheme === 'Basic' && val) {
    const pass = Buffer.from(val, 'base64').toString().split(':').slice(1).join(':');
    const a = crypto.createHash('sha256').update(pass).digest();
    const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    if (crypto.timingSafeEqual(a, b)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Admin Renta Car Ecuador"').status(401).send('Acceso restringido');
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fechaEC = (iso) => new Date(iso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });

app.get('/admin', auth, (req, res) => {
  const rows = leer().slice().reverse();
  const tr = rows.map((r) => {
    const celdas = filaExport(r).map((v) => `<td>${esc(v)}</td>`).join('');
    return `<tr><td>${r.id}</td>${celdas}</tr>`;
  }).join('');
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin · Renta Car Ecuador</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f7f4f0;color:#1b1e23}header{background:#1b1e23;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
.acciones{display:flex;gap:8px;flex-wrap:wrap}a.btn{background:#9f1239;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:700}main{padding:20px}.w{overflow:auto;background:#fff;border-radius:10px;box-shadow:0 1px 4px #0002}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:9px 12px;border-bottom:1px solid #e6e1da;text-align:left;white-space:nowrap}th{background:#f3eeea;position:sticky;top:0}</style></head><body>
<header><h1 style="margin:0;font-size:20px">Solicitudes (${rows.length})</h1><div class="acciones"><a class="btn" href="/admin/export.csv">Exportar CSV</a><a class="btn" href="/admin/export.xlsx">Descargar Excel</a></div></header>
<main><div class="w"><table><thead><tr><th>#</th>${ENCABEZADOS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tr || `<tr><td colspan="${ENCABEZADOS.length + 1}">Aún no hay solicitudes.</td></tr>`}</tbody></table></div></main></body></html>`);
});

app.get('/admin/export.csv', auth, (req, res) => {
  const cols = ENCABEZADOS;
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita inyección de fórmulas
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = '\ufeff' + [cols.join(',')].concat(leer().map((r) => filaExport(r).map(cell).join(','))).join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="solicitudes.csv"' }).send(csv);
});

app.get('/admin/export.xlsx', auth, async (req, res) => {
  try {
    const rows = leer();
    await escribirExcel(rows);
    res.download(XLSX_FILE, 'solicitudes.xlsx');
  } catch (err) {
    console.error('Excel', err);
    res.status(500).send('No se pudo generar el Excel');
  }
});

function paginaInicio(req, res) {
  const host = String(req.get('host') || '').replace(/[^a-zA-Z0-9.:-]/g, '');
  const proto = req.protocol === 'https' ? 'https' : 'http';
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8')
    .replaceAll('__ORIGIN__', `${proto}://${host}`);
  res.set('Cache-Control', 'no-cache').type('html').send(html);
}
app.get(['/', '/index.html'], paginaInicio);

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (/\.(webp|jpg|woff2|svg)$/.test(filePath)) res.set('Cache-Control', 'public, max-age=86400');
  },
}));
app.get('/health', (_, res) => res.json({ ok: true }));
app.listen(PORT, '0.0.0.0', () => console.log('Servidor en puerto ' + PORT));
