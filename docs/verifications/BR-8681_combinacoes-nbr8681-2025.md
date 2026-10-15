# Verificação BR-8681 — Combinações de ações, ABNT NBR 8681:2025

**Módulo:** `js/design/combinations_nbr.js` (função `nbrCombinations`; o `code` retornado é `NBR6118:2026` para concreto e `NBR8800:2024` para aço) · **Teste:** `tests/test_nbr8681.mjs` · **Commits:** `c6a747e`

**Edição adotada:** NBR 8681:2025 (forma das combinações, 5.1.3.1 e 5.1.5; ψ da Tab. 6). Os γ seguem a norma do material: NBR 6118:2026 Tab. 11.1 para concreto e NBR 8800:2024 Tab. 1 para aço. A combinação excepcional segue a NBR 15421:2023, 5.4.
**Base do oráculo:** cálculo manual com as tabelas citadas acima (PLANO_BRASIL, seção 6, conferidas nos PDFs em 14/10/2026). O esperado **ainda precisa ser ratificado** pelo engenheiro (PLANO_BRASIL, nota da fase 2). Não existe exemplo resolvido de literatura.
**Equivalência:** não se aplica, porque o oráculo já foi feito na edição vigente. Os ψ são iguais nas três normas (NBR 6118:2026 Tab. 11.2, NBR 8800:2024 Tab. 2 e NBR 8681:2025 Tab. 6). A ficha F4 do StructPro-Pro registra γq = 1,4 "geral", mas pela 8681:2025 Tab. 4 o 1,4 vale só para o **vento**. Por isso o gerador usa 1,5 para as demais variáveis no aço.

## Casos

Todos os casos estão no teste BR-8681-01. A numeração (1) a (8) é a dos blocos do teste. A comparação é feita pelo conjunto de fatores de cada combinação. **PORTICO** é a saída de `nbrCombinations` executada para esta ficha.

### BR-8681-01 (1) — Concreto, G + Q + V0, uso residencial
Oráculo: cálculo manual na edição vigente. γg = γq = γv = 1,4; ψ residencial 0,5/0,4/0,3; ψ do vento 0,6/0,3/0.

| Combinação | Esperado (manual) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| ELU, Q principal | 1,4G + 1,4Q + 0,84V0 | 1,4G + 1,4Q + 0,84V0 | 0,00 % | 1e-9 por fator |
| ELU, V principal | 1,4G + 1,4V0 + 0,7Q | 1,4G + 1,4V0 + 0,7Q | 0,00 % | 1e-9 |
| ELU, G favorável | 1,0G + 1,4V0 | 1,0G + 1,4V0 | 0,00 % | 1e-9 |
| Nº de ELU | 3 | 3 | — | exato |
| ELS quase permanente | G + 0,3Q (ψ2 do vento = 0) | G + 0,3Q (única) | 0,00 % | 1e-9 |
| ELS frequente | G + 0,4Q; G + 0,3V0 + 0,3Q | idem | 0,00 % | 1e-9 |
| ELS rara | G + Q + 0,3V0; G + V0 + 0,4Q | idem | 0,00 % | 1e-9 |
| ELU excepcional sem sismo | nenhuma | nenhuma | — | exato |

### BR-8681-01 (2) — Aço, G + Q + V0, uso residencial
Oráculo: cálculo manual. γg agrupado 1,35; γq 1,50; γv 1,40.

| Combinação | Esperado (manual) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| ELU, Q principal | 1,35G + 1,5Q + 0,84V0 | 1,35G + 1,5Q + 0,84V0 | 0,00 % | 1e-9 |
| ELU, V principal | 1,35G + 1,4V0 + 0,75Q | 1,35G + 1,4V0 + 0,75Q | 0,00 % | 1e-9 |
| ELU, G favorável | 1,0G + 1,4V0 | 1,0G + 1,4V0 | 0,00 % | 1e-9 |

### BR-8681-01 (3) — Duas direções de vento (V0, V90), concreto

| Grandeza | Esperado (manual) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Combinação com V0 e V90 juntos | nenhuma | nenhuma | — | exato |
| Nº de ELU | 6 | 6 | — | exato |
| ELU com V90 secundário | 1,4G + 1,4Q + 0,84V90 | idem | 0,00 % | 1e-9 |

### BR-8681-01 (4) — Aço, uso comercial (ψ0 = 0,7)

| Combinação | Esperado (manual) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| ELU, V principal | 1,35G + 1,4V0 + 1,05Q | idem | 0,00 % | 1e-9 |
| ELS quase permanente | G + 0,4Q | idem | 0,00 % | 1e-9 |

### BR-8681-01 (5) — Temperatura, concreto (γ = 1,2; ψ0 = 0,6)

| Combinação | Esperado (manual) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| ELU, Q principal | 1,4G + 1,4Q + 0,72T | idem | 0,00 % | 1e-9 |
| ELU, T principal | 1,4G + 1,2T + 0,7Q | idem | 0,00 % | 1e-9 |

### BR-8681-01 (6) — Sismo, NBR 15421:2023 5.4
Oráculo: cálculo manual com γg = 1,2, γexc = 1,0 e vento fora da combinação.

| Combinação | Esperado (manual) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| ELU excepcional (ψ0,ef = ψ0, padrão) | 1,2G + 1,0E0 + 0,5Q | idem | 0,00 % | 1e-9 |
| ELU excepcional, G favorável | 1,0G + 1,0E0 | idem | 0,00 % | 1e-9 |
| Vento na excepcional | não entra | não entra | — | exato |
| Sismo em ELU normal ou ELS | não entra | não entra | — | exato |
| Opção `psiSismo: 'psi2'` (aço) | 1,2G + 1,0E0 + 0,3Q | idem | 0,00 % | 1e-9 |

### BR-8681-01 (7) — Sobrecarga de cobertura, aço (ψ da NBR 8681:2025 Tab. 6: 0,8/0,7/0,6)

| Combinação | Esperado (manual) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| ELU, V principal | 1,35G + 1,4V0 + 1,2Qcob | idem | 0,00 % | 1e-9 |

### BR-8681-01 (8) — Formato e erros

| Grandeza | Esperado | PORTICO | Tolerância do teste |
| --- | --- | --- | --- |
| `lista` = elu + exc + qp + freq + rara | sim | sim | exato |
| Toda combinação tem `nombre` e `factores` numéricos | sim | sim | exato |
| Família inválida (`timber`) | erro | erro | exato |
| Sem caso G | erro | erro | exato |

## Conclusão

Todos os fatores conferem com o cálculo manual, com diferença de 0,00 % (o teste compara cada fator com tolerância de 1e-9). O gerador cobre ELU normal, ELU excepcional e ELS quase permanente, frequente e raro para concreto e aço. **Esta conclusão não vale como fechamento:** o oráculo ainda depende da ratificação do engenheiro.

**Observação feita ao executar esta ficha, não coberta pelo teste:** com duas direções de vento (caso 3), a lista ELS frequente traz `G + 0,4Q` **duas vezes**, uma por direção. A lista fica redundante, mas o resultado não muda, porque a combinação é a mesma.

## Limitações e pendências

- **ψ0,ef da combinação sísmica:** o padrão é usar ψ0 (conservador). A NBR 8681:2025, 5.1.3.2, permite usar ψ2 para ações de duração muito curta (opção `psiSismo: 'psi2'`). A escolha cabe ao RT de cada projeto.
- **Combinação direcional do sismo (NBR 15421, 8.5):** o gerador não aplica.
- **Concreto:** γg = 1,3 para peso próprio de pequena variabilidade (Tab. 11.1, nota a) não é oferecido. O gerador usa 1,4.
- **Aço:** só existe a opção de permanentes agrupadas (1,35). As permanentes separadas (Tab. 1) não estão implementadas.
- **Cobertura no concreto:** a linha "coberturas" da NBR 8681 Tab. 6 é usada também para concreto, porque a NBR 6118 Tab. 11.2 não tem essa linha.

## Revisão

Nenhum achado de revisão de especialista ficou registrado para este módulo (há um só commit, `c6a747e`). O próprio teste diz que os valores esperados são "a ratificar".

Revisão do engenheiro responsável: pendente — ______ / data ______
