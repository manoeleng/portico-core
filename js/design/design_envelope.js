// design_envelope.js — strength design (D/C) of every member over a set of solved states (the ULS combinations): the
// loop of App._computeDesign, moved here unchanged so it runs outside the browser (tests). For each member: worst state,
// forces = |max| along the member (diagrams), unbraced lengths per axis (NBR 8800:2024 4.10.6.1), U/Ue weak-axis sense
// from the sign of My (sense_my.js). Members with designExcluded are listed apart, never approved.
//   disResults: [{ name, res }] — Results with getElemForces / getDiagramData;  mod: design.js (checkElement)
import { unbracedLengths, memberWithUnbraced } from './unbraced.js?v=7';
import { senseOfMy, myExtremes } from './sense_my.js?v=7';
import { localAxes } from '../solver/timoshenko.js?v=7';

export function designMembers(model, disResults, params, mod) {
  const maxAbs = (res, eid, type) => {
    let d; try { d = res.getDiagramData(eid, type, 12); } catch { return 0; }
    let m = 0;
    for (const p of (d.pts || [])) m = Math.max(m, Math.abs(p.val));
    for (const e of (d.extremes || [])) m = Math.max(m, Math.abs(e.val));
    return m;
  };
  // The DEFLECTION verification is done separately (service): table of beam
  // deflections under unfactored live load (_computeBeamDeflections) and
  // story drifts (_computeDrift). Here only strength (D/C).
  const filas = [], excluidos = [];
  // unbraced lengths per axis from the physical members and their restraint points (NBR 8800:2024 4.10.6.1)
  const ub = unbracedLengths(model, localAxes);
  for (const el of model.elements.values()) {
    const sec = model.sections.get(el.secId);
    const mat = model.materials.get(el.matId);
    if (!sec || !mat) continue;
    // members whose analysis forces are not design forces (e.g. generated purlins/sag rods: the roofing loads the
    // truss chords) are listed, never "approved"
    if (el.designExcluded) { excluidos.push({ id: el.id, sec: sec.name, why: el.designExcluded }); continue; }
    let peor = null, peorNom = null, peorFuerzas = null;
    for (const { name: nombre, res } of disResults) {   // states carry `name` (was read as `nombre` → "undefined")
      const f = res.getElemForces(el.id); if (!f) continue;
      const fuerzas = {
        N: (Math.sign(f.N) || 1) * maxAbs(res, el.id, 'N'),
        Vy: maxAbs(res, el.id, 'Vy'), Vz: maxAbs(res, el.id, 'Vz'),
        My: maxAbs(res, el.id, 'My'), Mz: maxAbs(res, el.id, 'Mz'), L: f.L,
      };
      const member = memberWithUnbraced(el, ub.get(el.id));
      // channels (U / Ue, NBR 14762): the weak-axis check depends on which side My compresses — taken from the
      // SIGN of My along the member (sense_my.js): the largest positive My with the web compressed and the
      // largest negative My with the flange tips compressed; the worse one governs
      const shp = sec.design?.cfProps?.shape;
      let r;
      if ((shp === 'U' || shp === 'Ue') && fuerzas.My > 0) {
        const ex = myExtremes(res, el.id), cases = [];
        if (ex.pos > 1e-9) cases.push([senseOfMy(1), ex.pos]);
        if (ex.neg > 1e-9) cases.push([senseOfMy(-1), ex.neg]);
        const rv = (x) => (x == null || !isFinite(x)) ? Infinity : x;
        for (const [sentido, My] of cases.length ? cases : [[null, fuerzas.My]]) {
          const ri = mod.checkElement({ forces: { ...fuerzas, My }, sec, mat, matName: mat.name, params,
            designSettings: model.designSettings, member, options: sentido ? { sentidoMy: sentido } : undefined });
          if (sentido && Array.isArray(ri.avisos)) ri.avisos.push(`My: sentido pelo diagrama — ${sentido === 'alma' ? 'alma' : 'pontas das mesas'} comprimida(s), |My| = ${My.toFixed(3).replace('.', ',')} kN·m${cases.length > 1 ? ' (os dois sentidos ocorrem na barra; governa o pior)' : ''} — premissa: alma do perfil no lado +z local (orientação do catálogo; β gira).`);
          if (!r || rv(ri.ratioMax) > rv(r.ratioMax)) r = ri;
        }
      } else r = mod.checkElement({ forces: fuerzas, sec, mat, matName: mat.name, params,
        designSettings: model.designSettings, member });
      r.flamb = member ? { Lx: member.Lx, Ly: member.Ly, Lb: member.Lb, Lz: member.Lz, auto: !!member.unbracedAuto } : null;
      if (!peor || r.ratioMax > peor.ratioMax) { peor = r; peorNom = nombre; peorFuerzas = fuerzas; }
    }
    if (!peor) continue;
    const au = ub.get(el.id);
    if (au && Array.isArray(peor.avisos)) {
      const f2 = (v) => v == null ? '—' : (+v).toFixed(2).replace('.', ',');
      const fl = peor.flamb || {};
      peor.avisos.push(`Comprimentos destravados (NBR 8800:2024 4.10.6.1${fl.auto ? ', automático' : ''}): Lx = ${f2(fl.Lx)} m, Ly = ${f2(fl.Ly)} m, Lb = ${f2(fl.Lb)} m, Lz = ${f2(fl.Lz)} m — barra física de ${au.chain.length} trecho(s), ${f2(au.chainL)} m. Contenção = apoio, diafragma/placa ou barra que chega ao nó e se ancora em um deles (4.10.3.2); resistência e rigidez das contenções (4.12) NÃO verificadas. ${el.design?.contencaoTorcao ? 'Lb = Lz = Ly (contenção à torção declarada pelo usuário).' : 'Lb e Lz entre extremidades/apoios (conservador): declare a contenção à torção e da mesa comprimida para usar Ly.'} K = 1 pressupõe esforços de 2ª ordem (4.10.6.2).`);
      if (au.mixedSections) peor.avisos.push('Barra física com troca de seção: cada trecho verificado com o comprimento da barra inteira — barra não prismática, aproximação (contra a segurança no trecho mais pesado).');
      if (au.freeEnd) peor.avisos.push('Barra com extremidade livre (balanço): comprimento destravado com K = 1 — o balanço exige comprimento de flambagem maior; informe Lx/Ly.');
    }
    filas.push({ id: el.id, mat: mat.name, sec: sec.name, forces: peorFuerzas, combo: peorNom, ...peor });
  }
  filas.sort((a, b) => b.ratioMax - a.ratioMax);
  return { filas, excluidos };
}
