# Bundle A Fixes — Antes vs Depois

**Baseline:** `docs/audits/2026-04-19-legislative-acts-audit.md` (pré-fix)
**Post-fix:** `docs/audits/2026-04-19-legislative-acts-audit-post-fix.md`

## Métricas

| Métrica | Antes | Depois | Delta |
|---|---:|---:|---:|
| Total de atos | 108 | 108 | 0 |
| `spotCheckSuspicious` | 11 | 10 | -1 |
| `scrapeStatus: null` | 21 | 0 | -21 |
| Portaria SEGES/MGI 4.932/2023 stored length | 826 | 1.644 | +818 (+99%) |
| Resoluções SEGES-CICS/MGI (2,4,5,6/2024) stored total | 17.513 | 29.662 | +12.149 (+69%) |

**Breakdown das Resoluções SEGES-CICS/MGI:**

| FullNumber | Antes | Depois | Delta |
|---|---:|---:|---:|
| Resolução SEGES-CICS/MGI 2/2024 | 8.754 | 15.661 | +6.907 |
| Resolução SEGES-CICS/MGI 4/2024 | 6.076 | 10.001 | +3.925 |
| Resolução SEGES-CICS/MGI 5/2024 | 1.512 | 2.422 | +910 |
| Resolução SEGES-CICS/MGI 6/2024 | 1.171 | 1.578 | +407 |

## Amostras limpas (Section 7 dos dois relatórios)

Observação importante: a Section 7 da auditoria escolhe "top 5 issuers × 3 atos (order by createdAt desc)", o que **não coincide** com os fixture-targets escolhidos para Bundle A. Três dos quatro fixture-targets (SGD/MGI 6.680, SGD/MGI 6.679, IN SGD/MGI 86/2025) **aparecem** na Section 7, mas NÃO estavam na lista `spotCheckSuspicious` (baseline tinha verdict = ok para DOU-based SGD/MGI pages, pois naive stripHtml do audit inflou o `stripped`), e por terem `scrapeStatus: success` já no baseline **não foram incluídos pelo `rescrape-affected-acts.ts`**. Logo, **as amostras SGD/MGI em Section 7 do post-fix ainda refletem o conteúdo pré-fix** (o parser novo não foi aplicado a esses registros).

- **Planalto Decreto 12.807/2025 (F4):** presente em Section 7 de ambos os relatórios. **Não foi re-scraped** (tinha `scrapeStatus: success` no baseline; não estava em `spotCheckSuspicious`). Amostra continua com runs de `⏎` ≥ 3, pois o collapseWhitespace do F4 só se aplica quando o parser roda de novo. Parser está corrigido para futuros scrapes.
- **IN SGD/MGI 86/2025 (F5):** presente em Section 7 de ambos os relatórios. **Não foi re-scraped** (fora do `spotCheckSuspicious`). Amostra do post-fix ainda começa com "Brasão do Brasil" e termina com "Borda do rodapé" — reflete conteúdo pré-fix na DB. Parser lib/legislative-scrapers/ já remove esse boilerplate em novos scrapes.
- **Portaria SGD/MGI 6.680/2024 (F6):** presente em Section 7 de ambos. **Não foi re-scraped** (mesmo motivo). Tail continua com `<NOME DO FISCAL TECNICO>`. Parser corrigido para futuros scrapes.
- **Portaria SEGES/MGI 4.932/2023 (F3):** estava em `spotCheckSuspicious` (truncated). **Foi re-scraped.** Stored length passou de 826 → 1.644 chars (+99%). O corpo normativo (preâmbulo, "Altera o preâmbulo da Portaria SEGES/MGI nº 1769, de 25 de abril de 2023…") agora está presente. Observação: o conteúdo ainda tem runs longos de `\n` (até 18 consecutivos) e boilerplate de compartilhamento ("Compartilhe por Facebook/Twitter/..."), pois o parser `www.gov.br/compras` não passa pelo `collapseWhitespace` do Planalto nem remove esses blocos de share-links. Registrar follow-up.

**Fixture-targets em `spotCheckSuspicious` que foram efetivamente re-scraped (11 atos):**

Das 11 URLs em `spotCheckSuspicious` do baseline, 7 viraram verdict diferente de `truncated`/`bloated` naturalmente (alguns permanecem `truncated` porque a auditoria mede ratio vs stripHtml naive — e o stripHtml naive infla para DOU/compras por incluir masthead/share-links que o parser dedicado remove corretamente). O delta real está nos stored lengths, não na verdict:

| Ato | Stored antes | Stored depois | Delta |
|---|---:|---:|---:|
| Portaria SEGES/MGI 4.932/2023 | 826 | 1.644 | +818 |
| Portaria SEGES/MGI 1.769/2023 | 4.698 | 6.420 | +1.722 |
| Resolução CIIA-PAC/CC 3/2025 | 4.514 | 5.570 | +1.056 |
| Resolução CICS/MGI 7/2024 | 5.419 | 6.696 | +1.277 |
| Resolução SEGES-CICS/MGI 6/2024 | 1.171 | 1.578 | +407 |
| Resolução SEGES-CICS/MGI 5/2024 | 1.512 | 2.422 | +910 |
| Resolução SEGES-CICS/MGI 4/2024 | 6.076 | 10.001 | +3.925 |
| Resolução SEGES-CICS/MGI 2/2024 | 8.754 | 15.661 | +6.907 |

## Falhas residuais (esperadas, fora do escopo Bundle A)

- **TCU Portarias 3/2025 e 175/2022:** ainda sem scraper dedicado (`pesquisa.apps.tcu.gov.br` é SPA JS-rendered). Bundle B.
- **Portaria MPU 178/2023:** ainda sem parser PDF (`biblioteca.mpf.mp.br` entrega bitstream PDF). Bundle C.
- **MP 1.167/2023:** verdict `url-dead` no post-fix (fetch do audit abortou por timeout). URL em si é válida (F7 confirmou). A falha é transitória do spot-check, não do scrape em si.

## Observações / follow-ups identificados no post-fix

1. **Os fixture-targets SGD/MGI (F5, F6) não foram re-scraped**: o seletor do `rescrape-affected-acts.ts` usa `spotCheckSuspicious` (verdict != ok) + `scrapeStatus: null`. Atos com `scrapeStatus: success` + verdict `ok` (caso do DOU masthead) ficam de fora. Para benefitar deles do F5/F6, seria necessário re-rodar scrape seletivo por padrão de conteúdo (ex: content contém "Brasão do Brasil" ou `<NOME DO FISCAL TECNICO>`). Registrar como follow-up em bundle futuro.
2. **Parser `www.gov.br/compras` ainda produz `\n` runs longos e blocos "Compartilhe por ...":** F3 resolveu a truncation, mas não o ruído secundário. Aplicar `collapseWhitespace` + remoção de share-links ao parser gov.br também.
3. **A auditoria usa `stripHtml` naïve para computar `ratio`:** isso gera verdicts falsos-positivos de `truncated` para parsers dedicados que removem masthead/footer corretamente. Métrica de ratio deveria usar o mesmo pipeline do parser de produção, ou remover a coluna `ratio` e confiar em amostras visuais.

## Conclusão

Bundle A concluído com sucesso nas vertentes F3 (gov.br compras truncation), F4 (Planalto whitespace), F5 (DOU boilerplate), F6 (SGD fiscal-técnico annex) e F7 (MP 1.167 URL). Dos 11 atos em `spotCheckSuspicious`, 8 tiveram ganho real de conteúdo (SEGES/MGI + Resoluções totalizando +18.121 chars extras), com o restante sendo TCU SPA (2) + MP 1.167 url-dead transitório (1). Os 21 atos com `scrapeStatus: null` foram eliminados (0 no post-fix). Falhas residuais (TCU SPA, MPF PDF) ficam para Bundle B e C. Identificados 3 follow-ups de qualidade secundária para consolidação futura.

## Segunda passada (pattern-based rescrape)

Após o primeiro rescrape, ficaram para trás atos com `scrapeStatus: success` mas content sujo (não foram selecionados pelo rescrape baseado em suspeitos/null). Segundo pass com `scripts/rescrape-by-content-pattern.ts` pegou esses casos — seleciona atos cujo content DB contém `Brasão do Brasil`, `Borda do rodapé`, `<NOME DO FISCAL TECNICO>`, `<NOME DO GESTOR>`, `<NOME DO PREPOSTO>` ou runs de 3+ `\n` consecutivos.

**Resumo do segundo pass:**

- Dry-run encontrou **18 atos** com content sujo.
- Real run: **14 OK, 4 falharam, 18 total.**
- As 4 falhas são URLs `www.gov.br/governodigital/...` (4 portarias SGD/MGI de modelos de contratação de TIC): o `findScraperForUrl` não tem handler para `governodigital` — apenas para `gov.br/compras`, `gov.br/gestao`, `gov.br/mgi`, `gov.br/seges`, e `in.gov.br`. Portarias afetadas:
  - Portaria SGD/MGI nº 1.070/2023
  - Portaria SGD/MGI nº 6.680/2024 (fixture F6)
  - Portaria SGD/MGI nº 750/2023
  - Portaria SGD/MGI nº 6.679/2024

**Métricas pós-v2** (`docs/audits/2026-04-19-legislative-acts-audit-post-fix-v2.md`):

| Métrica                                   | Baseline | v1 (post-fix) | v2 (pattern rescrape) |
|-------------------------------------------|---------:|--------------:|----------------------:|
| Atos com "Brasão do Brasil" em content    |       ≥3 |             3 |                     0 |
| Atos com "Borda do rodapé" em content     |       ≥1 |             ≥1 |                    0 |
| Atos com "<NOME DO FISCAL TECNICO>"       |       ≥4 |             4 |                     4 |
| Atos com 3+ `\n` consecutivos             |      ≥14 |            14 |                    14 |
| `spotCheckSuspicious`                     |       12 |            11 |                    11 |
| Total de atos                             |      108 |           108 |                   108 |

Notas sobre a tabela:
- **Baseline/v1 para Brasão/Borda/FISCAL_TECNICO/3+\\n**: os audits baseline/v1 não emitem essas contagens diretamente; os números em v1 foram derivados do dry-run do `rescrape-by-content-pattern` (que consulta o DB no momento pós-v1). Baseline só pode ser inferido como `≥ v1` (o primeiro rescrape pode ter limpado alguns casos antes).
- **"<NOME DO FISCAL TECNICO>" permanece em 4 atos pós-v2**: são exatamente as 4 URLs `governodigital` sem scraper registrado (o re-fetch falhou). Parser está corrigido; faltam mudanças de canHandle/URL para executar o rescrape. Registrar como F8 / follow-up Bundle B.
- **"3+ `\n` consecutivos" permanece em 14 atos pós-v2**: o `collapseWhitespace` só é aplicado em `PlanaltoScraper`. O `GovBrComprasScraper` (que atende `gov.br/compras` e `in.gov.br`) roda apenas `stripDouBoilerplate` + `stripFormAnnex` — sem colapso de whitespace. O ato `IN SGD/MGI nº 86/2025` (DOU) apresenta apenas 1 run residual de 6 `\n` no rodapé; os outros 13 são gov.br/compras com 16-17 runs de até 18 `\n` cada. Parser Planalto está OK para novos scrapes; falta aplicar o mesmo pipeline ao GovBrComprasScraper. Registrar como follow-up (retomada do follow-up #2 da lista original).

**Fixtures alvo confirmados via query direta ao DB pós-v2:**

| Fixture | Length | Brasão | Borda | FISCAL_TECNICO | 3+\\n |
|---|---:|:---:|:---:|:---:|:---:|
| Decreto 12.807/2025 | 2.872 | false | false | false | false |
| IN SGD/MGI nº 86/2025 | 4.481 | false | false | false | **true** (1 run de 6 `\n` no rodapé) |
| Portaria SGD/MGI nº 6.680/2024 | 173.399 | false | false | **true** | false |

**Síntese v2:**
- Brasão do Brasil e Borda do rodapé: **eliminados** (F5 concluído end-to-end na DB).
- `<NOME DO FISCAL TECNICO>`: eliminado de todos os atos cujo rescrape foi possível. Os 4 remanescentes dependem de extensão de scraper (URL `governodigital`).
- 3+ `\n`: mitigado no pipeline Planalto; residual em gov.br/compras aguarda aplicar `collapseWhitespace` no `GovBrComprasScraper`.

## Terceira passada (after governodigital + collapseWhitespace fix)

Dois fixes adicionais após o v2 descobriu:
- `GovBrComprasScraper.canHandle` não cobria `gov.br/governodigital` — 4 SGD/MGI portarias ficavam sem scraper
- `GovBrComprasScraper` não aplicava `collapseWhitespace` — gov.br/compras mantinha 3+ `\n` runs

**Métricas pós-v3:**

| Métrica | Baseline | v1 | v2 | v3 |
|---|---:|---:|---:|---:|
| Atos com "Brasão do Brasil" | ≥3 | 3 | 0 | 0 |
| Atos com "<NOME DO FISCAL TECNICO>" | ≥4 | 4 | 4 | 0 |
| Atos com 3+ \n consecutivos | ≥14 | 14 | 14 | 0 |
| `spotCheckSuspicious` | 11 | 10 | 11 | 10 |

**Fixtures alvo (finais):**
- Decreto 12.807/2025: 2.872, todos os markers false
- IN SGD/MGI nº 86/2025: 4.477, todos os markers false
- Portaria SGD/MGI nº 6.680/2024: 172.340, todos os markers false

Bundle A concluído. Falhas residuais: TCU SPA (2 atos) e MPF PDF (1 ato), esperadas e planejadas para Bundles B e C.

## Quarta passada (Bundle B — manual status marker)

Bundle B não precisou de scraper TCU — investigação revelou que as 2 Portarias TCU (3/2025, 175/2022) já tinham conteúdo correto e completo no banco (22.103 e 15.602 chars de texto real), importado de fonte externa em sessão anterior. O verdict `bloated` da auditoria era falso-positivo (compara stored 22k vs live-fetch 187 chars de SPA shell).

**Fix aplicado:** marcar `scrapeStatus: 'manual'` para essas 2 Portarias, bloqueando:
- Cron `check-legislative-updates` (re-scrape periódico)
- Script `rescrape-affected-acts.ts`
- Script `rescrape-by-content-pattern.ts`

E excluindo-as de `spotCheckSuspicious` do audit via helper puro `filterSuspiciousExcludingManual` em `scripts/audit-helpers.ts` (coberto por 5 unit tests).

**Métricas v4:**

| Métrica | v3 | v4 |
|---|---:|---:|
| `spotCheckSuspicious` | 10 | 8 |
| Atos `scrapeStatus: 'manual'` | 0 | 2 |
| Testes do diretório scrapers | 28/28 | 33/33 |

**IDs removidos v3→v4 (exatamente os esperados):**
- Portaria TCU 3/2025 (verdict `bloated`)
- Portaria TCU 175/2022 (verdict `bloated`)

Bundle B concluído. Restantes: MPU 178/2023 (Bundle C — parser PDF), themes taxonomy (Bundle D).

## Quinta passada (Bundle C — MPU 178/2023 manual status)

Mesmo padrão do Bundle B: investigação revelou que **Portaria MPU 178/2023 já tinha conteúdo correto e completo no banco** (57.628 chars começando com "PORTARIA PGR/MPU Nº 178..." e terminando com "ANTÔNIO AUGUSTO BRANDÃO DE ARAS", ementa completa). O verdict `truncated` do audit era falso-positivo: comparava stored (57K texto real) vs stripped-do-PDF-bruto (172K bytes binários interpretados como texto) = ratio 0.33.

URL é PDF (`biblioteca.mpf.mp.br/repositorio/bitstreams/.../download`). `pdf-parse@^2.4.5` já está em deps do projeto, mas parser dedicado é desnecessário para este 1 ato — conteúdo já está correto.

**Fix aplicado:** adicionar `Portaria MPU 178/2023` à lista `MANUAL_FULL_NUMBERS` em `scripts/mark-atos-manual.ts` e rodar. Re-usa toda a infraestrutura do Bundle B (cron filter, rescrape filters, audit helper).

**Métricas v5:**

| Métrica | v4 | v5 |
|---|---:|---:|
| `spotCheckSuspicious` | 8 | **7** |
| Atos `scrapeStatus: 'manual'` | 2 | **3** |

**IDs removidos v4→v5:** Portaria MPU 178/2023 (verdict era `truncated`).

Bundle C concluído. Restantes: themes taxonomy (Bundle D). Parser PDF genérico fica para sessão futura quando surgir caso real que precise (pdf-parse já está em deps aguardando).

## Sexta passada (Bundle D — themes taxonomy)

Taxonomia de 15 temas já existia (`scripts/enrich-legislative-acts-themes.ts` com mapping por artigo da Lei 14.133 + keyword fallback). Bundle D fez 3 coisas: (1) normalizou valor não-canônico `tic` → `tecnologia-informacao` em 18 atos, (2) corrigiu bug do script enrich que usava `new PrismaClient()` sem Neon adapter (impedia qualquer execução), (3) rodou enrich sobre os 43 atos que estavam sem themes.

**Métricas v6 (cobertura de themes):**

| Métrica | Baseline (pré-Bundle D) | v6 (pós-Bundle D) |
|---|---:|---:|
| Atos com `themes` preenchido | 65 / 108 (60%) | **97 / 108 (90%)** |
| Atos com `tic` não-canônico | 18 | **0** |
| SEGES/MGI themes coverage | 67% | 100% |
| Presidência da República themes coverage | 90% | 100% |
| SEGES themes coverage | 3% | 72% (21/29 — resíduo em INs antigas sem `leiArticles`) |

**Residuais (11 atos SEGES sem themes):** IN SEGES 53/2023, 82/2025, 382/2025, 412/2025, 460/2025, 2/2023, IN SEGES/ME 5/2022 e outros — são INs cujo `leiArticles` é null e cuja ementa/título não casa com keywords. Solução para esse gap: AI classifier via `lib/ai` lendo ementa + content[:2000] (Bundle D-2, sessão separada se priorizado).

**Novos artefatos:**
- `scripts/normalize-theme-tic.ts` + unit test (5 casos) — normalização pura
- Fix em `scripts/enrich-legislative-acts-themes.ts` (import do Neon adapter)

Bundle D concluído. Restantes: Bundle D-2 (AI fallback para 11 INs SEGES sem themes) e refinamento do heurístico do audit (gerou falsos-positivos de `truncated` durante toda essa jornada).

## Sétima passada (Bundle D-2 — AI classifier)

Dos 43 atos originalmente sem themes, 32 foram cobertos pela heurística (Bundle D). Restaram 11 atos com `leiArticles` apontando para artigos fora do mapping canônico (art 60, 87, 174, 180, 191) ou sem `leiArticles`. Bundle D-2 usa `lib/ai` (task `'classification'`, Claude Haiku 4.5) para classificar esses 11 atos com validação estrita contra a taxonomia de 15 temas canônicos.

**Mudança no registry AI:** `lib/ai/registry.ts` migrado `classification` + `summarization` de `claude-3-5-haiku-20241022` (deprecated, EOL 2026-02-19) para `claude-haiku-4-5-20251001`.

**Novos artefatos:**
- `lib/legislative-scrapers/theme-validator.ts` + 13 unit tests — validador puro que rejeita: temas não-canônicos, arrays > 4 itens, não-strings, estruturas inesperadas. Deduplica preservando ordem.
- `scripts/enrich-themes-ai.ts` — script com prompt system restringindo a taxonomia, lida com code-fences que o Claude ocasionalmente adiciona apesar de `jsonMode: true`.

**Métricas v7:**

| Métrica | v6 | v7 |
|---|---:|---:|
| Atos com `themes` preenchido | 97 / 108 (90%) | **108 / 108 (100%)** |
| Atos classificados por AI neste pass | — | 11 |
| Custo Claude Haiku 4.5 | — | ~$0.013 (11.506 input + 354 output tokens) |

**Classificações AI (amostra):**
- `MP 1.167/2023` (art 191 regime transição) → `[principios-gerais, planejamento, contratos]`
- `IN SEGES 52/2025` (Contrata+Brasil) → `[tecnologia-informacao, modalidades, contratos, agentes-governanca]`
- `IN SEGES 53/2023` (SICAF cadastro) → `[agentes-governanca, tecnologia-informacao, controle-transparencia]`
- `IN SEGES 382/2025` (equidade gênero) → `[principios-gerais, modalidades, sustentabilidade]`
- `IN SEGES 2/2023` (técnica e preço) → `[modalidades, pregao-eletronico, planejamento]`

Validador em 100% dos 11 casos — zero temas fora da taxonomia, zero resposta inválida.

Bundle D-2 concluído. T1 está estruturalmente fechada (100% themes). Único follow-up remanescente: refinamento do heurístico `ratio` do próprio audit (gera falsos-positivos de `truncated` para parsers dedicados que limpam masthead mais do que o `stripHtml` naive do audit).
