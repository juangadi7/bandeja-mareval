// Servidor de pruebas: imita la API de Gemini y la de Telegram.
// Sirve para probar el flujo de n8n sin claves ni conexión.
// Uso: node test/mock-server.mjs  (puerto 8787)
import http from 'node:http';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 8787);
const LOG = process.env.MOCK_LOG || 'mock-calls.jsonl';

const reglas = [
  ['queja', /(vergüenza|indignad|fatal|inaceptable|peor|denunciar|hoja de reclamaci|harto|decepcion)/i],
  ['factura', /(factura|cobro|cobrado|pago|reembolso|transferencia|iva|importe)/i],
  ['garantia', /(garant[ií]a)/i],
  ['reparacion', /(no funciona|se para|parado|atrasa|adelanta|revisi[oó]n|reparar|repar|cristal roto|rayad|corona|agua dentro|empa[ñn]ad)/i],
  ['cita', /(cita|visitar|pasarme|ir a la tienda|boutique|probarme|ver en persona)/i],
  ['pedido', /(pedido|comprar|precio|disponib|stock|env[ií]o|llega|entrega|reservar)/i],
];

function clasificar(texto) {
  let categoria = 'otro';
  for (const [cat, re] of reglas) if (re.test(texto)) { categoria = cat; break; }
  const urgente = /(urgente|hoy mismo|cuanto antes|ya mismo|mañana es|boda|inmediat)/i.test(texto);
  const negativo = categoria === 'queja' || /(enfadad|molest|mal servicio|nadie me contesta)/i.test(texto);
  const email = (texto.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0];
  const tel = (texto.match(/(\+34\s?)?[6789]\d{2}\s?\d{3}\s?\d{3}/) || [''])[0];
  const ref = (texto.match(/MRV-\d{4,}/i) || [''])[0].toUpperCase();
  const modelo = (texto.match(/(Ordinal|Meridiano|Ébano|Ebano|Travesía|Travesia)\s?\w*/i) || [''])[0];
  return {
    categoria,
    urgencia: urgente ? 'alta' : (negativo ? 'media' : 'baja'),
    sentimiento: negativo ? 'negativo' : 'neutro',
    resumen: texto.slice(0, 90).replace(/\s+/g, ' ').trim(),
    datos: { nombre: '', email, telefono: tel, referencia_pedido: ref, modelo_reloj: modelo },
    borrador_respuesta: 'Hola, gracias por escribir a Mareval. Hemos recibido tu mensaje y te respondemos en breve. [respuesta simulada]',
    idioma: 'es',
    confianza: 0.9,
  };
}

function log(entry) { fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...entry }) + '\n'); }

function body(req) {
  return new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });
}

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

http.createServer(async (req, res) => {
  const raw = await body(req);
  let json = {};
  try { json = raw ? JSON.parse(raw) : {}; } catch { /* form-encoded */ json = Object.fromEntries(new URLSearchParams(raw)); }

  // Gemini: POST /v1beta/models/<modelo>:generateContent
  const g = req.url.match(/^\/v1beta\/models\/([^:]+):generateContent/);
  if (g && req.method === 'POST') {
    if (!req.headers['x-goog-api-key']) return send(res, 403, { error: { code: 403, message: 'API key missing' } });
    // MOCK_FAIL_MODEL=<modelo> simula que ese modelo está saturado (503).
    if (process.env.MOCK_FAIL_MODEL && g[1] === process.env.MOCK_FAIL_MODEL) {
      log({ api: 'gemini', model: g[1], status: 503 });
      return send(res, 503, { error: { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' } });
    }
    const texto = json.contents?.[0]?.parts?.map((p) => p.text).join('\n') || '';
    const salida = clasificar(texto);
    log({ api: 'gemini', model: g[1], schema: !!json.generationConfig?.responseSchema, salida });
    return send(res, 200, {
      candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(salida) }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 420, candidatesTokenCount: 160, totalTokenCount: 580 },
      modelVersion: g[1],
    });
  }

  // Telegram: POST /bot<token>/sendMessage
  const t = req.url.match(/^\/bot([^/]+)\/(\w+)/);
  if (t) {
    if (t[2] === 'sendMessage') {
      log({ api: 'telegram', chat_id: String(json.chat_id), text: json.text });
      return send(res, 200, { ok: true, result: { message_id: Math.floor(Math.random() * 1e6), chat: { id: json.chat_id }, text: json.text } });
    }
    if (t[2] === 'getMe') return send(res, 200, { ok: true, result: { id: 1, is_bot: true, first_name: 'Mareval Mock', username: 'mareval_mock_bot' } });
    return send(res, 200, { ok: true, result: true });
  }

  send(res, 404, { error: 'ruta no simulada', url: req.url });
}).listen(PORT, () => console.log(`mock en http://localhost:${PORT}`));
