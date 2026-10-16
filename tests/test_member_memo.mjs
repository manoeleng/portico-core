// test_member_memo.mjs — memória de cálculo por barra (js/report/member_memo.js): é só apresentação — os números vêm da
// linha de dimensionamento (checkElement). Oráculo: os próprios valores da linha convertidos À MÃO para as unidades da
// memória (m² → cm², m³ → cm³, m → mm) e a presença de fórmula/cláusula em cada estado-limite.
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.document = { documentElement: { lang: 'pt' }, querySelectorAll: () => [] };
const R = new URL('../', import.meta.url).href;
const { i18n } = await import(R + 'js/i18n/i18n.js?v=7');
const { memberMemo, memoHTML, memoDocx, criticalPerSection } = await import(R + 'js/report/member_memo.js?v=7');
const { Docx } = await import(R + 'js/io/docx.js');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };
i18n.setLocale('pt');
// linha real da perna interna do galpão 3D do Wanderson (U 200x100x3,75, ZAR 280), recortada
const row = {
  id: 242, mat: 'Aço ZAR 280', sec: 'U 200x100x3,75 (pernas do pilar)', combo: 'C1 – 1,25PP + 1,30CP + 1,5SC', metodo: 'ABNT NBR 14762:2010 (MLE)',
  code: 'NBR8800:2024', codigoLabel: 'ABNT NBR 8800:2024', ratioMax: 0.8461, governs: 'interacción',
  forces: { N: -123.297, Vy: 0.00073, Vz: 1.596, My: 1.3272, Mz: 0.0042, L: 0.88 },
  axial: { demand: 123.29729, capacity: 210.94849, ratio: 0.5845, modo: 'compressão', chi: 0.8341, lambda0: 0.6583, Ne: 939.4242, Nexz: 939.4242,
    modoGlobal: 'flexo-torção', esbeltez: { x: 49.81, y: 27.76, limite: 200 }, Aef: 0.0010838655816063766, NcRdGlobal: 210.94849,
    distorcional: { dispensada: true, motivo: '9.3: U simples não sofre flambagem distorcional' }, formula: 'Nc,Rd = min(χ·Aef·fy/1,20 (9.7.2); χdist·A·fy/1,20 (9.7.3))', novoValor: 1.5 },
  flexaoX: { demand: 0.0042, capacity: 17.657564, ratio: 0.0002, eixo: 'forte (Mz = Msd,x)', ramo: 'escoamento (9.8.2.1)', Wef: 0.00006936899956065032, MRdEsc: 17.657563524529174, formula: 'MRd = min(...) (9.8.2)' },
  flexaoY: { demand: 1.3272189, capacity: 5.0784075, ratio: 0.2613, comp: 'alma', Wef: 0.00001995088676671214, MRdEsc: 5.078407540617636, Me: 352.9246242863384, formula: 'MRd = min(Wef·fy/1,10; …) (9.8.2)' },
  corteY: { demand: 0.00073, capacity: 105.95455, ratio: 0, kv: 5, h: 0.185, ht: 49.333333, formula: 'VRd (9.8.3), kv = 5,0' },
  corteZ: { demand: 1.596, capacity: 105.95455, ratio: 0.0151, kv: 1.2, formula: 'VRd pela NBR 8800:2024 5.4.3.5' },
  interaction: { demand: 0.84607, capacity: 1, ratio: 0.8461, adim: true, parcelas: { N: 0.58449, Mx: 0.00024, My: 0.26135 }, formula: 'NSd/NRd + Mx,Sd/Mx,Rd + My,Sd/My,Rd ≤ 1,0 (9.9)' },
  bending: { demand: 1.3272189, capacity: 5.0784075, ratio: 0.2613, formula: 'cópia do eixo governante' },
  avisos: ['Perfil formado a frio: verificado pela ABNT NBR 14762:2010.', 'aviso com <tag>'],
  flamb: { Lx: 3.98, Ly: 0.88, Lb: 0.88, Lz: 0.88, auto: true },
};
const cf = { shape: 'U', dims: { bw: 0.2, bf: 0.1, t: 0.00375, ri: 0.00375 }, A: 0.001454, Iz: 0.0000092863, Iy: 0.0000014624, Sz: 0.00009286, Sy: 0.00001996, rz: 0.0799, ry: 0.0317, J: 6.8994140625e-9, Cw: 9.94985e-9, x0: 0.0616, xg: 0.0267, r0: 0.1058, fonte: 'ABNT NBR 6355:2012 Tab. A.2' };
const model = { elements: new Map([[242, { matId: 3, secId: 3, design: { contencaoTorcao: true } }]]), materials: new Map([[3, { name: 'Aço ZAR 280', E: 2e8, G: 7.7e7, design: { Fy: 280, Fu: 380 } }]]),
  sections: new Map([[3, { design: { cfProps: cf } }]]), loadCases: new Map([[6, { name: 'PP' }], [1, { name: 'CP' }], [2, { name: 'SC' }]]),
  combinations: new Map([[1, { name: 'C1 – 1,25PP + 1,30CP + 1,5SC', factors: [{ lcId: 6, factor: 1.25 }, { lcId: 1, factor: 1.3 }, { lcId: 2, factor: 1.5 }] }]]) };
const m = memberMemo(row, { model });
const find = (rows, lab) => rows.find(([a]) => a.startsWith(lab))?.[1];
ok(find(m.dados, 'Material')?.includes('fy = 280 MPa, fu = 380 MPa, E = 200000 MPa, G = 77000 MPa'), `aço com fy/fu/E/G (${find(m.dados, 'Material')})`);
ok(find(m.dados, 'Seção')?.endsWith('ABNT NBR 6355:2012 Tab. A.2'), 'seção com a fonte do catálogo');
ok(find(m.dados, 'Norma')?.startsWith('ABNT NBR 14762:2010') && find(m.dados, 'Norma').includes('referência externa: ABNT NBR 8800:2024'), `PFF: norma NBR 14762, NBR 8800 só como referência externa (${find(m.dados, 'Norma')})`);
ok(find(m.dados, 'Combinação')?.endsWith('= 1,25 × PP + 1,30 × CP + 1,50 × SC'), `combinação com os fatores (${find(m.dados, 'Combinação')})`);
ok(find(m.dados, 'Coeficientes de ponderação')?.includes('1,20 (9.7)'), 'γ da NBR 14762 declarados');
ok(find(m.props, 'A') === '14,54 cm²' && find(m.props, 'Ix · Iy') === '928,63 · 146,24 cm⁴' && find(m.props, 'Cw') === '9949,9 cm⁶' && find(m.props, 'r0') === '105,80 mm',
  `propriedades da seção bruta (A 14,54 cm², Ix 928,63 cm⁴, Cw 9949,9 cm⁶, r0 105,80 mm): ${JSON.stringify(m.props)}`);
ok(find(m.dados, 'Combinação determinante')?.startsWith(row.combo), 'combinação determinante');
ok(find(m.dados, 'Comprimentos destravados') === 'Lx = 3,98 · Ly = 0,88 · Lb = 0,88 · Lz = 0,88 m (automático); K = 1', `comprimentos destravados: ${find(m.dados, 'Comprimentos destravados')}`);
ok(find(m.dados, 'Contenção à torção')?.includes('Lb = Lz = Ly'), 'contenção à torção declarada');
ok(find(m.esforcos, 'N') === '123,30 kN (compressão)', `N: ${find(m.esforcos, 'N')}`);
ok(find(m.esforcos, 'My') === '1,327 kN·m', `My: ${find(m.esforcos, 'My')}`);
ok(m.blocos.map((b) => b.key).join() === 'axial,flexaoX,flexaoY,corteY,corteZ,interaction', `blocos NBR na ordem, sem o 'bending' duplicado (${m.blocos.map((b) => b.key)})`);
ok(m.blocos.every((b) => b.formula && /\(\d|NBR|9\.\d/.test(b.formula)), 'cada estado-limite com fórmula e cláusula');
const ax = m.blocos[0];
ok(ax.Sd === '123,30 kN' && ax.Rd === '210,95 kN' && ax.ratio === 0.5845, `axial Sd/Rd: ${ax.Sd} / ${ax.Rd}`);
ok(find(ax.itens, 'Aef') === '10,84 cm²', `Aef 0,00108387 m² = 10,84 cm² (${find(ax.itens, 'Aef')})`);
ok(find(ax.itens, 'χ') === '0,8341' && find(ax.itens, 'λ0') === '0,6583' && find(ax.itens, 'Ne ') === '939,42 kN', 'χ, λ0, Ne');
ok(find(ax.itens, 'Esbeltez') === 'x 49,8 · y 27,8 / 200', `esbeltez: ${find(ax.itens, 'Esbeltez')}`);
ok(find(ax.itens, 'Flambagem distorcional')?.startsWith('dispensada — 9.3'), 'distorcional dispensada com o motivo');
ok(find(ax.outros, 'novoValor') === '1,5000', 'chave desconhecida aparece em "outros valores" (nada escondido)');
const fy = m.blocos[2];
ok(find(fy.itens, 'Wef') === '19,95 cm³' && find(fy.itens, 'MRd (início') === '5,078 kN·m' && find(fy.itens, 'Me ') === '352,925 kN·m', `flexão eixo fraco: Wef 1,9951e-5 m³ = 19,95 cm³ (${find(fy.itens, 'Wef')})`);
ok(find(m.blocos[3].itens, 'h (parte plana)') === '185,00 mm', 'h 0,185 m = 185,00 mm');
const it = m.blocos.find((b) => b.key === 'interaction');
ok(it.Sd === '0,846' && it.Rd === '1,000' && find(it.itens, 'Parcelas') === 'N 0,584 + Mx 0,000 + My 0,261', `interação adimensional e parcelas (${find(it.itens, 'Parcelas')})`);
ok(m.veredito === 'atende' && m.pend.length === 0, `sem pendências: "${m.veredito}"`);
const m2 = memberMemo({ ...row, ratioMax: 0.948, condicionado: '9.7.5 não verificado (l1 não informado): resultado de dois perfis independentes',
  avisos: ['Tração: ruptura da seção líquida (9.6.2 b/c, Ct) não verificada — informe member.secaoLiquida.', 'Cb = 1,0 (a favor da segurança).'] }, { model });
ok(m2.veredito === 'ATENDE COM RESSALVAS' && m2.pend.length === 2, `pendências no topo e veredito com ressalvas (${m2.veredito}, ${m2.pend.length})`);
ok(memoHTML(m2).indexOf('Premissas e verificações pendentes') < memoHTML(m2).indexOf('Propriedades da seção bruta'), 'pendências antes dos dados');
const m3 = memberMemo({ ...row, axial: { ...row.axial, composta: { Nzf: 171.81, Nt: 166.64 } }, forces: { ...row.forces, Vz: 6.97e-19 } }, { model });
ok(find(m3.blocos[0].itens, 'Nex — flexão em relação a x') === '171,81 kN' && find(m3.blocos[0].itens, 'Nt (torção pura)') === '166,64 kN', 'composta: Nzf é flexão (não torção), Nt é a torção');
ok(find(m3.esforcos, 'Vz') === '0 kN', 'ruído numérico (1e-19) aparece como 0');
// anchoring (NBR 14762:2010 item + expression per value; read from the standard)
const r3 = (rows, lab) => rows.find(([x]) => x.startsWith(lab))?.[2];
ok(r3(ax.itens, 'χ')?.startsWith('9.7.2 — χ = 0,658^(λ0²)') && r3(ax.itens, 'Aef')?.startsWith('9.7.2; 9.2.2'), `âncoras do bloco axial (χ: ${r3(ax.itens, 'χ')})`);
ok(ax.norma.startsWith('NBR 14762:2010 9.7') && m.blocos.find((b) => b.key === 'corteZ').norma.startsWith('NBR 8800:2024 5.4.3.4') && it.norma.startsWith('NBR 14762:2010 9.9'), 'cláusula de cada estado-limite (9.7, 8800 5.4.3.x, 9.9)');
ok(r3(fy.itens, 'Me ')?.startsWith('9.8.2.2 / Anexo E') && r3(fy.itens, 'MRd (início')?.startsWith('9.8.2.1'), 'âncoras da flexão (Me 9.8.2.2/Anexo E, MRd 9.8.2.1)');
ok(r3(m3.blocos[0].itens, 'Nex — flexão em relação a x')?.startsWith('9.7.2.2 a) (y de simetria'), 'composta: Nex ancorado em 9.7.2.2 a) com y de simetria');
const m4 = memberMemo({ ...row, avisos: ['elemento AL com ψ < −1: extensão da Tab. 6 com k = 23,8 — não é leitura literal da NBR 14762.'] }, { model });
ok(m4.pend.length === 1 && m4.avisos.length === 0 && m4.veredito === 'ATENDE COM RESSALVAS', 'extensão não literal da Tab. 6 vai às pendências e não se repete nos avisos');
const html = memoHTML(m);
ok(html.includes('aviso com &lt;tag&gt;') && !html.includes('<tag>'), 'HTML escapa os avisos');
ok(html.includes('Barra #242') && html.includes('r-ok') && html.includes('(9.9)') && html.includes('ART'), 'HTML com cabeçalho, cor do veredito, cláusulas e a nota de responsabilidade técnica');
const d = new Docx(); memoDocx(d, m);
ok(d._body.length > 10 && d._body.join('').includes('Força axial'), `Word: ${d._body.length} parágrafos/tabelas`);
// outras normas (sem flexaoX/corteY): blocos genéricos axial / flexão / cortante / interação
const g = memberMemo({ id: 1, sec: 'W 200x15', mat: 'A36', ratioMax: 1.2, axial: { demand: 1, capacity: 2, ratio: 0.5 }, bending: { demand: 3, capacity: 2.5, ratio: 1.2, formula: 'φMn (F2)' }, shear: { demand: 1, capacity: 9, ratio: 0.11 }, forces: { N: 1 } }, {});
ok(g.blocos.map((b) => b.key).join() === 'axial,bending,shear' && !g.ok, 'norma genérica: blocos bending/shear e veredito NÃO ATENDE');
const crit = criticalPerSection([{ sec: 'A', ratioMax: 0.5, id: 1 }, { sec: 'A', ratioMax: 0.9, id: 2 }, { sec: 'B', ratioMax: 0.95, id: 3 }]);
ok(crit.map((x) => x.id).join() === '3,2', 'memorial: barra mais solicitada de cada seção, ordenada');
console.log(`test_member_memo: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
