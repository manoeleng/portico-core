// test_nbr14762_anexoF.mjs — NBR 14762:2010 Anexo F: barra com painel conectado à mesa tracionada (terça + telha sob sucção)
//   node tests/test_nbr14762_anexoF.mjs
// Fonte: NBR 14762:2010, Anexo F (págs. 85–86 do PDF do acervo): MRd = R·Wef·fy/1,10, Wef de 9.8.2.1, R da Tab. F.1
//   (U com enrijecedor: biapoiada bw ≤ 165 → 0,70; 165 < bw ≤ 216 → 0,65; 216 < bw ≤ 292 → 0,40; contínua 0,60),
//   condições a) mesas com enrijecedor; b) bw ≤ 292 mm; c) 60 ≤ bw/t ≤ 170; d) 2,8 ≤ bw/bf ≤ 4,5; e) 16 ≤ b/t ≤ 43;
//   g) vão < 10 m; m) fy ≤ 410 MPa. O acervo não tem exemplo resolvido do Anexo F (os manuais CBCA o tratam como
//   "verificação especial"): o oráculo é a própria Tab. F.1 e as condições, conferidos à mão; Wef vem de 9.8.2.1
//   (motor validado contra o Manual CBCA em tests/test_nbr14762.mjs).
//   Ue 250×85×25×2,00 (catálogo NBR 6355): bw/t = 125, bw/bf = 2,94, b/t = (85 − 4·2)/2 = 38,5 → atende a)–e)
//   Ue 200×75×20×2,00: bw/bf = 2,67 < 2,8 → d) falha → FLT normal (9.8.2.2)
import { checkElement } from '../js/design/design.js';
import { profileToSection } from '../js/design/profiles.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 1e-9) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${got}`); };
const assert = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name}${info ? ' · ' + info : ''}`); } else console.log(`ok   ${name}`); };
const mat = (Fy = 250e3) => ({ name: 'ZAR', family: 'steel', Fy, Fu: 1.2 * Fy, E: 200e6, G: 77e6, nu: 0.3, design: { family: 'steel', Fy: Fy / 1e3, Fu: 1.2 * Fy / 1e3 } });   // design.Fy em MPa (resolveMaterial)
const run = (name, member, Fy) => checkElement({ forces: { Mz: 5, L: member.L }, sec: profileToSection(name), mat: mat(Fy), codeId: 'NBR14762:2010',
  member: { Cb: 1, ...member }, options: { Mdist: 1e4 } });   // Mdist alto: a distorcional não governa (fora do escopo deste teste)

{
  const r = run('Ue 250x85x25x2,00', { L: 6, Lb: 6, painelMesaTracionada: true });
  const f = r.flexaoX;
  ok('F1. biapoiada, 216 < bw ≤ 292: MRd(Anexo F) = 0,40·Wef·fy/1,10', f.MRdFLT, 0.40 * f.Wef * 250e3 / 1.10, 1e-6);
  ok('F1b. R = 0,40 (Tab. F.1)', f.anexoF.R, 0.40);
  assert('F1c. governa o Anexo F', /Anexo F/.test(f.ramo), f.ramo);
  assert('F1d. aviso com as premissas f) e h)–l)', r.avisos.some(a => /Premissas do usuário/.test(a)));
  const c = run('Ue 250x85x25x2,00', { L: 6, Lb: 6, painelMesaTracionada: { continua: true } }).flexaoX;
  ok('F2. contínua: R = 0,60', c.anexoF.R, 0.60);
  ok('F2b. MRd = 0,60·Wef·fy/1,10', c.MRdFLT, 0.60 * c.Wef * 250e3 / 1.10, 1e-6);
  const semPainel = run('Ue 250x85x25x2,00', { L: 6, Lb: 6 }).flexaoX;
  assert('F3. sem painel: FLT da 9.8.2.2 (sem anexoF)', !semPainel.anexoF && /FLT|escoamento|distorcional/.test(semPainel.ramo), semPainel.ramo);
}
{
  const r = run('Ue 200x75x20x2,00', { L: 6, Lb: 6, painelMesaTracionada: true });
  assert('F4. bw/bf = 2,67: Anexo F não aplicável (d), FLT normal', !r.flexaoX.anexoF && r.avisos.some(a => /Anexo F não aplicável/.test(a) && /d\)/.test(a)));
  const g = run('Ue 250x85x25x2,00', { L: 10, Lb: 10, painelMesaTracionada: true });
  assert('F5. vão de 10 m: condição g) falha', !g.flexaoX.anexoF && g.avisos.some(a => /g\) vão/.test(a)));
  const m = run('Ue 250x85x25x2,00', { L: 6, Lb: 6, painelMesaTracionada: true }, 450e3);
  assert('F6. fy = 450 MPa: condição m) falha', !m.flexaoX.anexoF && m.avisos.some(a => /m\) fy/.test(a)));
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
