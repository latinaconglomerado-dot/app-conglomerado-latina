const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
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

const TIPOS = ['Sedán', 'SUV', 'Camioneta', 'Van'];
const PAGOS = ['Efectivo', 'Transferencia', 'Tarjeta de crédito/débito', 'Otro'];

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
  d.tipoVehiculo = t('tipoVehiculo');
  if (!TIPOS.includes(d.tipoVehiculo)) e.tipoVehiculo = 'Selecciona un tipo de vehículo.';
  d.dias = parseInt(b.dias, 10);
  if (!Number.isInteger(d.dias) || d.dias < 1 || d.dias > 365) e.dias = 'Ingresa un número de días entre 1 y 365.';
  d.fechaRetiro = t('fechaRetiro'); d.fechaEntrega = t('fechaEntrega');
  if (!esFecha(d.fechaRetiro) || d.fechaRetiro < hoy()) e.fechaRetiro = 'Selecciona una fecha de retiro válida (hoy o posterior).';
  if (!esFecha(d.fechaEntrega) || (esFecha(d.fechaRetiro) && d.fechaEntrega < d.fechaRetiro)) e.fechaEntrega = 'La fecha de entrega debe ser igual o posterior al retiro.';
  d.lugar = t('lugar');
  if (d.lugar.length < 3 || d.lugar.length > 200) e.lugar = 'Indica el lugar de retiro/entrega.';
  d.metodoPago = t('metodoPago');
  if (!PAGOS.includes(d.metodoPago)) e.metodoPago = 'Selecciona un método de pago.';
  if (b.consentimiento !== true && b.consentimiento !== 'true' && b.consentimiento !== 'on') e.consentimiento = 'Debes aceptar el tratamiento de tus datos.';
  return { e, d };
}

app.post('/api/solicitudes', limitar, (req, res) => {
  const { e, d } = validar(req.body || {});
  if (Object.keys(e).length) return res.status(400).json({ ok: false, errores: e });
  const rows = leer();
  const reg = { id: rows.length ? rows[rows.length - 1].id + 1 : 1, creado: new Date().toISOString(), ...d, consentimiento: true };
  rows.push(reg); guardar(rows);
  res.status(201).json({ ok: true, id: reg.id });
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
  res.set('WWW-Authenticate', 'Basic realm="Admin Conglomerado Latina"').status(401).send('Acceso restringido');
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fechaEC = (iso) => new Date(iso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });

app.get('/admin', auth, (req, res) => {
  const rows = leer().slice().reverse();
  const tr = rows.map((r) => `<tr><td>${r.id}</td><td>${esc(fechaEC(r.creado))}</td><td>${esc(r.nombre)}</td><td>${esc(r.cedula)}</td><td>${esc(r.telefono)}</td><td>${esc(r.correo)}</td><td>${esc(r.tipoVehiculo)}</td><td>${r.dias}</td><td>${esc(r.fechaRetiro)}</td><td>${esc(r.fechaEntrega)}</td><td>${esc(r.lugar)}</td><td>${esc(r.metodoPago)}</td></tr>`).join('');
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin · Conglomerado Latina</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f4f6f8;color:#16202a}header{background:#0b2545;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
a.btn{background:#f5a623;color:#0b2545;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:700}main{padding:20px}.w{overflow:auto;background:#fff;border-radius:10px;box-shadow:0 1px 4px #0002}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:9px 12px;border-bottom:1px solid #e5e9ee;text-align:left;white-space:nowrap}th{background:#eef2f6;position:sticky;top:0}</style></head><body>
<header><h1 style="margin:0;font-size:20px">Solicitudes de clientes (${rows.length})</h1><a class="btn" href="/admin/export.csv">Exportar CSV</a></header>
<main><div class="w"><table><thead><tr><th>#</th><th>Fecha registro</th><th>Nombre</th><th>Cédula</th><th>Teléfono</th><th>Correo</th><th>Vehículo</th><th>Días</th><th>Retiro</th><th>Entrega</th><th>Lugar</th><th>Pago</th></tr></thead><tbody>${tr || '<tr><td colspan="12">Aún no hay solicitudes.</td></tr>'}</tbody></table></div></main></body></html>`);
});

app.get('/admin/export.csv', auth, (req, res) => {
  const cols = ['id', 'creado', 'nombre', 'cedula', 'telefono', 'correo', 'tipoVehiculo', 'dias', 'fechaRetiro', 'fechaEntrega', 'lugar', 'metodoPago', 'consentimiento'];
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita inyección de fórmulas
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = '\ufeff' + [cols.join(',')].concat(leer().map((r) => cols.map((c) => cell(r[c])).join(','))).join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="solicitudes.csv"' }).send(csv);
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));
app.listen(PORT, '0.0.0.0', () => console.log('Servidor en puerto ' + PORT));
