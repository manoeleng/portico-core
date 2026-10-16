// test_nbr14762_composite.mjs — built-up members 2L / 2U costas, single angle (NBR 14762:2010 9.7.2, 9.7.5, 9.6.2, 9.8.6)
//   node tests/test_nbr14762_composite.mjs
// Oracles:
//  W — apostila Wanderson F. Maia, INBEC Mód. 05 "Perfis formados a frio II" p.117-137: diagonais/montantes 2L 40x2,25,
//      fy = 28, fu = 38 kN/cm², E = 20 000, G = 7 700, K·L igual nas 3 direções. Cantoneira isolada (A = 1,72; I1 = 4,40;
//      I2 = 1,03; x0 = 1,40; r0 = 2,26) e dupla cantoneira (A = 3,44; Ix = 5,42, só flexão em x, ≥ 3 chapas separadoras):
//        KL = 122:   isolada Ne2 = 13,7, χ = 0,251, Nc,Rd(2L) = 20,1 kN (p.118-122); dupla 44,3 kN (p.123-126, sem flexo-torção)
//        KL = 228:   isolada 5,6 kN (χ arredondado 0,07; p.128-132); dupla Nex = 20,6, χ = 0,188, Nc,Rd = 15,1 kN (p.133-136)
//        KL = 73:    isolada 45,5 kN; dupla 57,5 kN (p.137, sem flexo-torção)
//        KL = 140,8: isolada 15,0 kN; dupla 38,1 kN (p.137)
//        tração: Nt,Rd = 2·1,72·28/1,1 = 87,6 kN; Ct = 1 − 1,2·1,1/4 = 0,67, Nt,Rd = 0,67·3,44·38/1,65 = 53,1 kN (p.127)
//  H — hand calculation (scratchpad hand2L.py, independent of the app): composite with the flexural-torsional mode of
//      9.7.2.2 (y0 = yg − t/2 = 0,9875 cm, Cw = 0, J = 2·(2b − t)t³/3, g = 8 mm → Iy = 13,16 cm⁴):
//        KL = 122: Neyz = 65,32 < Nex 71,88 → λ0 = 1,2143, χ = 0,5395, Aef = 3,3844 → Nc,Rd = 42,60 kN (apostila 44,3: sem FT)
//        KL = 73:  Neyz = 69,53 → composta 43,81 < 2 × isolada 45,51 → Nc,Rd = 45,51 kN (apostila 57,5: sem FT)
//  C — Manual CBCA 2014 Anexo D p.157-160: ][ 2U 100x50x2,65, L = 111 cm, fy = 24: Nc,Rd = 2 × 68,22 = 136,44 kN;
//      MRd,esc = 2 × 310,57 kN·cm (catálogo NBR 6355 difere do quadro do Manual em Ix/x0 → tolerância 2 %).
import { nbr14762 } from '../js/design/codes/nbr14762.js';
import { compositeSection } from '../js/design/composite_cf.js';
import { cfSection } from '../js/design/profiles_cf.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 1e-3) => { n++; if (!(Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp)))) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp}`); } else console.log(`ok   ${name}: ${(+got).toFixed(4)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const mat28 = { Fy: 280e3, Fu: 380e3, E: 2e8, G: 7.7e7 };
const sec2L = compositeSection('2L', 'L 40x2,25', 'costas', 8);
const run = (KL, N, presilhas, extra = {}) => nbr14762.check({ demands: { N }, mat: mat28, sec: sec2L,
  member: { L: KL, Lx: KL, Ly: KL, Lz: KL, ...(presilhas ? { presilhas } : {}), ...extra } });

// catálogo: eixos principais da Tab. A.1
const L40 = cfSection('L 40x2,25');
ok('A1. L 40x2,25 I1 = 4,40 cm⁴ (Tab. A.1)', L40.I1 * 1e8, 4.40, 1e-9); ok('A1b. I2 = 1,03 cm⁴', L40.I2 * 1e8, 1.03, 1e-9); ok('A1c. r2 = 0,77 cm', L40.r2 * 100, 0.77, 1e-9);

// W1 KL = 122, sem presilhas → só isolada
let r = run(1.22, -29.6);
ok('W1. KL 122 isolada × 2 = 19,97 kN (apostila 20,1 com χ = 0,251)', r.axial.capacity, 19.966, 2e-3);
ok('W1b. ... dentro de 1 % da apostila', r.axial.capacity, 20.1, 0.01);
yes('W1c. aviso 9.7.5 NÃO VERIFICADO sem l1, resultado condicionado', r.avisos.some(a => /9\.7\.5 NÃO VERIFICADO/.test(a)) && /9\.7\.5/.test(r.condicionado || ''));
yes('W1d. aviso de excentricidade da ligação da cantoneira', r.avisos.some(a => /excentricidade da ligação/.test(a)));
{ const s2 = { ...cfSection('L 40x2,25'), dims: { ...cfSection('L 40x2,25').dims, b2: 0.03 } };
  const ru = nbr14762.check({ demands: { N: -5 }, mat: mat28, sec: s2, member: { L: 1, Lx: 1, Ly: 1, Lz: 1 } });
  yes('W1e. abas desiguais → NÃO verificada (9.7.2.3)', ru.axial.verificado === false && /abas desiguais/.test(ru.axial.motivo)); }
// W2 KL = 122 com 3 chapas (l1 = 0,305 m): composta com flexo-torção (H) — abaixo da apostila (que omite FT)
r = run(1.22, -29.6, { l1: 0.305 });
ok('W2. KL 122 composta Neyz = 65,32 kN', r.axial.composta.Neyz, 65.322, 2e-3);
ok('W2b. Nc,Rd composta = 42,60 kN', r.axial.capacity, 42.60, 2e-3);
yes('W2c. < 44,3 da apostila (a FT governa)', r.axial.capacity < 44.3);
yes('W2d. atende Nsd = 29,6', r.axial.ratio < 1);
// W3 KL = 228
r = run(2.28, -8.5);
ok('W3. KL 228 isolada × 2 = 5,72 kN (apostila 5,6 com χ = 0,07)', r.axial.capacity, 5.7167, 2e-3);
r = run(2.28, -8.5, { l1: 0.57 });
ok('W3b. KL 228 composta = 15,04 kN (apostila 15,1)', r.axial.capacity, 15.1, 0.01);
yes('W3c. modo = flexão em z', /flexão em torno de z/.test(r.axial.composta.modoGlobal));
// W4 montantes
r = run(0.73, -13.6, { l1: 0.18 });
ok('W4. KL 73 isolada × 2 = 45,5 kN (apostila)', r.axial.capacity, 45.5, 0.005);
yes('W4b. composta (43,81, FT) < isolada → governa a isolada', !r.axial.composta || r.axial.capacity === r.axial.NcRdIsolado || r.avisos.some(a => /governa a isolada/.test(a)));
ok('W4c. Nc,Rd composta (H) = 43,81 kN', r.axial.composta.NcRd, 43.808, 2e-3);
r = run(1.408, -3.2, { l1: 0.35 });
ok('W5. KL 140,8 composta = 38,03 kN (apostila 38,1)', r.axial.capacity, 38.1, 0.005);
r = run(1.408, -3.2);
ok('W5b. KL 140,8 isolada × 2 = 15,0 kN', r.axial.capacity, 15.0, 0.005);
// 9.7.5 não atendido: λconj = 122/1,2552 = 97,2 → l1,máx = 0,5·97,2·0,77 = 37,4 cm
r = run(1.22, -29.6, { l1: 0.40 });
yes('W6. l1 = 0,40 > l1,máx 0,374 → 9.7.5 NÃO atendido, vale a isolada', /NÃO atendido/.test(r.avisos.join(' ')) && Math.abs(r.axial.capacity - 19.966) < 0.05);
r = run(1.22, -29.6, { l1: 0.30, tipo: 'tala' });
yes('W6b. talas → LACUNA, vale a isolada', /talas/.test(r.avisos.join(' ')) && Math.abs(r.axial.capacity - 19.966) < 0.05);
// tração (p.127)
r = run(1.22, 38.6);
ok('W7. Nt,Rd bruta = 87,56 kN', r.axial.capacity, 2 * 1.72 * 28 / 1.1, 1e-6);
r = run(1.22, 38.6, null, { secaoLiquida: { An: 3.44e-4, ligacao: 'soldada', todosConectados: false, x: 0.011, Lc: 0.04, tipo: 'L' } });
ok('W7b. Ct·An·fu/1,65 = 53,08 kN (Ct = 0,67)', r.axial.capacity, 0.67 * 3.44 * 38 / 1.65, 1e-6);
// esbeltez 9.7.4 pelo conjunto: KL 228 isolada tem L/r2 = 296 > 200, mas o conjunto 181,6 ≤ 200
r = run(2.28, -8.5);
yes('W8. 9.7.4 pelo conjunto (λ = 181,6 ≤ 200): verificado', r.axial.verificado !== false && isFinite(r.axial.ratio));

// C — 2U 100x50x2,65 costas (Manual CBCA 2014)
const sec2U = compositeSection('2U', 'U 100x50x2,65', 'costas', 6.3);
const mat24 = { Fy: 240e3, Fu: 370e3, E: 2e8, G: 7.7e7 };
r = nbr14762.check({ demands: { N: -50 }, mat: mat24, sec: sec2U, member: { L: 1.11, Lx: 1.11, Ly: 1.11, Lz: 1.11 } });
ok('C1. 2U 100x50x2,65 Nc,Rd = 2 × 68,22 = 136,44 kN', r.axial.capacity, 136.44, 0.02);
r = nbr14762.check({ demands: { Mz: 1 }, mat: mat24, sec: sec2U, member: { L: 1.11, Lx: 1.11, Ly: 1.11, Lz: 1.11, Lb: 1.11, Cb: 1.67 } });
ok('C2. MRd,esc = 2 × 310,57 = 621,14 kN·cm', r.flexaoX.capacity * 100, 621.14, 0.02);
yes('C3. aviso 9.8.6 (conexão não verificada, m)', r.avisos.some(a => /9\.8\.6: conexão/.test(a)));
// 9.8.6 com dados: m = x0 − xg + t/2 = 3,07 − 1,37 + 0,1325 = 1,8325 cm; g = 0,05 m, FRd = 5 kN, q = 3 kN/m
//   smax = 2·0,05·5/(0,018325·3) = 9,095 m → limitado a L/6 = 0,185 m
r = nbr14762.check({ demands: { Mz: 1 }, mat: mat24, sec: sec2U, member: { L: 1.11, Lx: 1.11, Ly: 1.11, Lz: 1.11, Cb: 1.67, conexao: { s: 0.25, g: 0.05, FRd: 5, q: 3 } } });
ok('C4. smax = min(2gFRd/(mq); L/6) = 0,185 m', r.conexao986.capacity, 1.11 / 6, 1e-6);
ok('C4b. m = 1,8325 cm', r.conexao986.m * 100, 3.07 - 1.37 + 0.1325, 1e-6);
yes('C4c. s = 0,25 > smax → flexão não verificada', r.flexaoX.verificado === false);
// caixa → LACUNA na compressão
r = nbr14762.check({ demands: { N: -10 }, mat: mat24, sec: compositeSection('2Ue', 'Ue 100x50x17x2,00', 'caixa', 0), member: { L: 1, Lx: 1, Ly: 1, Lz: 1 } });
yes('C5. caixa: compressão NÃO verificada (LACUNA)', r.axial.verificado === false && /caixa/.test(r.axial.motivo));
// U — 2L em U (abas horizontais para dentro, g = 10 mm entre as pontas): Steiner d = b − xg + g/2 = 4,0 − 1,10 + 0,5 = 3,40 cm
//     Iy = 2·(2,71 + 1,72·3,40²) = 45,186 cm⁴; Iz = 2·2,71 = 5,42; J = 2·J1 (aberta); compressão = 2 × isolada (KL 122: 19,97)
const s2LU = compositeSection('2L', 'L 40x2,25', 'U', 10);
ok('U1. 2L em U: Iy = 45,186 cm⁴', s2LU.Iy * 1e8, 2 * (2.71 + 1.72 * 3.40 ** 2), 1e-9);
ok('U1b. Iz = 5,42 cm⁴', s2LU.Iz * 1e8, 5.42, 1e-9);
yes('U1c. aberta (J = 2·J1, sem Bredt)', !s2LU.closed && Math.abs(s2LU.J - 2 * L40.J) < 1e-15);
r = nbr14762.check({ demands: { N: -29.6 }, mat: mat28, sec: s2LU, member: { L: 1.22, Lx: 1.22, Ly: 1.22, Lz: 1.22, presilhas: { l1: 0.25 } } });
ok('U2. 2L em U, KL 122, l1 ok: Nc,Rd = 2 × isolada = 19,97 kN', r.axial.capacity, 19.966, 2e-3);
yes('U2b. aviso: composta não considerada em U', r.avisos.some(a => /2L em U/.test(a)));
// exibição (16/10/2026): o bloco axial mostra a esbeltez usada no 9.7.4 (conjunto) e a do perfil isolado.
// 2L 40x2,25 costas g8, L = 1,22 m: conjunto max(122/1,2552; 122/1,9559) = 97,20; isolado 122/0,77 = 158,44
r = nbr14762.check({ demands: { N: -5 }, mat: mat28, sec: sec2L, member: { L: 1.22, Lx: 1.22, Ly: 1.22, Lz: 1.22 } });
ok('E1. esbeltez do conjunto no bloco axial (9.7.4)', r.axial.esbeltez.conjunto, 97.20, 2e-3);
ok('E1b. esbeltez do perfil isolado ao lado', r.axial.esbeltez['perfil isolado'], 158.44, 2e-3);
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
