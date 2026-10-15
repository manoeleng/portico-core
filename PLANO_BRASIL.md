# PLANO_BRASIL.md — Adaptação do PORTICO para o Brasil

## Estado em 15/10/2026 — resumo de fechamento

**Implementado:** as 8 fases (i18n pt-BR; combinações NBR 8681 e ELS; NBR 8800:2024; perfis e materiais; NBR
6118:2026 com torção; preset Brasil NBR 6120/6123/15421; NBR 7190-1:2022; NBR 14762:2010). Bateria: 106 testes,
todos verdes. Publicado no fork `github.com/manoeleng/portico-core`, branch `feat/i18n-pt-br` (sem PR no original).
Revisão de especialista FECHADA nas fases 5, 6, 7, 8 e nos itens cantoneira (8800) e torção (6118).

**Falta para "concluído" (definition of done, seção 10):**
1. Revisão do engenheiro responsável registrada nas fichas `docs/verifications/BR-*.md` (linhas em branco).
2. Ratificação dos oráculos por cálculo manual: BR-8681-01, BR-15421-01, BR-6123-01..04, BR-8800-05f/g e 07, torção.
3. Comparação com software comercial (SAP2000 / CYPE 3D / TQS-Eberick, tolerância 3 %) — não feita.
4. Revisão humana da tradução (`Desktop\REVISAO_TRADUCAO_PT.csv`).

**Assistente com o preset Brasil (15/10/2026):** o diálogo do assistente tem seletor de normas (Brasil por padrão
em PT) e carrega `presets/brasil/` com leitor CSV que respeita aspas (`js/utils/csv.js`); o gerador aplica, em todas
as tipologias, as combinações NBR 8681 (`nbrCombinations`; CV → Qcob em galpão/treliça) e o espectro NBR 15421 no
edifício. Teste `assistant/test_assistente_brasil.mjs`; conferido no navegador. **Limites do gerador (não são da
norma):** vento NBR 6123 no galpão FEITO (15/10/2026: X e Y × cada Cpi, Tab. 6/7 por região, Notas 3; teste `assistant/test_galpao_vento.mjs` por cálculo manual); contraventamento em X (barra redonda φ12 só de tração) nos vãos extremos no telhado e nas paredes laterais e rótulas nas diagonais/terças FEITOS (Manual CBCA de galpões 2.14/2.15; teste com solver real e equilíbrio vetorial `assistant/test_galpao_contrav.mjs`); terças Ue do catálogo NBR 6355 pré-dimensionadas por d ≥ L/40 (CBCA 2.9), biapoiadas, uma por nó do banzo superior, com os painéis da treliça definidos pelo espaçamento das terças (padrão 1,8 m, CBCA) e opção de contraventamento 'extremidades' | 'todos' | 'sem' FEITOS (15/10/2026); o galpão ainda não gera sismo; pilar treliçado FEITO (warehouse.column_type 'treliçado', largura e modulação, dois banzos contínuos, travejamento rotulado, dois apoios articulados; vento em todo o montante externo; teste com solver real: equilíbrio, vento X igual ao do pilar simples, deslocamentos da mesma ordem); formulário "Gerador de galpão" FEITO (menu Assistente → painel lateral não modal, preset Brasil fixo; prévia 3D a cada mudança — geometria, pilar simples/treliçado, treliça, inclinação, espaçamento das terças, contraventamento, perfis por função, cargas e vento V0/categoria/S3; Gerar mantém, Cancelar restaura; conferido no navegador sem erros no console). Pendente cosmético: o resumo do gerador ainda sai em inglês/espanhol; pranchas ficam com o Detalhador — proposta de "galpão completo" aguardando o Manoel. O endpoint de LLM não existe (backend privado
do autor; "traga o seu serviço") — decisão do Manoel.

**Pendências técnicas abertas** (detalhes nas notas de cada fase):  alma esbelta (Anexo H) e ruptura da seção líquida na 8800;
 seção não retangular e torção de perfis abertos (17.5.2) na
6118; ELS de madeira; Ca de edifícios (NBR 6123 Fig. 4/5); textos com número embutido fora de `t()` e título da
aba; campos `type="number"` com vírgula (decisão de produto). Fora do plano: o caminho AISC 360 tem a mesma
limitação da cantoneira que foi corrigida na NBR 8800.

---

> Instruções de trabalho para o Claude Code neste repositório (`portico-core`).
> Leia este arquivo inteiro antes de começar qualquer tarefa da adaptação brasileira.
> Levantamento feito no commit `7468071` (main, out/2026).
> **Edições e fontes revisadas em 14/10/2026** contra os PDFs do acervo `C:\projetos\_referencias`
> (seção "Fontes"). Item marcado **[LACUNA]** = norma/livro ausente do acervo: obter antes da fase.

### Edições adotadas

| Norma | Edição | Uso no plano |
| --- | --- | --- |
| NBR 8681 | **2025** | Combinações (fase 3 do plano) |
| NBR 8800 | 2024 | Aço (7.1), γ de aço, deslocamentos (Anexo B) |
| NBR 6118 | **2026** | Concreto (7.2), γ de concreto, ELS (Tab. 13.3), Eci/Ecs |
| NBR 6120 | 2019 | Cargas variáveis do preset |
| NBR 6123 | 2023 | Vento |
| NBR 7480 | 2024 | CA-50/CA-60 |
| NBR 14762 / NBR 6355 | 2010 / 2012 | Formados a frio (7.4) |
| NBR 7190-1 | **2022** (Parte 1 — critérios de dimensionamento) | Madeira (7.3) |
| NBR 15421 | **2023** (2ª ed.) | Sismo (5.6) e combinação excepcional (3.2) |
| NBR 5884 | 2005 (2ª ed.) | Perfis soldados VS/CVS/CS (8.1) |

## 1. Objetivo

Tornar o PORTICO utilizável por engenheiros brasileiros: interface em pt-BR, dimensionamento
pelas NBR, convenções brasileiras de ações e combinações, catálogo de perfis e materiais
nacionais e um preset `presets/brasil/`. **O solver não deve ser alterado.**

## 2. Regras para o Claude Code

1. **Uma fase (ou sub-tarefa) por vez.** Antes de codar, apresente o plano da tarefa
   (arquivos que vai mexer, abordagem) e espere confirmação.
2. **Não quebre o que existe.** Todos os testes atuais (AISC, EC3, ACI, NCh…) têm de
   continuar passando. Rode a bateria completa antes de cada commit (seção 9).
3. **Não mude o comportamento do Chile.** Refatorações do núcleo (espectro, vento) devem
   manter os resultados NCh433/NCh432 idênticos — prove com os testes existentes.
4. **Edição de norma explícita.** Todo módulo NBR grava a edição no `id`
   (ex.: `NBR8800:2024`). Itens marcados **[CONFIRMAR]** neste plano vieram de memória:
   pare e peça ao usuário a confirmação (ou o trecho da norma) antes de codificar o valor.
5. **Nada de inventar coeficientes.** Se um valor normativo não estiver neste arquivo nem
   for fornecido pelo usuário, pergunte. Não preencha com "valor típico".
6. **Siga o estilo do repositório:** JavaScript vanilla, ES modules, sem build, sem
   dependências novas, imports com o sufixo `?v=7` como nos arquivos vizinhos, comentários
   de cabeçalho no padrão dos arquivos em `js/design/codes/`.
7. **Commits no padrão Conventional Commits** usado no projeto (`feat`, `fix`, `docs`,
   `refactor`, `test`, `chore`), um commit por sub-tarefa.
8. **Licença:** o projeto é AGPL-3.0-or-later. Não copie código do PORTICO para outros
   projetos proprietários do usuário (Fplus/StructPro). Contribuições upstream exigem o
   `CLA.md`.

## 3. Mapa do código (onde está cada coisa)

| Área | Arquivos | Situação para o Brasil |
| --- | --- | --- |
| i18n | `js/i18n/i18n.js`, `js/i18n/dict.en.js`, seletor em `index.html` (~linha 221) | Espanhol é a string-fonte; só existe dicionário EN (~1.076 entradas). `SUPPORTED = ['es','en']` |
| Registro de normas | `js/design/registry.js`, `js/design/design.js` (`registerBuiltinCodes`) | Plugável: `registerDesignCode({ id, family, label, check })` |
| Normas existentes | `js/design/codes/aisc360.js`, `eurocode3.js`, `concrete.js` (ACI 318/EC2), `timber.js` (NCh1198), `eurocode9.js` | Modelos para os módulos NBR |
| ELS | `js/design/serviceability.js` (tabela `DEFLECTION`) | Adicionar entradas NBR |
| Espectro | `js/design/nch433_spectrum.js`, importado direto em `js/app.js` (linha ~33) e `js/api/portico.js` (linha ~39) | Acoplado ao Chile → precisa de registro de espectros |
| Seções | `js/design/section_props.js` (formas: I, pipe, box, rect, channel, angle, tee, generic) | Falta U enrijecido (Ue) e Z |
| Perfis | `js/design/profiles.js`, `assistant/profiles.csv` (IPE/HEA/HEB/HEM) | Adicionar W, HP, VS/CVS/CS, tubos, U, L |
| Materiais | `js/design/materials_catalog.js`, `assistant/materials.csv` | Adicionar concretos NBR, CA-50/60, MR250, AR350… |
| Presets | `presets/chile/` (`rules.json`, `design_params.json`, `live_loads.csv`), lidos por `assistant/loads.js` e `assistant/generator.js` | Criar `presets/brasil/` |
| Relatório | `js/report/report.js` (226 chamadas `i18n.t()`) | Herda o pt-BR |
| Datas | `toLocaleString('es-CL')` em 4 pontos de `js/app.js` (~4728, 8141, 8213, 8275) | Usar o idioma ativo |
| Testes | `tests/test_*.mjs`, `assistant/test_*.mjs`, casos em `tools/verif/cases/`, fichas em `docs/verifications/` | Casos `BR-*` |

## 4. Ordem de execução

| # | Fase | Semanas (solo) | Marco ao final |
| --- | --- | --- | --- |
| 1 | Idioma pt-BR | 1–3 | Interface em PT |
| 2 | Convenções + combinações NBR 8681 (fase 3 do plano) | 4–5 | — |
| 3 | NBR 8800 (aço) | 6–9 | — |
| 4 | Perfis e materiais | 10–11 | Aço NBR utilizável |
| 5 | NBR 6118 (concreto) — caminho crítico | 12–19 | Concreto NBR |
| 6 | Preset Brasil (6120, 6123, 15421) | 20–23 | Preset Brasil 1.0 |
| 7 | NBR 7190 (madeira) | 24–26 | — |
| 8 | NBR 14762 (formados a frio) + perfis NBR 6355 — incluída em 14/10/2026 a pedido do usuário | — | Formados a frio NBR |
| — | Validação contínua | 6–26 | — |

Estimativas de ordem de grandeza; revisar ao fim da fase 1.

---

## 5. Fase 1 — Idioma pt-BR

### Tarefas
- [x] **1.1** Criar `js/i18n/dict.pt.js` exportando `PT`, com **as mesmas chaves** de
      `dict.en.js` (chave = string em espanhol). Traduzir a partir do espanhol, aplicando o
      glossário abaixo.
- [x] **1.2** `js/i18n/i18n.js`:
      - `SUPPORTED = ['es','en','pt']`;
      - trocar o uso fixo de `EN` em `_lookup()` por um mapa `{ en: EN, pt: PT }` escolhido
        pelo `_locale` atual;
      - em `_initialLocale()`, `navigator.language` começando por `pt` → `'pt'`.
- [x] **1.3** `index.html`: adicionar `<option value="pt">PT</option>` no seletor de idioma.
- [x] **1.4** `js/app.js`: substituir os 4 `toLocaleString('es-CL')` por uma função que usa o
      idioma ativo (`pt` → `pt-BR`, `en` → `en-US`, `es` → `es-CL`).
- [x] **1.5** Varredura de cobertura com o idioma em PT: menus, diálogos, painéis, memorial.
      Todo texto que continuar em espanhol é texto dinâmico fora de `t()` → embrulhar em
      `t()` e adicionar a chave nos **dois** dicionários (EN e PT).
- [x] **1.6** Traduzir as descrições de `examples/index.json` (estratégia a definir com o
      usuário: campo `desc_pt` ou chave de dicionário).
- [x] **1.7** Teste `tests/test_i18n_pt.mjs`: falha se alguma chave de `dict.en.js` não existir
      em `dict.pt.js` (e vice-versa).

### Glossário obrigatório (ES → PT-BR)

| Espanhol (fonte) | Português (BR) |
| --- | --- |
| Hormigón | Concreto |
| Columna | Pilar |
| Losa | Laje |
| Muro | Parede / pilar-parede |
| Fundación | Fundação |
| Nodo / Elemento | Nó / Barra |
| Apoyo / Empotramiento | Apoio / Engaste |
| Peso propio | Peso próprio |
| Carga muerta | Carga permanente (G) |
| Sobrecarga de uso | Carga variável / sobrecarga de utilização (Q) |
| Caso de carga / Combinación | Caso de carregamento / Combinação |
| Corte / Flexión | Cortante / Flexão |
| Pandeo | Flambagem |
| Volcamiento lateral | Flambagem lateral com torção (FLT) |
| Flecha / Deriva | Flecha / Deslocamento entre pavimentos |
| Cuantía / Recubrimiento | Taxa de armadura / Cobrimento |
| Memoria de cálculo | Memorial de cálculo |
| Sismo / Viento | Sismo / Vento |

Use as siglas da NBR quando existirem: ELU, ELS, FLT, FLM, FLA.

> **Fase 1 concluída em 14/10/2026** — branch local `feat/i18n-pt-br`, commits `8177660`..`43660cd`; 85/85 testes; conferida no navegador (tela inicial, exemplo, análise, memorial). Ver pendências abaixo.

### Critério de aceite
Com PT selecionado, nenhum texto em espanhol visível nos fluxos principais (criar modelo,
analisar, ver resultados, dimensionar, gerar memorial); teste 1.7 passando; ES e EN
inalterados.

### Pendências da Fase 1
- Revisão humana da tradução: `C:\Users\Manoel\Desktop\REVISAO_TRADUCAO_PT.csv`.
- Textos com número embutido (notas de pré-dimensionamento em `js/design/autodesign.js` e partes de `aisc360.js`/`concrete.js`) exigem refatoração para `t()` com mensagem inteira.
- Lista de manuais (`app.js` ~1147) só tem campos `es`/`en`; título da aba ("nuevo — PORTICO") e dados do preset Chile (`assistant/design_params.json`) seguem em espanhol — o preset Brasil (fase 6) resolve os dados.

---

## 6. Fase 3 do plano — Convenções e combinações (executar antes da fase 2)

### Tarefas
- [x] **3.1** Nomes de casos: G (permanente), Q (variável), Qcob (cobertura), V (vento, uma
      por direção: V0°, V90°…), E (sismo), T (temperatura). Preencher via
      `_mapa_cargas_a_casos` do `rules.json` do preset.
- [x] **3.2** Gerador de combinações NBR 8681 (em dados no `rules.json`, formato
      `{ nombre, factores }` já usado): ELU normal com cada variável como principal, ELU
      excepcional (sismo), ELS quase permanente (ψ2) e frequente (ψ1 na principal, ψ2 nas
      demais).

      Fd = Σ γgi·FGi,k + γq1·FQ1,k + Σ(j>1) γqj·ψ0j·FQj,k   (NBR 8681:2025, 5.1.3.1)

      **Os γ dependem da família** (a norma específica prevalece sobre a 8681): o gerador recebe
      a tabela de γ do preset por família — concreto pela NBR 6118:2026, aço pela NBR 8800:2024.
      Os ψ são os mesmos nas três normas.

**Coeficientes γf — combinação normal (conferidos nos PDFs em 14/10/2026)**

| Ação | NBR 6118:2026 Tab. 11.1 (concreto) | NBR 8800:2024 Tab. 1 = NBR 8681:2025 Tab. 1, 2, 4 (aço) |
| --- | --- | --- |
| Permanentes — desfav. / fav. | 1,4 (1,3 p/ peso próprio de pequena variabilidade, nota a) / 1,0 | Agrupadas 1,35 / 1,0; separadas: PP de aço 1,25 · moldado in loco 1,35 · elementos construtivos em geral 1,50 |
| Variáveis em geral | 1,4 | 1,50 |
| Vento | 1,4 | 1,40 |
| Temperatura (variação atmosférica) | 1,2 | 1,20 |
| Excepcional (sismo) | 1,0 (permanentes 1,2) | 1,0 (permanentes agrupadas 1,15) |

**Fatores ψ (NBR 6118:2026 Tab. 11.2 = NBR 8800:2024 Tab. 2 = NBR 8681:2025 Tab. 6)**

| Ação | ψ0 | ψ1 | ψ2 |
| --- | --- | --- | --- |
| Uso — sem predominância de equipamentos fixos nem alta concentração de pessoas (residencial) | 0,5 | 0,4 | 0,3 |
| Uso — com predominância (comercial, escritórios, acesso público) | 0,7 | 0,6 | 0,4 |
| Bibliotecas, arquivos, depósitos, oficinas, garagens (e coberturas na 8800/8681) | 0,8 | 0,7 | 0,6 |
| Vento | 0,6 | 0,3 | 0 |
| Temperatura | 0,6 | 0,5 | 0,3 |

> Atenção: a ficha `F4-combinacoes-NBR8681-2025.md` do StructPro-Pro registra γq = 1,4 "geral";
> pela Tab. 4 da 8681:2025 o 1,4 é do **vento** e as demais variáveis levam **1,5**. Não copiar
> a ficha sem essa correção.

- [x] **3.3** `serviceability.js`: adicionar entradas `NBR6118:2026` e `NBR8800:2024`
      (`NBR7190`: os limites de ELS de madeira continuam pendentes — escolha de projeto, ver fase 7):

| Verificação | NBR 6118:2026 Tab. 13.3 | NBR 8800:2024 Tab. B.1 |
| --- | --- | --- |
| Flecha total de vigas | L/250 (aceitabilidade visual) | L/350 (piso), L/250 (cobertura e terças) |
| Balanços | vão efetivo 2·L, regra atual do código (decisão do usuário, 14/10/2026) | L = dobro do balanço (nota a) → L/350 ⇒ balanço/175 |
| Deslocamento horizontal do topo | H/1 700 (comb. frequente, ψ1 = 0,3) | H/400 (2+ pavimentos); H/300 (galpões, 1 pavimento) |
| Deslocamento entre pavimentos | Hi/850 | h/500 |

- [x] **3.4** Formatação: exibição e memorial com `Intl.NumberFormat` do idioma ativo
      (vírgula decimal em PT). Campos de entrada aceitam vírgula e ponto, mas o valor
      armazenado usa sempre ponto. CSV exportado em PT usa `;` como separador.
- [x] **3.5** Sinais e eixos: **não alterar** as convenções internas (Z vertical; na seção,
      z = eixo forte). Documentar a correspondência com a notação NBR (Msd,x / Msd,y) no
      diálogo de convenções. Mudar a convenção interna quebraria `.s3d` e testes.

> **Fase 2 concluída em 14/10/2026** — commits `c6a747e`..`f79906a` (branch local `feat/i18n-pt-br`); 87/87 testes; BR-8681-01 em `tests/test_nbr8681.mjs` (valores à mão, a ratificar). Gerador em `js/design/combinations_nbr.js`; sismo pela NBR 15421:2023 5.4 (γg 1,2; γq 1,0; vento não combina).

### Pendências da Fase 2
- ψ0,ef da combinação sísmica: padrão ψ0 (conservador); NBR 8681:2025 5.1.3.2 permite ψ2 (opção `psiSismo: 'psi2'`) — escolha do RT por projeto.
- ~~Combinação direcional do sismo (NBR 15421 8.5)~~ — feito 15/10/2026: opção `sismoOrtogonal` do gerador (100 % + ±30 % da ortogonal), obrigatória só para categoria C com irregularidade no plano Tipo 3 (Tab. 7); padrão = direções separadas, como permite o 1º parágrafo da 8.5. Teste 10 em `tests/test_nbr8681.mjs`. A opção ainda não tem controle na interface (o botão de combinações NBR usa o padrão).
- ~~Deslocamento do topo H/1 700 (NBR 6118) não existe no módulo de ELS~~ — feito 15/10/2026: `checkTopDrift`/`topDriftLimit` em `serviceability.js` (NBR 6118 H/1 700; NBR 8800 H/400 e H/300 galpão), exposto na API; teste `tests/test_serviceability_topo.mjs`. **Ligado ao memorial (15/10/2026):** seção 4.3 "Deslocamento horizontal do topo dos pilares — vento" (`js/design/top_drift.js`, teste `tests/test_top_drift.mjs`): pilares = linhas verticais que partem da base, H = altura do pilar (Tab. B.1 nota a); NBR 6118 sempre frequente (ψ1 = 0,30); NBR 8800 rara por padrão (B.2.4: escolha do RT; `designSettings.topDriftCombo`) com o valor frequente ao lado; H/300 quando o modelo tem no máximo um nível de diafragma. Conferido no navegador (galpão do formulário: 14 pilares, H/300, razão 0,66). **Deriva sísmica (15/10/2026):** o painel e o memorial passam a usar a NBR 15421:2023 quando o espectro foi gerado pelo bloco NBR (parâmetros salvos no caso): limite da Tab. 9 por categoria (0,020/0,015/0,010·hsx) e deslocamentos × Cd/I (9.5); memorial com seção sísmica NBR (ag, classe, Ca/Cv, I, R, Cd). `driftLimit15421` testado; fluxo conferido no navegador (Valdivia 5 pav., cat. II, Cd 2,5: limite 0,015, fator 2,000, colunas ·/0,015).
- Balanço na NBR 6118: mantida a regra atual do código (vão efetivo 2·L), por decisão do usuário.
- ~~ELS frequente repetia `G + ψ1·Q` uma vez por direção de vento~~ — corrigido 15/10/2026 (combinações idênticas emitidas uma vez; teste 9 em `tests/test_nbr8681.mjs`).
- 3.4 em escopo reduzido: memorial e CSV exportados; os demais `toFixed` da interface ficam para depois. **Campos de entrada (15/10/2026):** os 9 campos de TEXTO numéricos (fator de carga, diálogo de rótulas plásticas) leem vírgula via `js/utils/num.js` (`parseNum`, teste `tests/test_num_input.mjs`); os ~170 campos `type="number"` dependem do idioma do navegador (Chrome usa o idioma da interface, não o `lang` da página) — convertê-los para texto com `inputmode="decimal"` é decisão de produto, não feita.

Unidades: kN–m já atende. Ativar t–m (hoje desabilitado) é opcional e fica para depois.

---

## 7. Fase 2 — Módulos de dimensionamento NBR

Cada módulo segue a interface de `registry.js` e o padrão de `codes/eurocode3.js`:
retorna `{ checks, ratioMax, gobierna, estado, metodo }` via `finalize` (importado de
`aisc360.js`). Registrar em `registerBuiltinCodes()` de `design.js`. **Não** trocar os
padrões globais (`setDefaultCode`) no core — isso é feito pelo preset Brasil.

### 7.1 NBR 8800 — aço (`js/design/codes/nbr8800.js`)
- id `NBR8800:2024`, family `steel`, label `ABNT NBR 8800:2024`.
- Reaproveitar de `aisc360.js` a classificação de seção e a lógica de flambagem.
- γa1 = 1,10 (escoamento, flambagem, instabilidade); γa2 = 1,35 (ruptura) — conferido, Tab. 3.
- Compressão: χ = 0,658^(λ0²) para λ0 ≤ 1,5; χ = 0,877/λ0² para λ0 > 1,5 — conferido no texto
  2024. **A 2024 NÃO tem fator Q**: Nc,Rd = χ·Aef·fy/γa1 (5.3.2), Aef por largura efetiva (5.3.4.2,
  Tab. 4/5), λ0 = √(Ag·fy/Ne) com Ne = mín(Nex, Ney, Nez) (5.3.5.1), comprimento destravado sem K.
- Flexão: FLT, FLM e FLA, com Cb. Na 2024 a flexão de viga I migrou do Anexo G (2008) para o
  **Anexo D + Tab. D.1 + 5.4.2, sem mudança de coeficientes** (ficha
  `C:\projetos\StructPro-Pro\docs\fichas\C1-flexao-viga-I.md`).
- Cortante conforme a norma.
- Interação N+M: duas expressões (NSd/NRd ≥ 0,2 e < 0,2).
- Equivalência 2008↔2024 fora da flexão: conferida nos itens cobertos pelos casos BR-8800 (a 2024 não tem fator Q;
  compressão por Aef) — ver "Achados da NBR 8800:2024" abaixo.
- Testes: `tests/test_nbr8800.mjs` com casos BR-8800-01..03 (seção 10). Os valores esperados do
  Pfeil 9ª ed. já estão transcritos nas fixtures JSON de `C:\projetos\StructPro-Pro\tests\`.

#### Achados da NBR 8800:2024 (conferidos nas páginas do PDF em 14/10/2026)
- **Sem fator Q**: flambagem local na compressão por área efetiva (5.3.2, 5.3.4). O Anexo F da 2024 é "aberturas em almas".
- **FLT**: Cb entra em λr e em Mcr (D.2.8-a); a interpolação de D.2.1 NÃO é multiplicada por Cb. Para Cb ≠ 1 o resultado difere da forma 2008 (ex.: Pfeil V3, Cb = 1,67: MRd 2024 = 196,9 kN·m contra 231,1 kN·m do livro).
- **Comprimento destravado sem K** (4.10.6.1, 5.3.5.1) com esforços de análise de 2ª ordem com imperfeições (4.10.6.2, 4.10.7). O módulo usa K = 1 e aceita K como override com aviso.
- **Cortante no eixo menor** (5.4.3.5): kv = 1,2, h = bf/2, tw = tf, Aw = 2·bf·tf.
- **Divergência no StructPro-Pro (reportar, não corrigido aqui):** `src/StructPro.Steel/Compressao.cs` usa Q·Ag e λ0 = (λ/π)·√(Q·fy/E); `Flexao.cs` usa Lr sem Cb e Mn = Cb·[…] — forma 2008. Para Cb ≠ 1 ou seção esbelta, diverge da 2024. A ficha C1 cita D.2.8-b)/k) para Lr/Mcr; o correto é D.2.8-a).

#### Decisões da Fase 3 (aprovadas pelo usuário em 14/10/2026)
- **Escopo v1:** perfil I/H duplamente simétrico completo (tração, compressão com Q, flexão nos dois eixos com FLT/FLM/FLA, cortante, interação). Tubos, caixão, U, cantoneira e T: compressão e flexão simplificadas, com aviso "verificação simplificada" no resultado (mesmo padrão do `aisc360.js`).
- **Tração:** só escoamento da seção bruta (5.2.2-a). Ruptura da seção líquida (5.2.2-b) não é verificada — o modelo não tem área líquida; o resultado sai com aviso.
- **Alma esbelta** (h/tw > λr): fora da v1 — o resultado avisa e não calcula (Anexo H).
- **Fontes das fórmulas:** ficha transcrita da 2024 (Anexo F, Tab. D.1, 5.4.2, 5.4.3, 5.5.1.2) conferida antes de codar; itens já conferidos nas fichas do StructPro-Pro (C1, Pilha 1) reaproveitados.
- **Oráculos:** Pfeil 9ª ed. (base 2008) via fixtures do StructPro-Pro; teste usa propriedades de catálogo (`laminados-gerdau.csv`), não a geometria recalculada (o `section_props.js` não considera o raio de concordância).
- **Contrato:** `resolveSectionProps` passa a repassar `dims` e `fabricacao` (aditivo; AISC/EC3 inalterados).

> **Fase 3 (NBR 8800:2024) implementada em 14/10/2026** — `js/design/codes/nbr8800.js` (I/H duplamente simétrico: tração 5.2.2-a, compressão por área efetiva com Ne = mín(Nex, Ney, Nez), flexão Anexo D com Cb em λr/Mcr, FLM laminado/soldado, FLA, cortante 5.4.3.1 e 5.4.3.5, interação 5.5.1.2; demais formas simplificadas com aviso) — commits `aade4cd`, `edf352f`, `3465b86`; perfis W/HP Gerdau `226f3b2`; materiais NBR `2784af7`. Testes `tests/test_nbr8800.mjs` BR-8800-01..08 (Pfeil 9ª ed.; V3 com Cb = 1,67 e BR-8800-07 por cálculo manual na 2024). Revisão do especialista: 1 rodada de achados corrigida (`edf352f`); **fechamento formal não registrado**.
> Pendências: alma esbelta (Anexo H) e ruptura da seção líquida não calculadas (aviso); equivalência 2008↔2024 fora da flexão conferida só nos itens dos casos BR-8800.
> **Correção 15/10/2026 — cantoneira simples à compressão** (achado ao preparar o catálogo de L): o Ne usava as inércias em torno dos eixos paralelos às abas (contra a segurança: L 2"×1/4", r 1,55 cm contra rmín 0,99 cm). Agora: eixos principais + flexo-torção pela cúbica da 5.3.5.3 (= 5.3.5.2 em abas iguais), comprimento max(Lx, Ly); Aef com aba AL grupo 3 (Tab. 4: 0,45·√(E/fy), b = largura total; Tab. 5: c1 0,22, c2 1,49); esbeltez 5.3.7.1 com rmín. `tests/test_nbr8800_angle.mjs` (cálculo manual independente; rmín conferido no catálogo Gerdau). Revisão (rodada 1): a norma EXCLUI a cantoneira simples de 5.3.5.2/5.3.5.3 — corrigido: 5.3.5.4 implementada (`member.cantoneira.trelica` = 'plana' | 'espacial' | 'concentrica'; Lx1,eq de 5.3.5.4.2/5.3.5.4.3 sobre rx1 da aba ligada, tomada a maior; flexo-torção só se b/t > 0,71·√(E/fy), 5.3.5.4.4; fora de 5.3.5.4.1 → flexo-compressão 5.3.5.4.5, NÃO verificado; ligação não declarada → menor Ne entre os caminhos). Casos A4 conferidos pelo revisor (63,7/70,9/105,0/112,4 kN). Revisão rodada 2: **FECHADO** (15/10/2026). Abas desiguais ligadas pela menor (member.cantoneira.abaLigada = menor): limites inferiores de Lx1,eq do último parágrafo de 5.3.5.4.2/5.3.5.4.3 FEITOS (15/10/2026, caso A6 por cálculo manual). Não implementado: esbeltez de tração com rmín. **O caminho AISC 360 tem a mesma limitação (não corrigido aqui).**

### 7.2 NBR 6118 — concreto (`js/design/codes/nbr6118.js`)
- id `NBR6118:2026`, family `concrete`.
- Reaproveitar `rebarLayers` de `concrete.js`.
- γc = 1,4; γs = 1,15; fcd = fck/γc; diagrama parábola-retângulo (8.2.10.1) ou retangular
  (17.2.2 e), conferido no texto 2026:
  αc = 0,85 (fck ≤ 50 MPa) ou 0,85·[1,0 − (fck − 50)/200] (fck > 50);
  λ = 0,8 (fck ≤ 50 MPa) ou 0,8 − (fck − 50)/400 (fck > 50).
- Vigas: flexão simples/composta, cortante modelos I e II, armadura mínima.
- Pilares: M1d,mín = Nd·(0,015 + 0,03·h) [h em m] — conferido no texto 2026; efeitos locais de
  2ª ordem (pilar-padrão com curvatura aproximada como primeira implementação).
- ELS: flecha com inércia equivalente (Branson) e fluência; abertura de fissuras wk.
- Exigir `sec.design.rebar`; se cair no modo "taxa ρ" de `concrete.js`, emitir aviso no
  resultado.
- Testes: `tests/test_nbr6118.mjs` com casos BR-6118-01..04.

> **Fase 5 (NBR 6118:2026) concluída em 15/10/2026** — `js/design/codes/nbr6118.js` (vigas: flexão/N+M por compatibilidade, bloco αc·ηc·fcd com ηc novo da 2026, As necessária simples/dupla, ductilidade da armadura dada, cortante modelos I e II; pilares: M1d,mín, λ1/αb (balanço = 1,0 na 2026), pilar-padrão curvatura/κ, γn; ELS: Mr, estádio II, Branson, αf, wk). Testes: Carvalho Vol. 1 (flexão, cortante, flecha, fissuras), Bastos e Kimura (pilares). Revisão do especialista: FECHADO após 3 rodadas.
> Pendências: ~~torção (17.5)~~ (15/10/2026: `torsionCheck` — seção vazada equivalente 17.5.1.4.1, TRd2/TRd3/TRd4 17.5.1.5, interação V+T 17.7.2.2, estribos somados 17.7.2.3; As,l de torção só verificada se informada em `rebar.Asl_torcao_cm2`, senão NÃO verificado com a área necessária; opção `torcaoCompatibilidade` (17.5.1.2). Oráculo: cálculo manual — **sem exemplo de literatura no acervo** (IBRACON = LACUNA). Revisão (rodada 1): números conferidos; corrigidos taxas mínimas ρsl = ρsw ≥ 0,2·fct,m/fywk (17.5.1.2), aviso VSd ≤ 0,7·VRd2 na torção de compatibilidade, guarda b/h ≤ 2c1, Vz somado na interação (conservador), aviso de estribo inclinado; testes de taxa mínima, 4 ramos, he ≥ 2c1. Rodada 2: **FECHADO** (15/10/2026). Desejáveis: 0,7·VRd2 da compatibilidade só com Vy; armadura mínima de torção na compatibilidade só como aviso (decisão do RT). Não feito: torção em perfis abertos 17.5.2, redução de As,l no banzo comprimido 17.7.1.3, ρ mínimo de torção específico) e seções não retangulares → "não verificado"; sentido do momento não verificado (aviso); pilar exige papel "pilar" na seção ou ν ≥ 0,10 (critério adotado, sinalizado).

### 7.3 NBR 7190 — madeira (`js/design/codes/nbr7190.js`)
- NBR 7190-1:2022 obtida em 14/10/2026 (acervo `Madeira\`).
- id `NBR7190:2022` (Parte 1 — critérios de dimensionamento), family `timber`.
- kmod = kmod1·kmod2 (·kmod3 se aplicável); γw = 1,4 (compressão), 1,8 (tração e
  cisalhamento) — conferidos na 2022 (fase 7).
- Classes de resistência da 2022 (Tab. 2/3) — conferidas na fase 7.
- Testes: `tests/test_nbr7190.mjs` com BR-7190-01.

> **Fase 7 (NBR 7190-1:2022) concluída em 15/10/2026** — `js/design/codes/nbr7190.js` (kmod1·kmod2, γw 1,4/1,8, Tab. 2/3, tração, compressão com kc da 2022, flexão oblíqua kM = 0,7, flexo-tração/compressão, cisalhamento resultante, estabilidade lateral βM, limites 9.3). Testes: Dias, Calil Jr, Lahr, Martins (2019) Ex. 1–4. Revisão do especialista: FECHADO.
> Pendências: ELS de madeira (faixas de flecha da Tab. 21 são escolha de projeto); kmod3 de MLC aplicado como fator adicional (leitura sinalizada).

### 7.4 NBR 14762 — formados a frio (Fase 8, incluída em 14/10/2026)
- Depende de novas formas `lipped_channel` (Ue) e `zee` (Z) em `section_props.js`.
- Antecipada pelo usuário (14/10/2026): roda no loop junto das fases 5–7. Catálogo de perfis pelas propriedades TABELADAS da NBR 6355 (como os W Gerdau), sem depender de novas formas geométricas no `section_props.js` na v1.

---

## 8. Fases 4 e 5 — Perfis, materiais e preset Brasil

### 8.1 Perfis (`profiles.js` + `profiles.csv`)
- [x] W laminados (W150×13 … W610×174) e HP (HP200×53 … HP310×125) — forma `I` (81 W + 7 HP Gerdau, propriedades tabeladas — `226f3b2`).
- [x] Soldados VS, CVS, CS — forma `I`, fabricação `soldado` (15/10/2026). Geometria copiada da
      biblioteca do usuário (`Detalhador/data/perfis.json`: 98 VS, 90 CVS, 108 CS), propriedades por
      `fromShape`; nome = d x bf (tf/tw). Amostra de 13 perfis conferida contra a NBR 5884:2005 Tab. B.1–B.3
      (A, Ix, Iy, Zx, It ≤ 0,21 %) em `tests/test_profiles_nbr5884.mjs`. **A série da biblioteca não é a
      da 2005:** tem alturas 200/225 (tw 5) e VS 1500 que a 2005 não tem; faltam os VS 150–350 da 2005.
      Corrigido VS 750 x 320 tf 12,3 → 12,5 (Tab. B.3). Massa da biblioteca não usada (CS 400x400 (19/16)
      constava com 65 kg/m).
- [x] Tubos circulares e retangulares — `pipe` / `box`. Circulares: 850 da biblioteca (`js/design/profiles_lib.js`),
      TC 168,3×16 conferido no Fakury/Vallourec. **Retangulares (15/10/2026):** 406 da biblioteca com propriedades
      COM raios de canto pela EN 10219-2:2019 A.3 (`js/design/rhs_en10219.js`; ro/ri = 2T/1T, 2,5T/1,5T, 3T/2T),
      conferidas contra a Tab. B.3 (≤ 0,23 %). O "conflito" do livro (exemplo 3.7.10) era leitura minha: os
      valores do livro (Ix 2829, Iy 1816, J 3665) fecham com os raios de conformação a frio — a área 53,1 é que
      não fecha (51,2 pela EN). Fontes acrescentadas ao acervo: `Aco/EN-10219-2-2019.pdf`,
      `Aco/BR-Catalogo-de-Acos-Estruturais.pdf` (Vallourec, só massas).
- [x] U laminado e cantoneiras — `channel` / `angle`. **Cantoneiras feitas** (15/10/2026): 89 da biblioteca
      (família "L (cantoneira)"), amostra contra catálogo Gerdau ≤ 2,3 % (geometria sem raios).
      **U laminado (15/10/2026):** 12 bitolas Gerdau (3" a 12") com as propriedades do PRODUTO Gerdau (Tabela de
      Bitolas 01/23 e Barras e Perfis 2009 — o perfil do fabricante pode diferir do perfil-padrão). Zx, Zy, J e Cw,
      que a Gerdau não publica, vêm do perfil C equivalente da AISC Shapes Database v16.0 (`_referencias/Aco`),
      conferidos célula a célula contra a planilha. U 8": a linha Gerdau traz ry = 1,42, que não fecha com o próprio
      Iy/A — adotado ry = √(Iy/A) com Iy e A da Gerdau (1,58 / 1,55).
- Dados já disponíveis: `C:\projetos\StructPro-Pro\src\StructPro.Sections\data\laminados-gerdau.csv`
  (88 W/HP com Zx, It, Cw) e `formados-frio-6355.csv` (150 perfis, NBR 6355:2012 Tab. A, com
  página da fonte); catálogos Gerdau em `_referencias\Catalogos_Tabelas\`. NBR 5884:2005 no acervo (ver Fontes).
- Dados: catálogos de fabricante (Gerdau) e tabelas da NBR 5884. **Antes de publicar,
  confirmar com o usuário se a licença dessas tabelas permite redistribuição AGPL.** Se não,
  gerar propriedades a partir da geometria nominal (como `profiles.js` já faz).
- Os dados devem ser fornecidos/conferidos pelo usuário; não digitar dimensões de memória.

### 8.2 Materiais (`materials_catalog.js` + `materials.csv`)

| Material | Resistências | E | Observação |
| --- | --- | --- | --- |
| ASTM A36 / MR250 | fy 250, fu 400 MPa | 200 GPa | |
| ASTM A572 Gr.50 / AR350 | fy 345–350, fu 450 MPa | 200 GPa | |
| ASTM A588 / AR350COR | fy 345, fu 485 MPa | 200 GPa | patinável |
| C20 | fck 20 | Eci 25,0 / Ecs 21,3 GPa | |
| C25 | fck 25 | Eci 28,0 / Ecs 24,1 GPa | |
| C30 | fck 30 | Eci 30,7 / Ecs 26,8 GPa | |
| C35 | fck 35 | Eci 33,1 / Ecs 29,4 GPa | |
| C40 | fck 40 | Eci 35,4 / Ecs 31,9 GPa | |
| C50 | fck 50 | Eci 39,6 / Ecs 36,6 GPa | |
| CA-50 / CA-60 | fyk 500 / 600 MPa | 210 GPa | armadura |

- Concreto (NBR 6118:2026, 8.2.8, conferido): Eci = αE·5600·√fck para fck ≤ 50 MPa
  (αE = 1,2 basalto/diabásio · 1,0 granito/gnaisse · 0,9 calcário · 0,7 arenito; deixar αE
  configurável); Eci = 21,5·10³·αE·(fck/10 + 1,25)^(1/3) para fck > 50 MPa;
  Ecs = αi·Eci, αi = 0,8 + 0,2·fck/80 ≤ 1,0. **Usar Ecs na análise.** ρ = 2,5 t/m³
  (25 kN/m³, NBR 6120). E em kN/m² no catálogo (ex.: 26,8 GPa → 2.68e7).
- Nomes em PT ("Concreto C30", "Aço A572 Gr.50") — não usar "Hormigón".

### 8.3 Preset `presets/brasil/`
```
presets/brasil/
  README.md            normas cobertas, edições, avisos (modelo: presets/chile/README.md)
  rules.json           mesmas chaves do preset Chile
  design_params.json   resistências/limites de reserva (NBR 8800/6118/7190)
  live_loads.csv       NBR 6120:2019 — id,building_type,descricao,Lo_kNm2,Qk_kN
  profiles.csv         perfis da 8.1
  materials.csv        materiais da 8.2
```
- [x] **5.1** `live_loads.csv`: transcrever a tabela de cargas variáveis da NBR 6120:2019
      (valores fornecidos pelo usuário).
- [x] **5.2** `combinations.lista` com as combinações da tarefa 3.2.
- [x] **5.3** Preset define os padrões: `steel → NBR8800:2024`, `concrete → NBR6118:2026`,
      `timber → NBR7190:2022` (via `designSettings.codeByFamily` ou equivalente; definir com
      o usuário onde o preset aplica isso).
- [x] **5.4 Vento (NBR 6123:2023):** (feito na fase 6 — `341630b`, `9144288`) as chaves atuais seguem ASCE 7 (`Kz_formula`,
      `gcpf_external_pressure`). Criar `wind.method = "NBR6123"` e um ramo em
      `assistant/loads.js`:
      Vk = V0·S1·S2·S3; q = 0,613·Vk² (N/m²); S2 = bm·Fr·(z/10)^p por categoria I–V e classe
      A–C. Tabela 1 (bm, p) e Fr da edição 2023 já transcritas em
      `C:\projetos\StructPro-Pro\docs\fichas\P2.2-vento-NBR6123-2023.md` — conferir contra o PDF
      ao portar. Cpe/Cpi (Tab. 7–12) ainda não transcritos. O ramo ASCE existente não pode mudar.
- [x] **5.5 Sismo — refatoração do núcleo (PR separado):** (feito — `669cc47`, NCh433 idêntico em 270 combinações)
      criar `js/design/spectra/` com registro de espectros (mesma ideia de `registry.js`);
      mover NCh433 para lá **sem mudar resultados**; trocar os imports diretos em `app.js` e
      `api/portico.js` pelo registro.
- [x] **5.6 Sismo — `nbr15421_spectrum.js`** (feito como `js/design/spectra/nbr15421.js` pela
      edição 2023 — `729a62e`; o esboço abaixo, da edição 2006 de memória, está **superado**:
      na 2023 ags1 = Cv·0,75·ag e há o ramo 1/T²):
      zonas 0–4 (ag 0,025g … 0,15g); terreno A–F (Ca, Cv); categorias I–III (I = 1,0; 1,25; 1,5).
      ags0 = Ca·ag; ags1 = Cv·ag
      Sa(T) = ags0·(18,75·T·Ca/Cv + 1,0)   para 0 ≤ T ≤ 0,08·Cv/Ca
      Sa(T) = 2,5·ags0                     para 0,08·Cv/Ca ≤ T ≤ 0,4·Cv/Ca
      Sa(T) = ags1/T                       para T ≥ 0,4·Cv/Ca
      Espectro de projeto = Sa·I/R. Zonas 0 e 1 dispensam análise dinâmica (zona 1: forças
      horizontais mínimas) — tratar como caminho padrão; espectro completo só nas zonas 2–4.
- [x] **5.7** `modeling_rules`: `default_beam`/`default_column` com perfil W e concreto C25/C30.

---

> **Fase 6 (preset Brasil) concluída em 15/10/2026** — `presets/brasil/` (rules.json com NBR 6123:2023 e NBR 15421:2023, live_loads.csv NBR 6120:2019 conferida linha a linha, profiles.csv Gerdau W/HP, materials.csv NBR, design_params.json, README); ramos NBR6123/NBR15421 em `assistant/loads.js` (ASCE/NCh intactos); registro de espectros com NCh433 idêntico (270 combinações) e `js/design/spectra/nbr15421.js` (espectro 2023: ags1 = Cv·0,75·ag, ramo 1/T²); no app em PT: NBR 8800/6118 padrão, materiais NBR e combinações NBR 8681 pelo botão. Vento do galpão 25 × 54 m do curso reproduzido (q = 0,57 kN/m², Cpe A +0,7 / B −0,5). Revisão do especialista: FECHADO após 2 rodadas.
> Pendências: ~~Cpe de telhados com calha central/múltiplos (Tab. 9–12)~~ (15/10/2026: transcritas da imagem das págs. 23–26 para `rules.json` e consultadas por `cpeTelhadoMultiplo` em `assistant/loads.js`, teste `assistant/test_cpe_multiplos.mjs`; o gerador ainda só monta galpão de um vão, então não as usa — Cpe médio local da Tab. 9 (figura) não transcrito) e Ca de edifícios (Fig. 4/5) não transcritos; ag por município (a NBR 15421 só tem mapa); ~~UI dedicada para os parâmetros do espectro NBR 15421 no diálogo de espectro~~ (15/10/2026: bloco «Construir espectro ABNT NBR 15421:2023» no diálogo — ag, classe, categoria, R, Cd; a curva gerada é Sa·I/R (seção 10: forças × I/R; superposição modal linear) e a nota indica deslocamentos × Cd/I; `designCurve15421`, teste `tests/test_nbr15421_curva.mjs`; conferido no navegador em 15/10/2026: bloco renderiza, «Gerar curva NBR» preenche 61 pontos (Sa(0)·I/R = 0,06667 g para ag 0,10, D, II, R 3), desenha o gráfico e marca o caso como não salvo; sem erros no console).

> **Fase 8 (NBR 14762:2010) concluída em 15/10/2026** — `js/design/codes/nbr14762.js` + `js/design/profiles_cf.js` (85 Ue, 65 L da NBR 6355:2012); seções Ue roteadas automaticamente da NBR 8800 para a NBR 14762; família "Ue (NBR 6355)" no catálogo. Testes: Manual CBCA 2014 (Ex. 04–09, Anexo D S6/S8). Revisão do especialista: motor conferido com o PDF e conta à mão (Ex.05/07/09, S8); 3 rodadas — achados de caminho real corrigidos (sem L não passa; T ≠ 0 não verificado; avisos 9.6.3 e carga fora do centro de torção; L 80x4,25 Ix = 41,26 cm⁴; Lb injetado não governa a FLT) — commits 910cd61, 93c2e7e; teste `tests/test_nbr14762_rev.mjs`. FECHADO.
> Limitação relevante: Ndist/Mdist não têm fórmula na 2010 — só 24 dos 85 Ue dispensam a distorcional na compressão (Tab. 11) e 2 na flexão (Tab. 14); os demais exigem Ndist/Mdist de análise de estabilidade (CUFSM/GBT) ou ficam "não verificados".

## 9. Como rodar os testes

Não há `package.json` nem runner: cada `tests/test_*.mjs` é um script Node que sai com código
≠ 0 se falhar (Node 24 no CI).

PowerShell (Windows):
```powershell
Get-ChildItem tests\test_*.mjs, assistant\test_*.mjs | ForEach-Object {
  node $_.FullName; if ($LASTEXITCODE -ne 0) { Write-Host "FALHOU: $($_.Name)" -ForegroundColor Red }
}
```

Bash:
```bash
for f in tests/test_*.mjs assistant/test_*.mjs; do node "$f" || echo "FALHOU: $f"; done
```

Checagem de sintaxe (como no CI):
```bash
find js assistant -name '*.js' -print0 | xargs -0 -n1 sh -c 'node --input-type=module --check < "$0"'
```

App local: `python serve.py` → http://localhost:8765 (não abrir via `file://`).

---

## 10. Casos de validação

Tolerância: ≤ 1% contra exemplo resolvido da literatura; ≤ 3% contra software comercial.
Cada caso vira teste (golden master) + ficha `docs/verifications/BR-*.md` com edição da
norma, fonte e erro obtido. **Os valores esperados devem ser fornecidos pelo usuário** a
partir das fontes; não calcular o "esperado" com o próprio código em teste.

**Toda a literatura disponível é base de edição anterior** (NBR 8800:2008, NBR 6118:2003/2014).
O exemplo resolvido só vale como oráculo depois de conferida, cláusula a cláusula, a equivalência
com a edição adotada; onde mudou, o esperado vem de cálculo manual na edição vigente.

| Caso | Verifica | Fonte (acervo `_referencias`) | Comparação |
| --- | --- | --- | --- |
| BR-8800-01 | Pilar W comprimido: χ, Nc,Rd | Pfeil & Pfeil 9ª ed. 2022, Ex. 5.8.2 (`Aco\`) | SAP2000 / CYPE 3D (`Software\cype-3d-*`) |
| BR-8800-02 | Viga com FLT/FLM/FLA e Cb | Pfeil 9ª ed. 6.2.4, V3, 7.6.5; Fakury, Silva e Caldas 2017 (raiz) | SAP2000 / CYPE 3D |
| BR-8800-03 | Flexo-compressão | Fakury, Silva e Caldas 2017; Pfeil 9ª ed. | Idem |
| BR-6118-01 | Viga retangular, As de flexão | Carvalho & Figueiredo Filho Vol. 1, 4ª ed. (raiz); apoio: Leonhardt (`Concreto\`) | TQS / Eberick |
| BR-6118-02 | Cortante, modelos I e II | Idem | Idem |
| BR-6118-03 | Pilar com M1d,mín e 2ª ordem local | Kimura 2018 (raiz, base 6118:2014); Carvalho & Pinheiro Vol. 2 (raiz) | Idem |
| BR-6118-04 | Flecha imediata e diferida | Carvalho & Figueiredo Filho Vol. 1, 4ª ed. (raiz) | Idem |
| BR-7190-01 | Tração, compressão, flexão | Calil Jr. et al. (`Madeira\`); Martins (2019) | Planilha |
| BR-8681-01 | Combinações geradas para G+Q+V | Cálculo manual com as tabelas da seção 6 | — |
| BR-6123-01 | Vk e q, cidade/categoria definidas | *Ação do Vento nas Edificações – Teoria e Exemplos* (`Acoes\`); Manual CBCA Galpões (`Aco\01_Manual_Galpoes_web.pdf`) | CYPE |
| BR-15421-01 | Sa em T = 0; 0,5; 1,0; 2,0 s | Cálculo manual pela NBR 15421:2023 | — |
| BR-14762-* | Formados a frio (7.4) | Manual CBCA 449 (`Aco\449_Manual_...pdf`), Ex. 01 e 06 | — |

Definition of done de cada módulo: casos passando, bateria antiga passando, ficha escrita,
revisão de um engenheiro registrada.

---

## 11. Riscos a observar durante o trabalho

- Edição de norma errada → sempre gravar a edição no `id` e checar itens **[CONFIRMAR]**.
- Upstream mudar i18n/registro → manter PRs pequenos; teste 1.7 detecta dicionário defasado.
- Texto dinâmico fora de `t()` → varredura 1.5.
- Espectro/vento acoplados a NCh/ASCE → refatoração 5.5 isolada e sem mudança de resultado.
- Concreto com seção genérica (A, I) → exigir `sec.design.rebar` no NBR 6118.

## 12. Estratégia de entrega (decidir com o usuário)

1. **Upstream** (recomendado para i18n pt-BR, preset Brasil e registro de espectros): PRs
   para `jpreyes/portico-core`, com CLA assinado.
2. **Fork próprio**: uso interno modificado é livre; hospedar versão modificada para
   terceiros obriga a oferecer o código-fonte (AGPL §13).
3. **Módulos NBR de dimensionamento**: o projeto vende "advanced multi-code design" na
   edição Pro — conversar com o mantenedor antes de decidir onde esses módulos vivem.

## Fontes (acervo local `C:\projetos\_referencias`)

Normas (raiz do acervo):
- `ABNT NBR 8681 2025 - Ações e segurança nas estruturas.pdf` (+ `nbr8681-2025.txt`)
- `NBR_8800_2024_Projeto_de_estruturas_de_aço_e_de_estruturas_mistas (1).pdf`
- `NBR6118-2026 Projeto de Estruturas de Concreto.pdf` (+ `nbr6118-2026.txt`)
- `NBR 6120 - 2019.pdf` · `ABNT NBR 6123 - 2023.pdf` · `NBR 7480-2024 - ...pdf`
- `NBR_14762_2010_...pdf` · `ABNT NBR 6355_2012.pdf`
- `ABNT NBR 15421 2023 - Projeto de estruturas resistentes a sismos.pdf` (escaneado, sem texto; a 2006 está marcada SUPERADA)
- Comparação de códigos já existentes no PORTICO: `aisc-360-22-16thedition.pdf`, `ACI 318-25.pdf`,
  `EN 1992-1-1-2004 - Concrete general.pdf`, `Eurocode-3-Design-Of-Steel-Structures (1).pdf`

Literatura (oráculos):
- `Aco\Pfeil_Estruturas_de_aço,_dimensionamento_prático_9a_ed_LTC,_2022.pdf` (a 8ª ed. na raiz
  está superada)
- `Fakury Silva Caldas 2017 - Dimensionamento de Elementos Estruturais de Aco e Mistos.pdf`
- `Kimura 2018 - Calculo de Pilares de Concreto Armado.pdf`
- `Carvalho & Pinheiro Vol2 - Calculo e Detalhamento de Estruturas Usuais de Concreto Armado.pdf`
- `Aco\449_Manual_Dimensionamento_de_Perfis_Formados_a_Frio_web.pdf`, `Aco\01_Manual_Galpoes_web.pdf`
- `Acoes\Acao do Vento nas Edificacoes - Teoria e Exemplos.pdf`

Insumos já validados em projeto próprio (`C:\projetos\StructPro-Pro`, 193 testes de aço verdes
em 14/10/2026): fichas `docs\fichas\` (C1 flexão, F4 combinações — ver ressalva na seção 6 —,
P2.2 vento, P2.3 formados a frio), 48 fixtures de literatura em `tests\` e catálogos em
`src\StructPro.Sections\data\`. Portar para o PORTICO = publicar sob AGPL (decisão do usuário).

Acrescentados em 14/10/2026 (de `D:\Livros`): NBR 7190-1:2022; Calil Jr. e Lahr (2003, base 1997) e Calil Jr. e Molina (2010) em `Madeira\`; Carvalho e Figueiredo Filho Vol. 1, 4ª ed. (2014) na raiz; José Milton de Araújo Vol. 1 e 4, Bastos e Fusco em `Concreto\`.

NBR 5884:2005 (com as Tab. B.1-B.4 de CS/CVS/VS/VSM, escaneadas) e NBR 7190-1 a 7:2022 acrescentadas; o CVS 400×87 do Pfeil 7.6.5 saiu da Tab. B.2.

Faltam no acervo **[LACUNA]**: IBRACON *Comentários e Exemplos de Aplicação da NBR 6118* (seria o oráculo de literatura da torção 17.5).

Acrescentados em 15/10/2026: `Aco/EN-10219-2-2019.pdf` (tubos retangulares), `Aco/BR-Catalogo-de-Acos-Estruturais.pdf` (Vallourec), `Aco/aisc-shapes-database-v160-2.xlsx` (Z, J, Cw dos U).

Código-fonte: https://github.com/jpreyes/portico-core (commit `7468071`)
