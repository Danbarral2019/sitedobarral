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

*Última atualização: 2026-02-22*
