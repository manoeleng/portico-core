// test_connections_truss.mjs — barra de treliça em chapa de nó (js/design/connections_truss.js)
//   node tests/test_connections_truss.mjs
// Oráculos:
//  A) Fakury, Silva e Caldas 2017, 10.14.3 (p.296–302): 2L 76,2×6,35 A36, chapa de nó 9,5 USI CIVIL 350, ISO 8.8 M20
//     com rosca, 2 parafusos (s = 100, borda 40, linha a 30 mm da ponta da aba), F = 200 kN. Fórmulas inalteradas na
//     2024 (contato, rasgamento, Whitmore, compressão) entram pelos números do livro; o que mudou foi refeito à mão:
//     Fv,Rd 0,45 (83,78 kN); furo M20 da Tab. 14 = 22 mm → ℓf = 40 − 11 = 29 mm e área líquida com 22 + 2 = 24 mm
//     (rasgamento 2·132,6 kN; chapa de nó 415,9 kN — conta do engenheiro de aço conferida abaixo).
//  B) Wanderson, mód. 6, Aplicação 1 (NBR 14762:2010): U 150×50×2, A = 4,89 cm², A307 12,5 mm, e = 25 mm, df = 16 mm
//     (valor do livro), x = 23,3, L = 50 → Ct = 0,44, An = 3,83, Nt,Rd = 40,8 kN; rasgamento 13,8 e esmagamento 12,3 kN
//     por parafuso.
import { trussMemberConnection } from '../js/design/connections_truss.js';
let fails = 0, n = 0;
const ok = (name, got, exp, tol = 0.005) => { n++; const e = Math.abs(got / exp - 1); if (!(e <= tol)) { fails++; console.log(`FAIL ${name}: ${got} ≠ ${exp} (${(e * 100).toFixed(2)} %)`); } else console.log(`ok   ${name}: ${(+got).toFixed(3)}`); };
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const find = (r, re) => { const c = r.checks.find((x) => re.test(x.nome)); if (!c) console.log(`  (sem verificação ${re}: ${r.checks.map((x) => x.nome).join(' | ')})`); return c || { Rd: NaN, Sd: NaN }; };

const fakIn = { secao: { tipo: '2L', b: 76.2, t: 6.35, fy: 250, fu: 400 }, chapa: { t: 9.5, fy: 350, fu: 500, eBorda: 40, eLat: 30 + 20 + 140 * Math.tan(Math.PI / 6), Lw: 102 },
  meio: 'parafuso', par: { grade: 'ISO 898-1 classe 8.8', db: 20, n: 2, linhas: 1, s: 100, e1: 40, gHeel: 76.2 - 30, rosca: true }, N: 200, opts: { NRdBarra: 365 } };
const fak = (N) => trussMemberConnection({
  secao: { tipo: '2L', b: 76.2, t: 6.35, fy: 250, fu: 400 },
  chapa: { t: 9.5, fy: 350, fu: 500, eBorda: 40, eLat: 30 + 20 + 140 * Math.tan(Math.PI / 6), Lw: 102 },
  meio: 'parafuso', par: { grade: 'ISO 898-1 classe 8.8', db: 20, n: 2, linhas: 1, s: 100, e1: 40, gHeel: 76.2 - 30, rosca: true },
  N, opts: { NRdBarra: N > 0 ? 365 : 205 },
});
{ const r = fak(200);
  yes('A1. norma: t = 6,35 > 4,75 → NBR 8800', r.norma === '8800');
  ok('A2. F = 200 kN (> 45 kN)', r.F, 200, 1e-12);
  const v = find(r, /^Cisalhamento/);
  ok('A3. Fv,Sd = 200/(2·2) = 50 kN', v.Sd, 50, 1e-12);
  ok('A4. Fv,Rd M20 8.8 rosca (2024) = 83,78 kN', v.Rd, 0.45 * Math.PI * 100 * 800 / 1.35 / 1000, 1e-9);
  // hand: gusset 1,2·29·9,5·500/1,35 + 2,4·20·9,5·500/1,35 = 122,44 + 168,89; angles t = 12,7 fu 400: 130,95 + 180,62
  ok('A5. contato na chapa de nó (ℓf = 29 + furo interno no teto) = 291,33 kN', find(r, /chapa de nó \(t/).Rd, 122.444 + 168.889, 1e-4);
  ok('A6. contato nas cantoneiras (2 × 6,35) = 311,57 kN', find(r, /Contato.*cantoneiras/).Rd, 130.951 + 180.622, 1e-4);
  ok('A7. rasgamento das 2 cantoneiras, furo 2024 (24 mm) = 2·132,6 kN', find(r, /Barra — linha/).Rd, 2 * 132.6, 0.002);
  ok('A8. rasgamento da chapa de nó (Cts 0,5), furo 2024 = 415,9 kN', find(r, /Chapa de nó — linha/).Rd, 415.9, 0.002);
  ok('A9. Fakury: tração na seção de Whitmore = 349,0 kN', find(r, /Whitmore/).Rd, 349.0, 0.002);
  { const r2 = trussMemberConnection({ ...JSON.parse(JSON.stringify(fakIn)), chapa: { ...fakIn.chapa, largura: 100 } });
    ok('A9b. lwh limitada à largura da chapa (100 < 115,5 mm): 100·9,5·350/1,10', find(r2, /Whitmore/).Rd, 100 * 9.5 * 350 / 1.1 / 1000, 1e-9); }
  // net section, hand: A = 6,35·(152,4 − 6,35) = 927,4; ec = 21,40; Ct = 1 − 21,40/100; An = 2·927,4 − 2·24·6,35
  const A = 6.35 * (152.4 - 6.35), ec = (76.2 * 6.35 * 3.175 + 69.85 * 6.35 * (6.35 + 69.85 / 2)) / A;
  ok('A10. ec da cantoneira 76,2×6,35 = 21,4 mm (tabela Gerdau x̄ = 2,14 cm)', ec, 21.4, 0.003);
  ok('A11. ruptura da seção líquida 2L: (1 − ec/100)·(2A − 2·24·6,35)·400/1,35', find(r, /seção líquida/).Rd, (1 - ec / 100) * (2 * A - 2 * 24 * 6.35) * 400 / 1.35 / 1000, 1e-9);
  yes('A12. resultado atende (Fakury: atende)', r.ok, r.governa?.nome);
  yes('A13. disposições: s = 100 ≥ 54, borda 40 ≥ 26 (Tab. 16 M20)', r.checks.filter((c) => c.det).every((c) => c.ok)); }
{ const r = fak(-200);
  ok('A14. Fakury: compressão na chapa de nó (Whitmore, K = 0,65, L = 102) = 335,1 kN', find(r, /Compressão — seção de Whitmore/).Rd, 335.1, 0.003);
  yes('A15. compressão: sem rasgamento nem seção líquida', !r.checks.some((c) => /rasgamento|seção líquida/i.test(c.nome) && /Colapso|Barra/.test(c.g))); }
{ const r = trussMemberConnection({ secao: { tipo: 'L', b: 50.8, t: 6.35, fy: 250, fu: 400 }, chapa: { t: 8, fy: 250, fu: 400, eBorda: 30, eLat: 60 }, meio: 'parafuso',
    par: { grade: 'ASTM A307', db: 12.7, n: 2, linhas: 1, s: 40, e1: 25, gHeel: 28 }, N: 20 });
  ok('A16. mínimo de 45 kN (6.1.5.2) para NSd = 20 kN', r.F, 45, 1e-12);
  yes('A17. borda e1 = 25 ≥ 19 (Tab. 16, ½")', r.checks.find((c) => /Borda da barra/.test(c.nome)).ok); }

// ---------------- B) NBR 14762 (Wanderson, Aplicação 1)
{ const r = trussMemberConnection({ secao: { tipo: 'U', bw: 150, bf: 50, t: 2, A: 489, ec: 23.3, fy: 250, fu: 400 },
    chapa: { t: 2, fy: 250, fu: 400, eBorda: 25, largura: 200 }, meio: 'parafuso',
    par: { grade: 'ASTM A307', db: 12.5, n: 2, linhas: 2, s: 50, g: 60, e1: 25, dh: 16 }, N: 40, opts: { NRdBarra: 60 } });
  yes('B1. norma: t = 2 ≤ 4,75 → NBR 14762', r.norma === '14762');
  ok('B2. Wanderson: Nt,Rd escoamento = 111 kN', find(r, /Escoamento da seção bruta/).Rd, 489 * 250 / 1.1 / 1000, 1e-9);
  ok('B3. Wanderson: Nt,Rd ruptura (Ct 0,44, An 3,83) = 40,8 kN', find(r, /seção líquida/).Rd, 40.8, 0.01);
  const ras = find(r, /Rasgamento entre furos \/ furo–borda — barra/);
  ok('B4. rasgamento: 2 linhas·(13,79 [e = 25] + 23,17 [e = 50 − 8]) kN', ras.Rd, 2 * (2 * 25 * 400 / 1.45 + 2 * 42 * 400 / 1.45) / 1000, 1e-9);
  ok('B5. Wanderson: esmagamento 4 × 12,3 kN', find(r, /Esmagamento — barra/).Rd, 4 * 12.3, 0.01);
  ok('B6. Wanderson: corte A307 12,5 = 15,1 kN', find(r, /^Cisalhamento/).Rd, 15.1, 0.005);
  ok('B7. 10.1-a: F = máx(40; 0,5·60) = 40 kN', r.F, 40, 1e-12);
  yes('B8. U com 1 linha — Wanderson usa 2 linhas: há bloco do miolo', r.checks.some((c) => /miolo/.test(c.nome))); }
{ const r = trussMemberConnection({ secao: { tipo: '2L', b: 40, t: 2.25, A: 171, ec: 11.2, fy: 250, fu: 400 }, chapa: { t: 4.75, fy: 250, fu: 400, eBorda: 25, eLat: 40, Lw: 80 },
    meio: 'parafuso', par: { grade: 'ASTM A307', db: 12.5, n: 2, linhas: 1, s: 40, e1: 25, gHeel: 20 }, N: 15 });
  ok('B9. 10.1-a sem NRd informado: 50 % do escoamento de 2·171 mm² = 38,9 kN', r.F, 0.5 * 2 * 171 * 250 / 1.1 / 1000, 1e-9);
  yes('B10. aviso de NRd adotado', r.avisos.some((a) => /10\.1-a/.test(a))); }
// ---------------- welded (NBR 8800), hand: L 76,2×6,35, dw 5 E70, L1 = L2 = 100, Lt = 76,2; F = 200
{ const r = trussMemberConnection({ secao: { tipo: 'L', b: 76.2, t: 6.35, fy: 250, fu: 400 }, chapa: { t: 9.5, fy: 250, fu: 400 }, meio: 'solda',
    sol: { dw: 5, L1: 100, L2: 100, Lt: 76.2, eletrodo: 'E70' }, N: 200 });
  const q = 0.6 * 0.707 * 5 * 485 / 1.35 / 1000, Fl = 200 * q, Ft = 76.2 * q;
  ok('C1. grupo longitudinal + transversal: máx(Fwl + Fwt; 0,85Fwl + 1,5Fwt) (6.2.5.2-c)', find(r, /Metal da solda/).Rd, Math.max(Fl + Ft, 0.85 * Fl + 1.5 * Ft), 1e-9);
  ok('C2. metal-base da barra 0,6·fu·200·6,35/1,35 vs 0,6·fy·…/1,10 (6.5.5)', find(r, /Metal-base da barra/).Rd, Math.min(0.6 * 250 * 1270 / 1.1, 0.6 * 400 * 1270 / 1.35) / 1000, 1e-9);
  // Tab. 11: t = 6,35 > 6,3 → mínimo 5 mm; 6.2.6.2.2-b: máximo ao longo da borda t − 1,5 = 4,85 mm "a não ser que nos desenhos
  // essa solda seja indicada como reforçada" → admitido com aviso de desenho
  yes('C3. dw = 5 (mínimo da Tab. 11) > 4,85 (máximo da borda): solda reforçada pela 6.2.6.2.2-b, com aviso', r.checks.some((c) => /reforçada/.test(c.nome)) && r.avisos.some((a) => /reforçado durante a execução/.test(a))); }

// ---------------- perfil I ligado pela alma (5.2.5-c, 2 U fictícios — Fig. 4); conta de mão (sem exemplo publicado)
//   W 150×13: d 148, bf 100, tf 4,9, tw 4,3 (laminado → NBR 8800 mesmo com tw ≤ 4,75); A = 2·100·4,9 + 138,2·4,3 = 1574,3 mm²;
//   meia seção (U): Q = 2·(50·4,9)·25 + 138,2·2,15·1,075 = 12 569 mm³ → ec = Q/(A/2) = 15,97 mm; ℓc = 2·50 = 100 → Ct = 0,840
{ const r = trussMemberConnection({ secao: { tipo: 'I', d: 148, bf: 100, tf: 4.9, tw: 4.3, t: 4.3, bw: 138.2, fy: 345, fu: 450, laminado: true },
    chapa: { t: 9.5, fy: 250, fu: 400, eBorda: 30, Lw: 100 }, meio: 'parafuso', par: { grade: 'ASTM F3125 A325', db: 16, n: 3, linhas: 2, s: 50, g: 60, e1: 30 }, N: 150 });
  const A = 2 * 100 * 4.9 + 138.2 * 4.3, ec = (2 * 50 * 4.9 * 25 + 138.2 * 2.15 * 1.075) / (A / 2), Ct = 1 - ec / 100, An = A - 2 * 20 * 4.3;
  yes('I1. perfil I laminado com tw = 4,3 mm → NBR 8800 (a 14762 é de formados a frio)', r.norma === '8800');
  ok('I2. ruptura da seção líquida: Ct = 1 − ec/ℓc (U fictício) · An · fu/γa2', find(r, /seção líquida/).Rd, Ct * An * 450 / 1.35 / 1000, 1e-9);
  ok('I3. ec = 15,97 mm → Ct = 0,840', Ct, 0.8403, 0.001);
  yes('I4. bloco do miolo da alma (2 linhas)', r.checks.some((c) => /miolo/.test(c.nome))); }
{ const { shearConnection } = await import('../js/design/connections_shear.js');
  const r = shearConnection({ tipo: 'cantoneira', V: 40, viga: { tw: 4.3, d: 148, fy: 345, fu: 450 }, cant: { b: 76, b2: 76, t: 6.4, fy: 250, fu: 400, ev: 30, eh: 31, a: 45, gc: 45 }, pilar: { t: 9, fu: 450 },
    par: { grade: 'ASTM F3125 A325', db: 15.875, n: 2, s: 60 } });
  yes('I5. viga W150×13 (tw 4,3) na ligação flexível → NBR 8800', r.norma === '8800'); }
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
