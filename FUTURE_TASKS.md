# Tarefas Futuras — Site do Prof. Daniel Barral

> **Repositório central de melhorias, pendências e novas funcionalidades.**
> Atualizado em: 2026-04-19

---

## Legenda de Prioridade

- **BLOQUEANTE** — Impede funcionalidade em produção
- **Alta** — Impacto direto na experiência do usuário ou na qualidade dos dados
- **Média** — Melhoria significativa, mas não urgente
- **Baixa** — Nice-to-have, otimizações futuras

---

## PENDÊNCIAS DE LANÇAMENTO

### P1. Conta Stripe [BLOQUEANTE]
**Prioridade:** BLOQUEANTE
**Status:** Migração de Mercado Pago → Stripe em andamento. Código implementado (`lib/stripe.ts`: checkout subscription, Pix Automático via `mandate_options`, billing portal, enrollments). Faltam credenciais e configuração no painel Stripe.

**Ações:**
- [ ] Criar/ativar conta em dashboard.stripe.com (modo Brasil — habilitar Pix Automático)
- [ ] Criar Products + Prices recorrentes com `lookup_key` exatos: `basico_monthly`, `basico_yearly`, `premium_monthly`, `premium_yearly` (valores: 49,90 / 499,00 / 89,90 / 899,00 BRL)
- [ ] Obter `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Configurar variáveis de ambiente na Vercel (Production/Preview/Development)
- [ ] Configurar webhook: `https://www.profdanielbarral.com/api/pagamento/webhook` — eventos: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`
- [ ] Habilitar Customer Billing Portal (configurações de produto, cancelamento, atualização de cartão)
- [ ] Testar fluxo completo: checkout → pagamento (cartão e Pix) → webhook → Subscription + Enrollment criados

**Arquivos relevantes:** `lib/stripe.ts`, `app/api/pagamento/{checkout,status,webhook}/route.ts`

### P2. Verificação Manual Pós-Deploy [BLOQUEANTE]
**Prioridade:** BLOQUEANTE
**Status:** Pendente

- [ ] Registro sem QR Code → verificação email → login → planos
- [ ] Registro com QR Code → verificação → login → área restrita
- [ ] Reenvio de verificação com token → funciona
- [ ] Email de boas-vindas com acentos corretos
- [ ] Checkout Stripe (cartão) → webhook → Subscription + Enrollment
- [ ] Pix Automático Stripe → autorização → cobrança → webhook → Enrollment
- [ ] Newsletter renderiza em Gmail/Outlook

---

## CORREÇÕES E QUALIDADE DE DADOS

### T1. Correção das Extrações de Atos Normativos (TCU e MPU/MPF) [Alta]
**Prioridade:** Alta
**Status:** Auditoria realizada em 2026-04-19. Ver `docs/audits/2026-04-19-legislative-acts-audit.md` para diagnóstico detalhado (108 atos, 8 seções + Problem IDs, JSON dump em `docs/audits/2026-04-19-legislative-acts-audit.json`).

**Principais achados da auditoria (Seções 4, 7 e 8):**
- **TCU (2 atos, Portarias 3/2025 e 175/2022):** URLs em `pesquisa.apps.tcu.gov.br` são SPAs JS-rendered — spot-check retornou apenas **187 chars** de texto útil (stripped) vs 15–22 KB armazenados. Verdict: `bloated` (ratio 83–118x). O parser gov.br genérico não consegue extrair o conteúdo real; o texto armazenado é provavelmente shell/placeholder HTML e NÃO o texto da norma. Todos os 2 atos têm `scrapeStatus: null` (nunca foram scraped com sucesso real).
- **MPU/MPF (1 ato, Portaria MPU 178/2023):** Nomenclatura do issuer é **MPU** (não MPF), mas `officialUrl` aponta para `biblioteca.mpf.mp.br` (1 único host sem parser dedicado — cai no fallback). Verdict: `truncated` (stored 57 KB vs stripped 172 KB, ratio 0.33). Conteúdo é parcial.
- **Planalto (`www.planalto.gov.br`, 24 atos):** Decretos recentes (ex: Decreto 12.807/2025, 12.785/2025) apresentam ruído de tabela — blocos longos de `⏎` (newlines) sucessivos gerados a partir de cells vazias de table (ver Seção 7 do relatório). MP 1.167/2023 retornou `url-dead` (fetch errored/abortado — URL pode estar quebrada).
- **SEGES/MGI + Resoluções CICS/MGI + CIIA-PAC/CC em `www.gov.br`/`www.in.gov.br` (múltiplos atos):** 8 de 12 URLs do spot-check voltaram `truncated` (ratio 0.03–0.47) — Portaria SEGES/MGI 4.932/2023 armazena apenas 826 chars mas a página tem 25.826 chars de texto útil (ratio 0.03). Parser gov.br atual está cortando o corpo antes do fim.
- **DOU/in.gov.br masthead e footer vazam no texto:** IN SGD/MGI 86/2025 (Seção 7) começa com "Brasão do Brasil / Diário Oficial da União / Publicado em: ..." e termina com "Borda do rodapé / Logo da Imprensa" — boilerplate de layout não filtrado.
- **Planilhas internas em SGD/MGI:** Portarias SGD/MGI 6.680/2024 e 6.679/2024 contêm placeholders `<NOME DO FISCAL TECNICO>` vazando do HTML (formulários-modelo anexos à norma, que deveriam ser filtrados ou o conteúdo deveria terminar antes do anexo).
- **Completude de metadados (Seção 5):** `themes` tem baixa cobertura — SEGES 3% (1/29), TCU 0%, MPU 0%, CICS/MGI 0%, CIIA-PAC/CC 0%, SEGES/MGI 67%. `leiArticles` também falha pontualmente (ME 0%, SEGES 86%).
- **scrapeStatus null em 20 atos (Seção 3):** todos os 2 TCU, o 1 MPU, 1 CICS/MGI, 1 CIIA-PAC/CC, 10 SEGES/MGI e 6 Presidência da República nunca tiveram scrape bem-sucedido com timestamp registrado.

**Problem IDs emitidos (do relatório, para consumo pelo fix):**
- `unparsedHost`: 1 ato (biblioteca.mpf.mp.br)
- `spotCheckSuspicious`: 11 atos (2 bloated + 8 truncated + 1 url-dead)
- `contentMissing` / `contentTruncated` (heurística estática) / `metadataIncomplete` / `duplicateCandidates`: 0 atos

**Ações priorizadas:**
- [ ] Adicionar parser dedicado para `pesquisa.apps.tcu.gov.br` / `btcu.apps.tcu.gov.br` — hoje cai no parser gov.br genérico, mas TCU é SPA com conteúdo JS-rendered. Avaliar: (a) endpoint JSON/API oficial do TCU, (b) rota alternativa em `portal.tcu.gov.br` com HTML estático, ou (c) Playwright headless como último recurso.
- [ ] Adicionar parser dedicado (ou tratamento de fallback) para `biblioteca.mpf.mp.br` — é PDF/repositório de bitstream, não HTML; precisa pipeline de extração de PDF (pdfjs-dist ou similar).
- [ ] Corrigir `www.gov.br` / `www.in.gov.br` parser para não truncar o corpo — 8/12 URLs do spot-check voltaram `truncated`. Investigar se o seletor de conteúdo está parando cedo (ex: fechando no primeiro `<section>` em vez do fim do artigo principal).
- [ ] Limpar ruído de table-row do parser Planalto (`www.planalto.gov.br`) — Decretos apresentam blocos longos de `⏎` sucessivos; colapsar whitespace consecutivo a no máximo 2 newlines.
- [ ] Remover masthead ("Brasão do Brasil", "Diário Oficial da União") e footer ("Borda do rodapé", "Logo da Imprensa") do conteúdo extraído em `www.in.gov.br`.
- [ ] Detectar e excluir formulários-modelo anexos (`<NOME DO FISCAL TECNICO>`) em portarias SGD/MGI — cortar o conteúdo no final do texto normativo antes dos anexos.
- [ ] Investigar MP 1.167/2023 (fetch falhou com `url-dead`) — confirmar se URL `planalto.gov.br/ccivil_03/_ato2023-2026/2023/mpv/mpv1167.htm` ainda é válida; atualizar se a MP foi convertida em lei.
- [ ] Preencher `themes` para issuers com 0% (TCU, MPU, CICS/MGI, CIIA-PAC/CC) e baixa cobertura (SEGES 3%). Definir taxonomia mínima + scripts de tagging retroativo.
- [ ] Re-executar scrape dos 20 atos com `scrapeStatus: null` após fixes; registrar timestamp correto em `lastScrapedAt`.
- [ ] Re-executar `scrape-legislative-acts-content.ts --force` após os fixes acima.
- [ ] Re-rodar este audit (`scripts/audit-legislative-acts.ts`) e confirmar que `spotCheckSuspicious` cai para ≤ 2 atos (ou zero) e `unparsedHost` vai a 0.

**Arquivos relevantes:** `scripts/scrape-legislative-acts-content.ts`, `scripts/audit-legislative-acts.ts`, `lib/tribunal-scrapers/`, `docs/audits/2026-04-19-legislative-acts-audit.md`, `docs/audits/2026-04-19-legislative-acts-audit.json`

### T2. Verificar Redação Atualizada da ON 45 [Média]
**Prioridade:** Média

Confirmar se a Orientação Normativa nº 45 da AGU está com a redação mais recente no banco de dados, comparando com o texto oficial disponível no site da AGU.

**Arquivos relevantes:** `lib/agu-modules/`, banco de dados (tabela Document)

### T3. Verificar Indexação Completa de Atos Normativos Novos [Alta] ✅ CONCLUÍDO (2026-02-23)
**Prioridade:** Alta

Verificação completa realizada em 2026-02-23:

**Verificações:**
- [x] `migrate-to-embeddings.ts --dry-run`: 0 pendentes (4.387 completed, 1 failed conhecida)
- [x] `index-legislative-acts.ts --dry-run`: 0 pendentes (todos completed)
- [x] Chunks bem formados: prefixo [fullNumber | type], spans ~2.200-2.400 chars com overlap ~400
- [x] 100% dos 12.385 chunks (11.118 Document + 1.267 LegislativeAct) com embedding vectors não-nulos

**Única falha:** ON AGU 41/2014 — texto insuficiente (< 50 chars, sem R2 key), pré-existente e documentada.

**Arquivos relevantes:** `lib/embeddings/`, `scripts/migrate-to-embeddings.ts`, `scripts/index-legislative-acts.ts`

### T4. Contador de Legislação Fixo em 105 no Admin [Alta] ✅ CONCLUÍDO (2026-02-23)
**Prioridade:** Alta

Investigação completa realizada em 2026-02-23:

**Diagnóstico:**
- [x] Admin (`app/admin/legislacao/page.tsx`): Server Component com `getLegislativeActStats()` direto do Prisma — renderização dinâmica, sempre atualizado
- [x] Página pública (`app/legislacao/page.tsx`): Client Component que busca via API com CDN cache (`s-maxage=1800`, 30 min)
- [x] Redis (Upstash) NÃO configurado — `withCache` é no-op, não era a causa
- [x] Contador NÃO era hardcoded — exibia 105 porque havia exatamente 105 atos no banco na data do relato

**Contagem real atual:** 108 LegislativeActs (após adição de Portaria TCU 175/2022, Portaria TCU 3/2025, Portaria MPU 178/2023)

**Melhoria aplicada:** `CacheInvalidation.legislativeActs()` adicionado ao `scripts/import-legislative-acts.ts` para invalidação automática de Redis após importações futuras

---

## MELHORIAS NO ADMIN

### T5. Simplificação das Abas do Admin [Média] ✅ CONCLUÍDO (2026-02-23)
**Prioridade:** Média

Sidebar reduzido de 21 para 14 itens agrupando páginas relacionadas com tabs URL-synced.

**Implementado (commit `3c2cd52` + fix `ebc154e`):**
- [x] Layout compartilhado via `app/admin/layout.tsx`
- [x] `AdminLayout` removido de 35 pages individuais
- [x] Pages consolidadas: importacao (TCU+AGU), analytics-hub (Geral+Catalogação), docs (Central+Gerenciar), blog-social (Blog+Social), recursos (Vídeos+Sites)
- [x] 11 redirects para rotas antigas em `next.config.ts`
- [x] Hook `useTabFromUrl` para tabs sincronizadas com URL
- [x] Componente `Tabs` controlado/não-controlado

### T6. Admin Responsivo para Mobile [Média] ✅ CONCLUÍDO (2026-02-23)
**Prioridade:** Média

**Implementado (commit `3c2cd52` + fix `ebc154e`):**
- [x] Bottom nav mobile (`AdminBottomNav`) para ações frequentes
- [x] Responsive table wrapper (`components/ui/responsive-table.tsx`)
- [x] Sidebar colapsável no novo layout

---

## NOVAS FUNCIONALIDADES

### T7. Sistema de Certificações Digitais [Média]
**Prioridade:** Média
**Esforço:** 2-3 semanas

Sistema completo de certificados digitais ao concluir cursos:

**Funcionalidades:**
- Geração de PDF (jsPDF + html2canvas) com logo, QR code, assinatura digital
- Número único (BARRAL-2026-XXXXXX) + código de verificação
- Página pública de validação (`/validar-certificado`)
- Galeria do aluno (`/area-restrita/certificados`) — parcialmente implementada
- Compartilhamento no LinkedIn
- Admin: emissão manual + automática + revogação
- Emissão automática ao completar 80% dos documentos do curso

**Schema:** Certificate, CertificateTemplate (ver detalhes em PLANO_IMPLEMENTACAO_FEATURES.md — arquivado)

### T8. LMS — Refinamentos [Baixa] ✅ CONCLUÍDO (2026-02-23)
**Prioridade:** Baixa
**Status:** Todos os refinamentos implementados

**Implementado (2026-02-23):**
- [x] Pré-requisitos entre aulas (`prerequisiteId` FK self-relation no model Lesson)
- [x] Conteúdo condicional (quiz-gated via prerequisite + requiresQuizPass enforcement)
- [x] Lock icons na UI do curso e sidebar quando prerequisite não completado
- [x] Admin dropdown para selecionar pré-requisito ao criar/editar aula
- [x] Drag-and-drop no reordenamento de módulos/aulas (@dnd-kit + setas como fallback)
- [x] Export CSV global no analytics LMS (resumo + cursos + alunos inativos)
- [x] Bulk import de aulas via JSON no admin (preview + auto-slug)

**Arquivos relevantes:** `prisma/schema.prisma`, `app/admin/lms/`, `app/area-restrita/curso/`, `components/lms/`

### T9. Hub "Lei 14.133 Comentada" — Refinamentos [Baixa] ✅ CONCLUÍDO (2026-02-23)
**Prioridade:** Baixa
**Status:** Todos os refinamentos implementados

**Implementado (2026-02-23):**
- [x] Dashboard visual de cobertura no admin (barras por faixa, top 10, artigos órfãos)
- [x] Bulk linker: nova página `/admin/lei-14133/bulk-linker` para vincular múltiplos docs a artigos
- [x] Cross-references na UI da lei-comentada (tópicos + chips clicáveis de artigos relacionados)
- [x] API admin enhance já existia (T9.4) — POST `/api/admin/documents/[id]/enhance` + DocumentWizard
- [x] Mobile optimization: drawer lateral com FAB, sidebar hidden em mobile, auto-close ao selecionar

**Arquivos relevantes:** `app/admin/lei-14133/`, `app/area-restrita/lei-comentada/`, `data/lei-14133-cross-references.ts`

### T10. App Mobile (Android e iPhone) [Baixa]
**Prioridade:** Baixa

Estudar viabilidade de criar aplicativo nativo ou usar PWA avançado:

**Opções:**
1. **PWA melhorado** — já implementado parcialmente, melhorar offline support e push notifications
2. **React Native / Expo** — reaproveitamento de lógica, custo moderado
3. **WebView wrapper** — solução rápida mas limitada (Capacitor/Cordova)
4. **Flutter** — app nativo, sem reaproveitamento de código

**Análise necessária:**
- [ ] Avaliar funcionalidades que justificam app nativo vs PWA
- [ ] Custo de manutenção de 2 plataformas
- [ ] Necessidade real dos usuários (pesquisa)
- [ ] Publicação na Play Store / App Store (conta developer, aprovação)

---

## OTIMIZAÇÕES TÉCNICAS

### T11. Performance — Fase 2 [Concluído ✅]
**Status:** Implementado em 2026-02-23

- [x] Code splitting: dynamic imports para 4 componentes pesados na página de aula LMS (`LessonAIAssistant`, `QuizPlayer`, `GamificationSidebar`, `LessonDiscussion`)
- [x] Code splitting: 8 dynamic imports já existiam em `area-restrita/page.tsx` + 5 em admin pages
- [x] DNS prefetch/preconnect para serviços externos (fonts, Sentry, Vercel Analytics, Mercado Pago)
- [x] ISR configurado em jurisprudencia (30min) — soma-se a home/blog/publicações/cursos (1h)
- [x] Bundle analyzer: `@next/bundle-analyzer` + script `npm run analyze`
- [ ] QR codes base64 → PNG: **Deferido** — impacto baixo (QR codes raramente na navegação), requer mudança arquitetural (upload R2, alterar model, migrar dados)

### T12. Performance — Fase 3 [Concluído ✅]
**Status:** Avaliado e implementado o viável em 2026-02-23

- [x] Bundle analyzer instalado (`@next/bundle-analyzer`, `ANALYZE=true npm run build`)
- [x] Tree shaking: `lucide-react` já via `optimizePackageImports`; lodash não é dependência
- [x] Service Worker: já existe (`public/sw.js`, 180 linhas) com cache strategies
- [x] Font optimization: `next/font/google` com `display: swap`
- ~~Server Components em `/area-restrita`~~: **Inviável** — todas as 10 páginas usam hooks/state/interatividade
- ~~Virtual scrolling lei-comentada~~: **Deferido** — sidebar usa accordion (apenas itens expandidos no DOM, ~230 items max), complexidade alta para ganho marginal

### T13. Cache Redis Completo (Upstash) [Concluído ✅]
**Status:** 100% concluído — código (964 linhas em `lib/cache/redis-client.ts`, 60+ rotas, 798 linhas de testes) + credenciais Upstash configuradas na Vercel (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` em Production/Preview/Development). Cache ativo em produção.

### T14. Monitoring — Dashboard e Alertas [Baixa] ✅ CONCLUÍDO (2026-02-23)
**Prioridade:** Baixa
**Status:** Implementado

**Implementado (2026-02-23):**
- [x] Dashboard de monitoramento consolidado (`/admin/monitoring`) — cards de saúde, tabela atividade recente, gráfico 14 dias, status scrapers
- [x] API admin `/api/admin/monitoring` com queries agregadas ao AccessLog/User/ScraperHealthLog
- [x] Alertas por email via cron a cada 6h (`/api/cron/monitoring-alerts`) — zero logins 12h + scraper health degradado
- [x] Session Replay configurado no Sentry (1% sessões normais, 50% sessões com erro)
- [x] +7 server events: payment_checkout, payment_pix, payment_approved, payment_failed, certificate_issued, email_verified, subscription_created (via trackServerEvent)
- [x] +1 client event: favorite_toggled (via trackClientEvent)
- [x] Link "Monitoramento" no sidebar admin (ícone Activity)

---

## CÓDIGO ARQUIVADO (FUNCIONALIDADES_FUTURAS/)

Código funcional arquivado em `FUNCIONALIDADES_FUTURAS/` para implementação futura:

### Análise IA de Documentos
- `analise-ia/claude-analyzer.ts` — Análise com Claude
- `analise-ia/document-analyzer.ts` — Analisador de documentos
- `analise-ia/DocumentAnalyzer.tsx` — Componente React
- `analise-ia/analyze-document-route.ts` — Rota API

### Export PDF com Marca d'Água
- `export-pdf/route.ts` — Rota API de exportação
- `export-pdf/PDFExportPanel.tsx` — Painel de exportação

> Arquivado em 2025-01-27. Status: testado e funcional na data do arquivamento.

---

## GLOSSÁRIO E FAQ — Frontend Público

### T15. Páginas Públicas do Glossário e FAQ [Média]
**Prioridade:** Média
**Status:** Backend 100% completo (16 APIs, 3 models Prisma). Faltam páginas públicas.

**Glossário — falta:**
- [ ] Página `/glossario` (lista alfabética, busca, filtros por categoria, navegação A-Z)
- [ ] Página `/glossario/[slug]` (termo completo, artigos relacionados, documentos)
- [ ] Admin CRUD em `/admin/glossario` (se não existir)
- [ ] Conteúdo inicial: ~50-100 termos (ver `GUIA_ALIMENTACAO_FAQ_GLOSSARIO.md`)

**FAQ — falta:**
- [ ] Página `/faq` (accordion por categoria, busca, sistema de feedback "Foi útil?")
- [ ] Admin em `/admin/faq` (analytics: mais vistas, mais úteis, feedbacks negativos)
- [ ] Conteúdo inicial: ~30-50 perguntas

---

## NOTAS E LIÇÕES APRENDIDAS

- **Stripe SDK v22** com `apiVersion` default; usar lazy init `getStripe()` — NUNCA instanciar no top-level (quebra build sem env var)
- **Stripe Prices** resolvidos via `lookup_key` (não hardcode de IDs) — ver `resolvePriceId()` em `lib/stripe.ts`
- **Pix Automático Stripe** ainda não tipado no SDK — cast `as any` em `payment_method_options.pix.mandate_options` é intencional
- **Webhook signature** validar com `stripe.webhooks.constructEvent` usando `STRIPE_WEBHOOK_SECRET` (raw body)
- **Email fallback** mudou de `profbarral.com.br` para `profdanielbarral.com`
- **Resend SDK** retorna `{data, error}`, não lança exceções
- **prisma-client** (local) quebra webpack — usar `prisma-client-js`
- **Scripts standalone** precisam adapter PrismaNeon
- **DOU API** retorna HTML highlight — sanitizar com `stripHighlightHtml()`
