// test_connections_persist.mjs — the connection design recorded in the model ("Gravar no modelo") survives the
// file round trip (serializer.fromJSON reads obj.connectionDesign; app._singleSaveJSON writes it).
//   node tests/test_connections_persist.mjs
import { Serializer } from '../js/model/serializer.js';
import { Model } from '../js/model/model.js';
let fails = 0, n = 0;
const yes = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } else console.log(`ok   ${name}`); };
const S = new Serializer(), m = new Model();
const a = m.addNode(0, 0, 0), b = m.addNode(0, 0, 4);
const rec = { versao: 1, data: '16/10/2026', nCombos: 3, rows: [{ id: 'B1', tipo: 'base', node: a.id ?? a, elem: 1, desc: 'placa 418 × 175 × 22,4 mm', ratio: 0.91, ok: true, geo: { tipo: 1, nb: 4, db: 19 } }] };
const obj = JSON.parse(S.toJSON(m));
yes('P1. a assinatura do cache (toJSON) NÃO inclui as ligações', !('connectionDesign' in obj));
obj.connectionDesign = rec;                                   // what _singleSaveJSON adds when saving to disk
const m2 = S.fromJSON(JSON.stringify(obj));
yes('P2. fromJSON restaura connectionDesign', m2.connectionDesign?.rows?.[0]?.id === 'B1' && m2.connectionDesign.rows[0].geo.db === 19);
yes('P3. arquivo antigo (sem o campo) → null', S.fromJSON(S.toJSON(m)).connectionDesign === null);
console.log(fails ? `\n${fails}/${n} FALHAS` : `\n${n}/${n} ok`);
process.exit(fails ? 1 : 0);
