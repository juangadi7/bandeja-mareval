// Compara los resultados reales con lo esperado en test/mensajes.json.
// node scripts/metricas.mjs test/resultados.json
import fs from 'node:fs';

const esperados = JSON.parse(fs.readFileSync('test/mensajes.json', 'utf8'));
const resultados = JSON.parse(fs.readFileSync(process.argv[2] || 'test/resultados.json', 'utf8'));
const porId = new Map(resultados.map((r) => [r.id, r]));

let ok = 0, alertaOk = 0, alertaTotal = 0, revision = 0, minutos = 0;
const fallos = [];
const ms = [];
const porDepto = {};

for (const m of esperados) {
  const r = porId.get(m.id);
  if (!r) { fallos.push(`#${m.id}: sin resultado`); continue; }
  if (r.revision_manual) revision++;
  ms.push(r.ms_ia);
  porDepto[r.departamento] = (porDepto[r.departamento] || 0) + 1;
  minutos += r.minutos_ahorrados ?? 0;

  const catOk = m.esperado.cat.includes(r.categoria);
  if (catOk) ok++; else fallos.push(`#${m.id}: esperaba ${m.esperado.cat.join('/')} y salió ${r.categoria}`);

  if (typeof m.esperado.alta === 'boolean') {
    alertaTotal++;
    const esAlta = r.urgencia === 'alta';
    if (esAlta === m.esperado.alta) alertaOk++;
    else fallos.push(`#${m.id}: urgencia ${r.urgencia} (esperaba ${m.esperado.alta ? 'alta' : 'no alta'})`);
  }
}

ms.sort((a, b) => a - b);
const mediana = ms[Math.floor(ms.length / 2)];
const n = esperados.length;
const out = {
  mensajes: n,
  categoria_correcta: `${ok}/${n} (${Math.round((ok / n) * 100)}%)`,
  urgencia_correcta_en_casos_marcados: `${alertaOk}/${alertaTotal}`,
  a_revision_manual: revision,
  mediana_ms_ia: mediana,
  por_departamento: porDepto,
  fallos,
};
console.log(JSON.stringify(out, null, 2));
