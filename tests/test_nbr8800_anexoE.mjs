// test_nbr8800_anexoE.mjs — vigas de alma esbelta pela NBR 8800:2024, Anexo E (E.5, E.6.1–E.6.3)
//   node tests/test_nbr8800_anexoE.mjs
// Oráculo: cálculo manual independente (texto do Anexo E lido nas págs. 165–167 do PDF do acervo; Fakury 2017
// declara a viga de alma esbelta fora do escopo do livro). MR250: E = 200 000, fy = 250, σr = 0,3·fy, γa1 = 1,10.
//   I soldado d = 1 000, bf = 300, tf = 16, tw = 5 mm: h = 968, h/tw = 193,6 > 5,70·√(E/fy) = 161,22
//     Ix = 300·1000³/12 − 295·968³/12 = 2,70195·10⁹ mm⁴, W = 5 403 904 mm³; kc = 4/√193,6 = 0,287 → 0,35
//     ar = 968·5/(300·16) = 1,0083; kpg = 1 − 1,0083/(1200 + 302,5)·(193,6 − 161,22) = 0,97827
//     ryc (mesa + h/6 de alma): √[(16·300³/12 + 161,33·5³/12)/(4 800 + 806,7)] = 80,133 mm
//     λy = 1,10·√800 = 31,11; λr = π·√(800·Cb/0,7)
//     Lb = 3 m, Cb = 1:   λ = 37,44 (inelástica) → MFLT = 1 288,22 kN·m; FLM: bf/2tf = 9,38 ≤ 10,75 → My = 1 321,62;
//                        Wxt·fy = 1 350,98 → MRd = 1 288,22/1,10 = 1 171,111 kN·m
//     Lb = 8 m, Cb = 1:   λ = 99,83 ≤ λr = 106,21 → MFLT = 958,77 → MRd = 871,609
//     Lb = 8 m, Cb = 1,5: λr = 130,07 → MFLT = 1 046,29 → MRd = 951,171 (Cb só em λr e Mcr)
//     Lb = 10 m, Cb = 1:  λ = 124,79 > λr → Mcr = kpg·π²·E·W/λ² = 670,07 → MRd = 609,153
//   I soldado d = 1 000, bf = 400, tf = 12,5, tw = 5 mm, Lb = 1,5 m: h/tw = 195; W = 5 648 424 mm³; ar = 0,975;
//     kpg = 0,97793; FLT no patamar; FLM: λ = 16 entre 10,75 e λr = 0,95·√(0,35·200 000/175) = 19,00
//     → MFLM = 1 117,27 kN·m → MRd = 1 015,704 kN·m
import { resolveSectionProps } from '../js/design/section_props.js';
import { nbr8800 } from '../js/design/codes/nbr8800.js';

let fails = 0, n = 0;
const ok = (name, got, exp, rel = 0.002) => { n++; const e = Math.abs(got - exp) / Math.abs(exp); if (!(e <= rel)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)}%)`); } else console.log(`ok   ${name}: ${got}`); };
const assert = (name, c) => { n++; if (!c) { fails++; console.log(`FAIL ${name}`); } else console.log(`ok   ${name}`); };
const mat = { Fy: 250e3, Fu: 400e3, E: 200e6, G: 77e6 };   // kN/m²

const secOf = (d, bf, tf, tw, fabricacao = 'soldado') => resolveSectionProps({ design: { shape: 'I', dims: { d, bf, tf, tw }, fabricacao } });
const run = (sec, Lb, Cb = 1, extra = {}) => nbr8800.check({ demands: { Mz: 100 }, mat, sec, member: { L: Lb, Lb, Cb, ...extra }, options: { gamma_a1: 1.10 } });

const s1 = secOf(1.0, 0.3, 0.016, 0.005);
{
  const r = run(s1, 3);
  ok('E1. Lb = 3 m: FLT inelástica governa', r.flexaoX.capacity, 1171.111);
  ok('E1b. kpg', r.flexaoX.kpg, 0.97827, 0.0002);
  assert('E1c. aviso do Anexo E e razão finita', r.avisos.some(a => /Anexo E \(kpg/.test(a)) && isFinite(r.flexaoX.ratio));
}
ok('E2. Lb = 8 m, Cb = 1', run(s1, 8).flexaoX.capacity, 871.609);
ok('E3. Lb = 8 m, Cb = 1,5 (Cb em λr)', run(s1, 8, 1.5).flexaoX.capacity, 951.171);
ok('E4. Lb = 10 m: FLT elástica', run(s1, 10).flexaoX.capacity, 609.153);
ok('E5. FLM inelástica governa (bf = 400, tf = 12,5)', run(secOf(1.0, 0.4, 0.0125, 0.005), 1.5).flexaoX.capacity, 1015.704);
{
  // E.5.3-b: h/tw = 968/3,5 = 276,6 > 260 → não verificado
  const r = run(secOf(1.0, 0.3, 0.016, 0.0035), 3);
  assert('E6. h/tw > 260: flexão NÃO verificada', !isFinite(r.flexaoX.ratio) && r.avisos.some(a => /E\.5\.3-b/.test(a)));
}
{
  // fy = 350: a/h > 1,5 (sem enrijecedores) → 0,42·E/fy = 240; h/tw = 968/3,9 = 248,2 > 240; com a/h ≤ 1,5 → 11,7·√(E/fy) = 279,7 (260 rege) → passa
  const m350 = { ...mat, Fy: 350e3 };
  const s = secOf(1.0, 0.3, 0.016, 0.0039);
  const r = nbr8800.check({ demands: { Mz: 100 }, mat: m350, sec: s, member: { L: 3, Lb: 3 }, options: {} });
  assert('E7. fy = 350, sem enrijecedores: h/tw 248 > 0,42·E/fy = 240 → NÃO verificada', !isFinite(r.flexaoX.ratio));
  const r2 = nbr8800.check({ demands: { Mz: 100 }, mat: m350, sec: s, member: { L: 3, Lb: 3, a: 1.0 }, options: {} });
  assert('E7b. com a = 1,0 m (a/h ≤ 1,5): limite 260 → verificada', isFinite(r2.flexaoX.ratio));
}
{
  const r = run(secOf(1.0, 0.3, 0.016, 0.005, 'laminado'), 3);
  assert('E8. laminado com alma esbelta: fora do Anexo E (E.5.2)', !isFinite(r.flexaoX.ratio) && r.avisos.some(a => /E\.5\.2/.test(a)));
}

console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
