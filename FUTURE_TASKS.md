# Tarefas Futuras — Site do Prof. Daniel Barral

> **Repositório central de melhorias, pendências e novas funcionalidades.**
> Atualizado em: 2026-02-23

---

## Legenda de Prioridade

- **BLOQUEANTE** — Impede funcionalidade em produção
- **Alta** — Impacto direto na experiência do usuário ou na qualidade dos dados
- **Média** — Melhoria significativa, mas não urgente
- **Baixa** — Nice-to-have, otimizações futuras

---

## PENDÊNCIAS DE LANÇAMENTO

### P1. Conta Mercado Pago [BLOQUEANTE]
**Prioridade:** BLOQUEANTE
**Status:** Pendente — credenciais ainda não configuradas

**Ações:**
- [ ] Criar conta em mercadopago.com.br/developers
- [ ] Obter `MERCADOPAGO_ACCESS_TOKEN` e `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- [ ] Configurar variáveis de ambiente na Vercel
- [ ] Configurar webhook: `https://www.profdanielbarral.com/api/pagamento/webhook` (evento: payment)
- [ ] Testar fluxo completo: checkout → pagamento → webhook → enrollment

**Arquivos relevantes:** `lib/mercadopago.ts`, `app/api/pagamento/`

### P2. Verificação Manual Pós-Deploy [BLOQUEANTE]
**Prioridade:** BLOQUEANTE
**Status:** Pendente

- [ ] Registro sem QR Code → verificação email → login → planos
- [ ] Registro com QR Code → verificação → login → área restrita
- [ ] Reenvio de verificação com token → funciona
- [ ] Email de boas-vindas com acentos corretos
- [ ] Checkout MP (cartão) → webhook → enrollment
- [ ] PIX → QR Code → pagamento → webhook → enrollment
- [ ] Newsletter renderiza em Gmail/Outlook

---

## CORREÇÕES E QUALIDADE DE DADOS

### T1. Correção das Extrações de Atos Normativos (TCU e MPF) [Alta]
**Prioridade:** Alta

As extrações dos atos normativos do TCU e MPF apresentam falhas significativas:
- Conteúdo incompleto (textos cortados, artigos faltando)
- Formatação perdida durante extração
- Metadados ausentes ou incorretos
- Possíveis duplicatas não detectadas

**Pontos a verificar:**
- Integridade do conteúdo extraído vs. fonte original
- Completude dos metadados (data, número, ementa)
- Consistência entre versões
- Funcionamento dos scrapers atuais

**Arquivos relevantes:** `lib/tribunal-scrapers/`, `scripts/`

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

### T13. Cache Redis Completo (Upstash) [Código Pronto ✅]
**Status:** Infraestrutura 100% implementada (964 linhas em `lib/cache/redis-client.ts`, 60+ rotas integradas, 798 linhas de testes). Falta apenas configurar credenciais.

Ação manual do usuário:
- [ ] Criar conta em https://console.upstash.com
- [ ] Criar database Redis (`profbarral-cache`, Regional, us-east-1, allkeys-lru)
- [ ] Configurar na Vercel: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- [ ] Deploy — 60+ rotas ativam cache automaticamente

### T14. Monitoring — Dashboard e Alertas [Baixa]
**Prioridade:** Baixa
**Status:** Parcialmente implementado (Sentry + Vercel Analytics ativos)

Falta:
- [ ] Dashboard de monitoramento consolidado
- [ ] Alertas por email/Slack para error rate acima do threshold
- [ ] Tracking de 5+ eventos customizados adicionais
- [ ] Session Replay configurado no Sentry

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

- **Mercado Pago SDK v2** usa classes (Payment, Preference, MercadoPagoConfig)
- **external_reference** é string — usar `JSON.stringify()` para dados compostos
- **Email fallback** mudou de `profbarral.com.br` para `profdanielbarral.com`
- **Resend SDK** retorna `{data, error}`, não lança exceções
- **prisma-client** (local) quebra webpack — usar `prisma-client-js`
- **Scripts standalone** precisam adapter PrismaNeon
- **DOU API** retorna HTML highlight — sanitizar com `stripHighlightHtml()`
- **MP lazy init:** `getMPClient()` evita erro no build — NUNCA instanciar no top-level
