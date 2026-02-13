/**
 * Script para popular o LMS com conteúdo de teste — Curso 2: Planejamento das Contratações
 *
 * Cria módulos e lições de teste sobre planejamento de contratações
 * com conteúdo didático real vinculado a artigos da Lei 14.133/2021.
 *
 * Todos os itens são marcados com "(teste)" para fácil identificação.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/populate-lms-test-curso2.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/populate-lms-test-curso2.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/populate-lms-test-curso2.ts --cleanup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const isCleanup = process.argv.includes('--cleanup');

const COURSE_ID = '2'; // Planejamento das Contratações

// ============================================================================
// ESTRUTURA DOS MÓDULOS E LIÇÕES
// ============================================================================

const TEST_MODULES = [
  {
    title: '(teste) Módulo 1 — Estudos Técnicos Preliminares (ETP)',
    description: 'Elaboração do ETP conforme a Lei 14.133/2021 e a IN SEGES/ME nº 58/2022: conceito, conteúdo obrigatório, metodologia e boas práticas.',
    displayOrder: 0,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 1.1 — Conceito e Finalidade do ETP',
        slug: 'teste-etp-conceito',
        description: 'O que é o Estudo Técnico Preliminar e por que ele é a base do planejamento.',
        estimatedMinutes: 25,
        leiArticles: ['18', '6'],
        isPublished: true,
        content: `# Conceito e Finalidade do Estudo Técnico Preliminar

## O que é o ETP?

O **Estudo Técnico Preliminar (ETP)** é o documento constitutivo da primeira etapa do planejamento de uma contratação pública. Conforme o Art. 6º, inciso XX, da Lei 14.133/2021:

> *"Estudo técnico preliminar: documento constitutivo da primeira etapa do planejamento de uma contratação que caracteriza o interesse público envolvido e a sua melhor solução e dá base ao anteprojeto, ao termo de referência ou ao projeto básico a ser elaborado caso se conclua pela viabilidade da contratação."*

## Por que o ETP é tão importante?

Na Lei 14.133/2021, o planejamento ganhou **protagonismo inédito**. O Art. 18 estabelece que a fase preparatória do processo licitatório é **caracterizada pelo planejamento** e deve compatibilizar-se com o Plano de Contratações Anual (PCA).

### Funções do ETP:

1. **Evidenciar a necessidade** — demonstrar que existe um problema real a ser resolvido
2. **Analisar alternativas** — estudar diferentes soluções possíveis
3. **Avaliar viabilidade** — verificar se a contratação é técnica e economicamente viável
4. **Definir requisitos** — estabelecer os parâmetros da futura contratação
5. **Estimar custos** — dar base à estimativa de preços

## ETP vs. Termo de Referência

| Aspecto | ETP | Termo de Referência |
|---------|-----|-------------------|
| Momento | Primeira etapa | Após o ETP |
| Foco | Viabilidade e alternativas | Detalhamento da solução |
| Resultado | Conclusão sobre viabilidade | Especificação do objeto |
| Obrigatório | Sim (regra geral) | Sim (sempre) |

## Quando o ETP é dispensável?

O Art. 18, §2º, permite que o ETP seja dispensado nos casos de:
- Contratações de **baixa complexidade** (a ser definido em regulamento)
- Prorrogações de contratos de prestação de serviços contínuos

> **Atenção:** Mesmo quando dispensável, é recomendável documentar minimamente a análise de necessidade e viabilidade.

## Jurisprudência do TCU

O TCU tem reiteradamente enfatizado a importância do ETP:

- **Acórdão 2.328/2021-Plenário:** A ausência de ETP pode ensejar a nulidade do processo licitatório
- **Acórdão 1.240/2022-Plenário:** O ETP deve demonstrar efetivamente a análise de alternativas, não sendo mera formalidade

## Para reflexão

- Na sua experiência, o ETP tem sido tratado como instrumento de planejamento efetivo ou como mera formalidade?
- Quais os principais desafios na elaboração de um ETP consistente?`,
      },
      {
        title: '(teste) Aula 1.2 — Conteúdo Obrigatório do ETP (Art. 18)',
        slug: 'teste-etp-conteudo',
        description: 'Os elementos que devem compor o ETP segundo o Art. 18 da Lei 14.133/2021.',
        estimatedMinutes: 35,
        leiArticles: ['18', '19', '6'],
        isPublished: true,
        content: `# Conteúdo Obrigatório do ETP

## Base Legal: Art. 18 da Lei 14.133/2021

O Art. 18, §1º, lista os elementos que devem compor o ETP, **quando couber**. Essa expressão indica que nem todos os itens serão necessários em todas as contratações — a análise deve ser proporcional à complexidade do objeto.

## Elementos do ETP

### I — Descrição da necessidade da contratação

É o ponto de partida. Deve responder:
- **Qual problema** será resolvido?
- **Quem** é afetado pela necessidade?
- **O que acontece** se não houver a contratação?

> Exemplo: "A frota de veículos do órgão possui 15 anos de uso médio, gerando custos de manutenção superiores ao valor de locação, conforme levantamento anexo."

### II — Alinhamento com o Plano de Contratações Anual (PCA)

Demonstrar que a contratação está prevista no PCA ou justificar sua inclusão extraordinária.

### III — Requisitos da contratação

Identificar os requisitos necessários ao atendimento da necessidade:
- Especificações técnicas mínimas
- Prazos de entrega/execução
- Locais de prestação
- Condições de garantia

### IV — Estimativas das quantidades

Memória de cálculo que fundamente as quantidades pretendidas:
- Histórico de consumo
- Demanda projetada
- Dados estatísticos

### V — Levantamento de mercado

Análise das soluções disponíveis:
- Consulta a fornecedores
- Contratações similares de outros órgãos (ComprasNet, Painel de Preços)
- Soluções inovadoras
- Benchmarking com setor privado

### VI — Estimativa de preços

Pesquisa de preços preliminar (será detalhada no TR), considerando:
- Painel de Preços do Governo Federal
- Contratos anteriores
- Pesquisa com fornecedores
- Bancos de preços

### VII — Descrição da solução como um todo

A solução completa, incluindo:
- Bens e serviços necessários
- Infraestrutura de apoio
- Capacitação de pessoal
- Cronograma de implantação

### VIII — Justificativa para parcelamento ou não

O Art. 40, §3º, estabelece que o parcelamento é a regra. O ETP deve justificar:
- Se o objeto será parcelado: demonstrar viabilidade técnica e econômica
- Se não será: justificar por que o parcelamento é inviável

### IX — Resultados pretendidos

Definir indicadores e metas:
- O que se espera alcançar?
- Como medir o sucesso da contratação?
- Quais indicadores de desempenho serão utilizados?

### X — Análise de riscos

Identificação e tratamento dos riscos:

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Atraso na entrega | Média | Alto | Multa contratual + fornecedor backup |
| Produto fora de especificação | Baixa | Alto | Amostra prévia + critérios de aceitação |
| Variação de preços | Alta | Médio | Cláusula de reequilíbrio |

### XI — Declaração de viabilidade

Conclusão fundamentada:
- **Viável:** a contratação atende à necessidade com relação custo-benefício adequada
- **Inviável:** não é possível ou não é conveniente contratar (justificar)
- **Viável com ressalvas:** indicar condições necessárias

## Modelo Estruturado

\`\`\`
ESTUDO TÉCNICO PRELIMINAR

1. INFORMAÇÕES BÁSICAS
   1.1 Órgão/Entidade
   1.2 Setor Requisitante
   1.3 Responsável

2. DESCRIÇÃO DA NECESSIDADE (Art. 18, §1º, I)
   [texto]

3. ALINHAMENTO COM O PCA (Art. 18, §1º, II)
   [texto]

4. REQUISITOS DA CONTRATAÇÃO (Art. 18, §1º, III)
   [texto]

5. ESTIMATIVAS DE QUANTIDADES (Art. 18, §1º, IV)
   [texto + memória de cálculo]

6. LEVANTAMENTO DE MERCADO (Art. 18, §1º, V)
   [texto + análise de alternativas]

7. ESTIMATIVA DE PREÇOS (Art. 18, §1º, VI)
   [texto + pesquisa preliminar]

8. DESCRIÇÃO DA SOLUÇÃO (Art. 18, §1º, VII)
   [texto]

9. JUSTIFICATIVA DO PARCELAMENTO (Art. 18, §1º, VIII)
   [texto]

10. RESULTADOS PRETENDIDOS (Art. 18, §1º, IX)
    [texto + indicadores]

11. ANÁLISE DE RISCOS (Art. 18, §1º, X)
    [matriz de riscos]

12. DECLARAÇÃO DE VIABILIDADE (Art. 18, §1º, XI)
    [conclusão fundamentada]

Data / Assinatura do responsável
\`\`\`

> **Dica prática:** Não trate o ETP como formulário burocrático. Cada seção deve refletir uma análise real e fundamentada.`,
      },
    ],
  },
  {
    title: '(teste) Módulo 2 — Termo de Referência e Projeto Básico',
    description: 'Elaboração do Termo de Referência e do Projeto Básico: conteúdo, requisitos, especificações e erros comuns a evitar.',
    displayOrder: 1,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 2.1 — Termo de Referência: Estrutura e Conteúdo',
        slug: 'teste-tr-estrutura',
        description: 'Como estruturar o Termo de Referência conforme o Art. 40 da Lei 14.133/2021.',
        estimatedMinutes: 30,
        leiArticles: ['6', '40', '18'],
        isPublished: true,
        content: `# Termo de Referência: Estrutura e Conteúdo

## Definição Legal

O **Termo de Referência (TR)** é o documento necessário para a contratação de bens e serviços, que deve conter os parâmetros e elementos descritivos, conforme Art. 6º, XXIII:

> *"Termo de referência: documento necessário para a contratação de bens e serviços, que deve conter os seguintes parâmetros e elementos descritivos [...]"*

## Relação ETP → TR

O TR é a **consequência natural** do ETP:

\`\`\`
ETP (análise/viabilidade) → TR (detalhamento/especificação)
\`\`\`

Enquanto o ETP analisa SE deve contratar e QUAL a melhor solução, o TR detalha COMO contratar.

## Conteúdo do TR (Art. 40)

### §1º — Elementos obrigatórios:

**I — Definição do objeto**
- Descrição clara, precisa e suficiente
- Vedação a especificações excessivas ou restritivas (Art. 41)
- Indicação de marca apenas como referência, com aceite de similar

**II — Fundamentação da contratação**
- Referência ao ETP (que já fundamentou a necessidade)
- Alinhamento com planejamento estratégico

**III — Descrição da solução como um todo**
- Detalhamento completo do que será contratado
- Todos os componentes necessários

**IV — Requisitos da contratação**
- Habilitação técnica e econômica
- Exigências de sustentabilidade (Art. 45)
- Critérios de acessibilidade (quando aplicável)

**V — Modelo de execução do objeto**
- Rotinas de execução
- Cronograma
- Locais de entrega/prestação
- Horários

**VI — Modelo de gestão do contrato**
- Fiscalização
- Comunicação
- Recebimento provisório e definitivo
- Pagamento

**VII — Critérios de medição e pagamento**
- Métricas objetivas
- Instrumentos de medição
- Forma de pagamento
- Prazos

**VIII — Forma e critérios de seleção do fornecedor**
- Modalidade de licitação
- Critério de julgamento
- Modo de disputa
- Fase de habilitação

## Checklist de Qualidade do TR

- [ ] O objeto está descrito de forma clara e sem ambiguidade?
- [ ] As especificações permitem competição adequada?
- [ ] Os critérios de aceitação são objetivos e verificáveis?
- [ ] O modelo de execução é praticável?
- [ ] A fiscalização está detalhada?
- [ ] Os prazos são realistas?
- [ ] As obrigações das partes estão equilibradas?
- [ ] A estimativa de preços está atualizada?
- [ ] Os riscos foram mapeados e alocados?
- [ ] As cláusulas de sustentabilidade foram observadas?

## Erros mais comuns

1. **Copiar TR sem adaptação** — cada contratação tem especificidades
2. **Especificação vaga** — "material de qualidade" não é especificação
3. **Restrição injustificada** — exigir marca sem aceitar similar
4. **Ausência de critérios de aceitação** — como verificar o cumprimento?
5. **Não prever gestão de riscos** — quem arca com imprevistos?
6. **Descolamento do ETP** — TR que contradiz o que o ETP concluiu

> **Jurisprudência TCU (Acórdão 2.622/2015-Plenário):** "O termo de referência é peça fundamental do processo licitatório, e sua deficiência pode comprometer a competitividade, a economicidade e a eficácia da contratação."`,
      },
      {
        title: '(teste) Aula 2.2 — Projeto Básico e Projeto Executivo em Obras',
        slug: 'teste-projeto-basico',
        description: 'Diferenças entre Projeto Básico e Executivo e requisitos para obras de engenharia.',
        estimatedMinutes: 25,
        leiArticles: ['6', '46', '47'],
        isPublished: true,
        content: `# Projeto Básico e Projeto Executivo

## Definições Legais

### Projeto Básico (Art. 6º, XXV)

Conjunto de elementos necessários e suficientes, com nível de precisão adequado, para:
- Caracterizar a obra ou o serviço de engenharia
- Assegurar a viabilidade técnica
- Possibilitar a avaliação do custo
- Definir os métodos construtivos
- Permitir o prazo de execução

### Projeto Executivo (Art. 6º, XXVI)

Conjunto de elementos necessários e suficientes à execução completa da obra, de acordo com as normas técnicas da ABNT.

## Quando usar cada um?

| Documento | Aplicação | Momento |
|-----------|-----------|---------|
| **ETP** | Obras e serviços | Antes do projeto |
| **Projeto Básico** | Obras de engenharia | Antes da licitação |
| **Projeto Executivo** | Obras de engenharia | Antes da execução (pode ser concomitante) |
| **Termo de Referência** | Bens e serviços | Antes da licitação |

## Conteúdo do Projeto Básico (Art. 46)

O Art. 46 da Lei 14.133/2021 detalha o conteúdo mínimo:

### I — Levantamentos topográficos e cadastrais
- Georreferenciamento
- Sondagens
- Estudos ambientais

### II — Soluções técnicas
- Estudos de alternativas
- Metodologias construtivas
- Cronograma físico-financeiro

### III — Identificação dos elementos
- Orçamento detalhado com BDI
- Composição de custos unitários
- Planilha de quantitativos

### IV — Informações complementares
- Viabilidade ambiental
- Licenças prévias
- Serviços e obras provisórias

## Responsabilidade pelo Projeto

### Quem elabora?

O projeto básico pode ser elaborado:
1. Pela própria Administração (corpo técnico)
2. Por empresa contratada (licitação específica para o projeto)

### Regime de Contratação Integrada (Art. 46, §1º)

Na **contratação integrada**, o projeto básico pode ser elaborado pelo contratado, mas a Administração deve fornecer:
- Anteprojeto de engenharia
- Elementos técnicos de referência

> **Atenção:** A contratação integrada é vedada para obras de engenharia comuns. É restrita a obras de grande vulto ou com complexidade técnica que justifique a integração projeto-execução.

## Vedações Importantes

O Art. 47 estabelece vedações relacionadas ao projeto:

1. **Vedação de inclusão de equipamentos sem utilidade** — Art. 47, I
2. **Vedação de alteração unilateral superior a 25%** — Art. 125
3. **Vedação de início de obra sem projeto executivo aprovado** — Art. 46, §3º

## Erro Comum: Projeto Básico Incompleto

Um dos principais achados de auditoria do TCU é o **projeto básico incompleto**, que gera:
- Aditivos contratuais excessivos
- Paralisação de obras
- Superfaturamento
- Obras inacabadas

> **TCU (Acórdão 2.099/2011-Plenário):** "Não se deve licitar obra com projeto básico deficiente, sob pena de comprometer a estimativa de custos e gerar aditivos desnecessários."`,
      },
    ],
  },
  {
    title: '(teste) Módulo 3 — Pesquisa de Preços e Orçamento',
    description: 'Metodologia de pesquisa de preços, elaboração do orçamento estimado e parâmetros legais para a estimativa de custos.',
    displayOrder: 2,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 3.1 — Pesquisa de Preços: Metodologia e Fontes',
        slug: 'teste-pesquisa-precos',
        description: 'Como realizar pesquisa de preços conforme a Lei 14.133/2021 e a IN SEGES/ME nº 65/2021.',
        estimatedMinutes: 30,
        leiArticles: ['23', '22', '18'],
        isPublished: true,
        content: `# Pesquisa de Preços: Metodologia e Fontes

## Base Legal

A pesquisa de preços é disciplinada por:
- **Art. 23 da Lei 14.133/2021** — Regras gerais
- **IN SEGES/ME nº 65/2021** — Regulamento federal

## Finalidade

A pesquisa de preços tem dupla finalidade:
1. **Estimar o valor da contratação** — para fins orçamentários
2. **Aferir a compatibilidade** das propostas recebidas

## Parâmetros de Pesquisa (Art. 23, §1º)

A pesquisa deve utilizar, **preferencialmente na ordem indicada**:

### I — Painel de Preços (ComprasNet)
- Base de dados oficial do Governo Federal
- Contém preços praticados em licitações anteriores
- Fonte mais confiável e acessível
- Acesso: paineldeprecos.planejamento.gov.br

### II — Aquisições e contratações similares
- Contratos celebrados por outros órgãos (consulta PNCP)
- Atas de registro de preços vigentes
- Devem ser da mesma localidade ou região

### III — Dados de pesquisa com fornecedores
- Consulta formal a fornecedores do ramo
- Mínimo de 3 orçamentos (boa prática)
- Pesquisa deve ser documentada

### IV — Pesquisa em sites especializados
- Catálogos eletrônicos
- Tabelas de referência (SINAPI, SICRO para obras)
- Sítios de compras governamentais

## Metodologia de Cálculo

### Preço estimado

A IN 65/2021 estabelece que o preço estimado deve ser obtido pela:
- **Média** dos preços pesquisados
- **Mediana** dos preços pesquisados
- **Menor preço** encontrado (quando justificado)

### Tratamento de outliers

Devem ser **descartados** os preços que:
- Sejam inexequíveis (abaixo do custo)
- Sejam excessivos (acima de 75% do preço de referência, como parâmetro)
- Apresentem desvio significativo em relação aos demais

### Exemplo prático

| Fonte | Preço Unitário |
|-------|---------------|
| Painel de Preços | R$ 150,00 |
| Contrato Órgão A | R$ 145,00 |
| Fornecedor 1 | R$ 160,00 |
| Fornecedor 2 | R$ 155,00 |
| Fornecedor 3 | R$ 280,00 ← outlier |

**Cálculo (excluindo outlier):**
- Média: (150 + 145 + 160 + 155) / 4 = **R$ 152,50**
- Mediana: (150 + 155) / 2 = **R$ 152,50**

## Sigilo do Orçamento Estimado

O Art. 24 permite que o orçamento estimado da licitação seja:

### Orçamento sigiloso (Art. 24, caput)
- Tornado público apenas após o encerramento da fase de lances
- Justificativa: evitar conluio entre licitantes

### Orçamento público (Art. 24, parágrafo único)
- Quando a Administração optar por divulgar
- Obrigatório para obras (SINAPI/SICRO são públicos)

## Erros Comuns na Pesquisa de Preços

1. **Pesquisa insuficiente** — menos de 3 fontes
2. **Fontes desatualizadas** — preços de mais de 12 meses
3. **Não descartar outliers** — distorce a estimativa
4. **Pesquisa apenas com fornecedores** — sem consulta ao Painel
5. **Ausência de memória de cálculo** — não documentar a metodologia

> **TCU (Acórdão 2.170/2019-Plenário):** "A pesquisa de preços deve ser ampla e representativa do mercado, utilizando preferencialmente os parâmetros na ordem estabelecida em lei."`,
      },
      {
        title: '(teste) Aula 3.2 — Orçamento Estimado e Dotação Orçamentária',
        slug: 'teste-orcamento-estimado',
        description: 'Elaboração do orçamento estimado e comprovação de dotação orçamentária.',
        estimatedMinutes: 20,
        leiArticles: ['18', '20', '21', '22', '23'],
        isPublished: true,
        content: `# Orçamento Estimado e Dotação Orçamentária

## Orçamento Estimado

### O que compõe o orçamento estimado?

O orçamento estimado é a consolidação da pesquisa de preços, devendo conter:

1. **Descrição dos itens** — com unidade de medida
2. **Quantidades estimadas** — fundamentadas no ETP
3. **Preços unitários** — obtidos na pesquisa de preços
4. **Valor total estimado** — soma dos itens
5. **BDI** — para obras (Bonificação e Despesas Indiretas)

### Planilha de Custos

Para serviços contínuos com dedicação exclusiva de mão de obra, a planilha deve detalhar:

| Componente | Descrição |
|-----------|-----------|
| Remuneração | Salário-base + adicionais |
| Encargos sociais | INSS, FGTS, 13º, férias |
| Insumos | Uniformes, materiais, equipamentos |
| Custos indiretos | Administração, lucro |
| Tributos | ISS, PIS, COFINS, etc. |

## Dotação Orçamentária (Art. 18, §1º)

### Exigência legal

O Art. 18 exige que a fase preparatória contemple a **compatibilidade com o plano plurianual, com a lei de diretrizes orçamentárias e com a lei orçamentária anual**.

Na prática:
- **Antes da licitação:** declaração de adequação orçamentária
- **Antes da contratação:** empenho da despesa
- **Exceção:** registro de preços não exige dotação na licitação (Art. 82)

### Plano de Contratações Anual (PCA)

O Art. 12, VII, estabelece que a licitação deve ser precedida de:
- Planejamento com base no PCA
- Identificação da ação orçamentária
- Programa de trabalho

## Regime de Execução (Art. 46)

O orçamento deve considerar o regime de execução:

| Regime | Aplicação | Orçamento |
|--------|-----------|-----------|
| Empreitada por preço unitário | Obras com quantitativos variáveis | Detalhado por unidade |
| Empreitada por preço global | Obras com projeto definido | Valor global fixo |
| Empreitada integral | Obras complexas (turnkey) | Valor total |
| Contratação por tarefa | Serviços pontuais | Por tarefa concluída |

## Atualização de Preços

### Quando atualizar?

- Se a pesquisa tiver mais de **180 dias** (6 meses), deve ser atualizada
- Utilizar índices oficiais (IPCA, INPC, SINAPI)
- Documentar a atualização

### Fórmula de atualização

\`\`\`
Preço atualizado = Preço original × (Índice atual / Índice na data da pesquisa)
\`\`\`

## Resumo do Fluxo de Planejamento

\`\`\`
1. PCA (planejamento anual)
    ↓
2. ETP (análise de viabilidade)
    ↓
3. Pesquisa de Preços (estimativa de custos)
    ↓
4. Termo de Referência / Projeto Básico (detalhamento)
    ↓
5. Dotação Orçamentária (reserva de recursos)
    ↓
6. Parecer Jurídico (análise de conformidade)
    ↓
7. Autorização da Autoridade Competente
    ↓
8. Publicação do Edital
\`\`\`

> **Ponto-chave:** O planejamento não é etapa burocrática — é o alicerce de uma contratação bem-sucedida. Cada documento da fase preparatória alimenta o seguinte, formando uma cadeia lógica de decisões fundamentadas.`,
      },
    ],
  },
];

// ============================================================================
// FUNÇÕES
// ============================================================================

async function cleanup() {
  console.log('Removendo dados de teste do Curso 2...\n');

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

  const result = await prisma.module.deleteMany({
    where: { courseId: COURSE_ID, title: { contains: '(teste)' } },
  });

  console.log(`\n${result.count} módulos removidos (com todas as lições e vínculos).`);
}

async function populate() {
  console.log('Populando LMS — Curso 2: Planejamento das Contratações\n');
  console.log(`Curso ID: ${COURSE_ID}`);
  console.log(`Módulos: ${TEST_MODULES.length}`);
  console.log(`Lições: ${TEST_MODULES.reduce((sum, m) => sum + m.lessons.length, 0)}`);
  console.log('');

  // Check for existing test data
  const existing = await prisma.module.count({
    where: { courseId: COURSE_ID, title: { contains: '(teste)' } },
  });

  if (existing > 0) {
    console.log(`Já existem ${existing} módulos de teste. Use --cleanup primeiro.`);
    return;
  }

  if (isDryRun) {
    console.log('[DRY RUN] Estrutura que seria criada:\n');
    for (const mod of TEST_MODULES) {
      console.log(`  ${mod.title}`);
      for (const lesson of mod.lessons) {
        console.log(`    ${lesson.title} (${lesson.estimatedMinutes}min, Art. ${lesson.leiArticles.join(', ')})`);
      }
    }
    console.log('\n[DRY RUN] Nenhuma alteração feita.');
    return;
  }

  let totalLessons = 0;

  for (const mod of TEST_MODULES) {
    const module = await prisma.module.create({
      data: {
        courseId: COURSE_ID,
        title: mod.title,
        description: mod.description,
        displayOrder: mod.displayOrder,
        isPublished: mod.isPublished,
      },
    });
    console.log(`Módulo: ${mod.title}`);

    for (let i = 0; i < mod.lessons.length; i++) {
      const lessonData = mod.lessons[i];

      await prisma.lesson.create({
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

      console.log(`  Lição: ${lessonData.title}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`\nLMS populado com sucesso!`);
  console.log(`  Módulos: ${TEST_MODULES.length}`);
  console.log(`  Lições: ${totalLessons}`);
  console.log(`\nAcesse: /admin/lms para gerenciar`);
  console.log(`Acesse: /area-restrita (curso "Planejamento das Contratações") para visualizar como aluno`);
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
    console.error('Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
