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

**Não medido:** quantos registros do acervo têm `LEI-014133` com `ANO-` diferente de 2021. Antes de apertar a regex, medir — a fonte também pode omitir o `ANO-`, e exigi-lo derrubaria capturas legítimas.

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
