# Tarefas Futuras — Site do Prof. Daniel Barral

> **Repositório central de melhorias, pendências e novas funcionalidades.**
> Atualizado em: 2026-02-22

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

### T3. Verificar Indexação Completa de Atos Normativos Novos [Alta]
**Prioridade:** Alta

Após adição recente de novos atos normativos, verificar se todos foram indexados corretamente para busca semântica com IA (embeddings no pgvector).

**Verificações:**
- [ ] Executar `npx tsx scripts/migrate-to-embeddings.ts --dry-run` para identificar docs sem embedding
- [ ] Executar `npx tsx scripts/index-legislative-acts.ts --dry-run` para atos legislativos
- [ ] Confirmar que a busca IA retorna os novos atos
- [ ] Verificar se os chunks estão bem formados

**Arquivos relevantes:** `lib/embeddings/`, `scripts/migrate-to-embeddings.ts`, `scripts/index-legislative-acts.ts`

### T4. Contador de Legislação Fixo em 105 no Admin [Alta]
**Prioridade:** Alta

A aba de legislação no painel admin exibe valor fixo de 105 normas, não refletindo as adições recentes. Provavelmente o componente usa um valor hardcoded ou um cache desatualizado.

**Investigar:**
- [ ] Verificar se o componente da aba faz query dinâmica ou usa valor estático
- [ ] Checar se há cache (Redis ou ISR) impedindo atualização
- [ ] Verificar a query que alimenta o contador
- [ ] Corrigir para refletir contagem real do banco

**Arquivos prováveis:** `app/admin/` (aba de legislação), APIs de contagem

---

## MELHORIAS NO ADMIN

### T5. Simplificação das Abas do Admin [Média]
**Prioridade:** Média

O painel admin possui ~20 abas. Consolidar em ~12 abas agrupando funcionalidades semelhantes:

| Fusão | Resultado |
|-------|-----------|
| Destaques TCU + Destaques TCE | "Destaques Jurisprudência" (toggle TCU/TCE) |
| TCU Manager + AGU Manager | "Importação de Atos" (sub-abas por fonte) |
| Tribunal Decisions + DOU Filtros | "Monitoramento Jurídico" (fontes externas) |
| Analytics Geral + Busca + Catalogação | "Analytics" (3 sub-abas internas) |
| Central Docs + Gerenciar Docs | "Documentos" (upload + gerenciamento) |
| Blog + Redes Sociais | "Blog & Social" (escrever → distribuir) |
| Vídeos + Sites Recomendados | "Recursos Externos" (links externos) |

**Implementação:** Usar tabs horizontais (Radix UI) dentro das páginas consolidadas.

### T6. Admin Responsivo para Mobile [Média]
**Prioridade:** Média
**Depende de:** T5 (simplificação das abas)

A página admin não funciona bem no celular. Após a simplificação dos menus (T5):

- [ ] Sidebar colapsável com menu hamburger
- [ ] Tabelas responsivas com scroll horizontal ou cards empilhados
- [ ] Formulários single-column em telas pequenas
- [ ] Touch targets mínimo 44px
- [ ] Navegação bottom-bar para ações frequentes
- [ ] Testar em viewport 375px (iPhone SE)

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

### T8. LMS com Trilhas de Conhecimento [Baixa]
**Prioridade:** Baixa
**Esforço:** 4-6 semanas

Sistema de aprendizado estruturado em trilhas, módulos e lições:

**Modelo recomendado:** Complementar (trilhas OPCIONAIS + manter acesso livre)

**MVP:**
- Estrutura: Course → Module → Lesson (conteúdo = documento existente, vídeo, texto, quiz)
- Tracking de progresso (UserProgress, LessonProgress)
- Dashboard do aluno (`/area-restrita/meu-progresso`) — parcialmente implementado
- Navegação sequencial com botão "Continuar de onde parei"
- Admin: Course Builder com drag-and-drop

**Fase 2 (futura):** Quizzes, gamificação, badges, ranking, recomendação IA

**Schema:** Course (no banco), Module, Lesson, UserProgress, LessonProgress (ver detalhes em PLANO_IMPLEMENTACAO_FEATURES.md — arquivado)

**Decisões pendentes:**
- LMS opcional vs obrigatório? (recomendação: opcional)
- Certificado por % documentos OU por completar trilha? (recomendação: híbrido)
- Quizzes no MVP ou Fase 2? (recomendação: Fase 2)

### T9. Hub "Lei 14.133 Comentada" [Média]
**Prioridade:** Média
**Esforço:** ~12-15 horas

Transformar a navegação do site para centralizar na estrutura da Lei 14.133:

**Fase 1 — Backend (parcialmente feito):**
- [x] Migração content → summary
- [x] Serviço de enriquecimento IA (`lib/ai/document-enhancer.ts`)
- [ ] API `/api/admin/documents/[id]/enhance`
- [ ] API `/api/admin/analytics/lei-cobertura`

**Fase 2 — Admin Wizard (4 etapas):**
- Step 1: Info básica
- Step 2: Vinculação com Lei 14.133 (IA sugere artigos)
- Step 3: Conteúdo educacional (resumo, pontos-chave, aplicação prática — gerados por IA)
- Step 4: Finalizar + preview
- Dashboard de cobertura no admin (barra de progresso 195 artigos)

**Fase 3 — Frontend alunos:**
- Página `/area-restrita/lei-comentada` com estrutura da lei (Títulos → Capítulos → Artigos → Documentos)
- Widget "Explorar Lei 14.133" na home da área restrita
- Breadcrumbs contextuais
- Indicadores visuais de cobertura por artigo

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

### T11. Performance — Fase 2 [Baixa]
**Prioridade:** Baixa
**Condição:** Implementar se scores Lighthouse não atingirem 70+

- [ ] Code splitting em `/area-restrita` (dynamic imports para VideoPlayer, DocumentFilters)
- [ ] QR codes: converter base64 → arquivos PNG servidos via URL estática
- [ ] Cache headers otimizados (ISR: cursos 1h, blog 2h, publicações 24h)
- [ ] Prefetch de recursos críticos (fonts, preconnect)

### T12. Performance — Fase 3 [Baixa]
**Prioridade:** Baixa
**Condição:** Implementar para atingir scores 90+

- [ ] Migração para Server Components em `/area-restrita` (redução ~60% bundle JS)
- [ ] Virtual scrolling para listas longas (react-window)
- [ ] Bundle analyzer + tree shaking (eliminar imports completos de lodash, lucide-react)
- [ ] Service Worker com Workbox para offline support

### T13. Cache Redis Completo (Upstash) [Baixa]
**Prioridade:** Baixa
**Status:** Parcialmente implementado (padronização feita em 50+ rotas)

Falta:
- [ ] Setup conta Upstash Redis dedicada
- [ ] Configurar variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
- [ ] Implementar `CacheManager` com `getOrSet()` e invalidação automática
- [ ] Medir performance antes/depois

**Arquivos referência:** `lib/cache/` (estrutura planejada em AUDITORIA_FASES_8-11_PLANO.md — arquivado)

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
