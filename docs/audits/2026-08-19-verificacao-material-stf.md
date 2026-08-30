# Verificação do material de estudo do STF contra a fonte

**19/08/2026.** Consolida seis arquivos de saída bruta que ficaram soltos na raiz do projeto (`stf-verificacao.txt`, `stf-verificacao2.txt`, `stf-datas.txt`, `stf-final.txt`, `stf-adpf.txt`, `stf-campos.txt`), agora removidos. O trabalho não constava de nenhum handoff.

**Fonte:** `stf_lei14133_dados_2026-08-16.json` — 2.516 registros, 2.461 títulos distintos (caminho em `docs/HANDOFF-2026-08-18-stf-e-busca.md`, seção final).
**Verificado:** o DOCX compilado na sessão de 18/08, em duas rodadas.

---

## 1. Resultado

| rodada | escopo | conferem | divergem |
|---|---|---:|---:|
| 1 | Parte I — 9 verbetes: ementas | 9 | 0 |
| 1 | Parte I — metadados (relator, órgão, data) | 9 | 0 |
| 1 | Parte I — dispositivos da Lei 14.133 | 8 | 0 |
| 2 | Partes II/III — 290 entradas: metadados | 286 | 4 |

Nenhum título do documento deixou de ser encontrado na fonte. Os resumos são texto sintetizado e **não** constam da fonte — por construção, não é defeito.

**As 4 divergências e 6 dos 7 alertas de resumo são falsos positivos do verificador.** Sobra **um** achado real (ADPF 1138) e **um** não investigado (ADI 7576). Detalhe abaixo.

## 2. As 4 divergências de data: falso positivo

O mesmo processo aparece várias vezes na fonte, em grupos diferentes e com datas diferentes — a monocrática é de uma data, o acórdão é de outra. O verificador comparava a entrada do documento contra **uma** ocorrência do título; quando calhava de ser a outra, acusava divergência.

| processo | data no DOCX | corresponde a | data comparada |
|---|---|---|---|
| ADI 6890 *(2 entradas)* | 26/06/2024 | monocrática `despacho1539711` | acórdão `sjur512294`, 09/09/2024 |
| ARE 1489537 | 24/09/2024 | grupo amplo `sjur518276` | monocrática `despacho1546651`, 18/07/2024 |
| RHC 243452 | 09/07/2024 | `despacho1542859` | `despacho1571149`, 24/09/2024 |

Toda data do documento corresponde a uma ocorrência real do processo na fonte. **Zero erro de data no material.**

## 3. Os 7 alertas de "entidade citada ausente da fonte"

O verificador procurava a entidade só na ementa. Onde o texto vive em outro campo ou aparece por extenso, ele não achava.

| processo | alerta | verificação |
|---|---|---|
| ADI 2888 *(2×)* | "AGU" ausente | **falso positivo** — a fonte traz `ADVOCACIA-GERAL DA UNIÃO` na ementa, por extenso (base `acordaos`, 1.924 chars) |
| ARE 1474601 *(3×)* | "Lei 14.113/2020" ausente | **falso positivo** — `LEI DO NOVO FUNDEB` está no `decisao_texto` (base `decisoes`, 5.360 chars), não na ementa. Mas ver §4 |
| ADPF 1138 | "Lei 14.133/2021" ausente | **ACHADO REAL** — a legislação citada da fonte para a ADPF 1138 está **vazia** e não cita `LEI-014133`. O caso é prorrogação de concessão de transporte coletivo; o texto fala de licitação, não da Lei 14.133. O resumo atribui a lei; a fonte não. *(Para comparação: das 145 entradas da Parte II, 0 estão sem a Lei 14.133 na legislação citada — a ADPF 1138 é exceção isolada.)* |
| ADI 7576 | "Lei 14.133/2021" ausente | **não investigado.** Lei estadual da Paraíba sobre corte de energia e água — assunto sem relação aparente com licitação. Provável mesmo padrão da ADPF 1138 |

## 4. Achado operacional: `citaLei14133()` não confere o ano

Não é sobre o material, é sobre o conector. A fonte do STF indexa o **ARE 1474601** assim:

```
LEG-FED LEI-014133 ANO-2020
 ART-00020 ART-00021
 LEI ORDINÁRIA
```

A Lei 14.133 é de **2021**. O caso é FUNDEB — Lei **14.113**/2020. O erro nasce do próprio acórdão recorrido, cuja ementa diz "LEI 14.133/20", e o STF o propagou para o campo estruturado.

`lib/jurisprudencia/legislacao-citada.ts` casa `/LEI[-:]0*14133\b/i` e **ignora o `ANO-`**. Verificado por execução sobre o bloco real: `citaLei14133()` → `true`. Consequência dupla: o julgado entra no acervo como decisão que cita a Lei 14.133, e `extrairArtigos14133()` ainda amarra os arts. 20 e 21 a um caso de FUNDEB — justamente a amarração determinística que é a razão de ser destes conectores.

### Medição (30/08/2026)

Rodada com o parser real do projeto sobre a fonte de 16/08 e cruzada com o acervo em produção.

**Na fonte:** 1.071 julgados distintos capturados por `citaLei14133()`, dos quais **22 (2,1%)** declaram `ANO-` diferente de 2021. Nenhum registro tem mais de um bloco casando o token, então a atribuição de ano é inequívoca. Lendo bloco e assunto, os 22 se partem em dois grupos de tamanho parecido e natureza oposta:

| | n | o que são |
|---|---:|---|
| **captura errada** | **13** | 11 com `LEG-FED ANO-2020` → é a **Lei 14.113/2020 (FUNDEB)**, digitada como 14.133; e 2 com `LEG-MUN ANO-2006` → **lei municipal 14.133/2006 de São Paulo**. *(Ao implementar a correção apareceu um 14º, invisível a qualquer análise por ano: o **ARE 1489537**, lei municipal de São Paulo declarada como `LEG-MUN ANO-2021`.)* |
| **captura certa, ano errado na fonte** | **9** | `ANO-2023` (2), `ANO-2022` (3), `ANO-2001` (2), `ANO-1921` (1), sem `ANO-` (1). Todos tratam de licitação, art. 89/90 da 8.666 ou art. 337-E do CP — e em dois deles o próprio STF escreveu "lei 14.133/2001" e "Lei nº 14.133/22" na ementa |

**No acervo** (STF: 600 registros, 254 aprovados), 10 dos 22 chegaram a `TribunalDecision`:

- **5 capturas erradas, todas visíveis (`auto_approved`) e todas com artigo amarrado:** ACO 3576 AgR `[36]`, ADI 5791 `[30]`, ARE 1474601 `[20, 21]`, ARE 1531099 `[64]`, ARE 1578097 `[47]`. São casos de FUNDEB carregando dispositivos da Lei 14.133.
- 5 capturas certas (3 visíveis), que **seriam perdidas** se a regex exigisse `ANO-2021`.

### A correção não é exigir o ano

Exigir `ANO-2021` mataria 9 capturas legítimas na fonte (5 no acervo) para eliminar 13 erradas. O discriminador certo é outro, e é duplo:

1. **Exigir `LEG-FED`.** A Lei 14.133 é federal por definição, então isso elimina as 2 municipais sem nenhum falso negativo possível. O parser hoje ignora o prefixo de esfera.
2. **Rejeitar `ANO-2020`.** A Lei 14.133 foi sancionada em 01/04/2021 — `ANO-2020` é impossível para ela. Elimina as 11 do FUNDEB, e nenhuma das 9 capturas legítimas usa 2020.

Juntos: **14 de 14 falsos positivos eliminados, 0 falso negativo**, nos dados medidos — 1.071 → 1.057 julgados capturados. Implementado em #199; o acervo já gravado é saneado em #200.

**Defeito vizinho, no mesmo caminho:** `ARE 1578097` cita `ART-0047A` — o art. **47-A** da Lei do FUNDEB. `RE_ARTIGO` só reconhecia o sufixo com hífen (`ART-00184-A`), então extraiu `47` e amarrou o art. 47 da Lei 14.133. Medido depois: das 10 ocorrências de sufixo na fonte, **10 vêm coladas e nenhuma hifenizada** — o formato reconhecido não existe ali, e `ART-0337L` virava `337`, `ART-0005A` virava `5`. Corrigido junto, em #199.

**STJ — não mensurável hoje.** O parser é compartilhado e o formato do STJ traz a mesma esfera (`LEG:FED LEI:014133 ANO:2021`), então o defeito é possível por construção. Mas o `sourceRawData` dos 396 registros do STJ guarda apenas `classe`, `tema` e `tese` — a legislação citada não é persistida. Medir exigiria recoletar os espelhos.

## 5. Cobertura de campos da API do STF

Útil para saber o que dá para prometer em cada grupo. Medido sobre a mesma fonte:

| campo | `acordaos` (56) | `monocraticas` (1.050) | `amplo` (1.410) |
|---|---:|---:|---:|
| `ementa_texto` | 56 | — *(não existe)* | 1.410 |
| `decisao_texto` | — | 1.050 | — |
| `documental_legislacao_citada_texto` | 55 | 1.046 | 1.262 |
| `documental_indexacao_texto` | 54 | — | 1.255 |
| `julgamento_data` | 56 | 1.049 | 1.410 |
| `orgao_julgador` | 56 | — | 1.410 |
| `relator_acordao_nome` | 4 | — | 215 |
| `relator_decisao_nome` | — | 46 | — |
| `documental_tese_texto` | 9 | — | 22 |
| `documental_tese_tema_texto` | 6 | — | 19 |
| `is_repercussao_geral` | 5 | — | 17 |

Dois pontos que importam:

- **Monocráticas não têm ementa nem órgão julgador** — só `decisao_texto`. É de lá que vem o corte em 6.000 caracteres tratado em #198 (bullets de IA a partir da ementa).
- **Tese e repercussão geral são raríssimas** (9 de 56 acórdãos, 22 de 1.410). Não dá para construir superfície que dependa delas.
