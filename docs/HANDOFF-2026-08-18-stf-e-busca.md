# Handoff — Conector do STF e saneamento da busca semântica

**Sessão de 16–18/08/2026.** Este documento é versionado de propósito: o ledger de execução fica em `.superpowers/` (gitignored) e não viaja entre máquinas.

**Leia primeiro:** este arquivo. Depois, se precisar do detalhe de desenho, `docs/superpowers/plans/2026-08-16-conector-stf-jurisprudencia.md` (tem uma seção **Errata** no fim registrando os 11 pontos em que o código final divergiu do plano).

---

## 1. Onde tudo parou

### Em produção e funcionando

| | |
|---|---:|
| julgados do STF no catálogo | **600** |
| visíveis na API pública | **254** |
| **amarrações artigo↔julgado visíveis** | **114 de 114** |
| pendentes na fila de revisão do admin | 211 |
| rejeitados automaticamente | 135 |
| `fullIdentifier` únicos | 600 / 600 — nenhuma duplicata |

Suíte: **2.480 → 2.573 testes**. Oito PRs mergeadas (#182 a #188), uma aberta (#189).

### A única PR aberta

**#189** — inclusão incondicional de decisões de tribunal + 10 queries de jurisprudência no golden set. **CI verde em todos os checks.** É o primeiro item ao retomar: só falta mergear.

---

## 2. O achado central (não re-descobrir)

O host `jurisprudencia.stf.jus.br` está atrás de um **AWS WAF**. Medido na mesma máquina, no mesmo minuto:

| cliente | resposta |
|---|---|
| requisição server-side (`curl`/`fetch`) | 202, corpo vazio, `x-amzn-waf-action: challenge` |
| Chromium **headless** | **403** |
| Chromium **headed** (janela visível) | **200** ✅ |

**É detecção de headless.** Não é bloqueio de IP de datacenter — essa hipótese foi levantada a partir do 403 do GitHub Actions e se provou **errada**. Também não é o desafio JavaScript em si: o navegador o vence.

**Consequência:** a coleta é **mensal e manual**, na máquina do Daniel:

```bash
npm run stf:coletar    # abre uma janela de Chromium por ~30s
```

Há lembrete no Google Calendar todo dia 1º às 9h, com instruções de diagnóstico na descrição do evento. O workflow em `.github/workflows/stf-jurisprudencia.yml` está **morto de propósito**, mantido como registro, com `xvfb-run` + headed anotado como **hipótese não testada** para quem quiser retomar a automação.

Outros bloqueios verificados: `redir.stf.jus.br` (PDF do inteiro teor) idem; `portal.stf.jus.br` responde 200 mas só tem casca institucional; LexML está atrás de verificação do Senado.

---

## 3. O ganho que justifica o conector

O campo `documental_legislacao_citada_texto` do índice do STF traz a legislação citada **estruturada** (`LEG-FED LEI-014133 ANO-2021 / ART-00075`). Isso dá amarração artigo↔julgado **determinística, sem LLM e sem heurística de proximidade** — o oposto do que custou construir no motor do TCU.

Por isso `leiArticlesArr` do STF vem **exclusivamente** desse campo, nunca de `classification.leiArticles` (que capturaria "art. 37 da Constituição" como artigo da 14.133). Há teste travando a troca.

**Decisão de produto do Daniel:** julgado com `artigos14133.length > 0` é **auto-aprovado**, independentemente do escore de palavra-chave — a legislação citada pelo STF é fonte autoritativa, o escore é aproximação. Sem essa regra, 44 das 114 amarrações nasceriam invisíveis.

---

## 4. Saneamento da busca (achado colateral, maior que o conector)

**Não havia cron de indexação.** `process-index-jobs` fora pausado em `f1c29f0b` (maio/2026) com o critério *"reativar quando surgir cliente que enfileira IndexJob"* — mas a rota **depois** ganhou o trabalho de drenar `Document` e `TribunalDecision` pendentes, que não passa por `IndexJob`. O gatilho ficou apontando para a responsabilidade errada e nunca dispararia.

> **Lição geral:** critério de reativação tem que apontar para a **responsabilidade**, não para a implementação da época.

Consequências corrigidas:

- **734 decisões** (480 de TCU/TCE-PE/TST/TCE-SC + 254 do STF) estavam aprovadas e **visíveis na listagem, invisíveis na busca semântica**. Indexadas.
- **5.069 acórdãos do TCU** com sumário real ficavam fora de qualquer busca, porque `backfill-retroativo` os criava com `embeddingStatus: 'skipped'`. Corrigido após medição (PR #186).
- 26 documentos em `failed` e 5 presos em `processing` desde julho. Destravados: **14 recuperados**; os 16 nós sem texto foram para `skipped` (estado honesto); sobrou **1 PDF** que falha de verdade na extração.
- 121 registros com `tribunalCode: 'tcu'` minúsculo. O sintoma já fora tratado **duas vezes** (script de migração + `UPPER()` em `vector-search.ts`) sem corrigir a **escrita**. PR #185 corrige o ponto de escrita e acrescenta **teste de arquitetura** varrendo `app/`+`lib/`+`scripts/`.

---

## 5. Medições de retrieval — guardar, custaram tempo

**Baseline (93 queries originais):** recall@5 **62,8%** · recall@10 75,8% · MRR 0,830.

Com o golden set ampliado para **103 queries** (10 de jurisprudência anotadas), recall@5:

| alternativa | 93 antigas | 10 novas | 103 total |
|---|---:|---:|---:|
| condicional por padrão de tribunal | 60,9% | **0,0%** | 51,5% |
| **incondicional** *(escolhida, #189)* | 57,1% | **70,0%** | **59,1%** |
| incondicional + boost STF 1.2 | **4,2%** 💥 | 86,7% | 16,9% |

No **caminho real de produção** (que também aplica `excludeInactiveSumulas` e boost trabalhista quando cabe): **51,5% → 56,4%**.

**Três armadilhas registradas:**

1. **O condicional disparava em 1 de 10 perguntas.** Gente pergunta pelo *assunto* ("credenciamento substitui licitação?"), não pelo nome do tribunal.
2. **O boost por tribunal é uma armadilha.** Melhor para o STF, catastrófico no conjunto — multiplica a similaridade em qualquer pergunta.
3. **A decisão de 17/08 foi tomada com balança de um prato só.** O "custa 5,1 pp" media só perguntas onde decisão de tribunal nunca é resposta certa. Custo real: 3,8 pp; ganho: 70 pp.

⚠️ **As 10 anotações são derivadas de metadados, não conferidas por humano** (`annotatedBy: claude-derivado-de-metadados-stf`). Puxam o resultado com força — a conferência do Daniel muda o peso delas.

⚠️ **O adapter do eval não espelha produção:** `baselineSearch` não aplica `detectQueryDomain`, então `npm run eval:run` mede um pipeline diferente do site. Dívida registrada, não corrigida.

---

## 6. Pendências, em ordem

### Primeiro ao retomar

1. **Mergear a #189** — CI verde, só falta o comando.

### Decisões do Daniel (sem urgência técnica)

2. **211 julgados do STF pendentes de revisão** no admin. Revisar aos poucos, afrouxar o critério, ou aceitar que fiquem invisíveis. As amarrações já estão todas visíveis.
3. **Conferir as 10 anotações do golden set** — muda a confiança de toda decisão futura de retrieval.
4. **Folha de calibração das teses do TCU** (84 casos, PR #179) — pendente desde 11/08.
5. `CLIPPING_TRIBUNAIS_ENABLED` na Vercel — pendente desde maio.

### Dívidas técnicas registradas

6. **`area-restrita/search-all` não filtra matrícula** — zero referências a `enrollment`. A exclusão da categoria do grafo é a única defesa ali. Não vaza hoje porque o material indexado é público, mas é rota sem defesa em profundidade.
7. **Incoerência entre buscas:** os nós do grafo aparecem na busca semântica e somem na busca por palavra-chave. Proposta de incluí-los nas rotas de keyword foi **descartada — seria regressão de segurança**, pelo item 6.
8. **1 PDF em `failed`** que não se deixa extrair (tem `r2Key` e descrição de 783 chars).
9. **346 julgados do STF ficam em `embeddingStatus: 'pending'` para sempre** — o cron só indexa aprovados. Coerente, mas um alarme sobre esse campo acusaria isso permanentemente.

---

## 7. Regras aprendidas nesta sessão

**`npm run build` antes de abrir PR quando o trabalho toca `app/api/`.** Nove revisões de código, um review final no modelo mais capaz, `tsc --noEmit` limpo e 2.562 testes verdes **não pegaram** um `export const` inválido numa rota. O App Router só aceita handlers e um conjunto fechado de configs, e a violação só aparece na checagem de tipos que o `next build` gera. O merge teria quebrado o deploy de produção.

**Medir contra o dado real acha o que teste unitário não acha.** Quatro defeitos do plano só apareceram rodando o pipeline sobre os 2.516 documentos. O mais didático: `ementaTruncada` errava em **137 de 154** casos e **o teste passava**, porque a fixture era `'x'.repeat(6000)` — string sem espaço, imune ao colapso de whitespace que quebrava o dado real.

**Teste que verifica menção não guarda nada.** O guard de invisibilidade do grafo checava se a string `acordao-grafo` aparecia no arquivo — passaria com o filtro invertido. Foi reescrito para verificar o **mecanismo** (`not: CATEGORIA_GRAFO` como cláusula Prisma).

**`classifyDecision(decision, useAI = false)` — a classificação nunca chama LLM.** O plano superestimava o custo do backfill em uma ordem de grandeza.

**`workflow_dispatch` do GitHub só funciona com o arquivo já na branch padrão** — não há como testar workflow novo antes do merge.

**O `CRON_SECRET` do `.env.local` estava defasado** (64 chars; produção tem 44) e dava 401 até em cron antigo. Corrigido via `npx vercel env pull`. **Conferir isso primeiro** se script local autenticado falhar.

---

## 8. Como retomar

```bash
git pull

# estado do STF em produção
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; \
  const t = await prisma.tribunalDecision.count({where:{tribunalCode:'STF'}}); \
  console.log('STF:', t); await prisma.\$disconnect();"

# saúde da coleta mensal
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; \
  const l = await prisma.scraperHealthLog.findMany({where:{scraperCode:'stf-runner'}, \
  orderBy:{runAt:'desc'},take:3}); console.log(l); await prisma.\$disconnect();"
```

O `.env.local` não está no git. Máquina nova precisa dele com `DATABASE_URL`, `CRON_SECRET`, `GEMINI_API_KEY` e `ANTHROPIC_API_KEY` — e o `CRON_SECRET` deve vir de `npx vercel env pull`, não de cópia antiga.

O corpus do STF usado no backfill está em `D:\OneDrive\XX - Arquivos\Documentos\STF_licitacoes\stf_lei14133_dados_2026-08-16.json`, junto com a compilação em DOCX gerada nesta sessão.
