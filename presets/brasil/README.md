# Preset — Brasil (normas ABNT NBR)

Tabelas das normas brasileiras para o gerador do assistente e para o dimensionamento do
**portico-core**. Substituem as tabelas de **exemplo** do core agnóstico (PLANO_BRASIL 8.3).

## Como aplicar

Copie estes arquivos sobre `assistant/` (mesmos nomes):

```bash
cp presets/brasil/rules.json          assistant/rules.json
cp presets/brasil/design_params.json  assistant/design_params.json
cp presets/brasil/live_loads.csv      assistant/live_loads.csv
cp presets/brasil/profiles.csv        assistant/profiles.csv
cp presets/brasil/materials.csv       assistant/materials.csv
```

Recarregue o app. Para voltar à base agnóstica: `git checkout assistant/`.

Com o idioma em **PT**, o app já usa NBR 8800 (aço) e NBR 6118 (concreto) como normas padrão,
lista os materiais NBR e o botão de combinações gera as combinações da NBR 8681.

## O que cobre

| Arquivo | Normas (edição) |
|---|---|
| `rules.json` | **NBR 6123:2023** (vento: S2 Tab. 1/2, S3 Tab. 4, Cpe paredes Tab. 6, telhado duas águas Tab. 7, Cpi 6.3.2.1), **NBR 15421:2023** (sismo: Ca/Cv Tab. 3, espectro 6.3, I Tab. 4, R/Ω0/Cd Tab. 6), lista de referência de combinações **NBR 8681:2025** e regras de modelagem (perfis W). |
| `design_params.json` | Respaldo legado: MR250 (NBR 8800:2024), C25/CA-50 (NBR 6118:2026), limites de flecha (NBR 6118 Tab. 13.3). |
| `live_loads.csv` | **NBR 6120:2019 Tabela 10** completa (190 usos), conferida linha a linha contra a norma. |
| `profiles.csv` | Perfis laminados **Gerdau W e HP** (88), propriedades tabeladas. |
| `materials.csv` | Aços NBR 7007 (MR250, AR350, AR350 COR, AR415) e concretos C20–C50 com Ecs da NBR 6118:2026. |

Os módulos de dimensionamento (`js/design/codes/nbr8800.js`, `nbr6118.js`, `nbr7190.js`) e o
espectro (`js/design/spectra/nbr15421.js`) ficam no core; este preset só traz dados.

## Entradas que o projeto precisa informar

- **Vento:** V0 (isopletas, Figura 1 da NBR 6123), categoria de rugosidade, grupo do S3, dimensões
  em planta (`ficha.wind.{V0_m_s, categoria, grupoS3, a_m, b_m}`) e o caso de Cpi (padrão: quatro
  faces permeáveis, −0,3 ou 0).
- **Sismo:** ag (mapa da Figura 1 da NBR 15421 — não há lista por município), classe do terreno,
  categoria de utilização e R do sistema.
- **Combinações:** categoria de uso do ψ (residencial por padrão) e, no sismo, ψ0 (padrão) ou ψ2.

## Avisos

- Dados transcritos das normas ABNT e conferidos nas páginas; **confira** contra a norma oficial
  antes de um projeto real. Cpe de telhados com calha central ou múltiplos (Tab. 9–12) e Ca de
  edifícios (Figuras 4/5) **não** estão no preset.
- Resultados são de apoio ao projeto e exigem revisão de engenheiro habilitado (ART).
