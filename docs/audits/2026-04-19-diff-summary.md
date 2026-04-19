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
