// sense_my.js — which side of a channel (U / Ue, NBR 6355 catalogue) is COMPRESSED by a weak-axis moment My of the
// solver, for the NBR 14762 weak-axis bending (options.sentidoMy = 'alma' | 'mesas').
//
// Solver convention (postprocess.js, fixed 15/10/2026): dMy/dx = +Vz, and a positive My compresses the fibres on the
// +z (local) side. Section orientation (viewport._sectionShape / _sectionOutline, the same in analysis and drawing): the
// profile's x axis is −z local, the flanges point to +x (= −z) and the web is on the +z side of the centroid.
// ⇒ My > 0 compresses the WEB ('alma'); My < 0 compresses the flange TIPS ('mesas'). β is already in the local axes.
export function senseOfMy(My) { return My > 0 ? 'alma' : 'mesas'; }

/** signed extremes of My along a member for one result: { pos: max(0, max My), neg: max(0, −min My) } */
export function myExtremes(res, elemId) {
  let d; try { d = res.getDiagramData(elemId, 'My', 12); } catch { return { pos: 0, neg: 0 }; }
  let pos = 0, neg = 0;
  for (const p of [...(d.pts || d || []), ...(d.extremes || [])]) { if (p.val > pos) pos = p.val; if (-p.val > neg) neg = -p.val; }
  return { pos, neg };
}
