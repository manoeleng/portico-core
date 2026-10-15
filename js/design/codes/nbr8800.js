// ──────────────────────────────────────────────────────────────────────────────
// nbr8800.js — STEEL design per ABNT NBR 8800:2024 (PLANO_BRASIL 7.1).
//
//   · 5.2.2-a tension          Nt,Rd = Ag·fy/γa1   (net-section rupture 5.2.2-b NOT checked)
//   · 5.3     compression      Nc,Rd = χ·Aef·fy/γa1;  λ0 = √(Ag·fy/Ne)  (5.3.3.2)
//               Ne = min(Nex, Ney, Nez) for doubly symmetric I (5.3.5.1)
//               Aef by effective width (5.3.4.2, Tab. 4/5) — the 2024 edition has NO Q factor
//   · Anexo D bending          I/H major axis: FLT (D.2.1, D.2.8-a: Cb inside λr and Mcr,
//               interpolation NOT multiplied by Cb), FLM (D.2.8-f, rolled/welded), FLA;
//               minor axis: FLM only (D.2.8-c/g);  MRd ≤ 1,5·W·fy/γa1 (5.4.2.2)
//               slender web (h/tw > 5,70√(E/fy), Anexo E) is out of scope → reported, not computed
//   · 5.4.3   shear            web (5.4.3.1, kv = 5,34 unstiffened) and minor axis (5.4.3.5, kv = 1,2)
//   · 5.5.1.2 N+M interaction  NSd/NRd ≥ 0,2: + 8/9·ΣM ; < 0,2: NSd/2NRd + ΣM
//
// Buckling lengths: NBR 8800:2024 uses UNBRACED lengths (4.10.6.1, 5.3.5.1) with internal
// forces from a second-order analysis including imperfections (4.10.6.2/4.10.7), so K = 1 by
// default; member.K/Kz/Ky are accepted as an override for isolated members and flagged.
// Axes: this code uses z = strong axis (NBR x: Mz → Msd,x, Iz → Ix) and y = weak axis.
// Units: kN, m, kN/m². Sections other than I/H get a simplified check (flagged).
// Source transcription: PLANO_BRASIL "Fase 3" ficha (pages checked against the 2024 PDF).
// ──────────────────────────────────────────────────────────────────────────────

import { finalize } from './aisc360.js?v=7';

const ratObj = (D, C, extra = {}) => ({
  demand: +(+D).toFixed(4), capacity: +(+C).toFixed(4),
  ratio: C > 1e-12 ? +(D / C).toFixed(4) : Infinity, ...extra,
});
const chiOf = (l0) => l0 <= 1.5 ? Math.pow(0.658, l0 * l0) : 0.877 / (l0 * l0);   // 5.3.3.1
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

function checkNBR8800({ demands, mat, sec, member = {}, options = {} }) {
  const fy = mat.Fy, E = mat.E, G = mat.G || 0.385 * E;           // G = 77 000 MPa for E = 200 000 MPa (NBR 8800:2024 4.6.2.9-c)
  const ga1 = options.gamma_a1 ?? 1.10, ga2 = options.gamma_a2 ?? 1.35;   // Tab. 3
  const avisos = [];
  const { A, Iz, Iy, J, Cw, Sz, Sy, Zz, Zy, rz, ry, shape } = sec;
  const isI = shape === 'I' && Cw > 0 && J > 0;
  const dims = sec.dims || {};
  const tf = dims.tf, tw = dims.tw, bf = dims.bf ?? sec.b, d = dims.d ?? sec.h;
  // λ of flange (bf/2tf) and web (h/tw): catalogue values, else derived from the plate dims
  const hWeb = (sec.lambdaWeb > 0 && tw > 0) ? sec.lambdaWeb * tw : (d > 0 && tf > 0 ? d - 2 * tf : 0);
  const lamF = sec.lambdaFlange > 0 ? sec.lambdaFlange : (bf > 0 && tf > 0 ? bf / (2 * tf) : NaN);
  const lamW = sec.lambdaWeb > 0 ? sec.lambdaWeb : (hWeb > 0 && tw > 0 ? hWeb / tw : NaN);
  const welded = sec.fabricacao === 'soldado';
  if (shape === 'I' && !isI) avisos.push('Perfil I sem Cw/J: verificação simplificada (sem FLT nem flambagem por torção).');
  if (isI && !(isFinite(lamF) && isFinite(lamW))) avisos.push('Faltam λ da mesa/alma e dimensões da chapa: flambagem local, FLM e FLA NÃO verificadas.');
  if (isI && !(sec.lambdaWeb > 0) && isFinite(lamW) && !welded) avisos.push('h/tw derivado de d − 2·tf: em laminado a norma desconta os raios de concordância (D.3) — informe λ de catálogo.');
  if (isI && sec.fabricacao !== 'laminado' && sec.fabricacao !== 'soldado') {
    avisos.push('Fabricação não informada: adotado perfil soldado (FLM/flambagem local mais conservadoras).');
  }
  const kc = (hWeb > 0 && tw > 0) ? clamp(4 / Math.sqrt(hWeb / tw), 0.35, 0.76) : 0.35;   // Tab. 4, nota a
  const sr = 0.3 * fy;                                              // σr (D.2.8-e)

  const L = member.L || 1;
  const Ks = ['K', 'Kz', 'Ky', 'Kt'].map(k => member[k]).filter(v => v != null);
  if (Ks.some(v => v < 1)) avisos.push('K < 1 informado: sem base na NBR 8800:2024 (comprimento destravado, 5.3.5.1) e contra a segurança.');
  else if (Ks.some(v => v > 1)) avisos.push('K > 1 informado (barra isolada/balanço): a NBR 8800:2024 é omissa (comprimento destravado + análise de 2ª ordem, 4.10.6.2) — decisão do RT.');
  const Lx = member.Lx ?? (member.Kz ?? member.K ?? 1) * L;          // buckling about strong axis
  const Ly = member.Ly ?? (member.Ky ?? member.K ?? 1) * L;          // about weak axis
  const Lt = member.Lz ?? (member.Kt ?? 1) * L;                      // torsion
  const Lb = member.Lb ?? L;
  const Cb = member.Cb ?? 1.0;

  const N = demands.N || 0, Nabs = Math.abs(N);
  const Vy = Math.abs(demands.Vy || 0), Vz = Math.abs(demands.Vz || 0);
  const My = Math.abs(demands.My || 0), Mz = Math.abs(demands.Mz || 0);

  // ── 5.2 tension / 5.3 compression ─────────────────────────────────────────────
  let axial, NRd;
  if (N >= 0) {
    NRd = A * fy / ga1;
    const slT = Math.max(L / rz, L / ry);
    if (slT > 300) avisos.push(`Esbeltez de barra tracionada ${slT.toFixed(0)} > 300 (5.2.8.1).`);
    axial = ratObj(Nabs, NRd, { modo: 'tração', formula: 'Nt,Rd = Ag·fy/γa1 (5.2.2-a)' });
    if (Nabs > 0) avisos.push('Tração: ruptura da seção líquida (5.2.2-b) não verificada — o modelo não tem área líquida.');
  } else {
    const Nex = Math.PI ** 2 * E * Iz / (Lx * Lx);
    const Ney = Math.PI ** 2 * E * Iy / (Ly * Ly);
    let Nez = Infinity;
    if (isI && J > 0) Nez = (Math.PI ** 2 * E * Cw / (Lt * Lt) + G * J) / (rz * rz + ry * ry);   // x0 = y0 = 0
    const Ne = Math.min(Nex, Ney, Nez);
    const lambda0 = Math.sqrt(A * fy / Ne);
    const chi = chiOf(lambda0);
    // effective area (5.3.4.1/5.3.4.2): Aef = Ag − Σ(b − bef)·t  [sum over elements: interpretation,
    // the text says "with them, the effective area of the section"]
    let Aef = A, localOk = true;
    if (isI) {
      const elems = [];
      const limF = welded ? 0.64 * Math.sqrt(E / (fy / kc)) : 0.56 * Math.sqrt(E / fy);   // Tab. 4 grupos 5 / 4
      const limW = 1.49 * Math.sqrt(E / fy);                                            // Tab. 4 grupo 2
      if (lamF > 0) elems.push({ bt: lamF, lim: limF, c1: 0.22, c2: 1.49, n: 4, t: tf, b: bf / 2 });   // AL, Tab. 5
      if (lamW > 0) elems.push({ bt: lamW, lim: limW, c1: 0.18, c2: 1.31, n: 1, t: tw, b: hWeb });     // AA
      for (const e of elems) {
        if (e.bt <= e.lim / Math.sqrt(chi)) continue;
        const sel = (e.c2 * e.lim / e.bt) ** 2 * fy;
        const k = Math.sqrt(sel / (chi * fy));
        const ratio = Math.min(1, (1 - e.c1 * k) * k);           // bef/b (≤ 1 at the transition)
        if (e.t > 0 && e.b > 0) Aef -= e.n * (1 - ratio) * e.b * e.t;
        else localOk = false;
      }
      if (!localOk) avisos.push('Flambagem local: faltam dimensões da chapa (d, bf, tf, tw) para calcular Aef — adotado Aef = Ag (NÃO verificado).');
    } else {
      avisos.push(`Seção "${shape}": compressão simplificada (Aef = Ag, sem flambagem local nem por torção).`);
    }
    NRd = chi * Aef * fy / ga1;
    axial = ratObj(Nabs, NRd, { modo: 'compressão', chi: +chi.toFixed(4), lambda0: +lambda0.toFixed(4),
      Ne: +Ne.toFixed(2), Aef, formula: 'Nc,Rd = χ·Aef·fy/γa1 (5.3.2); λ0 = √(Ag·fy/Ne)' });
    const slend = Math.max(Lx / rz, Ly / ry);
    if (slend > 200) avisos.push(`Esbeltez ${slend.toFixed(0)} > 200 (5.3.7.1).`);
  }

  // ── Anexo D bending ───────────────────────────────────────────────────────────
  const interp = (Mpl, Mr, lam, lp, lr) => Mpl - (Mpl - Mr) * (lam - lp) / (lr - lp);
  let flexaoX, flexaoY;
  if (isI) {
    const W = Sz, Mpl = Zz * fy, Mr = (fy - sr) * W;
    // FLT (D.2.1, D.2.8-a)
    const lam = Lb / ry, lp = 1.76 * Math.sqrt(E / fy);
    const b1 = (fy - sr) * W / (E * J);
    const lr = (1.38 * Cb * Math.sqrt(Iy * J) / (ry * J * b1)) * Math.sqrt(1 + Math.sqrt(1 + 27 * Cw * b1 * b1 / (Cb * Cb * Iy)));
    const Mcr = (Cb * Math.PI ** 2 * E * Iy / (Lb * Lb)) * Math.sqrt((Cw / Iy) * (1 + 0.039 * J * Lb * Lb / Cw));
    const MnFLT = lam <= lp ? Mpl : lam <= lr ? interp(Mpl, Mr, lam, lp, lr) : Mcr;
    const ramoFLT = lam <= lp ? 'FLT: λ ≤ λp' : lam <= lr ? 'FLT: λp < λ ≤ λr' : 'FLT: λ > λr (elástica)';
    // FLM (D.2.8-f)
    const lpF = 0.38 * Math.sqrt(E / fy);
    const lrF = welded ? 0.95 * Math.sqrt(E / ((fy - sr) / kc)) : 0.83 * Math.sqrt(E / (fy - sr));
    const McrF = (welded ? 0.90 * E * kc : 0.69 * E) * W / (lamF * lamF);
    const MnFLM = lamF <= lpF ? Mpl : lamF <= lrF ? interp(Mpl, Mr, lamF, lpF, lrF) : McrF;
    // FLA (Tab. D.1)
    const lpW = 3.76 * Math.sqrt(E / fy), lrW = 5.70 * Math.sqrt(E / fy);
    let MnFLA = lamW <= lpW ? Mpl : interp(Mpl, fy * W, lamW, lpW, lrW);
    const slenderWeb = lamW > lrW;
    if (slenderWeb) { MnFLA = 0; avisos.push(`Alma esbelta (h/tw = ${lamW.toFixed(1)} > ${lrW.toFixed(1)}): Anexo E fora do escopo — flexão NÃO verificada.`); }
    const cap = 1.5 * W * fy;                                      // 5.4.2.2
    const cand = [[MnFLT, ramoFLT], [MnFLM, 'FLM'], [MnFLA, 'FLA'], [cap, '1,5·W·fy (5.4.2.2)']];
    const unk = cand.some(([v]) => !isFinite(v));
    const [Mn, ramo] = cand.filter(([v]) => isFinite(v)).reduce((a, b) => b[0] < a[0] ? b : a);
    flexaoX = ratObj(Mz, Mn / ga1, { eixo: 'forte (Mz = Msd,x)', ramo, Mpl, Mr, Mcr,
      Lp: lp * ry, Lr: lr * ry, Cb, MRdFLT: MnFLT / ga1, MRdFLM: MnFLM / ga1,
      formula: 'MRd = min(FLT, FLM, FLA)/γa1 ≤ 1,5·W·fy/γa1 (Anexo D)' });
    if (slenderWeb || unk) flexaoX.ratio = Infinity;
    // minor axis: FLM only (D.2.8-c, D.2.8-g)
    const Wy = Sy, Mply = Zy * fy, Mry = (fy - sr) * Wy;
    const McrFy = (welded ? 0.90 * E * kc : 0.69 * E) * Wy / (lamF * lamF);
    const MnFLMy = lamF <= lpF ? Mply : lamF <= lrF ? interp(Mply, Mry, lamF, lpF, lrF) : McrFy;
    const Mny = Math.min(MnFLMy, 1.5 * Wy * fy);
    flexaoY = ratObj(My, Mny / ga1, { eixo: 'fraco (My = Msd,y)', formula: 'MRd = min(FLM, 1,5·W·fy)/γa1 (Anexo D)' });
  } else {
    const Mnz = Math.min(Zz * fy, 1.5 * Sz * fy), Mny = Math.min(Zy * fy, 1.5 * Sy * fy);
    flexaoX = ratObj(Mz, Mnz / ga1, { eixo: 'forte (Mz = Msd,x)', ramo: 'Mpl (simplificada)', formula: 'MRd = Mpl/γa1 ≤ 1,5·W·fy/γa1' });
    flexaoY = ratObj(My, Mny / ga1, { eixo: 'fraco (My = Msd,y)', formula: 'MRd = Mpl/γa1 ≤ 1,5·W·fy/γa1' });
    avisos.push(`Seção "${shape}": flexão simplificada (sem FLT nem flambagem local).`);
  }

  // ── 5.4.3 shear ───────────────────────────────────────────────────────────────
  const shearRd = (lam, kv, Aw) => {
    const lp = 1.10 * Math.sqrt(kv * E / fy), lr = 1.37 * Math.sqrt(kv * E / fy), Vpl = 0.60 * Aw * fy;
    if (lam <= lp) return { V: Vpl / ga1, regime: 'plastificação (λ ≤ λp)' };
    if (lam <= lr) return { V: (lp / lam) * Vpl / ga1, regime: 'inelástico (λp < λ ≤ λr)' };
    return { V: 1.24 * (lp / lam) ** 2 * Vpl / ga1, regime: 'elástico (λ > λr)' };
  };
  let corteY, corteZ;
  if (isI) {
    const kv = member.kv ?? 5.34;                                  // unstiffened web (5.4.3.1.1)
    const Aw = (d > 0 && tw > 0) ? d * tw : sec.Avy;               // 5.4.3.1.2: Aw = d·tw
    if (!(d > 0 && tw > 0)) avisos.push('Cortante: sem d·tw, adotado Aw = área de alma do modelo.');
    const sY = shearRd(lamW, kv, Aw);
    corteY = ratObj(Vy, sY.V, { dir: 'Vy (alma)', regime: sY.regime, formula: 'Vpl = 0,60·Aw·fy, Aw = d·tw (5.4.3.1)' });
    const Awz = (bf > 0 && tf > 0) ? 2 * bf * tf : sec.Avz;        // 5.4.3.5: kv = 1,2; h = bf/2; tw = tf
    const sZ = shearRd(lamF, 1.2, Awz);
    corteZ = ratObj(Vz, sZ.V, { dir: 'Vz (mesas)', regime: sZ.regime, formula: 'Aw = 2·bf·tf, kv = 1,2 (5.4.3.5)' });
  } else {
    corteY = ratObj(Vy, 0.60 * sec.Avy * fy / ga1, { dir: 'Vy', regime: 'simplificado', formula: 'VRd = 0,60·Av·fy/γa1' });
    corteZ = ratObj(Vz, 0.60 * sec.Avz * fy / ga1, { dir: 'Vz', regime: 'simplificado', formula: 'VRd = 0,60·Av·fy/γa1' });
  }

  // ── 5.5.1.2 interaction ───────────────────────────────────────────────────────
  const nr = NRd > 1e-12 ? Nabs / NRd : 0;
  const mm = (flexaoX.capacity > 1e-12 ? Mz / flexaoX.capacity : 0) + (flexaoY.capacity > 1e-12 ? My / flexaoY.capacity : 0);
  const H = nr >= 0.2 ? nr + (8 / 9) * mm : nr / 2 + mm;
  const interaction = ratObj(H, 1, { adim: true, modo: axial.modo,
    formula: nr >= 0.2 ? 'NSd/NRd + 8/9·(Mx,Sd/Mx,Rd + My,Sd/My,Rd) (5.5.1.2-a)' : 'NSd/2NRd + (Mx,Sd/Mx,Rd + My,Sd/My,Rd) (5.5.1.2-b)' });

  if (Nabs > 0 && N < 0) avisos.push('Esforços devem vir de análise de 2ª ordem com imperfeições (NBR 8800:2024 4.10.6.2/4.10.7).');
  const bending = flexaoX.ratio >= flexaoY.ratio ? flexaoX : flexaoY;
  const shear = corteY.ratio >= corteZ.ratio ? corteY : corteZ;
  return finalize({ material: 'aço', metodo: 'ABNT NBR 8800:2024', axial, bending, shear, interaction,
    flexaoX, flexaoY, corteY, corteZ, avisos }, options);
}

export const nbr8800 = {
  id: 'NBR8800:2024', family: 'steel', label: 'ABNT NBR 8800:2024',
  check: (input) => checkNBR8800(input),
};
