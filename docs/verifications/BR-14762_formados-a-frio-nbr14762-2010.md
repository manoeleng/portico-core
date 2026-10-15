# Verificação BR-14762 — Perfis formados a frio, ABNT NBR 14762:2010

**Módulo:** `js/design/codes/nbr14762.js` (id `NBR14762:2010`) + catálogo `js/design/profiles_cf.js` (NBR 6355:2012) · **Teste:** `tests/test_nbr14762.mjs`, `tests/test_nbr14762_rev.mjs` (oráculos em `tests/data/nbr14762_cbca.json`) · **Commits:** `2dd5c2d` (módulo e catálogo), `deb9f9e` (roteamento Ue → NBR 14762), `910cd61` e `93c2e7e` (achados da revisão)

**Edição adotada:** NBR 14762:2010; perfis pela NBR 6355:2012 (Tab. A).

**Base da literatura:**
- **M14:** CBCA 2014, E. Lubas Silva, *Estruturas compostas por perfis formados a frio*, na mesma base (NBR 14762:2010 e NBR 6355:2012). Fornece os Ex. 04–09 e o Anexo D (S6, S8).
- **M449:** CBCA 449/2008, *Manual de Dimensionamento de Perfis Formados a Frio*. Usado **só** para as fórmulas do MLE (Tab. 5/6) e para Ne, com E = 20 500 kN/cm² e G = 7 884,615 kN/cm² explícitos.

**Equivalência:** M14 está na edição adotada. M449 é método 2001, e nele χ, γ, kv e Ia diferem da 2010; por isso só entram fórmulas que não mudaram. Onde o manual diverge da norma, a tolerância do teste é maior e o motivo está registrado:
- **(a)** 9.2.3.1 "considerar Is/Ia ≤ 1" no k do enrijecedor. O Ex. 07 usa Is/Ia sem esse limite (k = 3,52; a norma dá 3,37), então o Wef da norma sai 0,8 % menor.
- **(b)** Ex. 08 e S8: o manual desloca o centroide com a área bruta (Aret·e/A) em vez de Aef, o que dá Wef,y 1,4 % maior.
- **(c)** S8:
  - o manual usa h = bw − 4t (ri = t), embora liste ri = 3,975 mm;
  - os Wef de y vêm do DimPerfil 4.0, que toma a fibra comprimida no extremo da largura efetiva;
  - a norma literal, que toma o extremo da seção bruta, dá até 3,9 % menos. A implementação fica do lado conservador.

Unidades: no módulo, kN, m e kN/m²; nas tabelas abaixo, as do oráculo (cm, kN, kN·cm). Os valores PORTICO vêm da execução do código em 15/10/2026: `node tests/test_nbr14762.mjs`, `node tests/test_nbr14762_rev.mjs` e um script de conferência dos avisos e da contagem de dispensa da distorcional.

## Casos

### BR-14762-TAB-DISPENSA — Tabelas 11 e 14 (D/bw mínimo, interpolação bilinear)
Fonte: NBR 14762:2010, Tab. 11 e 14. Tipo de oráculo: norma.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Tab. 11, bf/bw = 0,5, bw/t = 83,33 | 0,0716 | 0,071671 | +0,10 % | 0,5 % |
| Tab. 14, bf/bw = 0,5, bw/t = 83,33 | 0,1633 | 0,163342 | +0,03 % | 0,5 % |
| Tab. 11, bf/bw = 0,4, bw/t = 83,33 | 0,0533 | 0,053336 | +0,07 % | 0,5 % |
| Tab. 11, bf/bw = 0,6, bw/t = 83,33 | 0,0900 | 0,090006 | +0,01 % | 0,5 % |
| Tab. 11 fora do domínio (bw/t = 33,3 < 50) | null (sem extrapolação) | null | — | qualitativo |
| Tab. 14 fora do domínio (bf/bw = 2,5) | null | null | — | qualitativo |

### BR-14762-CB — Cb (9.8.2.2)
Fonte: M14 S8 (Cb,x = 1,3) e S6 (Cb = 2,737). Tipo de oráculo: literatura.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Cb, S8 | 1,300 | 1,2987 | −0,10 % | 0,5 % |
| Cb, S6 | 2,737 | 2,73743 | +0,02 % | 0,1 % |

### BR-14762-NE-01 — Compressão, Ue 100×50×17×1,20 (M14 Ex. 04)
Fonte: M14 Ex. 04, p. 51–53. Dados: fy = 25 kN/cm²; KxLx = KyLy = KzLz = 400 cm. Tipo de oráculo: literatura.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Nex | 54,47 kN | 54,4679 kN | −0,00 % | 1 % |
| Ney | 12,49 kN | 12,485 kN | −0,04 % | 1 % |
| Nez | 10,55 kN | 10,5528 kN | +0,03 % | 1 % |
| Ne = Nexz (flexo-torção) | 9,57 kN | 9,5762 kN | +0,06 % | 1 % |
| λ0 | 2,66 | 2,6599 | −0,00 % | 1 % |
| χ | 0,124 | 0,124 | 0,00 % | 1 % |
| Aef (todos efetivos a σ = 3,1 kN/cm²) | 2,71 cm² | 2,71 cm² | 0,00 % | 0,1 % |
| Nc,Rd global | 7,00 kN | 6,9986 kN | −0,02 % | 1 % |
| D/bw mín, Tab. 11 | 0,0716 | 0,0716667 | +0,09 % | 1 % |
| Modo governante | flexo-torção | flexo-torção | — | qualitativo |
| Distorcional dispensada (D/bw = 0,17) | sim | sim | — | qualitativo |
| KyLy/ry = 207 > 200 (9.7.4) | NÃO verificado + aviso | ratio = ∞, aviso 9.7.4 (esbeltez y = 207,25) | — | qualitativo |
| Mesma seção com L = 3 m (KL/r = 155) | verificado, ratio finito | Nc,Rd = 11,216 kN, verificado | — | qualitativo |

O manual ignora o limite de 9.7.4. Por isso os números deste exemplo valem só como conferência das grandezas intermediárias: a barra do Ex. 04 sai **não verificada**.

### BR-14762-NE-02 — Compressão, Ue 150×60×20×3,00 (M14 Ex. 05)
Fonte: M14 Ex. 05, p. 53–54. Dados: KxLx = 600 cm; KyLy = KzLz = 300 cm. Tipo de oráculo: literatura, e recálculo para Nc,Rd.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Nex | 163,44 kN | 163,435 kN | −0,00 % | 1 % |
| Ney | 91,98 kN | 91,9847 kN | +0,01 % | 1 % |
| Nez | 110,38 kN | 110,382 kN | +0,00 % | 1 % |
| Ne = Nexz | 81,89 kN | 81,8899 kN | −0,00 % | 1 % |
| λ0 | 1,63 | 1,6307 | +0,04 % | 1 % |
| χ = 0,877/λ0² | 0,330 | 0,3298 | −0,06 % | 1 % |
| Aef | 8,71 cm² | 8,71 cm² | 0,00 % | 0,1 % |
| Nc,Rd = χ·Aef·fy/1,2 (o 16,69 impresso no manual é inconsistente) | 59,9 kN | 59,8478 kN | −0,09 % | 1 % |
| Distorcional dispensada (D/bw = 0,133 > 0,08) | sim | sim | — | qualitativo |
| Mesma seção pelo catálogo `profiles_cf` (It recalculado 0,262 × 0,261 do manual) | Ne = 81,89 kN | 82,3418 kN | +0,55 % | 1 % |

### BR-14762-DIST-01 — Distorcional na compressão, Ue 100×50×17×3,00 (M14 Ex. 06)
Fonte: M14 Ex. 06, p. 55. Dados: L = 300 cm. Ndist = 575,60 kN, obtido no DimPerfil e passado como **entrada**. Tipo de oráculo: literatura.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| λdist | 0,528 | 0,528464 | +0,09 % | 1 % |
| χdist | 1,000 | 1,000 | 0,00 % | 0,1 % |
| Nc,Rd distorcional | 133,96 kN | 133,958 kN | −0,00 % | 0,1 % |
| Tab. 11 não dispensa (bw/t = 33,3 fora do domínio) | não dispensada | não dispensada | — | qualitativo |
| Nc,Rd = mín(global, distorcional) | sim | sim | — | qualitativo |
| Sem Ndist informado (compressão) | NÃO verificado + aviso Ndist | ratio = ∞ + aviso | — | qualitativo |
| Sem Mdist informado (flexão x) | NÃO verificado + aviso Mdist | ratio = ∞ + aviso | — | qualitativo |

### BR-14762-FLEX-01 — Flexão em x com FLT, Ue 100×50×17×1,20 (M14 Ex. 07)
Fonte: M14 Ex. 07, p. 62–66. Dados: Lb = 400 cm, Cb = 1. Tipo de oráculo: literatura.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Wef, ver (a) | 8,60 cm³ | 8,5322 cm³ | −0,79 % | 1,2 % |
| MRd,esc, ver (a) | 195,45 kN·cm | 193,914 kN·cm | −0,79 % | 1,2 % |
| Me | 71,1 kN·cm | 71,051 kN·cm | −0,07 % | 0,5 % |
| λ0 | 1,762 | 1,76265 | +0,04 % | 0,5 % |
| χFLT | 0,322 | 0,321862 | −0,04 % | 0,5 % |
| Wc,ef (todos efetivos a σ = 8,05) | 8,83 cm³ | 8,83 cm³ | 0,00 % | 0,1 % |
| MRd,FLT | 64,6 kN·cm | 64,5918 kN·cm | −0,01 % | 0,5 % |
| D/bw mín, Tab. 14 | 0,1633 | 0,163333 | +0,02 % | 0,5 % |
| MRd (governa FLT) | 64,6 kN·cm | 64,5918 kN·cm | −0,01 % | 0,5 % |
| Conservador (norma ≤ manual) | sim | sim | — | qualitativo |
| Distorcional dispensada (0,17 ≥ 0,163) | sim | sim | — | qualitativo |

### BR-14762-FLEX-02 — Flexão em y (Anexo E), alma comprimida, Ue 100×50×17×1,20 (M14 Ex. 08)
Fonte: M14 Ex. 08, p. 67–70. Dados: L = 400 cm, Cb = 1. Tipo de oráculo: literatura. Um MdistY muito grande foi passado como entrada só para neutralizar a LACUNA da distorcional; ele não faz parte do oráculo.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| xm | 1,737 cm | 1,73738 cm | +0,02 % | 0,2 % |
| x0 (Anexo E) | 4,29 cm | 4,29078 cm | +0,02 % | 0,2 % |
| βℓ | 33,49 cm⁵ | 33,4895 cm⁵ | −0,00 % | 0,2 % |
| βw | −22,974 cm⁵ | −22,9735 cm⁵ | −0,00 % | 0,2 % |
| βf | 25,387 cm⁵ | 25,3874 cm⁵ | +0,00 % | 0,2 % |
| j | 6,06 cm | 6,06466 cm | +0,08 % | 0,5 % |
| Me (Anexo E, Cs = +1) | 692 kN·cm | 692,463 kN·cm | +0,07 % | 0,5 % |
| λ0 | 0,452 | 0,451789 | −0,05 % | 0,5 % |
| Wef, ver (b) | 2,96 cm³ | 3,00103 cm³ | +1,39 % | 2 % |
| MRd,esc, ver (b) | 67,3 kN·cm | 68,2053 kN·cm | +1,35 % | 2 % |
| MRd (governa escoamento) | 67,3 kN·cm | 68,2053 kN·cm | +1,35 % | 2 % |
| χFLT | 1 | 1 | — | qualitativo |
| Sem MdistY | NÃO verificado (a Tab. 14 vale só para o eixo de maior inércia) | ratio = ∞ + aviso | — | qualitativo |
| Sem sentido de My | mínimo dos dois sentidos; ∞ se um deles não é coberto | ratio = ∞ + aviso | — | qualitativo |

Aqui a implementação dá MRd 1,35 % **acima** do manual (lado contra a segurança). A causa é a divergência (b): o manual desloca o centroide com a área bruta, e a norma pede Aef. O valor da norma é o da implementação; a diferença está dentro da tolerância declarada de 2 %.

### BR-14762-VM-01 — Cortante e interação M+V, Ue 100×50×17×1,20 (M14 Ex. 09)
Fonte: M14 Ex. 09, p. 71. Dados: MSd = 150 kN·cm, VSd = 0,75 kN. Tipo de oráculo: literatura.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Limite 1,08√(E·kv/fy) | 68,3 | 68,3052 | +0,01 % | 0,2 % |
| Limite 1,4√(E·kv/fy) | 88,5 | 88,5438 | +0,05 % | 0,2 % |
| h/t | 79,33 | 79,3333 | +0,00 % | 0,1 % |
| VRd (regime intermediário) | 13,45 kN | 13,4541 kN | +0,03 % | 0,5 % |
| (MSd/MRd)² + (VSd/VRd)² (9.8.4), ver (a) | 0,592 | 0,6015 | +1,60 % | 2 % |
| Regime | 1,08√ < h/t ≤ 1,4√ | intermediário (0,65·t²·√(kv·fy·E)/γ) | — | qualitativo |

### BR-14762-TERCA-S8 — Terça U 125×50×2,65 em flexo-compressão oblíqua (M14 Anexo D, S8)
Fonte: M14 Anexo D, item 4.8 "S8 terça U125x50x2,65", p. 164–170.

| Dado | Valor |
| --- | --- |
| Material | fy = 24 kN/cm² |
| Comprimentos | Lx = 342 cm; Ly = Lz = Lb = 171 cm |
| Cb | 1,3 |
| Esforços | NSd = 1,2 kN; MxSd = 230 kN·cm; MySd = 10 kN·cm; VSd = 0,1 kN |
| Sentido de My | mesas comprimidas |

Tipo de oráculo: literatura. Os Wef de y vêm do DimPerfil 4.0 e não são reproduzíveis à mão.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Nex | 225,38 kN | 225,383 kN | +0,00 % | 0,5 % |
| Ney | 91,15 kN | 91,1523 kN | +0,00 % | 0,5 % |
| Nez | 99,564 kN | 99,5643 kN | +0,00 % | 0,5 % |
| Ne = Nexz | 86,59 kN | 86,6346 kN | +0,05 % | 0,5 % |
| λ0 | 1,26 | 1,2601 | +0,01 % | 0,5 % |
| χ | 0,514 | 0,5145 | +0,10 % | 0,5 % |
| Aef (U simples, mesa AL k = 0,43) | 5,732 cm² | 5,732 cm² | 0,00 % | 0,1 % |
| Nc,Rd | 58,94 kN | 58,9787 kN | +0,07 % | 0,5 % |
| λx = Lx/rx | 70,8 | 70,85 | +0,07 % | 0,5 % |
| λy = Ly/ry | 111,7 | 111,76 | +0,05 % | 0,5 % |
| x: Wef,esc, ver (c) | 19,336 cm³ | 19,5181 cm³ | +0,94 % | 1,5 % |
| x: MRd,esc | 421,87 kN·cm | 425,848 kN·cm | +0,94 % | 1,5 % |
| x: Me = Cb·r0·√(Ney·Nez) | 719,38 kN·cm | 719,417 kN·cm | +0,01 % | 0,2 % |
| x: λ0 | 0,844 | 0,844341 | +0,04 % | 0,5 % |
| x: χFLT | 0,890 | 0,89001 | +0,00 % | 0,5 % |
| x: Wc,ef | 19,71 cm³ | 19,8851 cm³ | +0,89 % | 1,5 % |
| x: MRd,FLT = MxRd | 382,82 kN·cm | 386,137 kN·cm | +0,87 % | 1,5 % |
| y: j | 6,879 cm | 6,87793 cm | −0,02 % | 0,2 % |
| y: Wc = Iy/(bf − xg) | 3,581 cm³ | 3,5817 cm³ | +0,02 % | 0,2 % |
| y: Me (Anexo E; j arredondado no manual, recálculo 227,5) | 224,57 kN·cm | 227,541 kN·cm | +1,32 % | 2 % |
| y: λ0 | 0,619 | 0,614639 | −0,70 % | 1 % |
| y: χFLT | 0,992 | 0,993424 | +0,14 % | 0,5 % |
| y: Wef,esc, ver (c) | 3,077 cm³ | 2,95709 cm³ | **−3,90 %** | 5 % |
| y: MRd,esc | 67,14 kN·cm | 64,5184 kN·cm | −3,90 % | 5 % |
| y: Wc,ef | 3,091 cm³ | 2,97246 cm³ | −3,84 % | 5 % |
| y: MRd,FLT = MyRd | 66,89 kN·cm | 64,4272 kN·cm | −3,68 % | 5 % |
| VRd (manual com h = bw − 4t) | 39,69 kN | 38,7671 kN | −2,33 % | 3 % |
| Limite 1,08√(E·kv/fy) | 69,714 | 69,7137 | −0,00 % | 0,2 % |
| 9.9: N/NRd | 0,020 | 0,0203463 | +1,73 % | 5 % |
| 9.9: Mx/MxRd | 0,600 | 0,595643 | −0,73 % | 2 % |
| 9.9: My/MyRd, ver (c) | 0,150 | 0,155214 | +3,48 % | 5 % |
| 9.9: soma | 0,770 | 0,7712 | +0,16 % | 1,5 % |
| y: Cs = −1 (mesas comprimidas) | sim | sim | — | qualitativo |
| y: conservador (norma ≤ DimPerfil) | sim | sim | — | qualitativo |
| Distorcional dispensada (U simples, 9.3) | sim | sim | — | qualitativo |

Reproduzindo a convenção do manual (ri = t), os valores de x e o cortante voltam ao oráculo:

| Grandeza (ri = t) | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| x: Wef,esc | 19,336 cm³ | 19,2665 cm³ | −0,36 % | 0,5 % |
| x: MRd,FLT | 382,82 kN·cm | 381,463 kN·cm | −0,35 % | 0,5 % |
| x: Wc,ef | 19,71 cm³ | 19,6444 cm³ | −0,33 % | 0,5 % |
| VRd | 39,69 kN | 39,6864 kN | −0,01 % | 0,2 % |

Sem o sentido de My informado, a capacidade em y é o mínimo dos dois sentidos. Aqui ela sai 0, contra 0,6443 kN·m no sentido "mesas", porque o sentido "alma" não é coberto sem MdistY.

### BR-14762-PILAR-S6 — Tração, escoamento da seção bruta (M14 Anexo D, S6)
Fonte: M14 Anexo D, item 4.6 "S6", p. 153–156; só a tração. Dados: seção 2Ue, A = 44,53 cm², fy = 24 kN/cm². Tipo de oráculo: literatura.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Nt,Rd (escoamento da bruta, 9.6.2 a) | 971,65 kN | 971,564 kN | −0,01 % | 0,1 % |
| Ruptura da seção líquida | NÃO verificada + aviso | aviso "ruptura da seção líquida (9.6.2 b/c, Ct) não verificada" | — | qualitativo |

### BR-14762-MLE-449 — Método da largura efetiva, Tab. 5/6 (M449 Ex. 01–03)
Fonte: M449 Ex. 01–03, com E = 20 500 kN/cm² explícito. Tipo de oráculo: literatura (só as fórmulas que não mudaram de 2001 para 2010).

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Ex. 01 mesa AL: λp (k = 0,43) | 1,85 | 1,84996 | −0,00 % | 0,5 % |
| Ex. 01 mesa AL: bef | 4,51 cm | 4,51026 cm | +0,01 % | 0,5 % |
| Ex. 02 mesa AL caso d: k = 0,57 − 0,21ψ + 0,07ψ² | 0,624 | 0,623459 | −0,09 % | 0,5 % |
| Ex. 02 mesa: λp | 1,66 | 1,66368 | +0,22 % | 0,5 % |
| Ex. 02 bef sobre bc (2010) = 4,94·1/(1 + 0,236) | 3,99676 cm | 3,99634 cm | −0,01 % | 1 % |
| Ex. 03 cantoneira: λp | 0,72 | 0,719405 | −0,08 % | 1 % |
| Ex. 03 cantoneira: bef | 7,07 cm | 7,0731 cm | +0,04 % | 0,5 % |
| Ex. 01 alma AA, ψ = −1: k | 24 | 24 | 0,00 % | 0,1 % |
| Ex. 01 alma totalmente efetiva | sim | sim | — | qualitativo |

### BR-14762-NE-449-13 / NE-449-14 — Ne (M449 Ex. 13 e 14)
Fonte: M449 Ex. 13, p. 67–69 (U 100×50×2,0; KL = 150 cm) e Ex. 14, p. 69–71 (Ue 200×100×25×2,65 com propriedades da 6355:2003; Lx = 300 cm, Ly = Lz = 150 cm). E = 20 500 e G = 7 884,615 kN/cm². Tipo de oráculo: literatura (só Ne).

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Ex. 13 Nex | 552,95 kN | 552,946 kN | −0,00 % | 0,5 % |
| Ex. 13 Ney | 87,46 kN | 87,4592 kN | −0,00 % | 0,5 % |
| Ex. 13 Nez | 65,43 kN | 65,567 kN | +0,21 % | 0,5 % |
| Ex. 13 Ne = Nexz | 62,67 kN | 62,7981 kN | +0,20 % | 0,5 % |
| Ex. 14 Nex | 1 684,942 kN | 1 684,94 kN | +0,00 % | 0,5 % |
| Ex. 14 Ney | 1 415,074 kN | 1 415,07 kN | +0,00 % | 0,5 % |
| Ex. 14 Nez | 841,839 kN | 841,859 kN | +0,00 % | 0,5 % |
| Ex. 14 Ne = Nexz | 657,44 kN | 657,442 kN | +0,00 % | 0,5 % |

### BR-14762-CAT — Catálogo `profiles_cf.js` (NBR 6355:2012)
Fonte: NBR 6355:2012, Tab. A. Tipo de oráculo: norma (valor tabelado), e recálculo para It.

| Grandeza | Esperado (fonte) | PORTICO | dif. | Tolerância do teste |
| --- | --- | --- | --- | --- |
| Número de perfis | 85 Ue + 65 L | 85 + 65 | — | exato |
| Ue 100×50×17×1,20: A | 2,71 cm² | 2,71 cm² | 0,00 % | exato |
| Ue 100×50×17×1,20: Ix | 44,15 cm⁴ | 44,15 cm⁴ | 0,00 % | exato |
| Ue 100×50×17×1,20: Cw | 246,61 cm⁶ | 246,61 cm⁶ | 0,00 % | exato |
| ri = t (6355 Tab. A.3) | 1,2 mm | 1,2 mm | 0,00 % | exato |
| It recalculado Σ b·t³/3 (tabela imprime 0,01; manual 0,013) | 0,0132 cm⁴ | 0,0132019 cm⁴ | +0,01 % | 1 % |
| It tabelado (JTab) | 0,01 cm⁴ | 0,01 cm⁴ | 0,00 % | exato |
| L 80×4,25: Ix (6355 p. 18: I1 = 66,82; I2 = 15,69 → Ix = Iy) | 41,26 cm⁴ | 41,26 cm⁴ | 0,00 % | 0,1 % |
| Nenhum Ue/L com A, Iz ou Iy inválido | nenhum | nenhum | — | qualitativo |
| Ue 100×50×17×1,20 no check (dispensa por Tab. 11/14) | verificado sem exceção | ratioMax = 0,37, cumpre | — | qualitativo |
| Ue 200×75×25×3,00 (bf/bw = 0,375, fora das Tab. 11/14, sem Ndist/Mdist) | NÃO verificado + avisos | ratio = ∞ + avisos "Tab. 11 não cobre" / "Tab. 14 não cobre" | — | qualitativo |

### BR-14762-ROB — Robustez: nunca aprovação silenciosa (qualitativo)
Tipo de oráculo: regra da norma e do plano (estado esperado).

| Situação | Esperado | PORTICO |
| --- | --- | --- |
| Formas Z, C (cartola) e L em compressão, flexão ou cortante | NÃO verificado + aviso "fora do escopo" | ratio = ∞, NO CUMPLE, nas 3 formas |
| As mesmas formas na tração | só escoamento, finito, com aviso de ruptura líquida | finito + aviso, nas 3 formas |
| Sem comprimento (`Ldefault`) | compressão e flexão NÃO verificadas | ratio = ∞ + aviso de comprimento |
| Sem Cw | NÃO verificado | ratio = ∞ + aviso Cw |
| Alma h/t > 200 em flexão (Tab. 4) | NÃO verificado | ratio = ∞ + aviso Tab. 4 |
| 9.9 com My de Ue sem sentido nem MdistY | interação NÃO verificada | interação = ∞ |
| Só N (sem My/Mz) | flexão sem demanda não gera ∞ | flexão = 0; ratioMax = 0,2675 |

### BR-14762-REV — Caminho real `checkElement` (achados da revisão, `tests/test_nbr14762_rev.mjs`)
Montagem: perfil Ue 150×60×20×3,00 do catálogo, aço ZAR250 (fy = 250 MPa), código `NBR14762:2010` chamado via `js/design/design.js`. Tipo de oráculo: regra da norma e achado do revisor (estado esperado).

| Id | Situação | Esperado | PORTICO |
| --- | --- | --- | --- |
| C1a | Compressão N = −20 kN **sem L** (antes saía "cumpre" 0,13, com L = 1 m injetado) | NÃO verificado | NO CUMPLE, ratio = ∞; aviso "Compressão: NÃO verificado — comprimento da barra não informado (flambagem global)." |
| C1b | A mesma com L = 4 m | verificada, ratio > 0,4 | ratio = 0,5289, cumpre |
| C1c | Aviso de K | "K = 1,0 adotado" | "K = 1,0 adotado (comprimento destravado = L); informe Lx/Ly/Lz com K da NBR 8800 se aplicável (14762:2010 8.2)." |
| C1d | Flexão Mz = 2 kN·m sem L | FLT NÃO verificada | "Flexão forte (Mz = Msd,x): NÃO verificado — comprimento da barra não informado (FLT)." |
| D3 | Aviso de Cb | "Cb = 1,0" | "Cb = 1,0 (a favor da segurança, 9.8.2.2): informe member.Cb …" |
| I2 | Carga fora do centro de torção | aviso | "FLT (9.8.2.2): carga suposta no centro de torção … carga na mesa superior/alma de U/Ue … NÃO coberta." |
| I1 | **T ≠ 0** (N = −3, T = 5) | NÃO verificado (LACUNA da 2010) | ratio = ∞; "Momento torçor ≠ 0: a NBR 14762:2010 não traz verificação de torção para seção aberta (LACUNA) — resultado NÃO verificado." |
| I3 | Tração com L = 12 m | aviso 9.6.3 | "Tração: L/r = 548 > 300 — recomenda-se L/r ≤ 300 (NBR 14762:2010 9.6.3)." |
| I3b | Tração com L = 3 m | sem aviso 9.6.3 | sem aviso |
| R1 | **Lb injetado** — Ue 100×50×17×1,20, Mz = 0,5: `member.L = 6` sem `forces.L` | mesma FLT que `forces.L = 6` | 1,5171 = 1,5171 |
| R2 | `member.Lb = 6` sem L | mesma FLT que `forces.L = 6` | 1,5171 = 1,5171 |
| R3 | `member.Lb` sem L, compressão | NÃO verificada | não verificada |

## Conclusão

São 15 grupos de casos, todos passando nos dois testes:
- **116 asserções numéricas**: 113 em `test_nbr14762.mjs` e 3 em `test_nbr14762_rev.mjs`;
- **50 verificações qualitativas** de estado e aviso: 39 + 11.

Diferenças contra literatura:
- **Fora das divergências documentadas (a)–(c)**, a maior diferença é **+0,55 %**: Ne do Ex. 05 com o catálogo, por causa do It recalculado.
- **Nos itens (a)–(c)**, a maior é **−3,90 %** (Wef,esc de y no S8, tolerância 5 %). É do lado conservador e decorre da fibra comprimida tomada no extremo da seção bruta, como no texto da norma.
- **Única diferença acima de 1 % contra a segurança:** FLEX-02, MRd = +1,35 %. Ver (b): ali o manual se afasta da norma, que pede Aef no deslocamento do centroide.
- Os casos S8 em x e o cortante voltam a ≤ 0,36 % quando se adota a convenção do manual (ri = t).

## Limitações e avisos do módulo

- **Distorcional:**
  - a NBR 14762:2010 não tem fórmula para Ndist e Mdist;
  - **só 24 dos 85 Ue do catálogo dispensam a distorcional na compressão (Tab. 11) e só 2 na flexão (Tab. 14)**: Ue 100×40×17×1,20 e Ue 100×50×17×1,20. Contagem feita executando o módulo sobre o catálogo inteiro;
  - nos demais, Ndist/Mdist (e MdistY para flexão em y) precisam vir de análise de estabilidade (CUFSM, GBT) como entrada. Sem isso, o item sai **NÃO verificado**.
- **Escopo:** Z enrijecido, cartola e cantoneira saem NÃO verificados em compressão, flexão e cortante; só a tração é verificada, e apenas pelo escoamento.
- **Tração:** ruptura da seção líquida (9.6.2 b/c, Ct) não verificada, porque o modelo não tem área líquida nem ligação.
- **Torção:** T ≠ 0 dá NÃO verificado (LACUNA da norma para seção aberta).
- **FLT:** admite carga no centro de torção ou em posição estabilizante. Carga excêntrica (mesa superior ou alma de U/Ue, Anexo F) não é coberta.
- **Comprimento e coeficientes:** sem comprimento da barra, compressão e FLT saem NÃO verificadas. K = 1,0 e Cb = 1,0 são adotados com aviso.
- **Shear lag** (9.4, Tab. 7, L < 30·bf0): não verificado.
- **Análise:** os esforços devem vir de análise com 2ª ordem e imperfeições (8.1); o aviso é emitido sempre.
- **Sentido de My:** sem o sentido informado em Ue, a flexão em y usa o mínimo dos dois sentidos e sai NÃO verificada se algum sentido não for coberto.

## Revisão

Achados de revisão já corrigidos:
- `910cd61`: sem L não passa (antes, L = 1 m injetado aprovava a compressão); T ≠ 0 como LACUNA; aviso L/r ≤ 300 (9.6.3); aviso de carga fora do centro de torção; L 80×4,25 com Ix = 41,26 cm⁴.
- `93c2e7e`: o Lb injetado pelo `design.js` não governa mais a FLT quando há `member.L` sem `forces.L`.

Revisão do especialista registrada como FECHADO no PLANO_BRASIL (fase 8), após 3 rodadas.

Revisão do engenheiro responsável: pendente — ______ / data ______
