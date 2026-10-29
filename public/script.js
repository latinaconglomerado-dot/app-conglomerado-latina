// ⚠️ Reemplazar por el número real de WhatsApp, formato internacional sin "+": 593XXXXXXXXX
const WHATSAPP_NUMERO = '[por completar]';
const wa = document.getElementById('wa');
if (/^\d{11,15}$/.test(WHATSAPP_NUMERO)) {
  wa.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent('Hola, quisiera información sobre la renta de vehículos.')}`;
} else {
  wa.addEventListener('click', (e) => { e.preventDefault(); alert('El número de WhatsApp aún no está configurado.'); });
}
document.getElementById('y').textContent = new Date().getFullYear();

function cedulaValida(c) {
  if (!/^\d{10}$/.test(c)) return false;
  const p = +c.slice(0, 2);
  if (!((p >= 1 && p <= 24) || p === 30) || +c[2] > 5) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) { let d = +c[i] * (i % 2 === 0 ? 2 : 1); if (d > 9) d -= 9; s += d; }
  return (10 - (s % 10)) % 10 === +c[9];
}

const form = document.getElementById('form');
const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
form.fechaRetiro.min = hoy; form.fechaEntrega.min = hoy;
form.cedula.addEventListener('input', () => { form.cedula.value = form.cedula.value.replace(/\D/g, '').slice(0, 10); });

// Calcular días / fecha de entrega automáticamente
const dayMs = 86400000;
const dt = (s) => new Date(s + 'T00:00:00Z').getTime();
function porFechas() {
  if (form.fechaRetiro.value && form.fechaEntrega.value && form.fechaEntrega.value >= form.fechaRetiro.value)
    form.dias.value = Math.max(1, Math.round((dt(form.fechaEntrega.value) - dt(form.fechaRetiro.value)) / dayMs));
}
form.fechaRetiro.addEventListener('change', () => { form.fechaEntrega.min = form.fechaRetiro.value || hoy; porFechas(); });
form.fechaEntrega.addEventListener('change', porFechas);

const reglas = {
  nombre: (v) => v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5 || 'Ingresa tu nombre y apellido completos.',
  cedula: (v) => cedulaValida(v) || 'Cédula inválida. Debe tener 10 dígitos válidos.',
  telefono: (v) => { v = v.replace(/[\s-]/g, ''); return /^(\+593|0)?9\d{8}$|^(\+593|0)[2-7]\d{7}$/.test(v) || 'Ingresa un teléfono válido (ej. 0991234567).'; },
  correo: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Ingresa un correo electrónico válido.',
  tipoVehiculo: (v) => !!v || 'Selecciona un tipo de vehículo.',
  dias: (v) => (Number.isInteger(+v) && +v >= 1 && +v <= 365) || 'Ingresa un número de días entre 1 y 365.',
  fechaRetiro: (v) => (!!v && v >= hoy) || 'Selecciona una fecha de retiro válida (hoy o posterior).',
  fechaEntrega: (v) => (!!v && v >= form.fechaRetiro.value) || 'La fecha de entrega debe ser igual o posterior al retiro.',
  lugar: (v) => v.trim().length >= 3 || 'Indica el lugar de retiro/entrega.',
  metodoPago: (v) => !!v || 'Selecciona un método de pago.',
};
function mostrar(name, msg) {
  if (name === 'consentimiento') { form.querySelector('.cerr').textContent = msg || ''; return; }
  const el = form[name]; if (!el) return;
  const l = el.closest('label'); l.classList.toggle('invalid', !!msg); l.querySelector('em').textContent = msg || '';
}
function check(name) { const r = reglas[name](form[name].value); mostrar(name, r === true ? '' : r); return r === true; }
Object.keys(reglas).forEach((n) => form[n].addEventListener('blur', () => check(n)));

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const ok = document.getElementById('ok'), err = document.getElementById('err');
  ok.hidden = err.hidden = true;
  let valido = Object.keys(reglas).map(check).every(Boolean);
  if (!form.consentimiento.checked) { mostrar('consentimiento', 'Debes aceptar el tratamiento de tus datos.'); valido = false; } else mostrar('consentimiento', '');
  if (!valido) { const f = form.querySelector('.invalid input,.invalid select'); if (f) f.focus(); return; }
  const btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'Enviando…';
  const data = Object.fromEntries(Object.keys(reglas).map((n) => [n, form[n].value]));
  data.consentimiento = true;
  try {
    const r = await fetch('/api/solicitudes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const j = await r.json();
    if (r.ok && j.ok) {
      form.reset(); ok.textContent = `¡Gracias! Recibimos tu solicitud (N.º ${j.id}). Nos pondremos en contacto contigo pronto.`; ok.hidden = false; ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      Object.entries(j.errores || {}).forEach(([k, m]) => (k === '_' ? (err.textContent = m, err.hidden = false) : mostrar(k, m)));
      if (!Object.keys(j.errores || {}).length) { err.textContent = 'No se pudo enviar. Intenta de nuevo.'; err.hidden = false; }
    }
  } catch (_) { err.textContent = 'Error de conexión. Intenta de nuevo.'; err.hidden = false; }
  btn.disabled = false; btn.textContent = 'Enviar solicitud';
});
