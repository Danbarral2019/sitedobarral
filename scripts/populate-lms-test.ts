/**
 * Script para popular o LMS com conteúdo de teste
 *
 * Cria módulos e lições de teste para o curso "Nova Lei de Licitações"
 * com conteúdo didático real vinculado a documentos e vídeos existentes.
 *
 * Todos os itens são marcados com "(teste)" para fácil identificação.
 *
 * Uso:
 *   npx tsx scripts/populate-lms-test.ts
 *   npx tsx scripts/populate-lms-test.ts --dry-run
 *   npx tsx scripts/populate-lms-test.ts --cleanup   # Remove dados de teste
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const isCleanup = process.argv.includes('--cleanup');

const COURSE_ID = '1'; // Nova Lei de Licitações

// ============================================================================
// ESTRUTURA DOS MÓDULOS E LIÇÕES
// ============================================================================

const TEST_MODULES = [
  {
    title: '(teste) Módulo 1 — Introdução à Lei 14.133/2021',
    description: 'Visão geral da Nova Lei de Licitações: contexto histórico, princípios, estrutura e principais mudanças em relação à Lei 8.666/93.',
    displayOrder: 0,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 1.1 — Contexto Histórico e Objetivos da Nova Lei',
        slug: 'teste-contexto-historico',
        description: 'Por que a Lei 14.133/2021 foi criada e quais problemas ela pretende resolver.',
        estimatedMinutes: 25,
        leiArticles: ['1', '2', '3', '4', '5'],
        isPublished: true,
        content: `# Contexto Histórico da Lei 14.133/2021

## Introdução

A Lei nº 14.133, de 1º de abril de 2021, conhecida como **Nova Lei de Licitações e Contratos Administrativos**, representa a mais significativa reforma do arcabouço jurídico das contratações públicas no Brasil desde a promulgação da Lei 8.666/93.

## O Problema

O regime anterior era composto por **três normas principais** que conviviam de forma fragmentada:

1. **Lei 8.666/93** — Lei Geral de Licitações
2. **Lei 10.520/02** — Lei do Pregão
3. **Lei 12.462/11** — Regime Diferenciado de Contratações (RDC)

Essa fragmentação gerava insegurança jurídica, interpretações conflitantes e dificuldade de atualização.

## Objetivos da Nova Lei

A Lei 14.133/2021 buscou:

- **Unificar** o regime jurídico das licitações e contratos
- **Modernizar** os procedimentos com foco em eficiência e tecnologia
- **Fortalecer** o planejamento das contratações
- **Ampliar** a transparência e o controle social
- **Incorporar** a jurisprudência consolidada do TCU e da AGU

## Estrutura da Lei

A lei está organizada em **5 Títulos** e **194 artigos**:

| Título | Assunto | Artigos |
|--------|---------|---------|
| I | Disposições Preliminares | 1 a 4 |
| II | Das Licitações | 5 a 75 |
| III | Dos Contratos | 76 a 154 |
| IV | Irregularidades | 155 a 173 |
| V | Disposições Gerais | 174 a 194 |

## Transição

O art. 191 estabeleceu um período de transição de **2 anos** (prorrogado até 30/12/2023) durante o qual os órgãos podiam optar pelo regime da Lei 8.666/93 ou da Lei 14.133/2021. Desde 30/12/2023, a Nova Lei é de **aplicação obrigatória**.

> **Ponto-chave:** A transição foi um dos aspectos mais complexos, gerando dúvidas sobre contratos celebrados sob a lei anterior. O TCU e a AGU emitiram diversas orientações sobre o tema.

## Para reflexão

- Quais os principais problemas que você enfrentava com a Lei 8.666/93?
- Como a unificação do regime pode melhorar o seu dia a dia?`,
        // Vínculo com docs existentes
        docIds: [
          '487c1978-93a', // Quadro Comparativo: Lei 8.666/93 x Lei 14.133/2021
          '8b654655-615', // Slides - Aula 1: Visão Geral da Nova Lei
        ],
        // Vínculo com vídeo existente
        videoId: '4ecfa823-1329-46bd-a07f-63b1182981c2', // Introdução à Lei 14.133/2021
      },
      {
        title: '(teste) Aula 1.2 — Princípios e Definições Legais',
        slug: 'teste-principios-definicoes',
        description: 'Os princípios norteadores das licitações (Art. 5º) e as definições legais essenciais (Art. 6º).',
        estimatedMinutes: 30,
        leiArticles: ['5', '6'],
        isPublished: true,
        content: `# Princípios e Definições Legais

## Os Princípios (Art. 5º)

O art. 5º da Lei 14.133/2021 enumera os princípios que regem as licitações e contratações:

### Princípios Clássicos
- **Legalidade** — toda contratação deve ter base legal
- **Impessoalidade** — vedação de favorecimentos
- **Moralidade** — conduta ética dos agentes
- **Publicidade** — transparência dos atos
- **Eficiência** — melhor resultado com menor custo

### Princípios Específicos
- **Interesse público** — finalidade pública como norte
- **Probidade administrativa** — honestidade na gestão
- **Igualdade** — tratamento isonômico aos licitantes
- **Planejamento** — *novidade* com destaque na nova lei
- **Transparência** — ampla divulgação dos atos
- **Segregação de funções** — *novidade* — proibição de acúmulo
- **Motivação** — justificativa dos atos decisórios
- **Vinculação ao edital** — o edital é a lei da licitação
- **Julgamento objetivo** — critérios claros e previamente definidos
- **Segurança jurídica** — proteção da confiança legítima
- **Razoabilidade e proporcionalidade**
- **Competitividade** — busca do maior número de participantes
- **Desenvolvimento nacional sustentável** — critério de sustentabilidade

## Definições Legais (Art. 6º)

O art. 6º traz **56 definições** essenciais. Destacam-se:

| Inciso | Termo | Definição simplificada |
|--------|-------|----------------------|
| I | Obra | Toda construção, reforma ou ampliação |
| II | Serviço | Toda atividade com valor econômico |
| III | Serviço de engenharia | Serviço que demanda profissional de engenharia |
| XLI | Estudo Técnico Preliminar (ETP) | Documento que evidencia a necessidade da contratação |
| XLIII | Termo de Referência | Documento para contratação de bens e serviços |
| L | Segregação de funções | Vedação de acúmulo de funções |

> **Dica:** O Art. 6º é o artigo mais consultado da lei. Memorize os incisos mais utilizados no seu dia a dia.

## Exercício

Compare os princípios da Lei 14.133/2021 com os da Lei 8.666/93 (art. 3º). Quais são genuinamente novos?`,
        docIds: [
          '5580f05b-aad', // Apostila - Módulo 1
        ],
        videoId: null,
      },
      {
        title: '(teste) Aula 1.3 — Agentes da Contratação e Segregação de Funções',
        slug: 'teste-agentes-contratacao',
        description: 'Quem são os responsáveis pela contratação pública e como funciona a segregação de funções.',
        estimatedMinutes: 20,
        leiArticles: ['6', '7', '8', '9', '10', '11'],
        isPublished: true,
        content: `# Agentes da Contratação e Segregação de Funções

## Os Agentes Públicos na Nova Lei

A Lei 14.133/2021 trouxe uma **sistematização inédita** dos papéis dos agentes envolvidos no processo de contratação.

## Agente de Contratação (Art. 8º)

O **agente de contratação** é o servidor designado pela autoridade competente para:
- Conduzir o processo licitatório
- Tomar decisões durante a licitação
- Impulsionar o procedimento

### Requisitos:
- Servidor efetivo ou empregado público
- Preferencialmente do quadro permanente
- Com atribuições relacionadas a licitações

> **Atenção:** O agente de contratação **substituiu** a figura do pregoeiro em grande parte das situações.

## Comissão de Contratação (Art. 8º, §2º)

Para licitações que envolvam **bens ou serviços especiais**, a autoridade pode designar uma **comissão de contratação** (mínimo 3 membros).

Obrigatória nos casos de:
- Diálogo competitivo
- Concurso
- Quando justificada a necessidade

## Equipe de Apoio

A equipe de apoio auxilia o agente de contratação, podendo ser composta por:
- Servidores do órgão
- Profissionais de áreas técnicas específicas

## Segregação de Funções (Art. 7º, §1º)

A **segregação de funções** é um dos princípios mais relevantes da nova lei:

> *"A autoridade referida no caput deste artigo deverá observar o princípio da segregação de funções, vedada a designação do mesmo agente público para atuação simultânea em funções mais suscetíveis a riscos."*

Na prática, isso significa:
- ❌ O mesmo servidor **não pode** elaborar o TR e ser agente de contratação
- ❌ Quem fiscaliza **não pode** ser o mesmo que atesta
- ❌ Quem planeja **não pode** julgar

### Exceções
O §3º do art. 7º prevê exceção para **pequenos municípios** (até 20 mil habitantes), onde a segregação pode ser flexibilizada mediante justificativa.

## Quadro Resumo

| Agente | Base Legal | Função Principal |
|--------|-----------|-----------------|
| Autoridade competente | Art. 7º | Designar, autorizar, adjudicar |
| Agente de contratação | Art. 8º | Conduzir o processo |
| Comissão de contratação | Art. 8º, §2º | Bens/serviços especiais |
| Equipe de apoio | Art. 8º, §3º | Auxiliar o agente |
| Fiscal do contrato | Art. 117 | Acompanhar execução |
| Gestor do contrato | Art. 117 | Coordenar a gestão |`,
        docIds: [],
        videoId: null,
      },
    ],
  },
  {
    title: '(teste) Módulo 2 — Fase Preparatória da Licitação',
    description: 'Planejamento da contratação: ETP, Termo de Referência, pesquisa de preços, gestão de riscos e a importância do planejamento na Nova Lei.',
    displayOrder: 1,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 2.1 — Estudo Técnico Preliminar (ETP)',
        slug: 'teste-etp',
        description: 'Como elaborar o ETP conforme o Art. 18 da Lei 14.133/2021.',
        estimatedMinutes: 35,
        leiArticles: ['18', '6'],
        isPublished: true,
        content: `# Estudo Técnico Preliminar (ETP)

## O que é o ETP?

O **Estudo Técnico Preliminar** é o documento constitutivo da primeira etapa do planejamento de uma contratação. Ele demonstra a **viabilidade técnica e econômica** da solução escolhida.

## Base Legal

- **Art. 6º, XX** — Definição
- **Art. 18** — Conteúdo obrigatório
- **IN SEGES/ME nº 58/2022** — Regulamento federal

## Conteúdo do ETP (Art. 18)

O ETP deve conter, quando couber:

### 1. Descrição da necessidade (Art. 18, I)
Qual problema se pretende resolver? A necessidade deve ser **justificada** e vinculada ao planejamento estratégico.

### 2. Requisitos da contratação (Art. 18, IV)
Especificações mínimas, prazos, locais de prestação, garantias, etc.

### 3. Levantamento de mercado (Art. 18, V)
Identificar as soluções existentes no mercado:
- Contratações públicas similares (Painel de Preços, ComprasNet)
- Consulta a fornecedores
- Soluções alternativas

### 4. Estimativa de preços (Art. 18, VI)
Pesquisa de preços conforme metodologia regulamentada.

### 5. Análise de riscos (Art. 18, X)
Identificação dos principais riscos da contratação e medidas de mitigação.

### 6. Declaração de viabilidade (Art. 18, XI)
Conclusão sobre a viabilidade ou não da contratação.

## Modelo Prático

Estrutura sugerida de um ETP:

\`\`\`
1. INFORMAÇÕES BÁSICAS
   - Órgão requisitante
   - Objeto

2. NECESSIDADE DA CONTRATAÇÃO
   - Problema a ser resolvido
   - Alinhamento com PCA

3. ÁREA REQUISITANTE
   - Responsável pela demanda

4. DESCRIÇÃO DOS REQUISITOS
   - Especificações técnicas
   - Prazos e condições

5. LEVANTAMENTO DE MERCADO
   - Soluções identificadas
   - Comparativo

6. ESTIMATIVA DE PREÇOS
   - Metodologia
   - Valores encontrados

7. ANÁLISE DE RISCOS
   - Matriz de riscos

8. DECLARAÇÃO DE VIABILIDADE
   - Conclusão fundamentada
\`\`\`

> **Jurisprudência TCU:** O Tribunal tem reiterado que o ETP não é mera formalidade, mas instrumento essencial de planejamento. A ausência ou deficiência do ETP pode ensejar irregularidade no processo.`,
        docIds: [
          '6acc3c38-f24', // Modelo de Estudo Técnico Preliminar (ETP)
          '6b9256c6-ee4', // Apostila - Módulo 2: Fase Preparatória
        ],
        videoId: null,
      },
      {
        title: '(teste) Aula 2.2 — Termo de Referência e Projeto Básico',
        slug: 'teste-termo-referencia',
        description: 'Diferenças entre TR e Projeto Básico, e como elaborar cada um corretamente.',
        estimatedMinutes: 30,
        leiArticles: ['6', '18', '40'],
        isPublished: true,
        content: `# Termo de Referência e Projeto Básico

## Definições

### Termo de Referência (Art. 6º, XXIII)
Documento para contratação de **bens e serviços** (inclusive de engenharia), contendo os elementos necessários e suficientes para caracterizar o objeto.

### Projeto Básico (Art. 6º, XXV)
Conjunto de elementos necessários para caracterizar **obras e serviços de engenharia**, com nível de precisão adequado.

## Quando usar cada um?

| Documento | Aplicação |
|-----------|-----------|
| Termo de Referência | Bens, serviços comuns, serviços de engenharia |
| Projeto Básico + Executivo | Obras de engenharia |

## Conteúdo do TR (Art. 40)

O Termo de Referência deve conter:

1. **Definição do objeto** — descrição clara e precisa
2. **Fundamentação da contratação** — justificativa da necessidade
3. **Descrição da solução** — o que será contratado
4. **Requisitos** — especificações, prazos, garantias
5. **Modelo de execução** — como o serviço será prestado
6. **Modelo de gestão** — como o contrato será gerenciado
7. **Critérios de medição e pagamento**
8. **Forma de seleção do fornecedor**
9. **Estimativas de preços**
10. **Adequação orçamentária**

## Erros Comuns

- ❌ Copiar TR de outra contratação sem adaptação
- ❌ Especificações vagas ("serviço de boa qualidade")
- ❌ Exigências restritivas sem justificativa
- ❌ Ausência de critérios objetivos de aceitação
- ❌ Não prever a gestão de riscos

## Dicas Práticas

1. **Comece pelo ETP** — o TR é consequência do ETP
2. **Consulte o mercado** — entenda as práticas dos fornecedores
3. **Seja específico** — defina métricas claras de desempenho
4. **Pense na fiscalização** — como será verificado o cumprimento?
5. **Revise juridicamente** — submeta à assessoria jurídica

> **Atenção:** A qualidade do TR é determinante para o sucesso da contratação. Um TR mal elaborado gera licitação problemática e contrato difícil de fiscalizar.`,
        docIds: [
          '5dcc88e7-6f2', // Modelo de Termo de Referência - Serviços Contínuos
        ],
        videoId: null,
      },
    ],
  },
  {
    title: '(teste) Módulo 3 — Modalidades Licitatórias',
    description: 'As modalidades de licitação na Lei 14.133/2021: pregão, concorrência, concurso, leilão e diálogo competitivo.',
    displayOrder: 2,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 3.1 — Visão Geral das Modalidades',
        slug: 'teste-modalidades-visao-geral',
        description: 'Comparação entre as 5 modalidades de licitação e critérios de escolha.',
        estimatedMinutes: 25,
        leiArticles: ['28', '29', '30', '31', '32', '33'],
        isPublished: true,
        content: `# Modalidades Licitatórias na Lei 14.133/2021

## As 5 Modalidades

A Lei 14.133/2021 **reduziu** o número de modalidades de licitação. Foram extintas a **tomada de preços** e o **convite**.

| Modalidade | Base Legal | Utilização |
|-----------|-----------|------------|
| **Pregão** | Art. 28, I | Bens e serviços comuns |
| **Concorrência** | Art. 28, II | Obras, serviços especiais, bens especiais |
| **Concurso** | Art. 28, III | Trabalho técnico, científico ou artístico |
| **Leilão** | Art. 28, IV | Alienação de bens |
| **Diálogo Competitivo** | Art. 28, V | Soluções inovadoras (*novidade!*) |

## Pregão (Art. 29)

O **pregão** é a modalidade mais utilizada e agora é **obrigatório** para bens e serviços comuns.

Características:
- Modo de disputa: aberto, fechado ou combinado
- Critério de julgamento: **menor preço** ou **maior desconto**
- Inversão de fases: habilitação após o julgamento
- Forma: **preferencialmente eletrônica**

## Concorrência (Art. 29, parágrafo único)

A **concorrência** é utilizada para:
- Obras e serviços de engenharia
- Bens e serviços especiais
- Quando não couber pregão

Critérios de julgamento admitidos:
- Menor preço
- Melhor técnica ou conteúdo artístico
- Técnica e preço
- Maior retorno econômico
- Maior desconto

## Diálogo Competitivo (Art. 32)

**Novidade** da Lei 14.133/2021, o diálogo competitivo é usado quando:
- A Administração precisa de **inovação tecnológica ou técnica**
- Não é possível definir previamente a solução
- É necessário **dialogar** com os licitantes para construir a solução

### Fases:
1. Pré-qualificação dos interessados
2. Diálogo com os pré-qualificados
3. Apresentação das propostas finais
4. Julgamento

> **Curiosidade:** O diálogo competitivo foi inspirado no modelo europeu (*competitive dialogue*) e representa uma das maiores inovações da lei.

## Quadro Comparativo: Antes x Depois

| Lei 8.666/93 | Lei 14.133/2021 |
|--------------|----------------|
| Concorrência | Concorrência |
| Tomada de preços | *(extinta)* |
| Convite | *(extinto)* |
| Concurso | Concurso |
| Leilão | Leilão |
| — | Diálogo competitivo |
| Pregão (Lei 10.520) | Pregão |`,
        docIds: [
          'fe900887-8cb', // Apostila - Módulo 3: Modalidades Licitatórias
        ],
        videoId: '6369eee4-6035-4c44-9d2a-8381f4b14c83', // Modalidades de Licitação - Análise Prática
      },
      {
        title: '(teste) Aula 3.2 — Contratação Direta: Dispensa e Inexigibilidade',
        slug: 'teste-contratacao-direta',
        description: 'Hipóteses de dispensa e inexigibilidade de licitação na Lei 14.133/2021.',
        estimatedMinutes: 35,
        leiArticles: ['72', '73', '74', '75'],
        isPublished: true,
        content: `# Contratação Direta: Dispensa e Inexigibilidade

## Conceito

A contratação direta é a **exceção** ao dever de licitar. Ocorre em duas hipóteses:

1. **Dispensa de licitação** (Art. 75) — a licitação é possível, mas a lei permite dispensá-la
2. **Inexigibilidade** (Art. 74) — a licitação é **inviável** (impossível competir)

## Inexigibilidade (Art. 74)

A inexigibilidade ocorre quando há **inviabilidade de competição**, especialmente nos casos de:

### I — Aquisição de materiais/serviços com fornecedor exclusivo
- Vedada a preferência de marca
- Necessário comprovar a exclusividade

### II — Contratação de serviços técnicos especializados (Art. 74, III)
Natureza singular + notória especialização:
- Estudos técnicos
- Pareceres
- Assessorias
- Treinamento de pessoal

### III — Profissional do setor artístico
- Diretamente ou por empresário exclusivo

> **Jurisprudência TCU:** A notória especialização não dispensa a justificativa da singularidade do serviço. Não basta demonstrar que o profissional é renomado; é preciso demonstrar que o serviço específico demanda aquele profissional.

## Dispensa de Licitação (Art. 75)

O art. 75 traz **16 hipóteses** de dispensa. As mais utilizadas:

### Dispensa por valor (Art. 75, I e II)
- **Obras e serviços de engenharia**: até R$ 100.000,00
- **Outros serviços e compras**: até R$ 50.000,00

> Valores atualizados pelo Decreto nº 11.317/2022.

### Emergência (Art. 75, VIII)
- Situação que possa causar prejuízo ou risco à segurança
- Prazo máximo: **1 ano** (improrrogável)
- Vedada a prorrogação do contrato

### Licitação deserta ou fracassada (Art. 75, III)
- Justificativa de que nova licitação é prejudicial
- Mesmas condições do edital (preço no caso de deserta)

## Procedimento de Contratação Direta

A Lei 14.133/2021 **formalizou** o procedimento (Art. 72):

1. Documento de formalização de demanda
2. Estudo Técnico Preliminar (quando aplicável)
3. Estimativa de despesa
4. Parecer jurídico
5. Demonstração da compatibilidade orçamentária
6. **Publicação no PNCP** por 3 dias úteis (compras até R$ 50.000) ou 8 dias úteis

> **Novidade:** A publicação no PNCP permite que qualquer interessado apresente proposta, transformando a dispensa em uma espécie de "mini-licitação".

## Checklist de Conformidade

- [ ] Justificativa da situação enquadrada na lei
- [ ] ETP (quando aplicável)
- [ ] Pesquisa de preços
- [ ] Parecer jurídico
- [ ] Autorização da autoridade competente
- [ ] Publicação no PNCP
- [ ] Ratificação (inexigibilidade)`,
        docIds: [
          'fe5e2781-544', // Checklist de Conformidade - Pregão Eletrônico
        ],
        videoId: '39d34e9e-7467-46f2-9e39-3ab2cd52ea2e', // Contratação Direta: Dispensa e Inexigibilidade
      },
    ],
  },
];

// ============================================================================
// FUNÇÕES
// ============================================================================

async function cleanup() {
  console.log('🗑️  Removendo dados de teste...\n');

  // Find test modules
  const testModules = await prisma.module.findMany({
    where: { courseId: COURSE_ID, title: { contains: '(teste)' } },
    select: { id: true, title: true },
  });

  if (testModules.length === 0) {
    console.log('Nenhum dado de teste encontrado.');
    return;
  }

  console.log(`Encontrados ${testModules.length} módulos de teste:`);
  testModules.forEach(m => console.log(`  - ${m.title}`));

  if (isDryRun) {
    console.log('\n[DRY RUN] Nenhuma alteração feita.');
    return;
  }

  // Cascade delete removes lessons, docs, videos, progress, comments
  const result = await prisma.module.deleteMany({
    where: { courseId: COURSE_ID, title: { contains: '(teste)' } },
  });

  console.log(`\n✅ ${result.count} módulos removidos (com todas as lições e vínculos).`);
}

async function populate() {
  console.log('📚 Populando LMS com dados de teste...\n');
  console.log(`Curso: Nova Lei de Licitações (ID: ${COURSE_ID})`);
  console.log(`Módulos: ${TEST_MODULES.length}`);
  console.log(`Lições: ${TEST_MODULES.reduce((sum, m) => sum + m.lessons.length, 0)}`);
  console.log('');

  // Check for existing test data
  const existing = await prisma.module.count({
    where: { courseId: COURSE_ID, title: { contains: '(teste)' } },
  });

  if (existing > 0) {
    console.log(`⚠️  Já existem ${existing} módulos de teste. Use --cleanup primeiro.`);
    return;
  }

  if (isDryRun) {
    console.log('[DRY RUN] Estrutura que seria criada:\n');
    for (const mod of TEST_MODULES) {
      console.log(`📦 ${mod.title}`);
      for (const lesson of mod.lessons) {
        const docCount = lesson.docIds.length;
        const hasVideo = lesson.videoId ? '🎥' : '';
        console.log(`   📖 ${lesson.title} (${lesson.estimatedMinutes}min, ${docCount} docs ${hasVideo})`);
      }
    }
    console.log('\n[DRY RUN] Nenhuma alteração feita.');
    return;
  }

  let totalLessons = 0;
  let totalDocs = 0;
  let totalVideos = 0;

  for (const mod of TEST_MODULES) {
    // Create module
    const module = await prisma.module.create({
      data: {
        courseId: COURSE_ID,
        title: mod.title,
        description: mod.description,
        displayOrder: mod.displayOrder,
        isPublished: mod.isPublished,
      },
    });
    console.log(`✅ Módulo: ${mod.title}`);

    for (let i = 0; i < mod.lessons.length; i++) {
      const lessonData = mod.lessons[i];

      // Create lesson
      const lesson = await prisma.lesson.create({
        data: {
          moduleId: module.id,
          title: lessonData.title,
          slug: lessonData.slug,
          description: lessonData.description,
          content: lessonData.content,
          displayOrder: i,
          isPublished: lessonData.isPublished,
          estimatedMinutes: lessonData.estimatedMinutes,
          leiArticles: JSON.stringify(lessonData.leiArticles),
        },
      });
      totalLessons++;

      // Link documents
      for (let j = 0; j < lessonData.docIds.length; j++) {
        const docId = lessonData.docIds[j];
        // Verify doc exists (use startsWith for partial IDs)
        const doc = await prisma.document.findFirst({
          where: { id: { startsWith: docId } },
          select: { id: true, title: true },
        });

        if (doc) {
          await prisma.lessonDocument.create({
            data: {
              lessonId: lesson.id,
              documentId: doc.id,
              displayOrder: j,
              isRequired: j === 0, // First doc is required
              note: j === 0 ? 'Leitura obrigatória para esta aula' : undefined,
            },
          });
          totalDocs++;
          console.log(`   📎 Doc: ${doc.title.substring(0, 60)}`);
        } else {
          console.log(`   ⚠️  Doc não encontrado: ${docId}`);
        }
      }

      // Link video
      if (lessonData.videoId) {
        const video = await prisma.courseVideo.findUnique({
          where: { id: lessonData.videoId },
          select: { id: true, title: true, youtubeUrl: true, youtubeId: true },
        });

        if (video) {
          await prisma.lessonVideo.create({
            data: {
              lessonId: lesson.id,
              courseVideoId: video.id,
              title: video.title,
              youtubeUrl: video.youtubeUrl,
              youtubeId: video.youtubeId,
              displayOrder: 0,
              isRequired: true,
            },
          });
          totalVideos++;
          console.log(`   🎥 Vídeo: ${video.title.substring(0, 60)}`);
        } else {
          console.log(`   ⚠️  Vídeo não encontrado: ${lessonData.videoId}`);
        }
      }

      console.log(`   📖 Lição: ${lessonData.title}`);
    }
    console.log('');
  }

  console.log('━'.repeat(60));
  console.log(`\n🎉 LMS populado com sucesso!`);
  console.log(`   Módulos: ${TEST_MODULES.length}`);
  console.log(`   Lições: ${totalLessons}`);
  console.log(`   Documentos vinculados: ${totalDocs}`);
  console.log(`   Vídeos vinculados: ${totalVideos}`);
  console.log(`\n🔗 Acesse: /admin/lms para gerenciar`);
  console.log(`🔗 Acesse: /area-restrita (curso "Nova Lei de Licitações") para visualizar como aluno`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    if (isCleanup) {
      await cleanup();
    } else {
      await populate();
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
