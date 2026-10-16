// test_catalog_acocearense.mjs — catálogo Aço Cearense 2026 (js/design/catalog_acocearense.js)
//   node tests/test_catalog_acocearense.mjs
// Oráculos: (1) o próprio catálogo — contagem das tabelas (U simples 34 + 4 de encaixe, p.21; Ue 35, p.22; cantoneira
// 14, p.23) e a massa nominal, que deve ficar dentro de ±6 % de A·7850 (nota do catálogo: "variação de peso nominal de
// ±5 % a ±6 %") — controle da transcrição; (2) a tabela da NBR 6355:2012 para os perfis com as MESMAS dimensões nos dois
// catálogos (A ±0,6 %, Ix/Iy ±1 %, Cw ±0,5 %, xg ±0,03 cm).
import { AC_PROFILES, AC_ANGLES, L_AC } from '../js/design/catalog_acocearense.js';
import { CF_PROFILES, cfNames } from '../js/design/profiles_cf.js';
import { profileToSection, catalogNames } from '../js/design/profiles.js';
import { nbr14762 } from '../js/design/codes/nbr14762.js';
let fails = 0, n = 0;
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const rel = (a, b) => Math.abs(a / b - 1);
const U = Object.values(AC_PROFILES).filter((p) => p.shape === 'U'), UE = Object.values(AC_PROFILES).filter((p) => p.shape === 'Ue');
yes('C1. contagem: 38 U (34 + 4 de encaixe), 35 Ue, 14 cantoneiras', U.length === 38 && UE.length === 35 && Object.keys(AC_ANGLES).length === 14, `${U.length} ${UE.length} ${Object.keys(AC_ANGLES).length}`);
let mw = 0, mwN = '';
for (const p of [...U, ...UE]) { const r = rel(p.massa, p.massaGeom); if (r > mw) { mw = r; mwN = p.designacao; } }
for (const [b, t, m] of L_AC) { const r = rel(m, t * (2 * b - t) / 1e6 * 7850); if (r > mw) { mw = r; mwN = `L ${b}x${t}`; } }
yes(`C2. massa do catálogo dentro de ±6 % de A·7850 (maior: ${(mw * 100).toFixed(2)} % em ${mwN})`, mw <= 0.06);
// same dimensions in NBR 6355
const key = (p) => [p.shape, p.dims.bw, p.dims.bf, p.dims.D || 0, p.dims.t].map((v) => typeof v === 'number' ? +v.toFixed(6) : v).join('|');
const nbr = new Map(Object.values(CF_PROFILES).filter((p) => !p.fabricante && (p.shape === 'U' || p.shape === 'Ue')).map((p) => [key(p), p]));
let shared = 0, bad = [];
for (const p of [...U, ...UE]) {
  const q = nbr.get(key(p)); if (!q) continue; shared++;
  if (rel(p.A, q.A) > 0.006 || rel(p.Iz, q.Iz) > 0.01 || rel(p.Iy, q.Iy) > 0.01 || (q.Cw > 0 && rel(p.Cw, q.Cw) > 0.005) || Math.abs(p.xg - q.xg) > 0.0003) bad.push(p.designacao);
}
yes(`C3. ${shared} perfis com as mesmas dimensões da NBR 6355: propriedades conferem com a tabela da norma`, shared >= 10 && bad.length === 0, bad.join(', '));
yes('C4. fora das listas da NBR 6355 (cfNames sem fabricante)', !cfNames('Ue').some((x) => /Cearense/.test(x)) && cfNames('Ue', { fabricante: 'Aço Cearense' }).length === 35);
const s = profileToSection('Ue 100x50x14x2,00 (Aço Cearense)');
yes('C5. seção do catálogo (forma Ue, massa do fabricante 3,266 kg/m)', s?.design?.shape === 'Ue' && s.design.cfProps.massa === 3.266);
const r = nbr14762.check({ demands: { N: -20, Mz: 2 }, mat: { Fy: 250e3, Fu: 400e3, E: 2e8, G: 7.7e7 }, sec: { ...s.design.cfProps, coldFormed: true }, member: { L: 3, Lx: 3, Ly: 3, Lz: 3, Cb: 1 } });
yes('C6. verificado pela NBR 14762 (razão finita)', isFinite(r.ratioMax) && r.ratioMax > 0, String(r.ratioMax));
yes('C7. cantoneira laminada pela forma da biblioteca (NBR 8800)', profileToSection('L 50,8x50,8x6,35 (Aço Cearense)')?.design?.shape === 'angle' && catalogNames('L laminada — Aço Cearense').length === 14);
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
