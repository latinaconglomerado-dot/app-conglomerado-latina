const WHATSAPP_NUMERO = '[por completar]';
function enlazarWhatsApp(el) {
  if (!el) return;
  if (/^\d{11,15}$/.test(WHATSAPP_NUMERO)) {
    el.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent('Hola, quisiera información sobre la renta de vehículos.')}`;
  } else {
    el.addEventListener('click', (e) => { e.preventDefault(); alert('El número de WhatsApp aún no está configurado.'); });
  }
}
enlazarWhatsApp(document.getElementById('wa'));
enlazarWhatsApp(document.getElementById('testimonios-wa'));
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
const dlg = document.getElementById('reserva-dialog');
const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
form.fechaInicio.min = hoy; form.fechaFin.min = hoy;
document.getElementById('selector-fecha').min = hoy;
form.cedula.addEventListener('input', () => { form.cedula.value = form.cedula.value.replace(/\D/g, '').slice(0, 10); });

const dayMs = 86400000;
const dt = (s) => new Date(s + 'T00:00:00Z').getTime();
function porFechas() {
  if (form.fechaInicio.value && form.fechaFin.value && form.fechaFin.value >= form.fechaInicio.value)
    form.dias.value = Math.max(1, Math.round((dt(form.fechaFin.value) - dt(form.fechaInicio.value)) / dayMs));
}
form.fechaInicio.addEventListener('change', () => { form.fechaFin.min = form.fechaInicio.value || hoy; porFechas(); });
form.fechaFin.addEventListener('change', porFechas);
document.getElementById('selector-fecha').addEventListener('change', () => validarSelector());
document.getElementById('selector-conductor').addEventListener('blur', () => { if (document.getElementById('selector-conductor').value) validarSelector(); });

let catalogo = { tipos: [], vehiculos: [] };
let tipoActivo = '';

function setFoto(img, base, sizes) {
  const small = base + '-800.webp';
  const large = base + '-1600.webp';
  img.src = small;
  img.srcset = `${small} 800w, ${large} 1600w`;
  img.sizes = sizes;
  img.width = 1600;
  img.height = 900;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
}
function precioTipo(tipo) {
  if (tipo.precioDia != null) return `$${tipo.precioDia} / día`;
  if (tipo.precioDesde != null) return `Desde $${tipo.precioDesde} / día`;
  return 'Desde $[por definir] / día';
}
function rangoTipo(tipo) {
  if (tipo.precioDia == null && tipo.precioDesde != null && tipo.precioHasta != null) return `$${tipo.precioDesde}–$${tipo.precioHasta} / día`;
  return '';
}
function precioVehiculo(v, tipo) {
  if (v.precioDia != null) return `$${v.precioDia} / día`;
  if (tipo && tipo.precioDesde != null && tipo.precioHasta != null) return `$${tipo.precioDesde}–$${tipo.precioHasta} / día`;
  if (tipo && tipo.precioDia != null) return `$${tipo.precioDia} / día`;
  return 'Desde $[por definir] / día';
}

function renderTipos() {
  const box = document.getElementById('tipos');
  box.replaceChildren();
  catalogo.tipos.forEach((tipo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tcard';
    b.setAttribute('aria-pressed', tipo.id === tipoActivo ? 'true' : 'false');
    const img = document.createElement('img');
    setFoto(img, tipo.imagen, '(min-width: 980px) 340px, (min-width: 720px) 45vw, 100vw');
    const body = document.createElement('span');
    body.className = 'vbody';
    const title = document.createElement('span');
    title.className = 'vtitle';
    title.textContent = tipo.nombre;
    const desc = document.createElement('span');
    desc.className = 'vdesc';
    desc.textContent = tipo.resumen || '';
    const price = document.createElement('span');
    price.className = 'precio';
    price.textContent = precioTipo(tipo);
    body.append(title, desc, price);
    const rango = rangoTipo(tipo);
    if (rango) {
      const r = document.createElement('span');
      r.className = 'rango';
      r.textContent = rango;
      body.append(r);
    }
    const pick = document.createElement('span');
    pick.className = 'pick';
    pick.textContent = tipo.id === tipoActivo ? 'Seleccionado' : 'Elegir';
    const ref = document.createElement('span');
    ref.className = 'cap';
    ref.textContent = 'Imagen referencial';
    body.append(pick, ref);
    b.dataset.id = tipo.id;
    b.append(img, body);
    b.addEventListener('click', () => elegirTipo(tipo.id));
    box.append(b);
  });
  box.onkeydown = (e) => {
    const buttons = [...box.querySelectorAll('.tcard')];
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % buttons.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + buttons.length) % buttons.length;
    if (next >= 0) { e.preventDefault(); buttons[next].focus(); buttons[next].click(); }
  };
}

function marcarTipo(id) {
  tipoActivo = id;
  document.querySelectorAll('#tipos .tcard').forEach((b) => {
    const on = b.dataset.id === id;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const pick = b.querySelector('.pick');
    if (pick) pick.textContent = on ? 'Seleccionado' : 'Elegir';
  });
  const tipo = catalogo.tipos.find((t) => t.id === id);
  document.getElementById('tipo-estado').textContent = tipo ? `${tipo.nombre} seleccionado.` : 'Selecciona un tipo de vehículo.';
}

function nombreConductorOk(v) {
  const n = v.trim().replace(/\s+/g, ' ');
  return n.split(' ').length >= 2 && n.length >= 5 && n.length <= 100 && /^[\p{L}][\p{L}\s'.-]+$/u.test(n);
}

function validarSelector() {
  const fecha = document.getElementById('selector-fecha');
  const cond = document.getElementById('selector-conductor');
  const fe = document.getElementById('selector-fecha-err');
  const ce = document.getElementById('selector-conductor-err');
  let ok = true;
  if (!tipoActivo) {
    document.getElementById('tipo-estado').textContent = 'Selecciona un tipo de vehículo.';
    ok = false;
  }
  if (!fecha.value || fecha.value < hoy) {
    fe.textContent = 'Selecciona una fecha válida (hoy o posterior).';
    fecha.closest('label').classList.add('invalid');
    ok = false;
  } else {
    fe.textContent = '';
    fecha.closest('label').classList.remove('invalid');
  }
  if (!nombreConductorOk(cond.value)) {
    ce.textContent = 'Ingresa el nombre y apellido del conductor.';
    cond.closest('label').classList.add('invalid');
    ok = false;
  } else {
    ce.textContent = '';
    cond.closest('label').classList.remove('invalid');
  }
  return ok;
}

function elegirTipo(id) {
  marcarTipo(id);
  const tipo = catalogo.tipos.find((t) => t.id === id);
  const wrap = document.getElementById('flota-wrap');
  const list = document.getElementById('flota');
  document.getElementById('flota-titulo').textContent = tipo ? `Unidades · ${tipo.nombre}` : 'Unidades';
  list.replaceChildren();
  catalogo.vehiculos.filter((v) => v.tipo === id).forEach((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tcard';
    const img = document.createElement('img');
    setFoto(img, v.imagen, '(min-width: 980px) 340px, (min-width: 720px) 45vw, 100vw');
    const body = document.createElement('span');
    body.className = 'vbody';
    const title = document.createElement('span');
    title.className = 'vtitle';
    title.textContent = v.nombre;
    const specs = document.createElement('span');
    specs.className = 'vdesc';
    specs.textContent = v.specs || '';
    const price = document.createElement('span');
    price.className = 'precio';
    price.textContent = precioVehiculo(v, tipo);
    const pick = document.createElement('span');
    pick.className = 'pick';
    pick.textContent = 'Elegir';
    const ref = document.createElement('span');
    ref.className = 'cap';
    ref.textContent = 'Imagen referencial';
    body.append(title, specs, price, pick, ref);
    b.append(img, body);
    b.addEventListener('click', () => abrirReserva(v, tipo, b));
    list.append(b);
  });
  wrap.hidden = false;
}

function abrirReserva(v, tipo, origen) {
  if (!validarSelector()) {
    const bad = document.querySelector('#selector .invalid input');
    if (!tipoActivo) document.querySelector('#tipos .tcard')?.focus();
    else if (bad) bad.focus();
    return;
  }
  form.vehiculoId.value = v.id;
  form.fechaInicio.value = document.getElementById('selector-fecha').value;
  form.fechaFin.min = form.fechaInicio.value || hoy;
  if (form.fechaFin.value && form.fechaFin.value < form.fechaInicio.value) form.fechaFin.value = '';
  form.conductor.value = document.getElementById('selector-conductor').value.trim().replace(/\s+/g, ' ');
  porFechas();
  document.getElementById('vehiculo-elegido').textContent = `${tipo.nombre} · ${v.nombre} · ${precioVehiculo(v, tipo)}`;
  document.getElementById('vehiculo-error').textContent = '';
  dlg.dataset.origen = '';
  dlg._origen = origen;
  if (!dlg.open) dlg.showModal();
  form.nombre.focus();
}

document.getElementById('cerrar-reserva').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => { if (dlg._origen) dlg._origen.focus(); });

const reglas = {
  vehiculoId: (v) => !!v || 'Elige un vehículo de la lista.',
  nombre: (v) => v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5 || 'Ingresa tu nombre y apellido completos.',
  cedula: (v) => cedulaValida(v) || 'Cédula inválida. Debe tener 10 dígitos válidos.',
  telefono: (v) => { v = v.replace(/[\s-]/g, ''); return /^(\+593|0)?9\d{8}$|^(\+593|0)[2-7]\d{7}$/.test(v) || 'Ingresa un teléfono válido (ej. 0991234567).'; },
  correo: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Ingresa un correo electrónico válido.',
  conductor: (v) => nombreConductorOk(v) || 'Ingresa el nombre y apellido del conductor.',
  encargado: (v) => v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5 || 'Ingresa el nombre y apellido de la persona a cargo.',
  dias: (v) => (Number.isInteger(+v) && +v >= 1 && +v <= 365) || 'Ingresa un número de días entre 1 y 365.',
  fechaInicio: (v) => (!!v && v >= hoy) || 'Selecciona una fecha de inicio válida (hoy o posterior).',
  fechaFin: (v) => (!!v && v >= form.fechaInicio.value) || 'La fecha de fin debe ser igual o posterior al inicio.',
  lugar: (v) => v.trim().length >= 3 || 'Indica el lugar de retiro/entrega.',
  metodoPago: (v) => !!v || 'Selecciona un método de pago.',
};
function mostrar(name, msg) {
  if (name === 'consentimiento') { form.querySelector('.cerr').textContent = msg || ''; return; }
  if (name === 'vehiculoId') { document.getElementById('vehiculo-error').textContent = msg || ''; return; }
  const el = form[name]; if (!el) return;
  const l = el.closest('label'); if (!l) return;
  l.classList.toggle('invalid', !!msg);
  const em = l.querySelector('em'); if (em) em.textContent = msg || '';
}
function check(name) { const r = reglas[name](form[name].value); mostrar(name, r === true ? '' : r); return r === true; }
Object.keys(reglas).forEach((n) => { if (form[n]) form[n].addEventListener('blur', () => check(n)); });

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const ok = document.getElementById('ok'), err = document.getElementById('err');
  ok.hidden = err.hidden = true;
  let valido = Object.keys(reglas).map(check).every(Boolean);
  if (!form.consentimiento.checked) { mostrar('consentimiento', 'Debes aceptar el tratamiento de tus datos.'); valido = false; } else mostrar('consentimiento', '');
  if (!valido) { const f = form.querySelector('.invalid input,.invalid select'); if (f) f.focus(); return; }
  const btn = document.getElementById('enviar');
  btn.disabled = true; btn.textContent = 'Enviando…';
  const data = Object.fromEntries(Object.keys(reglas).map((n) => [n, form[n].value]));
  data.consentimiento = true;
  data.premioRuleta = document.getElementById('premio-ruleta').value;
  try {
    const r = await fetch('/api/solicitudes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const j = await r.json();
    if (r.ok && j.ok) {
      form.reset();
      form.fechaInicio.min = hoy; form.fechaFin.min = hoy;
      document.getElementById('vehiculo-elegido').textContent = 'Solicitud registrada.';
      ok.textContent = `¡Gracias! Recibimos tu solicitud (N.º ${j.id}). Nos pondremos en contacto contigo pronto.`;
      ok.hidden = false;
    } else {
      Object.entries(j.errores || {}).forEach(([k, m]) => (k === '_' ? (err.textContent = m, err.hidden = false) : mostrar(k, m)));
      if (!Object.keys(j.errores || {}).length) { err.textContent = 'No se pudo enviar. Intenta de nuevo.'; err.hidden = false; }
    }
  } catch (_) { err.textContent = 'Error de conexión. Intenta de nuevo.'; err.hidden = false; }
  btn.disabled = false; btn.textContent = 'Enviar solicitud';
});

fetch('/vehiculos.json').then((r) => r.json()).then((data) => {
  catalogo = data;
  renderTipos();
}).catch(() => {
  document.getElementById('tipos').textContent = 'No se pudo cargar la lista de vehículos.';
});

const light = document.getElementById('lightbox');
document.getElementById('cerrar-light').addEventListener('click', () => light.close());
fetch('/entregas/entregas.json').then((r) => r.json()).then((data) => {
  const box = document.getElementById('galeria');
  (data.items || []).forEach((item) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shot';
    const img = document.createElement('img');
    setFoto(img, item.imagen, '(min-width: 980px) 340px, (min-width: 720px) 45vw, 100vw');
    const cap = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = item.titulo;
    cap.append(title);
    if (item.referencial) {
      const note = document.createElement('span');
      note.className = 'cap';
      note.textContent = 'Imagen referencial';
      cap.append(note);
    }
    b.append(img, cap);
    b.addEventListener('click', () => {
      const pic = document.getElementById('light-img');
      setFoto(pic, item.imagen, 'min(960px, calc(100vw - 48px))');
      pic.loading = 'eager';
      pic.alt = item.referencial ? 'Imagen referencial' : (item.titulo || '');
      document.getElementById('light-titulo').textContent = item.titulo || '';
      document.getElementById('light-cap').textContent = item.referencial ? 'Imagen referencial' : '';
      light._origen = b;
      light.showModal();
    });
    box.append(b);
  });
}).catch(() => {});
light.addEventListener('close', () => { if (light._origen) light._origen.focus(); });

fetch('/empresa.json').then((r) => r.json()).then((data) => {
  const n = data && data.vehiculosEnFlota;
  if (!Number.isInteger(n) || n < 1) return;
  document.getElementById('stat-flota-num').textContent = String(n);
  const li = document.getElementById('stat-flota');
  li.hidden = false;
  li.parentElement.classList.add('has-flota');
}).catch(() => {});

fetch('/testimonios.json').then((r) => r.json()).then((data) => {
  const items = (data.items || []).filter((t) => t && String(t.texto || '').trim() && String(t.nombre || '').trim());
  if (!items.length) return;
  const list = document.getElementById('testimonios');
  document.getElementById('testimonios-vacio').hidden = true;
  list.hidden = false;
  items.forEach((t) => {
    const li = document.createElement('li');
    const quote = document.createElement('p');
    quote.className = 'ph';
    quote.textContent = String(t.texto).trim();
    const who = document.createElement('p');
    who.className = 'who';
    who.textContent = [String(t.nombre).trim(), String(t.ciudad || '').trim()].filter(Boolean).join(' · ');
    li.append(quote, who);
    const video = String(t.video || '').trim();
    if (/^https:\/\//.test(video)) {
      const a = document.createElement('a');
      a.className = 'quote-video';
      a.href = video;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Ver reseña en video';
      li.append(a);
    }
    list.append(li);
  });
}).catch(() => {});

fetch('/alianzas.json').then((r) => r.json()).then((data) => {
  const items = (data.items || []).filter((a) => a && String(a.nombre || '').trim());
  if (!items.length) return;
  const section = document.getElementById('alianzas');
  const list = document.getElementById('alianzas-list');
  items.forEach((item) => {
    const li = document.createElement('li');
    const url = String(item.url || '').trim();
    const box = /^https:\/\//.test(url) ? document.createElement('a') : document.createElement('span');
    if (box.tagName === 'A') { box.href = url; box.target = '_blank'; box.rel = 'noopener'; }
    const logo = String(item.logo || '').trim();
    if (logo) {
      const img = document.createElement('img');
      img.src = logo;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      box.append(img);
    }
    const name = document.createElement('span');
    name.textContent = String(item.nombre).trim();
    box.append(name);
    li.append(box);
    list.append(li);
  });
  section.hidden = false;
}).catch(() => {});

const SEGMENTOS = [
  { corto: '10%', premio: '10% de descuento', fondo: '#9f1239', tinta: '#ffffff' },
  { corto: '20%', premio: '20% de descuento', fondo: '#1b1e23', tinta: '#ffd6de' },
  { corto: '10%', premio: '10% de descuento', fondo: '#9f1239', tinta: '#ffffff' },
  { corto: '20%', premio: '20% de descuento', fondo: '#1b1e23', tinta: '#ffd6de' },
  { corto: '1 día gratis', premio: '1 día gratis de renta', fondo: '#ffd6de', tinta: '#1b1e23' },
];
const RULETA_CLAVE = 'rce-ruleta-v1';
const lienzo = document.getElementById('ruleta');
const btnGirar = document.getElementById('girar');
const dlgRuleta = document.getElementById('ruleta-dialog');

function dibujarRuleta() {
  const ctx = lienzo.getContext('2d');
  const n = SEGMENTOS.length;
  const arco = (Math.PI * 2) / n;
  const cx = lienzo.width / 2;
  const r = cx - 6;
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  ctx.save();
  ctx.translate(cx, cx);
  ctx.rotate(-Math.PI / 2);
  SEGMENTOS.forEach((seg, i) => {
    const a0 = i * arco;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a0 + arco);
    ctx.closePath();
    ctx.fillStyle = seg.fondo;
    ctx.fill();
    ctx.save();
    ctx.rotate(a0 + arco / 2);
    ctx.fillStyle = seg.tinta;
    ctx.font = '700 26px Manrope, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(seg.corto, r - 28, 0);
    ctx.restore();
  });
  ctx.beginPath();
  ctx.arc(0, 0, 42, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}
function anguloSegmento(i) {
  const centro = (i + 0.5) * (360 / SEGMENTOS.length);
  return 360 * 5 + (360 - centro);
}
function guardarPremio(premio) {
  document.getElementById('premio-ruleta').value = premio;
  const aviso = document.getElementById('premio-aviso');
  aviso.hidden = false;
  aviso.textContent = `Premio ruleta: ${premio}`;
}
function mostrarPremio(premio) {
  document.getElementById('ruleta-resultado').textContent = premio;
  document.getElementById('ruleta-estado').textContent = `Tu premio: ${premio}`;
  if (!dlgRuleta.open) dlgRuleta.showModal();
  document.getElementById('ruleta-reservar').focus();
}
function aplicarGiroGuardado(guardado) {
  lienzo.style.transition = 'none';
  lienzo.style.transform = `rotate(${anguloSegmento(guardado.indice)}deg)`;
  guardarPremio(guardado.premio);
  btnGirar.disabled = true;
  btnGirar.textContent = 'Ya usaste tu giro';
  document.getElementById('ruleta-estado').textContent = `Tu premio: ${guardado.premio}`;
}
dibujarRuleta();
try {
  const previo = JSON.parse(localStorage.getItem(RULETA_CLAVE) || 'null');
  if (previo && SEGMENTOS[previo.indice] && SEGMENTOS[previo.indice].premio === previo.premio) aplicarGiroGuardado(previo);
} catch (_) {}
btnGirar.addEventListener('click', async () => {
  if (btnGirar.disabled) return;
  btnGirar.disabled = true;
  document.getElementById('ruleta-estado').textContent = 'Girando…';
  try {
    const r = await fetch('/api/ruleta', { method: 'POST' });
    const j = await r.json();
    if (!r.ok || !SEGMENTOS[j.indice] || SEGMENTOS[j.indice].premio !== j.premio) throw new Error('ruleta');
    localStorage.setItem(RULETA_CLAVE, JSON.stringify({ indice: j.indice, premio: j.premio }));
    guardarPremio(j.premio);
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const terminar = () => {
      btnGirar.textContent = 'Ya usaste tu giro';
      mostrarPremio(j.premio);
    };
    if (reducido) {
      lienzo.style.transition = 'none';
      lienzo.style.transform = `rotate(${anguloSegmento(j.indice)}deg)`;
      terminar();
      return;
    }
    lienzo.style.transition = 'none';
    void lienzo.offsetWidth;
    lienzo.style.transition = '';
    lienzo.style.transform = `rotate(${anguloSegmento(j.indice)}deg)`;
    lienzo.addEventListener('transitionend', terminar, { once: true });
  } catch (_) {
    btnGirar.disabled = false;
    document.getElementById('ruleta-estado').textContent = 'No se pudo girar. Intenta de nuevo.';
  }
});
document.getElementById('ruleta-cerrar').addEventListener('click', () => dlgRuleta.close());
document.getElementById('ruleta-reservar').addEventListener('click', () => dlgRuleta.close());
dlgRuleta.addEventListener('close', () => btnGirar.focus());

const navToggle = document.getElementById('nav-toggle');
const siteNav = document.getElementById('site-nav');
if (navToggle && siteNav) {
  const label = navToggle.querySelector('.sr-only');
  const setOpen = (open) => {
    siteNav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (label) label.textContent = open ? 'Cerrar menú' : 'Abrir menú';
  };
  navToggle.addEventListener('click', () => setOpen(!siteNav.classList.contains('open')));
  siteNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && siteNav.classList.contains('open') && !dlg.open && !light.open) { setOpen(false); navToggle.focus(); }
  });
}

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce || !('IntersectionObserver' in window)) {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}
