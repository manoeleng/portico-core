// test_nbr14762_psi.mjs — AL element with ψ < −1 (support compressed): declared extension of Tab. 6 (review 15/10/2026)
//   node tests/test_nbr14762_psi.mjs
// Oracles by hand:
//  P1 effAL(b = 70 mm, t = 2,65 mm, σa = 25, σb = −92,5 kN/cm² → ψ = −3,7): k = 23,8; λp = (b/t)/(0,95·√(k·E/σ1))
//     with E = 20 000 kN/cm², σ1 = 25 → (26,42)/(0,95·√(23,8·20000/25)) = 26,42/131,1 = 0,2016 → fully effective.
//  P2 extreme b/t (b = 300 mm, t = 1 mm, σ1 = 25): λp = 300/131,1 = 2,289 > 0,673 → ρ = (1 − 0,22/λp)/λp
//     = 0,3949; bc = b/2 = 150 mm (conservative) → bef = 59,24 mm, ineffective zone [bef, bc].
//  P3 U 150x75x2,65 (NBR 6355 Tab. A.2), weak axis with the WEB compressed: no longer "não verificado"; the
//     section is fully effective → MRd,esc = W·fy/γ with W = Iy/max(xg, bf − xg) = 43,77/5,5 = 7,958 cm³,
//     fy = 25 kN/cm², γ = 1,10 → 180,9 kN·cm = 1,809 kN·m (± 2 %: thin-walled model of the module vs table Iy).
import { effAL, nbr14762 } from '../js/design/codes/nbr14762.js';
import { cfSection } from '../js/design/profiles_cf.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-3) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${(+got).toFixed(4)}`); };
const E = 20000;
const r1 = effAL(7.0, 0.265, 25, -92.5, E);
ok('P1. k = 23,8 (extensão)', r1.k, 23.8); ok('P1b. λp', r1.lp, (7.0 / 0.265) / (0.95 * Math.sqrt(23.8 * E / 25)), 1e-9);
n++; if (!(r1.full && !r1.unverified)) { fails++; console.log('FAIL P1c. totalmente efetivo', JSON.stringify(r1)); } else console.log('ok   P1c. totalmente efetivo');
const r2 = effAL(30, 0.1, 25, -92.5, E), lp2 = 300 / (0.95 * Math.sqrt(23.8 * E / 25)), rho2 = (1 - 0.22 / lp2) / lp2;
ok('P2. λp', r2.lp, lp2, 1e-9); ok('P2b. bef = ρ·b/2', r2.bef, rho2 * 15, 1e-9);
n++; if (!(r2.gaps.length === 1 && Math.abs(r2.gaps[0][1] - 15) < 1e-9)) { fails++; console.log('FAIL P2c. zona ineficaz até bc = b/2', JSON.stringify(r2.gaps)); } else console.log('ok   P2c. zona ineficaz [bef, b/2]');
const sec = { ...cfSection('U 150x75x2,65'), coldFormed: true };
const r3 = nbr14762.check({ demands: { My: 1.0 }, mat: { Fy: 250e3, Fu: 400e3, E: 2e8, G: 7.7e7 }, sec, member: { L: 1.6, Lx: 1.6, Ly: 1.6, Lz: 1.6, Lb: 1.6, Cb: 1 }, options: { sentidoMy: 'alma' } });
const fy = r3.flexaoY;
n++; if (!(fy && !fy.why && isFinite(fy.capacity))) { fails++; console.log('FAIL P3. flexão y verificada', JSON.stringify(fy).slice(0, 300)); }
else { console.log('ok   P3. flexão y (alma comprimida) verificada'); ok('P3b. MRd,esc = Iy/(bf−xg)·fy/1,10 (kN·m; o módulo devolve kN·m)', fy.MRdEsc, 43.77 / 5.5 * 25 / 1.10 / 100, 0.02); }
n++; if (!(r3.avisos || []).some((a) => /extensão da Tab. 6/.test(a))) { fails++; console.log('FAIL P4. aviso da extensão'); } else console.log('ok   P4. aviso da extensão presente');
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
