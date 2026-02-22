# Tarefas Futuras

Registro de tarefas pendentes para execução futura.

---

## 1. Correção das Extrações de Atos Normativos (TCU e MPF)

**Status:** Pendente
**Prioridade:** Alta
**Data de registro:** 2026-02-22

As extrações dos atos normativos do TCU e MPF estão com falhas significativas e conteúdo incompleto. Necessário:

- Auditar os scrapers/importadores de atos normativos do TCU
- Auditar os scrapers/importadores de atos normativos do MPF
- Identificar dados faltantes ou corrompidos
- Corrigir a lógica de extração para capturar conteúdo completo
- Re-executar importação após correções
- Validar integridade dos dados importados

**Arquivos relevantes:** `lib/tribunal-scrapers/`, `scripts/`, `lib/agu-modules/`

---

## 2. Estudo de Viabilidade — App Mobile (Android e iPhone)

**Status:** Pendente
**Prioridade:** Média
**Data de registro:** 2026-02-22

Estudar a possibilidade de criar um aplicativo mobile para Android e iPhone. Pontos a avaliar:

- **React Native / Expo:** reutilização do código React existente
- **PWA (Progressive Web App):** menor custo, usa o site atual como base
- **Flutter:** alternativa cross-platform
- Funcionalidades prioritárias para mobile (acesso a documentos, chat IA, notificações push)
- Custos de publicação nas lojas (Google Play, App Store)
- Manutenção de duas plataformas (web + mobile)

---

## 3. Verificar Redação Atualizada da ON 45

**Status:** Pendente
**Prioridade:** Média
**Data de registro:** 2026-02-22

Verificar se a Orientação Normativa nº 45 da AGU está com a redação atualizada no sistema. Pontos:

- Comparar conteúdo armazenado no banco com a versão oficial vigente
- Verificar se houve alterações recentes na ON 45
- Atualizar conteúdo se necessário
- Verificar se o versionamento registrou as mudanças corretamente

**Arquivos relevantes:** `lib/agu-modules/`, dados na tabela `Document`

---

## 4. Verificar Indexação Completa dos Atos Normativos Novos para Busca com IA

**Status:** Pendente
**Prioridade:** Alta
**Data de registro:** 2026-02-22

Verificar se todos os atos normativos recém-adicionados estão completamente indexados no pgvector para funcionamento correto da busca semântica com IA. Pontos:

- Executar `npx tsx scripts/index-legislative-acts.ts --dry-run` para verificar status
- Executar `npx tsx scripts/migrate-to-embeddings.ts --dry-run` para verificar documentos pendentes
- Identificar atos não indexados ou com chunks faltantes
- Re-indexar se necessário (com flag `--force` para atos problemáticos)
- Testar busca semântica com queries relacionadas aos novos atos

**Arquivos relevantes:** `lib/embeddings/legislative-act-processor.ts`, `lib/embeddings/document-processor.ts`, `scripts/index-legislative-acts.ts`, `scripts/migrate-to-embeddings.ts`

---

## 5. Contador de Legislação no Admin Não Atualiza

**Status:** Pendente
**Prioridade:** Alta
**Data de registro:** 2026-02-22

A aba de legislação na página admin continua exibindo o valor histórico de 105 normas, sem refletir as novas adições feitas pelo Claude. Necessário:

- Investigar como o contador de atos legislativos é calculado na página admin
- Verificar se há valor hardcoded ou cache desatualizado
- Corrigir para que o contador reflita a contagem real do banco de dados (tabela `LegislativeAct`)
- Testar que novas adições são refletidas imediatamente no painel

**Arquivos relevantes:** `app/admin/`, `app/api/admin/`, componentes do dashboard admin

---

## 6. Simplificação do Painel Admin — Consolidar Abas Semelhantes

**Status:** Pendente
**Prioridade:** Média
**Data de registro:** 2026-02-22

O painel admin possui atualmente **~20 abas** no menu lateral (organizadas em 8 categorias), muitas com funcionalidades sobrepostas. Objetivo: reduzir o número de abas reunindo tarefas semelhantes, melhorando a navegação e a experiência do administrador.

### Situação Atual (por categoria no menu)

| Categoria | Abas Atuais | Qtd |
|---|---|---|
| **Gestão** | QR Codes, Contatos, Depoimentos, Newsletter | 4 |
| **Conteúdo** | Blog, Publicações, Glossário, Vídeos YouTube, Sites Recomendados, Redes Sociais | 6 |
| **Documentos** | Central de Documentos, Gerenciar Documentos | 2 |
| **Legislação** | Legislação | 1 |
| **Jurisprudência** | TCU Manager, AGU Manager, Tribunal Decisions, Destaques TCU, Destaques TCE, DOU Filtros | 6 |
| **Analytics** | Analytics Geral, Catalogação (Analytics Docs), Analytics de Busca | 3 |
| **LMS** | Cursos (+ sub-rotas) | 1 |

### Consolidações Propostas

#### A) Jurisprudência: 6 abas → 3 abas

1. **Destaques TCU + Destaques TCE → "Destaques Jurisprudência"**
   - Mesma funcionalidade (curadoria de decisões para blog), diferença é apenas o tribunal
   - Implementar como aba única com filtro/toggle TCU vs TCE (ou sub-abas internas)
   - Ambas já têm a mesma estrutura: status (pending/dismissed/will-write/written), keyword score, AI worthiness

2. **TCU Manager + AGU Manager → "Importação de Atos"**
   - Ambos são interfaces de importação/scraping de documentos jurídicos
   - Unificar em painel com sub-abas ou accordion: TCU (upload Excel), AGU (ONs, Súmulas, Pareceres, DECOR)
   - Manter funcionalidades específicas de cada um dentro da mesma página

3. **Tribunal Decisions + DOU Filtros → "Monitoramento Jurídico"**
   - Tribunal Decisions: lista decisões de TCEs/STJ/STF
   - DOU Filtros: classifica publicações do Diário Oficial
   - Ambos são "monitoramento" de fontes jurídicas externas
   - Alternativa: manter DOU Filtros separado se a complexidade justificar

#### B) Analytics: 3 abas → 1 aba com sub-seções

4. **Analytics Geral + Analytics de Busca + Catalogação → "Analytics"**
   - Página única com sub-abas internas (tabs horizontais):
     - "Visão Geral" (stats gerais, usuários, acessos)
     - "Busca" (queries, comportamento de pesquisa)
     - "Catalogação" (referências Lei 14.133, cobertura de artigos)
   - Todas são visualização de dados/métricas, sem ações destrutivas

#### C) Documentos: 2 abas → 1 aba

5. **Central de Documentos + Gerenciar Documentos → "Documentos"**
   - Central é o hub de upload; Gerenciar é CRUD completo + bulk operations
   - Unificar: seção de upload no topo + listagem/gerenciamento abaixo
   - Ou manter como sub-abas: "Upload" e "Gerenciar"

#### D) Conteúdo: 6 abas → 3-4 abas

6. **Blog + Redes Sociais → "Blog & Social"**
   - Redes Sociais gera posts a partir de artigos do blog
   - Faz sentido estar junto: escrever artigo → gerar post social no mesmo fluxo

7. **Vídeos YouTube + Sites Recomendados → "Recursos Externos"**
   - Ambos são links para recursos externos (vídeos e sites)
   - Mesma lógica: título, URL, associação a curso, ativo/inativo

8. **Glossário e Publicações** — manter separados (naturezas distintas)

### Resultado Esperado

| Antes | Depois | Economia |
|---|---|---|
| ~20 abas | ~12 abas | -8 abas (~40%) |
| 6 categorias com sub-itens | Menu mais limpo | Navegação simplificada |

### Implementação Sugerida

- Usar **tabs horizontais** (Radix UI `Tabs`) dentro das páginas consolidadas para separar sub-seções
- Manter URLs individuais via query params (`?tab=tcu` / `?tab=tce`) para deep linking
- Atualizar badges de notificação para refletir contagens agregadas
- Manter dynamic imports para performance (carregar sub-seções sob demanda)

### Riscos e Cuidados

- Páginas consolidadas podem ficar pesadas → usar lazy loading por sub-aba
- Testar que badges continuam funcionando corretamente
- Manter retrocompatibilidade de URLs (redirects das URLs antigas)
- Considerar feedback do usuário antes de consolidar (o admin pode preferir separado)

**Arquivos relevantes:** `components/AdminLayout.tsx` (menu lateral), todas as páginas em `app/admin/`

---

*Última atualização: 2026-02-22*
