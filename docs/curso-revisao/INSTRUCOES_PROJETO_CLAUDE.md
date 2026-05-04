# Revisão editorial dos cursos — guia operacional

Este documento orienta a criação de **um projeto Claude por curso** no app web (claude.ai → Projects), o uso desses projetos pra revisar o conteúdo atual e o fluxo de trabalho do começo ao fim.

> **Decisão travada (2026-05-04):** o papel do Claude é **revisar e apontar erros**, não reescrever. O autor (Prof. Daniel Barral) decide o que muda e redige.

---

## Visão geral do fluxo

```
[1] Extração         → script export-courses-for-review.ts gera 1 .md por curso
[2] Setup do projeto → 1 projeto Claude por curso, com instruções e knowledge files
[3] Revisão          → Claude lê o conteúdo, lista erros aula a aula com fonte
[4] Decisão editorial → você revisa a lista, decide o que muda, redige
[5] Reaplicação      → editar via /admin/lms ou novo script de import
[6] Republicação     → tirar curso do CourseStatus.isSuspended
```

## Status atual dos cursos (2026-05-04)

| ID | Curso | Conteúdo no DB | Tamanho do extract |
|---|---|---|---|
| 2 | Planejamento das Contratações | ✅ extenso | 497 KB |
| 3 | Gestão e Fiscalização | ✅ extenso | 579 KB |
| 4 | Processo Sancionador | ⚠️ sem lições cadastradas | 1.8 KB (só metadata) |
| 7 | Assessoramento Jurídico | ⚠️ sem lições cadastradas | 1.8 KB (só metadata) |
| 8 | Revisão, Reajuste e Repactuação | ⚠️ sem lições cadastradas | 1.8 KB (só metadata) |
| 10 | **Contratação Direta** (o do erro art. 22 LINDB) | ✅ extenso | 649 KB |

**Os 3 cursos sem conteúdo no DB (4, 7, 8)** apenas existem como metadata em `/data/courses.ts`. Não há lições publicadas — então não há o que revisar. Pra esses, o trabalho é diferente: **criar conteúdo do zero** (assunto pra outra conversa).

A revisão pra valer começa pelos **3 cursos com conteúdo extenso (2, 3, 10)**.

---

## 1) Setup de cada projeto Claude

No app claude.ai, criar **6 projetos** (um por curso). Sugestão de nome: `Revisão · [Nome do Curso]`.

### Knowledge files de cada projeto (upload na aba "Project knowledge")

**Obrigatórios** (em todos os 6 projetos):

1. `<slug>.md` — extração do curso correspondente, gerada por `scripts/export-courses-for-review.ts` em `docs/curso-revisao/`.
2. **Lei 14.133/2021** completa, em texto puro. Baixar do Planalto: `https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/L14133.htm` → salvar como `lei-14133.txt`.
3. **LINDB (Decreto-Lei 4.657/1942)** com texto vigente (especialmente arts. 20-30 que tratam de erro grosseiro, dolo, segurança jurídica). `https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm`.
4. **Decreto 11.246/2022** (regulamenta gestão e fiscalização da Lei 14.133).
5. **Lei Complementar 123/2006** (ME/EPP — relevante em quase todos os cursos).

**Por curso** (knowledge específico):

| Curso | Knowledge adicional |
|---|---|
| Planejamento (2) | IN SEGES/MGI 58/2022 (PCA), IN SEGES 40/2020 (ETP), Lei 14.133 arts. 11-25, jurisprudência TCU sobre planejamento |
| Gestão e Fiscalização (3) | Decreto 11.246/2022 inteiro, IN SEGES 5/2017 (ainda aplicável), Lei 14.133 arts. 117-123 |
| Sancionador (4) | Lei 14.133 arts. 155-163, Decreto 11.430/2023, IN SEGES 73/2022 |
| Assessoramento (7) | Lei Complementar 73/93 (LOAGU), Decreto 7.392/2010, manuais AGU |
| Revisão/Reajuste (8) | Lei 14.133 arts. 134-139, IPCA/INCC referências, Decreto 7.689/2012 |
| Contratação Direta (10) | Lei 14.133 arts. 72-75, IN SEGES 67/2021 (dispensa eletrônica), jurisprudência TCU sobre dispensa |

> **Dica:** o site do Barral já tem a maioria desses atos consolidados em `/atos-normativos`. Pode exportar via SQL ou copiar do banco de conhecimento.

### Project instructions (system prompt) — cole na configuração do projeto

Use o bloco abaixo. Substitua `[NOME DO CURSO]` no início.

```
Você é um revisor jurídico-editorial especialista em licitações e contratos
administrativos no Brasil pós-Lei 14.133/2021. Sua função é revisar criticamente
o conteúdo do curso "[NOME DO CURSO]" do Prof. Daniel Barral e identificar
erros, imprecisões e desatualizações.

CONTEXTO IMPORTANTE
- O conteúdo atual foi gerado em parte por IA sem revisão suficiente. Há erros
  documentados (ex: citação errada de artigo da LINDB sobre erro grosseiro,
  que é o art. 28 e não o 22).
- O destinatário final é aluno pagante de pós-graduação em direito e gestão
  pública. O nível técnico é alto. Erros comprometem a credibilidade do curso.
- Você NÃO reescreve o conteúdo. Você aponta o erro, justifica com fonte
  oficial e sugere a correção mínima. O autor decide o que muda.

PARA CADA AULA DO CURSO
Identifique e categorize problemas em 5 grupos:

1. **ERROS FACTUAIS** — artigos, leis, decretos, datas ou números citados
   incorretamente. Ex: "art. 22 da LINDB" quando o correto é art. 28.

2. **ERROS JURÍDICOS** — interpretação incorreta de dispositivo, tese sem
   amparo legal, raciocínio que viola a Lei 14.133 ou a Constituição.

3. **DESATUALIZAÇÕES** — leis revogadas (ex: citar Lei 8.666 sem ressaltar
   que Lei 14.133 a substituiu), decretos superados, jurisprudência cancelada.

4. **IMPRECISÕES DIDÁTICAS** — exemplos contraditórios, hipóteses irreais,
   confusão entre institutos (ex: dispensa vs. inexigibilidade), uso impreciso
   de termos técnicos.

5. **LACUNAS** — temas obrigatórios pelo escopo da aula que ficaram de fora.
   Ex: aula sobre dispensa que não menciona dispensa eletrônica.

FORMATO DA RESPOSTA
Para cada aula com problemas, devolva:

  ## Aula X.Y — [Título]

  ### [Categoria] — [problema em 1 linha]

  **Trecho problemático** (citação literal):
  > [texto exato do conteúdo]

  **Por que está errado:**
  [explicação técnica direta, sem rodeios]

  **Fonte oficial que prova o erro:**
  - [Lei XYZ/AAAA, art. N — texto do dispositivo]
  - [Acórdão TCU NNNN/AAAA-Plenário — trecho relevante]

  **Sugestão de correção mínima:**
  [a menor mudança redacional que corrige o erro, mantendo o tom autoral]

REGRAS DURAS
- NUNCA invente artigo, decreto, acórdão ou doutrina. Se você não tem certeza
  da fonte, escreva "preciso verificar" e não cite.
- NUNCA reescreva o conteúdo do zero. Cingir-se à correção mínima.
- NUNCA suavize um erro grave. Se a aula afirma algo juridicamente errado,
  diga isso com clareza.
- Se uma aula estiver tecnicamente correta, escreva apenas: "Aula X.Y — sem
  apontamentos materiais". Não invente problemas pra justificar análise.
- Cite SEMPRE a fonte oficial (Planalto, TCU, AGU). Doutrina é secundária.
- Use a Lei 14.133/2021 como referência primária (Lei 8.666 só entra como
  comparativo histórico).

PAPEL ADICIONAL: ESTRUTURADOR DE IMPORT
Quando o autor terminar de redigir a versão final de uma aula (texto que ELE
escreveu, depois das nossas trocas), ajude-o a montar o arquivo no formato
esperado pelo script de import:

  ---
  courseId: "<id do curso>"
  moduleSlug: "<slug-do-modulo>"
  moduleTitle: "<Título do módulo>"
  moduleDescription: "<descrição>"
  moduleDisplayOrder: <int>
  lessonSlug: "<slug-da-aula>"
  title: "<Título da aula>"
  description: "<descrição curta>"
  displayOrder: <int>
  estimatedMinutes: <int>
  leiArticles: [<números>]
  aiSummary: "<resumo curto>"
  aiKeyPoints:
    - "<ponto 1>"
    - "<ponto 2>"
  isPublished: true
  ---

  # <Título da aula>

  <conteúdo Markdown completo escrito pelo autor>

Você organiza o YAML, escolhe slugs estáveis em kebab-case, sugere
`leiArticles` apropriados pelo conteúdo, propõe `aiSummary` e `aiKeyPoints`
fiéis ao texto. NUNCA escreva o conteúdo principal da aula — você apenas
estrutura o arquivo a partir do que o autor entregou. Se o autor não definiu
uma `aiKeyPoints` ou `aiSummary`, pergunte se ele quer que você proponha.

ABERTURA DE CADA CONVERSA
Comece SEMPRE perguntando: "Quer começar pela primeira aula sem revisão,
focar em uma aula específica, ou estruturar uma versão final pro import?"
```

---

## 2) Workflow recomendado

### Por curso

1. **Crie o projeto** com o nome `Revisão · [Curso]`.
2. **Cole as instruções** acima (substituindo `[NOME DO CURSO]`).
3. **Suba os knowledge files** (ver tabela acima).
4. **Abra uma conversa nova** pra cada **módulo** do curso (não tente revisar o curso inteiro numa conversa só — o contexto satura).
5. Peça: _"Revise as aulas X.1, X.2 e X.3 deste módulo, conforme as instruções do projeto."_
6. Para cada apontamento que você concorda, copie pra um arquivo `<slug>-correcoes-aceitas.md` local.
7. Para cada apontamento que você discorda, conteste no chat. Se Claude defender com fonte sólida, reconsidere. Se a fonte for fraca, descarte.

### Reaplicação no site (script de import)

A reaplicação é via **script** (definida em 2026-05-04 — sem alunos pagantes ainda, sem necessidade de modo draft/snapshot).

**Estrutura esperada de arquivos:**

```
docs/curso-revisao/imports/
  contratacao-direta/
    01-conceito-contratacao-direta.md
    02-dispensa-de-licitacao.md
    03-inexigibilidade.md
    ...
  planejamento-contratacoes/
    01-...
```

Cada arquivo é **uma aula**, com frontmatter YAML + conteúdo Markdown. Veja `docs/curso-revisao/imports/_template/01-exemplo-de-aula.md` e `_template/README.md`.

**Fluxo de aplicação:**

```bash
# 1. Dry-run pra conferir o resumo de mudanças (sem escrever)
npx dotenv -e .env.local -- tsx scripts/import-revised-course.ts contratacao-direta --dryRun

# 2. Aplicar de verdade
npx dotenv -e .env.local -- tsx scripts/import-revised-course.ts contratacao-direta

# 3. Quando o curso inteiro estiver atualizado, republicar
npx dotenv -e .env.local -- tsx scripts/republish-course.ts 10
```

**O que o import atualiza** (decisão de 2026-05-04):
- `Lesson.title`, `description`, `content`
- `Lesson.aiSummary`, `aiKeyPoints` (ou zera se omitidos)
- `Lesson.leiArticles`
- `Module.title`, `description`
- Cria Lesson nova se `lessonSlug` não existir; cria Module novo se `moduleTitle` não bater com nenhum existente
- **NÃO deleta** aulas/módulos antigos automaticamente — pra remover, usar `/admin/lms` ou query SQL direta

**Importante:**
- O import **sobrescreve direto** (sem snapshot, sem draft). Como não temos alunos pagantes, isso é OK. Se mudar de ideia depois, dá pra adicionar `LessonContentSnapshot` à schema.
- Antes de cada onda de import, **commitar os `.md` da pasta de imports** pra ter histórico no git. Sugestão: `git tag pre-import-contratacao-direta` antes de aplicar.

---

## 3) Checklist de QA por aula (uso interno)

Antes de aceitar uma correção sugerida pelo Claude:

- [ ] Conferiu o artigo citado direto no Planalto (link na resposta)
- [ ] Conferiu a vigência (lei não revogada, decreto não superado)
- [ ] Se cita acórdão TCU, conferiu se está vigente em pesquisa.apps.tcu.gov.br
- [ ] A correção mantém o tom autoral, não soa como Claude escrevendo
- [ ] Cross-referenciou com a Lei 14.133 comentada do site (se aplicável)
- [ ] Sem alucinações (artigos inexistentes, decretos imaginários — Claude às vezes mistura números)

---

## 4) Outras orientações práticas

### Sobre o tom autoral

Os cursos do Prof. Barral têm voz didática mas técnica. Cuidado:
- Claude tende a usar bullet excessivo. Se a aula original é em texto corrido, mantenha.
- Claude usa "vamos" e perguntas retóricas. Se não está no estilo do curso, remova.
- Erros antigos da IA podem ter "deformado" o estilo. Use um trecho que você sabe que ESCREVEU pessoalmente como referência de voz.

### Sobre citações

Toda citação no curso deve ter:
1. **Fonte** (lei, acórdão, IN, autor)
2. **Localização** (artigo, item, página)
3. **Vigência** (não revogado, não superado)

Se Claude apontar erro mas a sugestão de correção citar fonte sem localização exata, peça pra ele detalhar antes de aceitar.

### Sobre jurisprudência TCU

O site já indexa acórdãos do TCU em `/admin/jurisprudencia`. Antes de citar um acórdão sugerido pelo Claude, **busque no próprio site** — se não está lá, é candidato a alucinação. Verifique sempre em `pesquisa.apps.tcu.gov.br`.

### Sobre versionamento

Antes de editar conteúdo, **salve um snapshot** da versão atual (Markdown extraído por `export-courses-for-review.ts`). Útil pra:
- Comparar pré e pós-revisão
- Auditar evolução pra alunos antigos
- Detectar regressões se a revisão "quebrar" algo

Sugestão: commitar os `.md` em `docs/curso-revisao/` antes de cada onda de revisão e tagar o commit (`git tag pre-revisao-curso-10`).

### Sobre prioridade

Comece por **Contratação Direta (ID 10)** — você já sabe que tem erro grave (art. 22 vs 28 LINDB). É o piloto: validar o workflow nesse curso primeiro, depois replicar pra Planejamento (2) e Gestão (3).

### Sobre os cursos sem conteúdo (4, 7, 8)

Sancionador, Assessoramento e Revisão/Reajuste estão suspensos mas **não têm conteúdo cadastrado no DB**. Pra criar conteúdo do zero, o fluxo é diferente — é construção, não revisão. Recomendo:
- Postergar a criação até os 3 cursos com conteúdo (2, 3, 10) estarem revisados
- Quando começar, usar projeto Claude diferente com prompt de **redator** (não revisor)
- Validar a estrutura proposta antes de produzir conteúdo em massa

---

## 5) Comandos úteis

```bash
# Regenerar extracts (depois de mudanças no DB):
npx dotenv -e .env.local -- tsx scripts/export-courses-for-review.ts

# Suspender todos os cursos novamente (se algum foi republicado por engano):
npx dotenv -e .env.local -- tsx scripts/suspend-all-courses.ts

# Importar aulas revisadas (dry-run primeiro, depois sem flag):
npx dotenv -e .env.local -- tsx scripts/import-revised-course.ts <courseSlug> --dryRun
npx dotenv -e .env.local -- tsx scripts/import-revised-course.ts <courseSlug>

# Republicar UM curso (tira o banner "Em revisão"):
npx dotenv -e .env.local -- tsx scripts/republish-course.ts <courseId>
```

---

**Este documento vive em `docs/curso-revisao/INSTRUCOES_PROJETO_CLAUDE.md`. Atualize sempre que o workflow evoluir.**
