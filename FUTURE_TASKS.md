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
**Status (2026-04-24):** Modo teste **100% configurado e validado**. Modo live depende de KYC da Stripe (análise em andamento) + repetir os passos de configuração com chaves live. Teste end-to-end com cartão 4242 ainda pendente.

**Fase 1 — Modo TESTE (concluída 2026-04-24):**
- [x] Criar conta em dashboard.stripe.com (modo Brasil)
- [x] Criar Products + Prices recorrentes com `lookup_key` exatos: `basico_monthly`, `basico_yearly`, `premium_monthly`, `premium_yearly` (valores 49,90 / 499,00 / 89,90 / 899,00 BRL) — via `npx dotenv -e .env.local -- npx tsx scripts/stripe-bootstrap.ts`
- [x] Obter `sk_test_...`, `pk_test_...` e `whsec_...` (test mode)
- [x] Configurar as 3 vars em `.env.local`
- [x] Configurar as 3 vars no Vercel:
  - Production: ✅ (test keys por enquanto — precisa trocar pra live antes de abrir pra alunos reais)
  - Preview (branch `stripe-migration`): ✅
  - Development: ainda não configurado no Vercel (`.env.local` local cobre esse caso)
- [x] Configurar webhook no dashboard Stripe (modo teste):
  - URL: `https://www.profdanielbarral.com/api/pagamento/webhook`
  - 6 eventos ouvidos: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`
- [x] Redeploy produção pra carregar env vars novas (deploy `sitedobarral-4cclhsxkd...`, Ready em 7min)
- [x] Verificar healthcheck: `POST /api/pagamento/webhook` sem signature retorna **400** (prova que `STRIPE_WEBHOOK_SECRET` está carregada e validação ativa)

**Fase 2 — PENDENTE (pra próxima sessão Stripe):**

- [ ] **Habilitar Customer Billing Portal** (modo teste) — dashboard Stripe → Configurações → Billing → Portal do cliente:
  - Cancelar assinaturas
  - Atualizar método de pagamento
  - Visualizar histórico de faturas
  - Salvar
- [ ] **Teste end-to-end com cartão `4242 4242 4242 4242`** em `/planos` de produção:
  - Checkout → Stripe hosted → volta pra `/obrigado` ou `/pagamento/sucesso`
  - Webhook dispara → visível em dashboard Stripe em Desenvolvedores → Webhooks → [endpoint] → Tentativas
  - Subscription criada no DB (`prisma.subscription.findFirst`)
  - Enrollment criado pro usuário logado
  - Entrar no Customer Portal via algum link no site → cancelar teste → webhook → Subscription cancelled
- [ ] **Teste end-to-end com Pix Automático** (Stripe fornece fluxo fake em test mode)
- [ ] **Habilitar Pix Automático** — verificar em Settings → Payment methods → Pix. Pode depender do KYC live ser concluído.

**Fase 3 — LIVE MODE (bloqueada por KYC da Stripe):**

- [x] Concluir KYC (verificação de identidade + dados da empresa/CNPJ que a Stripe pediu no onboarding). **Concluído em 2026-04-25** — Stripe respondeu "Verificado".
- [x] **Criar páginas `/termos` e `/privacidade`** no site (concluído em 2026-04-25; pendente apenas cadastrar as URLs em Stripe → Customer Portal → Business information → Terms of Service e Privacy Policy)
- [ ] **Criar conta de e-mail `dpo@profdanielbarral.com`** (referenciado na Política de Privacidade como canal do Encarregado pela Proteção de Dados)
- [ ] **Cadastrar URLs `/termos` e `/privacidade`** em Stripe Dashboard → Settings → Billing → Customer portal → Business information (Terms of service URL + Privacy policy URL) — só funciona após deploy em produção
- [ ] Com live mode ativado: repetir `scripts/stripe-bootstrap.ts` com `sk_live_...` pra criar os mesmos 4 Prices no ambiente live
- [ ] Obter `sk_live_...`, `pk_live_...` e criar webhook live → `whsec_live_...`
- [ ] Trocar as 3 vars no Vercel Production pra chaves **live** (preview pode continuar em test)
- [ ] Redeploy production
- [ ] Teste final com cartão real pequeno valor (ex: R$ 49,90 básico mensal) → validar cobrança efetiva + webhook → reembolso imediato via dashboard Stripe
- [ ] Customer Billing Portal: repetir config em live mode

**Arquivos relevantes:** `lib/stripe.ts`, `app/api/pagamento/{checkout,status,webhook}/route.ts`, `scripts/stripe-bootstrap.ts`

**Scripts de diagnóstico úteis:**
- `scripts/check-stripe-env.ts` — confirma 3 vars Stripe carregadas em `.env.local` (mostra prefixo + últimos 4 chars, sem expor)
- `scripts/verify-stripe-prices.ts` — confirma que os 4 `lookup_keys` resolvem pra preços ativos no Stripe

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

**Bundle A concluído em 2026-04-19.** Fixes F3-F7 aplicados em `lib/legislative-scrapers/`. Ver `docs/audits/2026-04-19-diff-summary.md` para comparativo antes/depois. Restante (TCU SPA, MPF PDF, themes taxonomy) em bundles futuros.

**Ações priorizadas:**
- [x] ~~Adicionar parser dedicado para `pesquisa.apps.tcu.gov.br`~~ — Bundle B (2026-04-19): investigação revelou que as 2 Portarias TCU afetadas já tinham conteúdo correto no banco (import manual anterior). Solução aplicada: marcar `scrapeStatus: 'manual'` para bloquear re-scrape e excluir de falsos-positivos do audit. Parser dedicado TCU fica para quando houver Portarias TCU futuras sem conteúdo importado — cenário não presente hoje.
- [x] ~~Adicionar parser dedicado (ou tratamento de fallback) para `biblioteca.mpf.mp.br`~~ — Bundle C (2026-04-19): investigação revelou que a única Portaria afetada (MPU 178/2023) já tinha conteúdo correto no banco (import anterior). Solução: marcar `scrapeStatus: 'manual'` via `scripts/mark-atos-manual.ts` (mesmo mecanismo do Bundle B). Parser PDF genérico fica para sessão futura quando surgir caso real que precise (`pdf-parse@^2.4.5` já está em deps aguardando).
- [x] Corrigir `www.gov.br` / `www.in.gov.br` parser para não truncar o corpo — 8/12 URLs do spot-check voltaram `truncated`. Investigar se o seletor de conteúdo está parando cedo (ex: fechando no primeiro `<section>` em vez do fim do artigo principal). (F3 ✓ — gov.br/compras 'maior match > 500')
- [x] Limpar ruído de table-row do parser Planalto (`www.planalto.gov.br`) — Decretos apresentam blocos longos de `⏎` sucessivos; colapsar whitespace consecutivo a no máximo 2 newlines. (F4 ✓ — collapseWhitespace)
- [x] Remover masthead ("Brasão do Brasil", "Diário Oficial da União") e footer ("Borda do rodapé", "Logo da Imprensa") do conteúdo extraído em `www.in.gov.br`. (F5 ✓)
- [x] Detectar e excluir formulários-modelo anexos (`<NOME DO FISCAL TECNICO>`) em portarias SGD/MGI — cortar o conteúdo no final do texto normativo antes dos anexos. (F6 ✓)
- [x] Investigar MP 1.167/2023 (fetch falhou com `url-dead`) — confirmar se URL `planalto.gov.br/ccivil_03/_ato2023-2026/2023/mpv/mpv1167.htm` ainda é válida; atualizar se a MP foi convertida em lei. (F7 ✓ — URL válida, sem ação necessária)
- [x] ~~Preencher `themes`~~ — Bundle D (2026-04-19): taxonomia já existia (15 temas em `scripts/enrich-legislative-acts-themes.ts`). Normalizado valor não-canônico `tic` → `tecnologia-informacao` em 18 atos + fix do Neon adapter no script de enrich + rodado sobre os 43 atos sem themes. Cobertura geral foi de 60% → 90% (97/108). SEGES: 3% → 72%. Restam 11 INs SEGES sem themes (leiArticles null + keywords não casam) — candidatas a Bundle D-2 com AI classifier se priorizado.
- [x] Re-executar scrape dos 20 atos com `scrapeStatus: null` após fixes; registrar timestamp correto em `lastScrapedAt`. (post-fix: `scrapeStatus: null` = 0)
- [x] Re-executar `scrape-legislative-acts-content.ts --force` após os fixes acima. (executado via `scripts/rescrape-affected-acts.ts` — 18 atos atualizados)
- [x] Re-rodar este audit (`scripts/audit-legislative-acts.ts`) e confirmar que `spotCheckSuspicious` cai para ≤ 2 atos (ou zero) e `unparsedHost` vai a 0. (post-fix: `spotCheckSuspicious` = 10, majoritariamente falsos-positivos de ratio; stored lengths melhoraram em 8/11. Ver diff summary.)

**Arquivos relevantes:** `scripts/scrape-legislative-acts-content.ts`, `scripts/audit-legislative-acts.ts`, `lib/tribunal-scrapers/`, `docs/audits/2026-04-19-legislative-acts-audit.md`, `docs/audits/2026-04-19-legislative-acts-audit.json`

### T2. Verificar Redação Atualizada da ON 45 [Média]
**Prioridade:** Média

Confirmar se a Orientação Normativa nº 45 da AGU está com a redação mais recente no banco de dados, comparando com o texto oficial disponível no site da AGU.

**Arquivos relevantes:** `lib/agu-modules/`, banco de dados (tabela Document)

### T2c. Auditoria de autenticidade dos enunciados (✅ parcial concluída 2026-04-30)

| Ente | Total DB | Auditado | Resultado |
|---|---|---|---|
| **CJF** | 54 | ✅ 54/54 | match perfeito com fonte oficial (compilação Irene Nohara que reproduz PDF do CJF). Inclui os 25 do 1º Simpósio (já existentes, 8 atualizados) + 29 do 2º Simpósio (criados nesta sessão) |
| **IBDA** | 61 | ✅ 61/61 | match perfeito com PDF oficial `ibda.com.br/wp-content/uploads/2025/03/ENUNCIADOS-_-DIGITAL.pdf` (III Jornada, Lei 14.133/2021). Texto integral validado |
| **INCP** | 43 | ✅ 22/43 + 11 site-only | 22 enunciados (1-22 da 1ª Reunião Técnica) auditados via `incpbrasil.com.br/enunciados-aprovados/` (4 atualizados, 18 já idênticos). Outros 21 (números 23-43) NÃO foram localizados no site público do INCP |

**Pendente pra próxima sessão:**

- [ ] **INCP 23-43 (21 enunciados)**: estão no DB mas não estão no site público do INCP. Investigar: (a) se foram apagados/movidos, (b) se estão em outra URL/PDF, (c) contato direto INCP. Hoje continuam com texto do upload original — pode ser legítimo, mas precisa validar.
- [ ] **INCP 44-54 (11 enunciados site-only)**: estão no `incpbrasil.com.br/informativo-enunciados-2a-edicao/` mas NÃO no DB. Avaliar se vale importar (talvez sejam da 3ª Reunião Técnica?).

**Scripts permanentes** (em `scripts/`): `scrape-cjf-enunciados.ts`, `import-cjf-enunciados.ts`, `scrape-ibda-pdf.ts`, `apply-ibda-enunciados.ts`, `scrape-incp-enunciados.ts`, `apply-incp-enunciados.ts`, `audit-enunciados-autenticidade.ts`.

### T2b. Substituir paráfrase IA por texto oficial em todas as ONs [Alta]
**Prioridade:** Alta · **Aberta em 2026-04-30** · **Leva 1 concluída em 2026-04-30**

Inspeção em 2026-04-30 (ON 102) revelou que a base de ONs tinha `description` populada com paráfrase IA, não texto oficial.

**Leva 1 — descrições (✅ concluída 2026-04-30):**

- [x] Scripts criados: `scrape-ons-oficial.ts` (read-only), `fix-and-diff-ons.ts` (read-only), `apply-ons-update.ts` (com `--apply`)
- [x] Scrape de https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu → 98 ONs (entre números 5 e 102)
- [x] Diff vs DB salvo em `docs/audits/2026-04-30-ons-diff-report.md` e `.json`
- [x] **98 ONs atualizadas com texto oficial** (`description` substituída, `reviewed=false` para forçar revisão humana)
- [x] Rota `/base-conhecimento/orientacoes-normativas` reativada com `showDescription: true` e disclaimer azul "texto oficial"

**Leva 2 — URLs DOU específicas (✅ parcial concluída 2026-04-30):**

- [x] Diagnóstico: links DOU no HTML do portal AGU aparecem dentro do bloco da ON anterior (não do bloco "dono"), por isso o parser do lib/agu-modules arrastava
- [x] Scraper v2: `scripts/scrape-ons-douurls.ts` extrai TODOS os links DOU e mapeia por número embutido na própria URL (independente de delimitação de bloco) → 32 ONs com link DOU específico encontradas
- [x] **32 URLs DOU aplicadas no DB** (`scripts/apply-ons-dou-urls.ts --apply`). URL antiga (PDF de fundamentação ou `/onsagu` genérico) movida para `alternativeUrls`
- [ ] **73 ONs restantes** sem link DOU específico (28 de 2009, 16 de 2014, 8 de 2024 etc.). Investigação 2026-04-30 mostrou que a busca do in.gov.br **não responde a query strings simples** (`?q=` retorna 0 resultados mesmo pra ONs que sabemos estar lá). Precisa fluxo de UI automation (typing + click + wait results) via Playwright. Custo estimado: 73 × ~10s = 12 min. Risco alto pras ONs antigas (2009-2014) não estarem indexadas no novo portal.
- [ ] Alternativa: usar Wayback Machine ou base de dados consolidada (planalto.gov.br) pras ONs muito antigas
- [ ] As 7 ONs antigas (1-8/2016-2018 da extinta CNU/CGU) não estão na listagem atual

**Leva 4 — texto integral (✅ concluída 2026-04-30):**

- [x] `scripts/scrape-ons-content.ts` extrai `<p class="dou-paragraph">` da página DOU
- [x] **32 ONs com texto integral em `Document.content`** (média 1300 chars, vai de 776 a 3989)
- [x] Inclui preâmbulo + enunciado + referência + fonte + cláusula de vigência
- [x] Throttle de 1.5s entre requests (rate-limit friendly)
- [ ] Pra ONs sem URL DOU (Leva 3 pendente), preencher quando URLs estiverem disponíveis

**Leva 5 — auditoria + correção bug de versionamento (✅ concluída 2026-04-30):**

Auditoria comparativa DB × DOU (`scripts/audit-ons-vs-agu.ts`, removido após uso) revelou que:
- O sistema de versionamento (`findOrCreateWithVersioning`) cria nova `Document(isPublic=false)` quando detecta mudança em vez de atualizar a versão pública. As Levas 1-4 atualizaram versões históricas (não-públicas).
- 22 das 32 ONs com `content` tinham `description` divergente do "Enunciado:" oficial do DOU.
- 9 ONs públicas tinham paráfrase IA enquanto as versões históricas (criadas pelos scripts) já tinham texto oficial.

- [x] `fix-descriptions-from-content.ts` extraiu "Enunciado:" do `content` e atualizou 30 ONs.
- [x] `sync-on-public-versions.ts` copiou texto oficial das versões históricas (isPublic=false) para as públicas (isPublic=true) — 9 ONs sincronizadas.
- [x] `fix-final-stragglers.ts` tratou 5 casos especiais (ONs revogadas, substituídas, e ON 56/2018 com formato resolutivo).
- [x] **Audit final: 95 de 105 match exato (90.5%); 3 "não-match" são falsos positivos (DB tem texto correto explicando revogação/substituição); 7 ONs antigas CNU sem fonte na listagem atual.**

**Bug a corrigir em sessão futura:** scripts `apply-ons-update.ts` e `apply-ons-dou-urls.ts` usam Map por `(numero, ano)` que pode colidir com versões históricas. Deveriam filtrar `isPublic=true` na query inicial.

**Leva 4 — revisão humana (pendente):**

- [ ] Admin UI já tem fluxo `reviewed=true` (botão revisar). Workflow: ler ON na rota pública → comparar com DOU oficial → marcar revisado.
- [ ] Quando 100% revisadas, remover marca `reviewed=false` que ficou após Leva 1.

**ONs intocadas pelo script (não estão na listagem atual da AGU):**

7 ONs antigas (1-8/2016-2018) da extinta CNU/CGU. Continuam no DB com paráfrase IA até alguém adicionar manualmente o texto oficial.

**Arquivos relevantes:** `scripts/scrape-ons-oficial.ts`, `scripts/fix-and-diff-ons.ts`, `scripts/apply-ons-update.ts`, `lib/agu-modules/orientacoes-normativas.ts`, `app/(acervo)/base-conhecimento/[categoria]/page.tsx`, banco (tabela `Document` filtrada por `category='orientacao-normativa'`).

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

### T7. Sistema de Certificações Digitais ✅ CONCLUÍDO (2026-05-07)
**Prioridade:** Média
**Status:** Entregue em 2026-05-07 (commit `4feed2d`).

**Implementado:**
- ✅ Schema `Certificate` com auditoria (issuedById, issueReason, revokedAt, revokedById, revokeReason, viewCount, lastViewAt) + relation User
- ✅ Geração de número único `BARRAL-{ANO}-{SEQ}` (sequencial por ano)
- ✅ PDF jsPDF com paleta navy + QR code (`generateCertificatePDF` em `lib/pdf-generator.ts`)
- ✅ Verificação de elegibilidade (100% lições + 100% quizzes aprovados)
- ✅ Emissão automática via `checkAndIssueCertificate`
- ✅ **Emissão manual admin** (`POST /api/admin/certificates`) com motivo registrado
- ✅ **Revogação** (`PATCH .../revoke`) com soft delete preservando histórico + email automático ao aluno
- ✅ **Restauração** (`PATCH .../restore`) para corrigir revogação por engano
- ✅ Email de notificação (`sendCertificateNotification`) + email de revogação (`sendCertificateRevocation`)
- ✅ Push notification ao emitir
- ✅ Galeria do aluno `/area-restrita/meus-certificados` (download PDF, share LinkedIn, banner revogado)
- ✅ Página por curso `/area-restrita/curso/[slug]/certificado`
- ✅ Admin `/admin/lms/certificates` com filtros (Todos/Válidos/Revogados/Manuais), modal de emissão manual (busca aluno + select curso + motivo), modal de revogação, badges (Manual/Revogado/ViewCount)
- ✅ Endpoints auxiliares: `GET /api/admin/users/search`, `GET /api/admin/courses-list`
- ✅ **Página pública premium** `/certificado/[numero]` com hero gradient navy, QR code visível, status banner (verde/vermelho), CTAs download+LinkedIn, footer marketing
- ✅ **Open Graph image dinâmica** `/api/og/certificate/[numero]` via `@vercel/og` (1200×630, paleta navy)
- ✅ ViewCount tracking SSR (fire-and-forget)
- ✅ Compartilhamento LinkedIn via deep link CERTIFICATION_NAME

**Não implementado (decisão consciente):**
- ~~CertificateTemplate (templates por curso)~~ — adiado; layout único atende; pode ser priorizado quando houver pluralidade de cursos com identidade visual distinta.
- ~~Critério "80% dos documentos"~~ — mantido o critério rigoroso 100% lições + 100% quizzes (mais sólido juridicamente).
- ~~Expiração / blockchain / hash anti-fraude~~ — fora de escopo.

**Arquivos relevantes:** `prisma/schema.prisma` (model Certificate), `lib/certificate.ts`, `lib/pdf-generator.ts`, `lib/email.ts` (sendCertificateNotification + sendCertificateRevocation), `app/admin/lms/certificates/`, `app/area-restrita/meus-certificados/page.tsx`, `app/certificado/[numero]/`, `app/api/admin/certificates/`, `app/api/og/certificate/[numero]/route.tsx`

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

### T15. Performance — Fase 4 (Lighthouse home) [Baixa]
**Prioridade:** Baixa — descoberto em auditoria Lighthouse de 2026-05-09 durante prep do app mobile (T10).

**Contexto:** Lighthouse na home pública mediu Performance 58/100 (LCP 9,6 s). Auditoria revelou que parte do score baixo veio de **falsos positivos** do Lighthouse (savings teóricos exagerados em "redirects" — real é 663 ms) e **antivírus Kaspersky local** injetando 416 KB de scripts no test rig. Compressão Brotli já está ativa. GTM já é lazy via `requestIdleCallback`. PWA score: **100**.

**Quick win aplicado em 2026-05-09:** removido `subsets: ["latin-ext"]` das fontes Source Serif 4 e Inter em `app/layout.tsx`. `latin` já cobre acentos do português; `latin-ext` adiciona apenas caracteres centro-europeus não usados. Estimado ~130 KB de fontes economizados.

**Aplicado em 2026-05-09 (commit `79b4d0f`):**
- [x] Code splitting do `lei-14133-artigos.ts` (~329 KB): novo hook `useLeiArticles` com cache singleton, dynamic import como fallback. 9 callsites migrados. Resultado: `/artigos` 482 → 400 KB, `/glossario` 514 → 432 KB. Bundle compartilhado mantido em 184 KB.

**Pendente (custo alto, ganho modesto):**
- [ ] Investigar 76 KB de "Minify JavaScript" — Vercel deveria minificar automaticamente; pode ser falso positivo ou third-party não minificado (ex: GTM)
- [ ] Avaliar tornar JetBrains Mono lazy (usado em 25+ componentes, risco de regressão visual)
- [ ] Re-rodar Lighthouse em ambiente sem Kaspersky para baseline limpo
- [ ] Investigar restante de 280 KB de "Reduce unused JavaScript": após o code split do lei-14133-artigos, sobram ~200 KB ainda — provavelmente Stripe SDK, jspdf carregando antes do click, etc.

**Por que baixa prioridade:** A home pública é landing page. Aluno logado entra direto na área restrita, que já tem dynamic imports (T11) e bundle menor. O ganho percebido pelo público pagante é pequeno comparado ao custo.

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
