// test_num_input.mjs — leitura de números com vírgula decimal (PLANO_BRASIL 3.4)
//   node tests/test_num_input.mjs
import { parseNum } from '../js/utils/num.js';

let fails = 0;
const eq = (name, got, exp) => { const p = Object.is(got, exp) || got === exp; if (!p) fails++; console.log(`${p ? '✓' : '✗'} ${name}: got=${got} exp=${exp}`); };

eq('1. vírgula decimal', parseNum('2,5'), 2.5);
eq('2. ponto decimal (inalterado)', parseNum('2.5'), 2.5);
eq('3. milhar pt-BR', parseNum('1.234,5'), 1234.5);
eq('4. milhar en', parseNum('1,234.5'), 1234.5);
eq('5. negativo com vírgula', parseNum('-0,02'), -0.02);
eq('6. espaços', parseNum(' 10 '), 10);
eq('7. vazio → NaN (campo "∞" do Np continua vazio = infinito)', Number.isNaN(parseNum('')), true);
eq('8. Number passa direto', parseNum(3), 3);
eq('9. exponencial', parseNum('1,5e-3'), 0.0015);

console.log(fails ? `\n${fails} FALHA(S)` : '\nOK');
process.exit(fails ? 1 : 0);
