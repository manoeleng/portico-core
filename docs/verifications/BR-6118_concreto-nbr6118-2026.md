# Verificação BR-6118 — Concreto, ABNT NBR 6118:2026

**Módulo:** `js/design/codes/nbr6118.js` (id `NBR6118:2026`, família `concrete`) · **Testes:** `tests/test_nbr6118.mjs`, `tests/test_nbr6118_els.mjs` (fixtures `tests/data/nbr6118_carvalho.json`, `tests/data/nbr6118_els_carvalho.json`) · **Commits:** `4c14550`, `be781b9`, `dab6004`, `6f566cd`, `a208f71`

**Edição adotada:** NBR 6118:2026 · **Base da literatura:** Carvalho & Figueiredo Filho, Vol. 1, 4ª ed. (2014), base NBR 6118:2014; Bastos (UNESP, notas de aula "Pilares", base 2014); Kimura (2018), base 2014. · **Equivalência:** para fck ≤ 40 MPa e CA-50, as expressões usadas de flexão (17.2), cortante (17.4.2.2/17.4.2.3), flecha (17.3.2.1) e fissuração (17.3.3.2) não mudaram de 2014 para 2026. As mudanças da 2026 foram evitadas nos casos de literatura: ηc = (40/fck)^(1/3) só acima de 40 MPa (8.2.10.1) e η1 do CA-60. Pilares: M1d,mín, λ1 e αb biapoiado iguais na 2026 (15.8.3.3.2/3); αb do balanço passou a 1,0 na 2026 (15.8.2) — testado à parte (03g).

Valores "PORTICO" obtidos executando o módulo com a mesma montagem dos testes (script independente, 15/10/2026). dif. = (PORTICO − esperado)/esperado.

## Casos

### BR-6118-01a — Flexão simples, armadura simples, domínio 2
Fonte: Carvalho Vol. 1, Cap. 3, Ex. 1 (p. 130–131; Ex. 6a p. 143). Oráculo: literatura.

| Dado | Valor |
| --- | --- |
| bw × d | 12 × 29 cm |
| fck / aço | 20 MPa / CA-50 |
| Md | 17,08 kN·m (= 1,4 × 12,2) |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| x/d | 0,188 | 0,1884 | +0,21 % | 1,5 % |
| Domínio | 2 | 2 | — | igual |
| As necessária | 1,46 cm² | 1,465 cm² | +0,35 % | 1,5 % |
| A's | 0 | 0 | — | igual |

### BR-6118-01b — Flexão simples, domínio 3 (x/d próximo de 0,45)
Fonte: Carvalho Vol. 1, Cap. 3, Ex. 6b (p. 143–144). Oráculo: literatura.

| Dado | Valor |
| --- | --- |
| bw × d | 12 × 20 cm |
| fck / aço | 20 MPa / CA-50 |
| Md | 17,08 kN·m |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| x/d | 0,4479 | 0,4458 | −0,47 % | 1,5 % |
| Domínio | 3 | 3 | — | igual |
| As necessária | 2,39 cm² | 2,390 cm² | +0,02 % | 1,5 % |
| A's | 0 | 0 | — | igual |

Observação da fixture: o livro entra na tabela com KMD arredondado (0,250; exato 0,2491 → KX 0,4458) — o PORTICO reproduz o valor exato.

### BR-6118-01c — Flexão simples, armadura dupla
Fonte: Carvalho Vol. 1, Cap. 3, Ex. 7 (p. 146–147). Oráculo: literatura.

| Dado | Valor |
| --- | --- |
| bw × d / d' | 12 × 29 cm / 3,6 cm |
| fck / aço | 20 MPa / CA-50 |
| Md | 63,0 kN·m (= 1,4 × 45) |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| x/d (limite de ductilidade) | 0,45 | 0,45 | 0,00 % | 1 % |
| Domínio | 3 | 3 | — | igual |
| As tracionada total | 5,93 cm² | 5,928 cm² | −0,04 % | 1 % |
| A's comprimida | 2,43 cm² | 2,429 cm² | −0,04 % | 1 % |

### BR-6118-01d — Momento resistente com As dada
Fonte: Carvalho Vol. 1, Cap. 3, Ex. 4 (p. 137–138). Oráculo: literatura. Seção 12 × 17,65 cm, fck 20 MPa, CA-50.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| MRd, As = 0,5 cm² (domínio 2) | 3,675 kN·m | 3,673 kN·m | −0,05 % | 1 % |
| MRd, As = 2,0 cm² (domínio 3) | 12,753 kN·m | 12,751 kN·m | −0,02 % | 1 % |

### BR-6118-02a — Cortante, Modelo I, viga alta
Fonte: Carvalho Vol. 1, Cap. 6, Ex. 2 (e Ex. 3), p. 296–298. Oráculo: literatura.

| Dado | Valor |
| --- | --- |
| bw × d | 70 × 200 cm |
| fck / aço | 26 MPa / CA-50 |
| Vsd / α | 1 820 kN / 90° |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Modelo | I | I | — | igual |
| VRd2 | 6 289,9 kN | 6 289,9 kN | 0,00 % | 0,5 % |
| Vc | 1 108,8 kN | 1 105,8 kN | −0,27 % | 0,5 % |
| Asw/s necessária | 9,09 cm²/m | 9,13 cm²/m | +0,39 % | 1 % |

Observação da fixture: o livro arredonda fctd = 1,32 MPa (Vc exato 1 107,3 kN).

### BR-6118-02b — Cortante, Modelo I, viga V101
Fonte: Carvalho Vol. 1, Cap. 6, Ex. 4 (p. 299–300). Oráculo: literatura.

| Dado | Valor |
| --- | --- |
| bw × d | 25 × 80 cm |
| fck / aço | 20 MPa / CA-50 |
| Vsd / α | 357,7 kN / 90° |
| Estribo dado | φ6,3 c/ 8,9 cm, 2 ramos |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| VRd2 | 709,8 kN | 709,7 kN | −0,01 % | 0,5 % |
| Vc | 132,0 kN | 132,6 kN | +0,47 % | 1 % |
| Asw/s necessária | 7,20 cm²/m | 7,19 cm²/m | −0,14 % | 1 % |
| VRd3 com o estribo dado | 357,7 kN | 351,9 kN | **−1,62 %** | 3 % |

VRd3: o livro usa 0,32 cm²/ramo para φ6,3 (π·6,3²/4 = 0,312 cm², −2,6 % em Asw) e s arredondado. A tolerância de 3 % só vale para esta grandeza e está acima do 1 % da seção 10 do PLANO_BRASIL — a justificativa está registrada na fixture.

### BR-6118-02c — Cortante, Modelo II (θ = 30°), viga V101
Fonte: Carvalho Vol. 1, Cap. 6, "Exemplo 5" (refaz o Ex. 4 com o Modelo II), p. 302–304. Oráculo: literatura.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Modelo | II | II | — | igual |
| VRd2,II | 614,0 kN | 614,6 kN | +0,10 % | 0,5 % |
| Vc,II (interpolado) | 70,2 kN | 70,7 kN | +0,71 % | 2 % |
| Asw/s necessária | 5,30 cm²/m | 5,29 cm²/m | −0,13 % | 1,5 % |
| Asw/s(II, 30°) < Asw/s(I) (livro p. 304) | sim | 5,29 < 7,19 | — | lógico |

Tolerâncias de Vc e Asw/s acima de 1 % por causa do arredondamento encadeado do livro (0,66; 1,79; 3,07 MPa), justificadas na fixture.

### BR-6118-03 — Pilar, 2ª ordem local, M1d,A < M1d,mín
Fonte: Bastos (UNESP, notas de aula "Pilares", base 2014), Ex. 1. Oráculo: literatura. Função `columnSecondOrder`.

| Dado | Valor |
| --- | --- |
| Seção / eixo | 20 × 50 cm, eixo de h = 20 cm |
| fck / aço | 20 MPa (C20) / CA-50 |
| Nd / le | 1 100 kN / 2,80 m |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| λ | 48,4 | 48,50 | +0,20 % | 0,5 % |
| M1d,mín | 2 310 kN·cm | 2 310 kN·cm | 0,00 % | 0,1 % |
| ν | 0,77 | 0,77 | 0,00 % | 0,2 % |
| Md,tot, curvatura aproximada | 4 008 kN·cm | 4 007,6 kN·cm | −0,01 % | 0,2 % |
| Md,tot, rigidez κ | 3 500 kN·cm | 3 504,9 kN·cm | +0,14 % | 0,5 % |
| αb (M1d,A < M1d,mín) | 1,0 | 1,0 | — | igual |
| αb do balanço (2026, 15.8.2) | 1,0 | 1,0 | — | igual |

O teste da linha "αb do balanço" é um teste de regra (mudança da 2026), não um oráculo de livro.

### BR-6118-03b — Pilar, curvatura reversa
Fonte: Kimura (2018), Ex. 16 (p. 129–131, base 2014; 1 tf = 10 kN). Oráculo: literatura.

| Dado | Valor |
| --- | --- |
| Seção / eixo | 35 × 65 cm, eixo de h = 35 cm |
| fck / aço | 20 MPa (C20) / CA-50 |
| Nd / le | 3 200 kN (320 tf) / 7,5 m |
| MA / MB | 105 kN·m / −20 kN·m (curvatura reversa) |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| αb | 0,524 | 0,5238 | −0,04 % | 0,2 % |
| λ | 74,2 | 74,23 | +0,04 % | 0,2 % |
| λ1 | 50 | 49,96 | −0,07 % | 0,2 % |
| ν | 0,985 | 0,9846 | −0,04 % | 0,2 % |
| Md,tot, curvatura aproximada | 228 kN·m (22,8 tf·m) | 228,2 kN·m | +0,09 % | 0,5 % |
| Md,tot, rigidez κ | 211 kN·m (21,1 tf·m) | 210,9 kN·m | −0,07 % | 0,5 % |

### BR-6118-04a — ELS, flecha imediata e diferida (laje b16)
Fonte: Carvalho Vol. 1, Cap. 4, Ex. 2 (p. 215–219). Oráculo: literatura. Funções `stage2Inertia`, `equivalentStiffness` (Branson), `xiTime`, `creepFactor`. Seção T com LN na mesa, logo equivale a uma seção retangular com b = bf.

| Dado | Valor |
| --- | --- |
| bf / hf / d | 50 / 4 / 13,9 cm |
| As | 3,615 cm² |
| αe / Ecs | 9,865 / 21 287 MPa |
| Ic / Mr | 6 507 cm⁴ / 1,57 kN·m |
| Vão / t0 | 5,0 m / 0,47 mês |

Os valores de Ic, Mr e Ecs entram como dado do livro, sem aferição própria.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| x_II | 3,8 cm | 3,796 cm | −0,09 % | 1 % |
| I_II | 4 552 cm⁴ | 4 552,4 cm⁴ | +0,01 % | 1 % |
| Flecha imediata, permanente | 1,30 cm | 1,283 cm | **−1,32 %** | 2 % |
| Flecha imediata, quase permanente | 1,81 cm | 1,796 cm | −0,79 % | 2 % |
| Flecha imediata, rara | 3,01 cm | 2,978 cm | **−1,08 %** | 2 % |
| ξ(t0 = 0,47 mês) | 0,53 | 0,533 | +0,57 % | 1 % |
| ξ(t > 70 meses) | 2 | 2 | — | igual |
| αf (ρ' = 0) | 1,47 | 1,467 | −0,21 % | 1 % |
| Flecha total t = ∞ | 4,47 cm | 4,430 cm | −0,90 % | 2 % |

### BR-6118-04b — ELS, flecha (laje b20)
Fonte: Carvalho Vol. 1, Cap. 4, Ex. 3 (p. 219–220). Oráculo: literatura.

| Dado | Valor |
| --- | --- |
| bf / hf / d | 50 / 6 / 18 cm |
| As | 3,615 cm² |
| Ic / Mr | 12 700 cm⁴ / 2,44 kN·m |
| Vão | 5,0 m |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| x_II | 4,4 cm | 4,404 cm | +0,09 % | 1 % |
| I_II | 8 016 cm⁴ | 8 015,8 cm⁴ | 0,00 % | 1 % |
| Flecha imediata, permanente | 0,69 cm | 0,688 cm | −0,33 % | 2 % |
| Flecha imediata, quase permanente | 1,00 cm | 0,998 cm | −0,25 % | 2 % |
| Flecha imediata, rara | 1,69 cm | 1,683 cm | −0,43 % | 2 % |
| αf | 1,47 | 1,467 | −0,21 % | 1 % |
| Flecha total t = ∞ | 2,47 cm | 2,461 cm | −0,37 % | 3 % |

### BR-6118-04c — ELS, abertura de fissuras (viga V101)
Fonte: Carvalho Vol. 1, Cap. 4, Ex. 1 (p. 212–215). Oráculo: literatura. Funções `stage2Inertia`, `crackWidth`, `crackLimit`.

| Dado | Valor |
| --- | --- |
| Seção / d | 25 × 90 cm / 80,47 cm |
| As / φ | 20 cm² / 12,5 mm |
| Aço | CA-50 (η1 = 2,25) |
| fctm | 2,21 MPa |
| ρr | 0,01755 |
| M_ser | 322,56 kN·m |

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| x_II | 28,6 cm | 28,61 cm | +0,04 % | 1 % |
| I_II | 725 782 cm⁴ | 725 782 cm⁴ | 0,00 % | 1 % |
| σs no estádio II | 204 MPa | 204,3 MPa | +0,15 % | 1 % |
| wk com σs = 245 MPa (simplificado) | 0,142 mm | 0,1415 mm | −0,34 % | 1 % |
| wk com σs = 204 MPa | 0,118 mm | 0,1178 mm | −0,14 % | 1 % |
| Limite CAA II | 0,3 mm | 0,3 mm | — | igual |

### BR-6118-05 — Robustez: nada fora do escopo passa em silêncio
Fonte: revisão do especialista. Oráculo: regra de projeto do módulo e cálculo à mão do revisor (05d, 05e). Seção 20 × 50 cm, C30, CA-50, estribo φ8 c/ 15 cm.

| Caso | Esperado | PORTICO |
| --- | --- | --- |
| 05a seção não retangular (box) | NÃO atende (ratio = ∞) | ∞ |
| 05b torção ≠ 0 | NÃO atende (ratio = ∞) | ∞ |
| 05c compressão sem le | pilar calculado com le = L, com aviso | M1d,mín = 24 kN·m; aviso presente |
| 05d As = 25 cm² (aço não escoa) | x/d = 0,671 (revisor), NÃO atende | x/d = 0,6713; ratio = ∞ |
| 05e tirante N = +500 kN | Vc = 0; VRd3 = 120,6 kN (revisor) | Vc = 0; VRd3 = 120,64 kN (+0,03 %) |
| 05f pilar curto 4φ20 + 4φ20, N = 1 000 kN | atende | ratio = 0,276 |
| 05g camadas só por área | NÃO verificado, aviso "eixo fraco" | ∞ |
| 05h viga com N = −0,01 kN | continua reprovando por ductilidade, não vira pilar | ∞; pilar = não |
| 05i role "viga" com compressão pequena | não vira pilar | pilar = não |

### BR-6118-T1..T11 — Torção uniforme, 17.5.1 / 17.7.2 (acrescentado em 15/10/2026)

Teste: `tests/test_nbr6118_torcao.mjs` · commits `80b24d8`, `1bb4fbe` · oráculo: cálculo manual na 2026 (**não há
exemplo resolvido de torção no acervo**; IBRACON Comentários = LACUNA), conferido pelo revisor (rodada 2: FECHADO).
Viga 20 × 50 cm, c1 = 4 cm, C25, CA-50, estribo φ8 c/10, modelo I (θ = 45°).

| Grandeza | Esperado | PORTICO | dif. | Tol. |
| --- | --- | --- | --- | --- |
| he (A/u < 2c1) | 0,071429 m | 0,071429 | 0,00 % | 0,01 % |
| Ae / ue | 0,0504 m² / 1,08 m | 0,0504 / 1,08 | 0,00 % | 1e-6 |
| TRd2 | 28,9286 kN·m | 28,9286 | 0,00 % | 0,01 % |
| A90/s por ramo (TSd = 10) | 2,2817 cm²/m | 2,2817 | 0,00 % | 0,01 % |
| As,l | 2,4643 cm² | 2,4643 | 0,00 % | 0,01 % |
| Interação V/VRd2 + T/TRd2 (V = 60 / 150 kN) | 0,49597 / 0,72142 | 0,4960 / 0,7214 | 0,01 % | 0,1 % |
| Estribos V + T por ramo (V = 150 kN) | 0,89165 | 0,8917 | 0,01 % | 0,1 % |
| Taxa mínima: estribo / As,l (T = 1 kN·m) | 0,20411 / 0,26382 | 0,2041 / 0,2638 | 0,01 % | 0,1 % |
| Estribo de 4 ramos (ramo periférico) | 0,67278 | 0,6728 | 0,00 % | 0,1 % |
| Ramo he ≥ 2c1 (40 × 80): he / Ae | 0,13333 / 0,17778 | 0,13333 / 0,17778 | 0,00 % | 0,01 % |

Casos qualitativos: sem `rebar.Asl_torcao_cm2` → não verificado com a área necessária; torção de compatibilidade
desprezada só por opção, com aviso de VSd ≤ 0,7·VRd2; TSd > TRd2 reprova; b ou h ≤ 2c1 → seção equivalente inválida.
Não implementado: 17.5.2 (perfis abertos), 17.7.1.3 (redução no banzo comprimido), seção não retangular.

## Conclusão

12 casos com oráculo numérico (01a–01d, 02a–02c, 03, 03b, 04a–04c) e um bloco de robustez (05a–05i); todos dentro da tolerância dos testes (`test_nbr6118.mjs` e `test_nbr6118_els.mjs` passam, 15/10/2026).

- **Diferença máxima: −1,62 %**, no VRd3 do 02b, que vem da área de barra arredondada no livro.
- Também passam de 1 % as flechas permanente (−1,32 %) e rara (−1,08 %) do 04a, ambas dentro da tolerância de 2 %.
- Todas as demais grandezas ficam ≤ 0,71 %.
- Três grandezas excedem o critério de ≤ 1 % contra literatura da seção 10 do PLANO_BRASIL, todas com tolerância justificada na fixture: VRd3 do 02b e flechas permanente e rara do 04a.

## Limitações e avisos do módulo

**Não verificado — ratio = ∞, nunca aprovação silenciosa:**
- torção (17.5);
- seções não retangulares (o módulo só trata `rect`);
- armadura de pilar dada só por área, quando a posição no eixo fraco não é conhecida.

**Avisos e limites de escopo:**
- O sentido do momento não é verificado (o módulo trabalha com magnitudes) e o resultado avisa.
- Na flexo-tração, a ductilidade é verificada com N = 0 (conservador).
- Uma barra é classificada como pilar quando a seção tem papel "pilar" ou ν ≥ 0,10 (critério adotado e sinalizado). Sem le, usa le = L com aviso.
- Os limites de detalhamento (As,mín, As,máx e dimensões) saem como avisos.

**ELS:**
- O ELS fica fora de `check()`: são funções auxiliares.
- `crackingMoment` não foi aferido contra o livro; Mr, Ic e yt entraram como dados do livro.
- Os limites NBR 6118:2026 de `js/design/serviceability.js` (L/250, Hi/850) **não têm teste dedicado**.
- O deslocamento do topo H/1 700 não existe no módulo de ELS (pendência da fase 2).

**Cobertura dos oráculos:**
- Toda a literatura é base 2014, com casos restritos a fck ≤ 40 MPa e CA-50.
- O ramo ηc da 2026 (fck > 40 MPa) e o η1 do CA-60 não têm oráculo de literatura.

**Casos descartados da literatura:** registrados em `tests/data/nbr6118_carvalho.json` → `descartados`.
- Cap. 3 Ex. 2 (fck 90 MPa);
- Cap. 3 Ex. 3 (critério anterior a 2014 e caso na borda x/d = 0,45);
- Cap. 3 Ex. 5 (d_mín);
- Cap. 3 Ex. 8–9 (seção T);
- Cap. 6 Ex. 1 (treliça clássica).

## Revisão

Revisão do especialista: FECHADO após 3 rodadas (PLANO_BRASIL, nota da fase 5). Achados corrigidos:
- `be781b9` — nada passa em silêncio fora do escopo (seção não retangular, torção, ductilidade da armadura dada, tirante com Vc = 0);
- `dab6004` — classificação de pilar e excentricidade em Vz;
- `a208f71` — normas NBR não aprovam sem o comprimento da barra.

Revisão do engenheiro responsável: pendente — ______ / data ______
