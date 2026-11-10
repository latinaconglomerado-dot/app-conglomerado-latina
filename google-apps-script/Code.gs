const SPREADSHEET_ID = '1s_uKwkZUrm7KUX_lQ6FH47KZ4lNG-s5VlBKUU8NyWRc';
const SHEET_NAME = 'Solicitudes';
const TOKEN_PROPERTY = 'GOOGLE_SHEETS_TOKEN';

function textoSeguro(valor) {
  if (typeof valor !== 'string' || !valor) return '';
  return /^\s*[=+@-]/.test(valor) ? "'" + valor : valor;
}

function doPost(e) {
  const out = (obj) => ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
    if (!token || body.token !== token) {
      return out({ ok: false, error: 'unauthorized' });
    }
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return out({ ok: false, error: 'sheet' });
    sheet.appendRow([
      textoSeguro(body.fechaRegistro),
      textoSeguro(body.nombre),
      body.cedula ? "'" + body.cedula : '',
      body.telefono ? "'" + body.telefono : '',
      textoSeguro(body.correo),
      textoSeguro(body.tipo),
      textoSeguro(body.vehiculo),
      textoSeguro(body.fechaInicio),
      textoSeguro(body.fechaFin),
      Number.isInteger(body.dias) ? body.dias : '',
      textoSeguro(body.lugar),
      textoSeguro(body.conductor),
      textoSeguro(body.encargado),
      textoSeguro(body.metodoPago),
      textoSeguro(body.premioRuleta),
      textoSeguro(body.ubicacion)
    ]);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
