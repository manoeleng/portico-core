// ──────────────────────────────────────────────────────────────────────────────
// materials_catalog.js — Preloaded LIBRARY of standard MATERIALS (#69).
//
// Typical materials (steel, concrete, timber, aluminum) ready to insert into the
// model. Each carries E/G/ν/ρ/α in MODEL UNITS (E,G in kN/m²; ρ in t/m³; α in 1/°C)
// and its `design` block with family + strengths in MPa (what the G15 design engine
// consumes). Editable after insertion.
//
// (The steel PROFILE library is in `profiles.js`, #66.)
// ──────────────────────────────────────────────────────────────────────────────

const STEEL = (Fy, Fu, E = 2.1e8) => ({ E, G: E / 2.6, nu: 0.3, rho: 7.85, alpha: 1.2e-5,
  design: { family: 'steel', Fy, Fu, E: E / 1000 } });
const CONC = (fc, E) => ({ E, G: E / 2.4, nu: 0.2, rho: 2.5, alpha: 1.0e-5,
  design: { family: 'concrete', fc, fyRebar: 420 } });
const TIMBER = (Fb, Fc, Ft, Fv, E, rho) => ({ E, G: E / 16, nu: 0.3, rho, alpha: 5e-6,
  design: { family: 'timber', Fb, Fc, Ft, Fv, Fcp: 2.5 } });

// Brazilian structural steel — NBR 8800:2024 4.6.2.9: E = 200 000 MPa, G = 77 000 MPa, ν = 0,3,
// α = 1,2·10⁻⁵/°C, ρ = 7 850 kg/m³; fy/fu per Tab. A.1 (NBR 7007; MR 250 fu = 400 MPa minimum).
const STEEL_BR = (Fy, Fu) => ({ E: 2.0e8, G: 7.7e7, nu: 0.3, rho: 7.85, alpha: 1.2e-5,
  design: { family: 'steel', Fy, Fu, E: 200000 } });
// Brazilian concrete — NBR 6118:2026: Eci = αE·5600·√fck (fck ≤ 50 MPa, αE = 1,0 granite/gneiss) and
// Ecs = αi·Eci, αi = 0,8 + 0,2·fck/80 ≤ 1,0 (8.2.8); Gc = Ecs/2,4 and ν = 0,2 (8.2.9); α = 10⁻⁵/°C
// (8.2.3); reinforced concrete 2 500 kg/m³ (8.2.2). Analysis uses Ecs. Rebar CA-50 (fyk = 500 MPa).
const CONC_BR = (fck, aE = 1.0) => {
  const Ecs = Math.min(0.8 + 0.2 * fck / 80, 1.0) * aE * 5600 * Math.sqrt(fck) * 1000;   // kN/m²
  return { E: Ecs, G: Ecs / 2.4, nu: 0.2, rho: 2.5, alpha: 1.0e-5,
    design: { family: 'concrete', fc: fck, fyRebar: 500 } };
};

// Brazilian materials live in a separate catalogue so the base library is unchanged; the Brazil
// preset exposes them in the UI. getMaterialDef() resolves names from both.
export const MATERIALS_BR = {
  'Aço MR250':         STEEL_BR(250, 400),
  'Aço AR350':         STEEL_BR(350, 450),
  'Aço AR350 COR':     STEEL_BR(350, 485),
  'Aço AR415':         STEEL_BR(415, 520),
  'Concreto C20':      CONC_BR(20),
  'Concreto C25':      CONC_BR(25),
  'Concreto C30':      CONC_BR(30),
  'Concreto C35':      CONC_BR(35),
  'Concreto C40':      CONC_BR(40),
  'Concreto C45':      CONC_BR(45),
  'Concreto C50':      CONC_BR(50),
};
// Brazilian timber — NBR 7190-1:2022 Tab. 3 (strength classes from structural-size tests, 12 % moisture; read from
// the standard in the acervo, 15/10/2026): E0,m and Gm (GPa) for the analysis, ρm (mean density, kg/m³) for the self
// weight; the class goes to design.classe7190 (the NBR 7190 module takes fb,k, ft0,k, fc0,k, fv,k, E0,05 from it).
// α is not given by NBR 7190-1 → not set (no thermal load on timber); ν is not used by members (G is explicit).
const T7190 = {   // class: [E0m GPa, Gm GPa, ρm kg/m³]
  C14: [7, 0.4, 350], C16: [8, 0.5, 370], C18: [9, 0.6, 380], C20: [9.5, 0.6, 390], C22: [10, 0.6, 410], C24: [11, 0.7, 420],
  C27: [12, 0.7, 450], C30: [12, 0.8, 460], C35: [13, 0.8, 480], C40: [14, 0.9, 500], C45: [15, 0.9, 520], C50: [16, 1.0, 550],
  D18: [9.5, 0.6, 570], D24: [10, 0.6, 580], D30: [11, 0.7, 640], D35: [12, 0.8, 650], D40: [13, 0.8, 660], D50: [14, 0.9, 750],
  D60: [17, 1.1, 840], D70: [20, 1.25, 1080],
};
for (const [cls, [E, G, rho]] of Object.entries(T7190)) MATERIALS_BR[`Madeira ${cls}`] = { E: E * 1e6, G: G * 1e6, nu: 0.3, rho: rho / 1000,
  design: { family: 'timber', classe7190: cls } };

export const MATERIAL_FAMILIES_BR = {
  'Aço (NBR)':      ['Aço MR250', 'Aço AR350', 'Aço AR350 COR', 'Aço AR415'],
  'Concreto (NBR)': ['Concreto C20', 'Concreto C25', 'Concreto C30', 'Concreto C35', 'Concreto C40', 'Concreto C45', 'Concreto C50'],
  'Madeira (NBR)':  Object.keys(T7190).map((c) => `Madeira ${c}`),
};

export const MATERIALS = {
  // Structural steel (E≈210 GPa; A36/A572 at 200 GPa per ASTM convention).
  'Acero A36':         STEEL(250, 400, 2.0e8),
  'Acero A572 Gr.50':  STEEL(345, 450, 2.0e8),
  'Acero S275':        STEEL(275, 430, 2.1e8),
  'Acero S355':        STEEL(355, 490, 2.1e8),
  // Concrete — grade G by characteristic cylindrical f'c (NCh170:2016).
  // E = 4700√f'c MPa approx → kN/m².
  'Hormigón G20':      CONC(20, 2.10e7),
  'Hormigón G25':      CONC(25, 2.35e7),
  'Hormigón G30':      CONC(30, 2.57e7),
  'Hormigón G40':      CONC(40, 2.97e7),
  // Sawn timber (EN 338 / typical characteristic values).
  'Madera C16':        TIMBER(16, 17, 8.5, 1.8, 8.0e6, 0.37),
  'Madera C24':        TIMBER(24, 21, 14, 2.5, 1.1e7, 0.42),
  // Aluminum (E≈70 GPa; fo = 0.2 % proof stress).
  'Aluminio 6061-T6':  { E: 7.0e7, G: 2.6e7, nu: 0.33, rho: 2.7, alpha: 2.3e-5,
                         design: { family: 'aluminum', Fy: 240, Fu: 260, E: 70000 } },
};

// Families to group in the UI.
export const MATERIAL_FAMILIES = {
  Acero:    ['Acero A36', 'Acero A572 Gr.50', 'Acero S275', 'Acero S355'],
  Hormigón: ['Hormigón G20', 'Hormigón G25', 'Hormigón G30', 'Hormigón G40'],
  Madera:   ['Madera C16', 'Madera C24'],
  Aluminio: ['Aluminio 6061-T6'],
};

export function materialNames() { return Object.keys(MATERIALS); }

// Catalogue entries with type and standard (RFEM/CSI-like filtered library): [{ name, tipo, norma, resumo }]
const NORMA = (name, fam) => /^Aço /.test(name) ? 'NBR 8800:2024 / NBR 7007' : /^Concreto /.test(name) ? 'NBR 6118:2026'
  : /^Madeira /.test(name) ? 'NBR 7190-1:2022' : /A36|A572/.test(name) ? 'ASTM' : /S275|S355/.test(name) ? 'EN 10025'
  : /^Hormigón/.test(name) ? 'NCh 170' : /^Madera/.test(name) ? 'EN 338' : /Aluminio/.test(name) ? 'EN 1999' : fam;
const TIPO = { steel: 'aço', concrete: 'concreto', timber: 'madeira', aluminum: 'alumínio' };
export function catalogMaterials({ tipo = '', norma = '' } = {}) {
  const out = [];
  for (const [name, m] of [...Object.entries(MATERIALS_BR), ...Object.entries(MATERIALS)]) {
    const t = TIPO[m.design?.family] || 'outro', n = NORMA(name);
    if (tipo && t !== tipo) continue;
    if (norma && n !== norma) continue;
    const d = m.design || {};
    const resumo = t === 'aço' || t === 'alumínio' ? `fy ${d.Fy} MPa · fu ${d.Fu} MPa · E ${(m.E / 1e6).toFixed(0)} GPa`
      : t === 'concreto' ? `fck ${d.fc} MPa · Ecs ${(m.E / 1e6).toFixed(1)} GPa`
      : d.classe7190 ? `classe ${d.classe7190} · E0,m ${(m.E / 1e6)} GPa · ρm ${Math.round(m.rho * 1000)} kg/m³`
      : `E ${(m.E / 1e6).toFixed(1)} GPa`;
    out.push({ name, tipo: t, norma: n, resumo });
  }
  return out;
}
export function catalogNormas() { return [...new Set(catalogMaterials().map((x) => x.norma))]; }

// Definition ready for `model.addMaterial(...)` (deep copy + name).
export function getMaterialDef(name) {
  const m = MATERIALS[name] || MATERIALS_BR[name];
  return m ? { name, ...JSON.parse(JSON.stringify(m)), catalog: { name, norma: NORMA(name) } } : null;
}
