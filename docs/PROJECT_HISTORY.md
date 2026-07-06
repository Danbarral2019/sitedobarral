# Histórico do Projeto — Site do Barral

> Changelog de features e ondas concluídas, movidos do `CLAUDE.md` em 2026-07-06 para
> enxugar o contexto carregado a cada turno. O `CLAUDE.md` mantém só regras ativas,
> arquitetura e status atual. O detalhe completo de cada mudança também vive no git.

## Recent Features

**⚖️ Livro completo TST 2025 — Súmulas + OJs + Precedentes Normativos (2026-05-23):**
- ✅ **1292 documentos canônicos do TST** importados a partir do RTF oficial do Livro de Súmulas, OJs e PNs (Res. 225/2025, DEJT 30/6, 1º e 2/7/2025) — fonte vinculante única
- ✅ Cobertura de **6 séries**: 463 Súmulas + 13 OJ-TP/OE + 421 OJ-SDI-I + 79 OJ-SDI-I Transitória + 158 OJ-SDI-II + 38 OJ-SDC + 120 PN
- ✅ Modelagem: estende `TribunalDecision` com 2 novos `decisionType`s — `orientacao_jurisprudencial` (todas as 5 séries de OJ) e `precedente_normativo` (PN). Subsérie em `themes` (`oj-sdi1`, `oj-sdi1t`, `oj-sdi2`, `oj-sdc`, `oj-tp-oe`, `pn`) e em `sourceRawData.serie`. Zero migração de schema, reuso da infraestrutura existente
- ✅ Parser dedicado `lib/tst/parser-livro.ts` para o formato 2025 (cabeçalho `SUM-N\tTÍTULO`, situação inline em parênteses, sem tokens `Tese:`/`Observação:`/`Situação:`). 24 testes em `lib/tst/__tests__/parser-livro.test.ts` cobrindo as 6 séries
- ✅ Extrator `lib/tst/extract-rtf.ts` (wrapper para `textutil` macOS) — RTF não tem hyperlinks embarcados, URLs gravadas anteriormente (Súmulas) são preservadas pelo upsert idempotente
- ✅ CLI `scripts/import-tst-livro.ts` (flags `--dry-run`, `--limit N`, `--force`, `--serie sumula|sbdi1|sbdi1t|sbdi2|sdc|pn|tp-oe|all`). Importação: 829 criados + 463 atualizados (Súmulas re-validadas contra RTF 2025), 0 falhas
- ✅ UI pública: 3 cards no hub `/base-conhecimento` — "Súmulas do TST" (existente), "Orientações Jurisprudenciais (TST)" (novo, BookMarked icon), "Precedentes Normativos (TST)" (novo, Gavel icon). JurisprudenciaClient ganha 2 `<option>`s (orientacao_jurisprudencial, precedente_normativo) + sub-filtro de série visível quando decisionType=orientacao_jurisprudencial (5 séries de OJ)
- ✅ Toggle "Mostrar canceladas/revistas" estendido para os 3 tipos canônicos (Súmulas + OJs + PNs). Badge de situação no card e no detail page idem
- ✅ Detail page: helper `formatDecisionBadge` produz rótulos corretos por série ("Súmula nº N", "OJ-SBDI-I nº N", "OJ-SDC nº N", "Precedente Normativo nº N", etc.). Banner amarelo para canceladas/revistas vale para todos os 3 tipos
- ✅ **Crítico (lição #116):** filtro `excludeInactiveSumulas` em `lib/embeddings/vector-search.ts:379` generalizado de `decisionType = 'sumula'` para `decisionType IN ('sumula','orientacao_jurisprudencial','precedente_normativo')`. Evita que precedente superado vaze para RAG
- ✅ RAG: `tribunalKeywords` em `/api/documents/query` ganhou 18 termos novos (OJ, SBDI-I/II, SDC, PN, dissídio coletivo, negociação coletiva, etc.); detector de query histórica (`citesSpecificCanonical`) cobre os 3 tipos canônicos por regex. System prompt instrui LLM a alertar sobre canceladas em qualquer tipo canônico
- ✅ Enums DECISION_TYPES atualizados em `app/api/jurisprudencia/route.ts` e `query/route.ts`
- ✅ Contadores cached: `getCachedTstOjCount` + `getCachedTstPnCount` em `lib/cached-queries.ts`
- ✅ Tests: 58/58 (parser-livro 24 + parser PDF antigo 22 + vector-search 12)
- 📖 Ver `lib/tst/parser-livro.ts`, `scripts/import-tst-livro.ts`, https://www.tst.jus.br/livro-de-sumulas-ojs-e-pns

**⚖️ Súmulas do TST — nova categoria de conteúdo (2026-05-23):**
- ✅ 463 Súmulas do TST importadas a partir do PDF oficial (`Súmulas TST.pdf`) — 117 CRIADA + 185 ALTERADA + 161 CANCELADA
- ✅ Modelagem: estende `TribunalDecision` com `tribunalCode='TST'`, `decisionType='sumula'`, evitando criar tabela nova (aprende com lição #116). Itens romanos, IRRs, resoluções e histórico ficam em `sourceRawData` JSON
- ✅ Parser puro em `lib/tst/parser.ts` + extração de hyperlinks via pdfjs-dist em `lib/tst/extract-pdf.ts` — 463 URLs `https://jurisprudencia-backend2.tst.jus.br/rest/documentos/<id>` extraídas 1-a-1 do PDF (zero fallback necessário)
- ✅ CLI `scripts/import-tst-sumulas.ts` (flags `--dry-run`, `--limit`, `--force`) — idempotente via `fullIdentifier`
- ✅ UI pública: card "Súmulas do TST" no hub `/base-conhecimento` linka para `/jurisprudencia?tribunal=TST&decisionType=sumula`. JurisprudenciaClient inicia filtros via `useSearchParams`, mostra badge de situação (CRIADA verde, ALTERADA amarelo, CANCELADA vermelho), toggle "Mostrar súmulas inativas" (default OFF), e filtros internos `situacao:*`, `tst`, `clt` ficam escondidos dos chips visíveis
- ✅ Detail page renderiza itens romanos com `<s>→<del>`, banner amarelo para canceladas/revistas, timeline de resoluções e bloco de IRRs (quando aplicável). Botão linka direto para "Inteiro teor no site do TST"
- ✅ Backend: filtro `excludeInactive` em `JurisprudenciaFilters` aplica `themes NOT ILIKE %situacao:CANCELADA%` na consulta. Campo `sourceRawData` adicionado ao SELECT do `fetchUnifiedById` para o detail page consumir o JSON estruturado
- ✅ Busca semântica/RAG: `tribunalKeywords` em `/api/documents/query` ganhou termos TST/CLT/trabalho/terceirização/repactuação/responsabilidade subsidiária; system prompt instrui a LLM a alertar quando citar súmulas com `situacao:CANCELADA`/`REVISTA`
- ✅ Cores TST adicionadas em todos os 10 pontos hardcoded de tribunais (newsletter, novidades home/área restrita, admin highlights, admin tribunal-decisions/format, JurisprudenciaClient público e área restrita, etc.) — evita o tipo de grep perdido da Onda 4.5.6
- ✅ Enum de tribunais TST adicionado em `app/api/jurisprudencia/route.ts`, `app/api/jurisprudencia/query/route.ts`
- ✅ Sitemap: agora inclui hub, `/jurisprudencia` e cada decisão individual (TST + TCE + STJ) — `changeFrequency=yearly` para súmulas (canônicas)
- ✅ Tests: 22/22 em `lib/tst/__tests__/parser.test.ts` (cobre Súmulas 1, 6, 8, 331, 437 — situações, IRR, itens com `<s>`, cross-refs CLT)
- 📖 Ver `lib/tst/`, `scripts/import-tst-sumulas.ts`, `app/(acervo)/jurisprudencia/[id]/page.tsx`

**🎓 T7 — Certificados Digitais Premium (2026-05-07, commit `4feed2d`):**
- ✅ Schema com auditoria: `issuedById`, `revokedAt`, `revokeReason`, `viewCount`
- ✅ 6 APIs admin: emissão manual, revogação, restauração, listagem
- ✅ Página pública premium navy + QR code SSR + OG image dinâmica via `@vercel/og`
- ✅ Email automático na emissão e revogação
- ✅ Galeria do aluno (`/area-restrita/meus-certificados`) respeita revogação
- 📖 Ver memória `certificados-digitais.md`

**📰 Clipping Diário Multi-Tribunal — em produção (TCU desde 2026-05-07; multi-tribunal 2026-05-24):**
- ✅ Arquivo público com busca + ver-no-navegador (`app/clipping`)
- ✅ Admin recipients via env `CLIPPING_ADMIN_RECIPIENTS`
- ✅ Camada unificada `lib/clipping/sources/` (`ClippingItem`) abstrai `Document` TCU e `TribunalDecision` (TCE-PE, TCE-RS, TCE-SP, TCE-PR, TCE-SC, TCE-RJ, STJ).
- ✅ TCU: pipeline RTF + dispositivos numerados + IA editorial (mantido).
- ✅ TribunalDecision: AI bullets via `generateAiBulletsForTribunal` quando `fullText >= 800` chars; senão ementa-only.
- ✅ Histórico polimórfico em `DailyClippingSend.acordaoIdsIncluded` (`{ v: 2, items: [{kind,id}] }`) + leitura tolerante a payload legado. `getSentIdsInWindow(14)` evita repetir itens em 14 dias.
- ✅ Template `renderDailyClippingV2` agrupa decisões por tribunal com badge colorido (`lib/clipping/tribunal-branding.ts`).
- ✅ Cron `app/api/cron/daily-clipping/route.ts` (substitui `daily-tcu-clipping`, deprecated). Schedule 9h BRT (seg-sex).
- 🔑 Env vars: `CLIPPING_TRIBUNAIS_ENABLED` (CSV), `CLIPPING_WINDOW_DAYS=14`, `CLIPPING_MAX_ITEMS_PER_TRIBUNAL=5`, `CLIPPING_MAX_ITEMS_TOTAL=15`.
- 📖 Ver memória `clipping-diario-tcu.md`, módulo `lib/clipping/`

**🏛️ Hubs Admin Consolidados (2026-04-05):**
- ✅ Hub TCU com 4 abas (commits `9acd084`+`4e6a434`)
- ✅ Hub Lei 14.133 com 4 abas (commit `f770db0`)
- ✅ Busca IA como aba do Analytics-hub (commit `be74857`)
- ✅ Páginas TCU obsoletas removidas (`tcu-import`, `tcu-converter`)

**💳 Pagamentos — Stripe (REVERTIDO de Mercado Pago em abr/2026):**

> **Histórico:** O sistema saiu para produção em 2026-02-20 com Mercado Pago + PIX, mas foi revertido para Stripe na branch `stripe-migration` (mergeada na main em abr/2026). Modo TEST 100% configurado em 2026-04-24, Fase 3 LIVE com roadmap próprio.

- ✅ `lib/stripe.ts`: lazy init via `getStripe()`, Checkout Sessions, PIX nativo Stripe, helpers de subscription
- ✅ `POST /api/pagamento/checkout` — cria Checkout Session Stripe (recebe `{ plan, billingCycle, method, courseId? }`, retorna `{ url }`)
- ✅ `POST /api/pagamento/webhook` — verifica assinatura via `STRIPE_WEBHOOK_SECRET` e processa eventos
- ✅ `GET /api/pagamento/status` — consulta status de pagamento
- ✅ Página `/planos` com seletor Cartão/PIX, callbacks `/assinatura/sucesso|cancelado|pendente`
- ✅ Schema mantém colunas Stripe (`stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`); colunas MP (`mercadopagoPayerId`, `mercadopagoPreapprovalId`) ficaram no schema sem uso ativo
- 🔑 Requer: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- 🔑 Webhook: configurar no Stripe Dashboard → `https://www.profdanielbarral.com/api/pagamento/webhook`

**🚀 Pré-Lançamento (2026-02-20) — outros itens:**
- ✅ Registro aberto sem QR Code obrigatório (`app/registro/page.tsx`, `lib/validation-schemas.ts`)
- ✅ Verificação de email unificada (token hex em ambos os fluxos: registro + reenvio)
- ✅ Acentuação corrigida em todos os emails (boas-vindas, curso, módulo, inatividade, certificado)
- ✅ `sendCourseWelcomeEmail()` integrado ao fluxo de enrollment no registro
- ✅ Newsletter redesenhada (weekly + monthly): header gradiente, ícones por categoria, "Dica da Semana", mini dashboard stats
- ✅ Classifier paradigmático: threshold 55, keywords consulta/tese (+15/+8/+5), bônus Consulta (+20)
- ✅ 4 novos scrapers TCE: SC, RJ, RS, PE
- ✅ DataJud CNJ scraper (STJ/STF) via Elasticsearch API + cron semanal
- 📖 Ver `lib/email-templates/newsletter.ts`, `lib/tribunal-scrapers/datajud.ts`

**📧 Newsletter Analytics + Templates (2026-02-17):**
- ✅ Model `NewsletterSend` — tracking de envios (type, totalSent, opens, clicks)
- ✅ Templates HTML reutilizáveis em `lib/email-templates/newsletter.ts` (weekly + monthly)
- ✅ Tracking pixel (open) + redirect (click) em `/api/newsletter/track`
- ✅ Webhooks Resend (bounce/open/click) em `/api/webhooks/resend`
- ✅ Dashboard analytics no `/admin/newsletter` (stat cards, gráfico barras, tabela últimos envios)
- ✅ Crons `monthly-newsletter` e `newsletter-new-content` atualizados com templates + `NewsletterSend`
- 📖 Ver `lib/email-templates/newsletter.ts`, `app/admin/newsletter/analytics.tsx`

**🎓 Certificados LinkedIn + Galeria (2026-02-17):**
- ✅ Botão "Compartilhar no LinkedIn" no `CertificateCard` (URL LinkedIn Certification)
- ✅ Galeria `/area-restrita/meus-certificados` — lista todos certificados do aluno
- ✅ API `GET /api/area-restrita/certificates` — retorna certificados do usuário
- ✅ Links na navegação (AreaRestritaHeader + MobileBottomNav)
- 📖 Ver `components/lms/CertificateCard.tsx`, `app/area-restrita/meus-certificados/page.tsx`

**⚡ Performance — Dynamic Imports + Image Optimization (2026-02-17):**
- ✅ Dynamic imports (`next/dynamic` + `ssr: false`) em 5 páginas admin pesadas
- ✅ Componentes extraídos: `TCUManagerClient`, `ScraperAGUClient`, `AnalyticsClient`, `SearchAnalyticsClient`, `DOUFiltrosClient`
- ✅ `<img>` → `next/image` em `SiteResultCard`, `sites/config`, `depoimentos/config`
- ⚠️ `ssr: false` requer `'use client'` na page.tsx wrapper (Next.js 15)

**📊 LMS — Dashboard Progresso + Notificações (2026-02-17):**
- ✅ Dashboard `/area-restrita/meu-progresso` — XP, streaks, badges, progresso por curso, atividades recentes
- ✅ API `GET /api/area-restrita/progress` — dados agregados do aluno
- ✅ Push notification em `awardBadge()` (gamification.ts) e `issueCertificate()` (certificate.ts)
- ✅ Push notification no cron de inatividade LMS (`lms-inactivity`)
- 📖 Ver `app/area-restrita/meu-progresso/page.tsx`, `lib/gamification.ts`, `lib/certificate.ts`

**⚖️ Embeddings Semânticos para Atos Legislativos (2026-02-15):**
- ✅ Modelo `LegislativeActChunk` (espelha `DocumentChunk`, FK para `LegislativeAct`)
- ✅ 53 atos legislativos indexados com embeddings (801 chunks) na tabela separada
- ✅ Busca semântica UNION ALL: `DocumentChunk` + `LegislativeActChunk` em `performSearch()`
- ✅ Campo `sourceType` ('document' | 'legislative-act') no `SearchResult`
- ✅ Atos semânticos integrados no contexto do query route (legal sources + prompt)
- ✅ Cap de 3 resultados por tipo de ato para evitar flooding
- ✅ Processador dedicado: `lib/embeddings/legislative-act-processor.ts`
- ✅ Script: `npx tsx scripts/index-legislative-acts.ts` (flags: `--dry-run`, `--force`, `--limit N`)
- 📖 Ver `lib/embeddings/vector-search.ts`, `lib/embeddings/legislative-act-processor.ts`

**💳 Histórico de pagamentos — Stripe → MP → Stripe:**
- 2026-02-15: Stripe inicial
- 2026-02-20: Substituído por Mercado Pago + PIX
- 2026-04: **Revertido para Stripe** (branch `stripe-migration`, mergeada na main). Stripe agora suporta PIX nativamente, eliminando a necessidade do MP. Ver seção "Pagamentos — Stripe" acima.

**🔤 Full-Text Search — PostgreSQL tsvector (2026-02-15):**
- ✅ PostgreSQL FTS com stemming português (`portuguese_unaccent`) + `unaccent` extension
- ✅ `search_vector tsvector` + GIN index + triggers em 7 tabelas (Document, GlossaryTerm, LegislativeAct, CourseVideo, RecommendedSite, BlogPost, FAQ)
- ✅ Pesos A/B/C (título/descrição/conteúdo) para ranking por relevância via `ts_rank`
- ✅ `websearch_to_tsquery` — suporta AND, OR, frases entre aspas, negação com `-`
- ✅ FAQ e BlogPost adicionados à busca global (novos tipos `faq` e `blog`)
- ✅ ILIKE substituído por FTS na rota `/api/area-restrita/global-search`
- ✅ Error handling migrado para `handleApiError()` (padrão Fase 8)
- 📖 Ver `lib/search/full-text-search.ts`, `scripts/setup-full-text-search.ts`
- 🚀 Setup: `npx tsx scripts/setup-full-text-search.ts` | Verificar: `--verify`

**📊 Fase 11 — Monitoring e Observability (2026-02-15):**
- ✅ `Sentry.captureException()` no `handleApiError()` para erros 500+ (Prisma conexão, validação, genérico)
- ✅ `Sentry.setUser({ id, email, role })` no middleware após auth (`withAuth`, `withAdminAuth`)
- ✅ `trackServerEvent()` via Sentry breadcrumbs em 8 rotas (login, register, download, upgrade, ai_search, qr_scan, contact, newsletter)
- ✅ `trackClientEvent()` via Vercel Analytics em 2 componentes (GlobalSearchBar, ChatInterface)
- 📖 Ver `lib/monitoring/events.ts`, `lib/monitoring/track-client.ts`

**📦 Indexação Completa de Documentos no pgvector (2026-02-07):**
- ✅ 428/429 documentos indexados com embeddings no pgvector (1.598 chunks)
- ✅ Pipeline adaptado para documentos sem R2 (usa `content`/`description` como fallback)
- ✅ DECOR (171), Enunciados (129), ONs (96), Pareceres Vinculantes (20), Acórdãos (8) indexados
- ✅ Categoria `decor` adicionada ao chunker de documentos legais
- ⚠️ 1 doc não indexável: ON AGU nº 41/2014 (descrição < 50 chars)
- 📖 Ver `lib/embeddings/document-processor.ts`, `scripts/migrate-to-embeddings.ts`

**🔍 Busca Global com IA Integrada (2026-02-07):**
- ✅ Busca textual (300ms) + busca semântica IA (1.5s) em paralelo no campo de busca global
- ✅ Card "Análise IA" com resposta sintetizada aparece acima dos resultados tradicionais
- ✅ Toggle para ativar/desativar busca IA (botão Sparkles roxo/cinza)
- ✅ Enter dispara busca IA imediatamente (cancela debounce de 1.5s)
- ✅ Tratamento de rate limit (429) com mensagem amigável
- ✅ Fontes com badges de relevância percentual no card IA
- 📖 Ver `hooks/use-global-search.ts`, `components/area-restrita/GlobalSearchBar.tsx`, `components/area-restrita/SearchResultsList.tsx`

**🤖 Chat RAG com Busca Semântica (2025-11-12):**
- ✅ Interface de chat com busca semântica via Google Gemini
- ✅ Endpoint `/api/documents/query` com caching inteligente
- ✅ Componente `ChatInterface` reutilizável
- ✅ Página `/area-restrita/assistente` para alunos (chat completo)
- ✅ Histórico de conversas com localStorage
- ✅ Sugestões de perguntas contextuais
- ✅ Citações de fontes com relevância percentual
- 📖 Ver `components/ChatInterface.tsx` e `app/area-restrita/assistente/page.tsx`

**Sistema de Tratamento de Erros (2025-11-04) - Fase 8:**
- ✅ 9 classes de erro customizadas (`ApiError`, `ValidationError`, `AuthenticationError`, etc.)
- ✅ Handler centralizado com tratamento de Prisma, Zod, JWT
- ✅ `ErrorBoundary` React component para erros de renderização
- ✅ Status HTTP semânticos (400, 401, 403, 404, 409, 429, 500, 503)
- ✅ Logging estruturado com Pino (apiLogger, authLogger)
- ✅ 8+ rotas refatoradas com novo padrão
- 📖 Ver `lib/errors/api-error.ts`, `lib/errors/error-handler.ts`, `components/ErrorBoundary.tsx`

**MCP Gemini (2025-11-05) - v2.0.0:**
- ✅ MCP server customizado para integração Claude ↔ Gemini
- ✅ 5 tools: query, code_review, compare_approaches, brainstorm, collaborate
- ✅ Configuração global em `~/.claude-mcp-servers/gemini/`
- 🔑 Requer `GEMINI_API_KEY` (<https://aistudio.google.com/app/apikey>)
- 📖 Ver `~/.claude-mcp-servers/gemini/README.md`

**🚀 AGU Scraper v4:**
- ✅ Sistema de versionamento automático com detecção de mudanças
- ✅ 97 Orientações Normativas com análise de relevância
- ✅ Significance scoring (0-100) para mudanças
- 📖 Ver `AGU_SCRAPER_V4.md`

**TCU Manager:**
- ✅ Interface admin unificada
- ✅ Web scraping + AI summaries
- ✅ Excel converter (`npm run convert-tcu`)

**Parse Seguro de Tags:**
- ✅ Função `safeParseArray()` suporta CSV e JSON
- ✅ Script de migração `scripts/fix-csv-tags.ts` para conversão CSV→JSON



---

## Development Status — histórico completo (arquivado)

## Development Status

**✅ Completed:**
- **Onda 4.5 — JSON → String[] nativo PG (2026-05-17/18):** `leiArticles` migrado para `leiArticlesArr String[]` em 11 modelos Prisma + 7 GIN indexes. 5x speedup medido em prod. 9 PRs #72-#80. Drop coluna legada programado pra ~2026-06-01.
- **Onda 4.6 — Performance LMS analytics (2026-05-18):** `lib/lms/` subdir com 3 arquivos (`query-timing.ts`, `analytics-queries.ts`, `progress-aggregation.ts`) + 6 helpers. N+1 eliminado em 4 endpoints LMS. 3 PRs #82-#84.
- **Onda 4.7 — Single-flight em `withCache` (2026-05-18):** Dedup in-memory de chamadas concorrentes via `Map<key, Promise>` em `lib/cache/redis-client.ts`. 24 call sites herdam automaticamente. Leak protection `MAX_IN_FLIGHT=1000`. 2 PRs #85-#86.
- **Onda 5 — Podar features mortas (2026-05-18):** ~1500 LOC removidas. Flag `DOU_CLIPPING_V2_ENABLED` + 440 LOC legacy dropadas, pages AGU admin duplicadas consolidadas (545 LOC), cron migrado de `agu-scraper.ts` v1 → v4 e v1 dropado (496 LOC). 3 PRs #87-#89.
- Auth (JWT, QR codes, enrollment system)
- Document management (versioning, Excel import, safe parsing)
- Blog, publications, newsletter, social media
- TCU/AGU scrapers with AI summaries
- Error handling system (Fase 8 - 97% audit complete)
- Chat RAG with semantic search (Gemini)
- Busca global com IA integrada (busca textual + semântica em paralelo)
- Indexação pgvector completa: 428/429 docs, 1.598 chunks (DECOR, ONs, enunciados, pareceres vinculantes, acórdãos)
- Fase 9: Automated testing (Vitest 4, **1473+ tests**, ~73% global coverage — threshold global de 80% é pré-existente da campanha, não bloqueia merges com `--squash` direto)
- Fase 10: Redis caching extensão e padronização (+50 rotas)
- Fase 11: Monitoring (Sentry captureException em erros 500+, setUser após auth, tracking events server/client via Vercel Analytics)
- Admin Versioning UI: histórico de versões (timeline), diff viewer, seção collapsible na página de edição
- Full-Text Search: PostgreSQL tsvector + GIN + stemming português em 7 tabelas, FAQ e Blog na busca global
- Stripe (cartão + PIX nativo): Checkout Session, Webhook idempotente, 2 planos (Básico/Premium), QR Code trial 1 mês — mergeado de `stripe-migration` em abr/2026
- Certificados Digitais Premium (T7): emissão manual + revogação + galeria + OG image dinâmica + auditoria — concluído 2026-05-07
- Clipping Diário TCU: arquivo público + admin recipients + RTF + IA editorial — em produção desde 2026-05-07
- Hub TCU + Hub Lei 14.133 + Busca IA no Analytics-hub (admin consolidado, abr/2026)
- Módulo Planejamento (`app/area-restrita/planejamento`): sessões, documentos com seções/versões, biblioteca de snippets, trilhas
- CONUNI sync (1.512 docs)
- Registro aberto (sem QR Code), verificação email unificada (token hex)
- Newsletter Analytics + Redesign: templates profissionais (weekly + monthly), tracking, dashboard admin
- Tribunal Scrapers: TCE-SP, TCE-PR, TCE-MG + esqueletos TCE-SC/RJ/RS/PE + DataJud STJ/STF
- Certificados: botão LinkedIn, galeria `/area-restrita/meus-certificados`
- Performance: dynamic imports em 5 admin pages, `<img>` → `next/image`
- LMS Progresso: dashboard `/area-restrita/meu-progresso`, push em badge/certificado, cron inatividade
- DOU Classifier: pipeline classificação (keyword + IA), admin UI, cron diário, 7 endpoints, 3 suítes de teste
- Melhorias na Busca IA: reclassificação de artigos (4 categorias, 482 docs), consciência temporal, fidelidade ao texto, re-indexação embeddings

**🚧 Pendente / Em andamento:**
- Stripe Fase 3 LIVE: roadmap de migração de TEST→LIVE em produção (modo TEST 100% configurado em 2026-04-24)
- Gemini Embedding 2 upgrade: ELIC reindexando; calibrar thresholds após reindexação completa (ver memória `MEMORY.md`)
- Backlog completo em `FUTURE_TASKS.md`

