const SPREADSHEET_ID = '1s_uKwkZUrm7KUX_lQ6FH47KZ4lNG-s5VlBKUU8NyWRc';
const SHEET_NAME = 'Solicitudes';
// Pega aquí el mismo valor que GOOGLE_SHEETS_TOKEN en Render.
const TOKEN = 'CAMBIA-ESTE-TOKEN';

function doPost(e) {
  const out = (obj) => ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (!TOKEN || TOKEN === 'CAMBIA-ESTE-TOKEN' || body.token !== TOKEN) {
      return out({ ok: false, error: 'unauthorized' });
    }
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return out({ ok: false, error: 'sheet' });
    sheet.appendRow([
      body.fechaRegistro || '',
      body.nombre || '',
      body.cedula || '',
      body.telefono || '',
      body.correo || '',
      body.tipo || '',
      body.vehiculo || '',
      body.fechaInicio || '',
      body.fechaFin || '',
      body.dias === 0 || body.dias ? body.dias : '',
      body.lugar || '',
      body.conductor || '',
      body.encargado || '',
      body.metodoPago || '',
      body.premioRuleta || '',
      body.ubicacion || ''
    ]);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
