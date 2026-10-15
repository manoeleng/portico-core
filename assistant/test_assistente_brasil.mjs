// test_assistente_brasil.mjs — assistente com o preset Brasil, ficha → modelo (PLANO_BRASIL 8.3)
//   node assistant/test_assistente_brasil.mjs
// Oráculo das combinações: NBR 8800:2024 Tab. 1/2 = NBR 8681:2025 (γg agrupadas 1,35; γq 1,5; vento 1,4;
// ψ0 uso residencial 0,5, vento 0,6) e NBR 15421:2023 5.4 (γg 1,2; ψ0 0,5). Perfis e materiais do preset.
import fs from 'node:fs';
import { parseCSV } from '../js/utils/csv.js';
import { generateModel } from './generator.js';

let fails = 0;
const assert = (name, c, info = '') => { if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const libsOf = (dir) => ({ reglas: JSON.parse(rd(`${dir}rules.json`)), perfiles: parseCSV(rd(`${dir}profiles.csv`)),
  materiales: parseCSV(rd(`${dir}materials.csv`)), sobrecargas: parseCSV(rd(`${dir}live_loads.csv`)) });
const BR = libsOf('../presets/brasil/'), GEN = libsOf('./');
const key = (fs_) => JSON.stringify(fs_.map(f => [f.lcId, f.factor]).sort());

// (1) Edifício de aço, 3 pavimentos, vento NBR 6123 e sismo NBR 15421
{
  const spec = { mode: '3D', geometry: { levels: [{ height_m: 3 }, { height_m: 3 }, { height_m: 3 }], base_plan: { Lx_m: 10, Ly_m: 10 } },
    sections: { material: 'AR350', beams: 'W 310 x 32,7', columns: 'W 250 x 73,0' }, base_support: 'fixed', rigid_diaphragm: true,
    loads: { dead_extra_kN_m2: 1.5, live_load_kN_m2: 2.0, wind: true, seismic: true },
    wind: { V0_m_s: 35, categoria: 'III', grupoS3: '2' }, seismic: { ag: 0.10, soil: 'D', category: 'II', R: 3 } };
  const m = generateModel(spec, BR);
  const W = m._warnings.map(w => w.msg).join(' | ');
  assert('1a. seções do catálogo Gerdau resolvidas (sem substituição)', m.sections.some(s => /W 310 x 32,7/.test(s.name)) && m.sections.some(s => /W 250 x 73,0/.test(s.name)), m.sections.map(s => s.name).join(','));
  const lc = Object.fromEntries(m.loadCases.map(l => [l.name, l]));
  assert('1b. casos CM, CV, Viento X, Sismo X, Sismo Y', ['CM', 'CV', 'Viento X', 'Sismo X', 'Sismo Y'].every(n => lc[n]), Object.keys(lc).join(','));
  assert('1c. espectro NBR 15421 gerado (sem erro)', lc['Sismo X']._espectro_NBR15421 && !lc['Sismo X']._espectro_NBR15421._error, W);
  assert('1d. vento NBR 6123 com q > 0', lc['Viento X']._viento?.q_Nm2 > 0, String(lc['Viento X']._viento?.q_Nm2));
  const id = n => lc[n].id;
  const has = f => m.combinations.some(c => key(c.factors) === key(f));
  assert('1e. ELU 1,35G + 1,5Q + 0,84V0 (NBR 8800 Tab. 1; ψ0 vento 0,6)', has([{ lcId: id('CM'), factor: 1.35 }, { lcId: id('CV'), factor: 1.5 }, { lcId: id('Viento X'), factor: 0.84 }]), m.combinations.map(c => c.name).join(' | '));
  assert('1f. ELU 1,35G + 1,4V0 + 0,75Q (ψ0 uso residencial 0,5)', has([{ lcId: id('CM'), factor: 1.35 }, { lcId: id('Viento X'), factor: 1.4 }, { lcId: id('CV'), factor: 0.75 }]));
  assert('1g. ELU-EXC 1,2G + 1,0E0 + 0,5Q (NBR 15421 5.4)', has([{ lcId: id('CM'), factor: 1.2 }, { lcId: id('Sismo X'), factor: 1 }, { lcId: id('CV'), factor: 0.5 }]));
  assert('1h. nenhuma combinação NCh3171 (1.2CM+1.6CV)', !m.combinations.some(c => /1\.2CM\+1\.6CV|1\.4CM/.test(c.name)));
}
// (2) Galpão de aço — cobertura: CV → Qcob (ψ "coberturas" da NBR 8681 Tab. 6)
{
  const m = generateModel({ typology: 'galpão', sections: { material: 'MR250', columns: 'W 250 x 32,7' },
    warehouse: { span_m: 15, length_m: 30, column_height_m: 6, frame_spacing_m: 5, slope_pct: 10, chord_size: 'W 150 x 13,0', diagonal_size: 'W 150 x 13,0' },
    loads: { dead_extra_kN_m2: 0.15, live_load_kN_m2: 0.25 } }, BR);
  const ids = Object.fromEntries(m.loadCases.map(l => [l.name, l.id]));
  assert('2a. galpão com 1,35G + 1,5Qcob', m.combinations.some(c => key(c.factors) === key([{ lcId: ids.CM, factor: 1.35 }, { lcId: ids.CV, factor: 1.5 }])), m.combinations.map(c => c.name).join(' | '));
  assert('2b. nome usa Qcob', m.combinations.some(c => /Qcob/.test(c.name)));
}
// (3) Preset genérico inalterado (NCh3171)
{
  const m = generateModel({ typology: 'galpão', warehouse: { span_m: 15, length_m: 30 } }, GEN);
  assert('3. genérico continua com 1.2CM+1.6CV', m.combinations.some(c => c.name === '1.2CM+1.6CV'));
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
