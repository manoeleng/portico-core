// test_typology_wizard.mjs — assistente por tipologia: cada formulário pronto gera um modelo válido com o preset
// Brasil, sem substituição silenciosa de seção/material (o catálogo Gerdau e os materiais do preset resolvem
// tudo o que o formulário oferece), e a passarela usa a carga de multidão da NBR 7188:2024 6.1 (5,0 kN/m²).
//   node tests/test_typology_wizard.mjs
import fs from 'node:fs';
import { parseCSV } from '../js/utils/csv.js';
import { generateModel } from '../assistant/generator.js';
import { TYPOLOGIES } from '../js/ui/typology_wizard.js';

let fails = 0, n = 0;
const assert = (name, c, info = '') => { n++; if (!c) fails++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}${info ? ' · ' + info : ''}`); };
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const D = '../presets/brasil/';
const BR = { reglas: JSON.parse(rd(D + 'rules.json')), perfiles: parseCSV(rd(D + 'profiles.csv')),
  materiales: parseCSV(rd(D + 'materials.csv')), sobrecargas: parseCSV(rd(D + 'live_loads.csv')) };

// default values of a form, as the panel reads them (num → number; select → its default or first option)
const defaults = (def) => Object.fromEntries(def.fields.flatMap((it) => it.row || []).map((f) => {
  if (f.num) return [f.id, f.num[0]];
  const o = (typeof f.sel === 'function' ? f.sel(BR) : f.sel).map((x) => (Array.isArray(x) ? x[0] : x));
  return [f.id, f.v != null && o.includes(f.v) ? f.v : o[0]];
}));
const run = (label, def, over = {}) => {
  const v = { ...defaults(def), ...over };
  const m = generateModel(def.spec(v), BR);
  const bad = (m._warnings || []).filter((w) => /not recognized|não reconhec|used .* by default/i.test(w.msg)).map((w) => w.msg);
  assert(`${label}: modelo gerado (${m.nodes.length} nós, ${m.elements.length} barras, ${m.combinations.length} comb.)`, m.nodes.length > 0 && m.elements.length > 0 && m.combinations.length > 0);
  assert(`${label}: nenhuma seção/material substituído`, bad.length === 0, bad.join(' | '));
  return { m, v };
};

const ready = TYPOLOGIES.filter((t) => t.ready && t.form);
assert('galeria: 4 tipologias prontas (galpão, edifício, treliça, passarela)', TYPOLOGIES.filter((t) => t.ready).length === 4);
assert('galeria: as não prontas declaram o motivo', TYPOLOGIES.filter((t) => !t.ready).every((t) => t.why));
const F = Object.fromEntries(ready.map((t) => [t.id, t.form]));

// option lists offered by the forms exist in the preset (every default of a select is one of its options)
for (const t of ready) for (const f of t.form.fields.flatMap((it) => it.row || [])) if (f.sel && f.v != null && f.v !== '') {
  const o = (typeof f.sel === 'function' ? f.sel(BR) : f.sel).map((x) => (Array.isArray(x) ? x[0] : x));
  assert(`${t.id}.${f.id}: padrão "${f.v}" está na lista`, o.includes(f.v));
}

// edifício
{
  const { m, v } = run('edifício aço 3D', F.edificio);
  assert('edifício aço: perfis escolhidos no modelo', m.sections.some((s) => s.name === v.vig_w) && m.sections.some((s) => s.name === v.pil_w));
  const nLev = new Set(m.nodes.map((nd) => nd.z)).size;
  assert('edifício: 3 pisos + base = 4 cotas', nLev === 4, String(nLev));
  assert('edifício: vento NBR 6123 gerado (V0 = 35)', m.loadCases.some((l) => l._viento));
  assert('edifício: resumo conta as combinações NBR (não as substituídas)', m._generado.resumenT.v.ncb === m.combinations.length, `${m._generado.resumenT.v.ncb} vs ${m.combinations.length}`);
  run('edifício concreto 3D', F.edificio, { sys: 'hormigon' });
  run('edifício aço 2D', F.edificio, { mode: '2D' });
  const s = run('edifício com sismo NBR 15421', F.edificio, { ag: 0.10 }).m;
  assert('edifício: casos de sismo com ag > 0', s.loadCases.some((l) => l._espectro_NBR15421 && !l._espectro_NBR15421._error));
}
// treliça
{
  const { m, v } = run('treliça de aço', F.trelica);
  assert('treliça: banzos com o perfil Gerdau escolhido', m.sections.some((s) => s.name === v.ch));
}
// passarela
{
  for (const tipo of ['deck', 'central_beam', 'truss']) {
    for (const sys of ['acero', 'hormigon']) {
      const { m } = run(`passarela ${tipo} ${sys}`, F.passarela, { tipo, sys });
      if (tipo === 'deck' && sys === 'acero') assert('passarela: perfil das longarinas', m.sections.some((s) => s.name === 'W 410 x 60,0'));
    }
  }
  const sp = F.passarela.spec(defaults(F.passarela));
  assert('passarela: multidão p = 5,0 kN/m² (NBR 7188:2024 6.1)', sp.loads.live_load_kN_m2 === 5);
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
