// Validación de cédula ecuatoriana (10 dígitos, módulo 10)
function validarCedula(c) {
  if (!/^\d{10}$/.test(c)) return false;
  const prov = parseInt(c.slice(0, 2), 10);
  if (!((prov >= 1 && prov <= 24) || prov === 30)) return false;
  if (parseInt(c[2], 10) > 5) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let d = parseInt(c[i], 10) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    suma += d;
  }
  const verif = (10 - (suma % 10)) % 10;
  return verif === parseInt(c[9], 10);
}
module.exports = { validarCedula };
