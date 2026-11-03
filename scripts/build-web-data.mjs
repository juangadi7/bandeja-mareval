// Genera el data.js de la demo web a partir de los mensajes y los resultados reales.
// node scripts/build-web-data.mjs test/resultados-v3.json ../site/bandeja/data.js
import fs from 'node:fs';

const [, , resPath = 'test/resultados-v3.json', outPath = 'web-data.js'] = process.argv;
const mensajes = JSON.parse(fs.readFileSync('test/mensajes.json', 'utf8'));
const res = new Map(JSON.parse(fs.readFileSync(resPath, 'utf8')).map((r) => [r.id, r]));

const data = mensajes.map(({ esperado, ...m }) => {
  const r = res.get(m.id);
  if (!r) throw new Error('Falta el resultado del mensaje ' + m.id);
  return {
    ...m,
    r: {
      ticket: r.ticket, categoria: r.categoria, departamento: r.departamento, urgencia: r.urgencia,
      sentimiento: r.sentimiento, confianza: r.confianza, alerta: r.alerta, resumen: r.resumen,
      borrador: r.borrador_respuesta, ms: r.ms_ia, datos: r.datos || {},
    },
  };
});

fs.writeFileSync(outPath, '// Ejecuciones reales de la Bandeja inteligente (generado por scripts/build-web-data.mjs)\nwindow.BANDEJA = ' + JSON.stringify(data, null, 1) + ';\n');
console.log(outPath, data.length, 'mensajes');
