/**
 * Script para popular o LMS com conteudo de teste — Curso 3: Gestao e Fiscalizacao de Contratos
 *
 * Cria modulos e licoes de teste sobre gestao e fiscalizacao de contratos
 * com conteudo didatico real vinculado a artigos da Lei 14.133/2021.
 *
 * Todos os itens sao marcados com "(teste)" para facil identificacao.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/populate-lms-test-curso3.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/populate-lms-test-curso3.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/populate-lms-test-curso3.ts --cleanup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const isCleanup = process.argv.includes('--cleanup');

const COURSE_ID = '3'; // Gestao e Fiscalizacao de Contratos

// ============================================================================
// ESTRUTURA DOS MODULOS E LICOES
// ============================================================================

interface QuizQuestionData {
  text: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation: string;
}

interface LessonData {
  title: string;
  slug: string;
  description: string;
  estimatedMinutes: number;
  leiArticles: string[];
  isPublished: boolean;
  content: string;
  quiz: {
    title: string;
    questions: QuizQuestionData[];
  };
  recommendedSites: {
    title: string;
    description: string;
    url: string;
    category: string;
  }[];
}

interface ModuleData {
  title: string;
  description: string;
  displayOrder: number;
  isPublished: boolean;
  lessons: LessonData[];
}

const TEST_MODULES: ModuleData[] = [
  {
    title: '(teste) Modulo 1 — Designacao e Atribuicoes do Fiscal',
    description: 'Requisitos legais para designacao do fiscal de contrato, atribuicoes do fiscal tecnico e administrativo, e principios de segregacao de funcoes.',
    displayOrder: 0,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 1.1 — Quem pode ser fiscal de contrato?',
        slug: 'teste-fiscal-requisitos',
        description: 'Requisitos legais para designacao do fiscal de contrato conforme os Arts. 7 e 117 da Lei 14.133/2021, incluindo vedacoes e necessidade de capacitacao.',
        estimatedMinutes: 20,
        leiArticles: ['7', '117', '8'],
        isPublished: true,
        content: `# Quem pode ser fiscal de contrato?

## Introducao

A fiscalizacao de contratos e uma das atividades mais criticas da gestao publica. A Lei 14.133/2021 trouxe avancos significativos ao disciplinar de forma mais detalhada a designacao e as atribuicoes dos agentes responsaveis pela fiscalizacao contratual.

O Art. 117 da Lei 14.133/2021 estabelece que a execucao do contrato devera ser acompanhada e fiscalizada por 1 (um) ou mais fiscais do contrato, representantes da Administracao especialmente designados. Essa designacao nao e mera formalidade — ela vincula responsabilidade e deve observar criterios tecnicos e eticos.

## Requisitos para Designacao

### Requisitos Legais (Art. 7)

O Art. 7 da Lei 14.133/2021 define os requisitos gerais para os agentes publicos que atuam em licitacoes e contratos:

- **Capacitacao tecnica:** o fiscal deve possuir conhecimento tecnico compativel com o objeto do contrato
- **Experiencia pratica:** preferencialmente, deve ter experiencia na area relacionada ao contrato
- **Vinculo funcional:** deve ser servidor efetivo ou empregado publico do quadro permanente da Administracao

### Vedacoes Importantes

O Art. 7, paragrafo 1, veda a designacao de agente publico para funcoes de fiscalizacao quando:

1. **Parentesco:** ate o terceiro grau com o contratado, preposto ou socio
2. **Conflito de interesses:** quando houver interesse direto ou indireto no resultado do contrato
3. **Vinculo societario:** participacao em sociedade empresaria contratada

### Necessidade de Capacitacao

A lei preve expressamente que os agentes devem ser capacitados. O Art. 7, paragrafo 2, determina que a Administracao devera promover gestao por competencias e designar agentes que preencham os requisitos de qualificacao tecnica e profissional.

## Dispensa de Designacao

O Art. 117, paragrafo 3, permite que, nos contratos de que trata o paragrafo 2 (servicos de valor ate o limite para dispensa), a fiscalizacao possa ser exercida por um unico servidor. Isso nao dispensa a designacao formal, mas simplifica o procedimento.

## Jurisprudencia do TCU

O TCU tem reiterado que a ausencia de designacao formal de fiscal compromete a execucao contratual:

- **Acordao 1.094/2013-Plenario:** A Administracao deve designar formalmente representante para acompanhar e fiscalizar a execucao do contrato
- **Acordao 2.296/2019-Plenario:** A designacao deve recair sobre servidor com conhecimento tecnico do objeto contratado`,
        quiz: {
          title: 'Quiz — Requisitos do Fiscal de Contrato',
          questions: [
            {
              text: 'Segundo o Art. 117 da Lei 14.133/2021, quem deve acompanhar e fiscalizar a execucao do contrato?',
              options: [
                { id: 'a', text: 'Qualquer servidor publico do orgao', isCorrect: false },
                { id: 'b', text: 'Um ou mais fiscais do contrato, representantes da Administracao especialmente designados', isCorrect: true },
                { id: 'c', text: 'Apenas o ordenador de despesas do orgao', isCorrect: false },
                { id: 'd', text: 'O preposto da empresa contratada', isCorrect: false },
              ],
              explanation: 'O Art. 117 preve que a execucao do contrato sera acompanhada e fiscalizada por 1 (um) ou mais fiscais do contrato, representantes da Administracao especialmente designados.',
            },
            {
              text: 'Qual das opcoes abaixo configura vedacao para a designacao de fiscal de contrato?',
              options: [
                { id: 'a', text: 'Servidor com pouca experiencia na area', isCorrect: false },
                { id: 'b', text: 'Servidor lotado em unidade diferente da requisitante', isCorrect: false },
                { id: 'c', text: 'Servidor com parentesco ate o terceiro grau com socio da contratada', isCorrect: true },
                { id: 'd', text: 'Servidor em estagio probatorio', isCorrect: false },
              ],
              explanation: 'O Art. 7, paragrafo 1, veda a designacao de agente publico que tenha parentesco ate o terceiro grau com o contratado, preposto ou socio.',
            },
            {
              text: 'O que a Lei 14.133/2021 exige em relacao a capacitacao do fiscal de contrato?',
              options: [
                { id: 'a', text: 'Curso superior em Direito Administrativo', isCorrect: false },
                { id: 'b', text: 'Certificacao especifica de fiscalizacao contratual', isCorrect: false },
                { id: 'c', text: 'Qualificacao tecnica e profissional compativel com o objeto', isCorrect: true },
                { id: 'd', text: 'Nenhuma exigencia especifica de capacitacao', isCorrect: false },
              ],
              explanation: 'O Art. 7, paragrafo 2, determina que a Administracao deve designar agentes que preencham requisitos de qualificacao tecnica e profissional compativeis com suas atribuicoes.',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'Portal de Compras do Governo Federal',
            description: 'Portal oficial de compras governamentais com normas e orientacoes sobre fiscalizacao de contratos.',
            url: 'https://www.gov.br/compras',
            category: 'legislacao',
          },
          {
            title: 'Lei 14.133/2021 — Planalto',
            description: 'Texto integral da Nova Lei de Licitacoes e Contratos Administrativos.',
            url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
            category: 'legislacao',
          },
        ],
      },
      {
        title: '(teste) Aula 1.2 — Atribuicoes do fiscal tecnico e administrativo',
        slug: 'teste-fiscal-atribuicoes',
        description: 'Diferenca entre fiscal tecnico e administrativo, competencias de cada um e a importancia da atuacao coordenada na gestao contratual.',
        estimatedMinutes: 22,
        leiArticles: ['117', '118', '7'],
        isPublished: true,
        content: `# Atribuicoes do Fiscal Tecnico e Administrativo

## Introducao

A Lei 14.133/2021 inovou ao distinguir formalmente as figuras do **fiscal tecnico** e do **fiscal administrativo**, reconhecendo que a fiscalizacao contratual abrange aspectos de naturezas distintas que exigem competencias especificas.

O Art. 117 da lei estabelece a necessidade de fiscalizacao da execucao contratual, enquanto o Art. 118 detalha as responsabilidades do gestor do contrato e sua relacao com os fiscais. Essa separacao funcional e fundamental para garantir uma fiscalizacao efetiva e abrangente.

## Fiscal Tecnico

### Competencias Principais

O fiscal tecnico e responsavel por acompanhar os aspectos tecnicos da execucao contratual:

- **Verificar a qualidade** dos bens entregues ou servicos prestados
- **Conferir especificacoes** comparando o executado com o contratado
- **Acompanhar cronogramas** de execucao e alertar sobre desvios
- **Registrar ocorrencias** tecnicas em livro ou sistema proprio
- **Emitir pareceres tecnicos** sobre medicoes e entregas
- **Solicitar correcoes** quando a execucao divergir das especificacoes

### Exemplos de Atuacao

| Tipo de Contrato | Fiscalizacao Tecnica |
|-------------------|---------------------|
| Obra de engenharia | Verificar medicoes, qualidade de materiais, conformidade com projeto |
| Servico de TI | Verificar SLAs, disponibilidade de sistemas, entregas de sprints |
| Fornecimento de bens | Conferir quantidades, especificacoes, estado de conservacao |
| Servico continuado | Verificar frequencia, produtividade, qualidade do servico |

## Fiscal Administrativo

### Competencias Principais

O fiscal administrativo cuida dos aspectos formais e documentais:

- **Verificar regularidade fiscal** e trabalhista da contratada
- **Acompanhar documentacao** (certidoes, seguros, garantias)
- **Conferir notas fiscais** e documentos de cobranca
- **Controlar prazos** contratuais (vigencia, renovacao, reajuste)
- **Acompanhar pagamentos** e saldos do contrato
- **Verificar cumprimento** das obrigacoes trabalhistas (servicos com dedicacao exclusiva)

### Documentos sob Responsabilidade

1. Certidao Negativa de Debitos (CND) — INSS
2. Certificado de Regularidade do FGTS (CRF)
3. Certidao de Regularidade Trabalhista (CNDT)
4. Certidoes de regularidade fiscal (federal, estadual, municipal)
5. Comprovantes de pagamento de salarios e beneficios (quando aplicavel)

## Atuacao Coordenada

A eficacia da fiscalizacao depende da **integracao** entre os fiscais tecnico e administrativo. Ambos devem:

- Comunicar-se regularmente sobre a execucao contratual
- Registrar ocorrencias de forma coordenada
- Subsidiar o gestor do contrato com informacoes completas
- Participar de reunioes periodicas de acompanhamento

O Art. 118 preve que o gestor do contrato e responsavel por coordenar as atividades dos fiscais, garantindo a harmonia entre os aspectos tecnico e administrativo.

## Jurisprudencia do TCU

- **Acordao 2.296/2019-Plenario:** A fiscalizacao contratual deve abranger os aspectos tecnico e administrativo, com designacao de agentes especializados para cada area
- **Acordao 1.094/2013-Plenario:** O fiscal deve registrar todas as ocorrencias relacionadas a execucao do contrato`,
        quiz: {
          title: 'Quiz — Atribuicoes do Fiscal Tecnico e Administrativo',
          questions: [
            {
              text: 'Qual e a principal diferenca entre o fiscal tecnico e o fiscal administrativo?',
              options: [
                { id: 'a', text: 'O fiscal tecnico e nomeado pelo ordenador de despesas e o administrativo pela autoridade competente', isCorrect: false },
                { id: 'b', text: 'O fiscal tecnico acompanha a qualidade da execucao e o administrativo cuida de documentos e regularidade fiscal', isCorrect: true },
                { id: 'c', text: 'O fiscal tecnico so atua em contratos de obras e o administrativo em contratos de servicos', isCorrect: false },
                { id: 'd', text: 'Nao ha diferenca, ambos exercem as mesmas funcoes', isCorrect: false },
              ],
              explanation: 'O fiscal tecnico verifica os aspectos qualitativos da execucao (conformidade com especificacoes), enquanto o fiscal administrativo cuida da parte documental, financeira e de regularidade fiscal/trabalhista.',
            },
            {
              text: 'Qual das atividades abaixo e atribuicao do fiscal administrativo?',
              options: [
                { id: 'a', text: 'Verificar a qualidade dos materiais utilizados na obra', isCorrect: false },
                { id: 'b', text: 'Emitir pareceres tecnicos sobre as medicoes realizadas', isCorrect: false },
                { id: 'c', text: 'Verificar a regularidade fiscal e trabalhista da contratada', isCorrect: true },
                { id: 'd', text: 'Acompanhar o cronograma fisico-financeiro da execucao', isCorrect: false },
              ],
              explanation: 'A verificacao da regularidade fiscal e trabalhista da contratada e atribuicao tipica do fiscal administrativo, que cuida dos aspectos formais e documentais do contrato.',
            },
            {
              text: 'Segundo o Art. 118 da Lei 14.133/2021, quem coordena as atividades dos fiscais tecnico e administrativo?',
              options: [
                { id: 'a', text: 'O ordenador de despesas', isCorrect: false },
                { id: 'b', text: 'O pregoeiro ou presidente da comissao', isCorrect: false },
                { id: 'c', text: 'O gestor do contrato', isCorrect: true },
                { id: 'd', text: 'O fiscal tecnico, por ter precedencia funcional', isCorrect: false },
              ],
              explanation: 'O Art. 118 estabelece que o gestor do contrato e o responsavel por coordenar as atividades dos fiscais, garantindo a integracao entre os aspectos tecnico e administrativo.',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'Portal de Compras do Governo Federal',
            description: 'Normas e orientacoes sobre gestao e fiscalizacao de contratos administrativos.',
            url: 'https://www.gov.br/compras',
            category: 'legislacao',
          },
          {
            title: 'TCU — Fiscalizacao de Contratos',
            description: 'Jurisprudencia do TCU sobre fiscalizacao contratual e boas praticas.',
            url: 'https://pesquisa.apps.tcu.gov.br/',
            category: 'jurisprudencia',
          },
        ],
      },
      {
        title: '(teste) Aula 1.3 — Segregacao de funcoes e conflito de interesses',
        slug: 'teste-fiscal-segregacao',
        description: 'Principios de segregacao de funcoes (Art. 7, paragrafo 1) aplicados a fiscalizacao de contratos, vedacoes e prevencao de conflitos de interesse.',
        estimatedMinutes: 18,
        leiArticles: ['7', '9', '117'],
        isPublished: true,
        content: `# Segregacao de Funcoes e Conflito de Interesses

## Introducao

A segregacao de funcoes e um principio fundamental de controle interno que visa evitar a concentracao de poderes e reduzir riscos de fraude e erro. Na Lei 14.133/2021, esse principio ganhou destaque como um dos pilares da governanca nas contratacoes publicas.

O Art. 7, paragrafo 1, da Lei 14.133/2021 consagra a segregacao de funcoes como requisito essencial para a designacao de agentes publicos em licitacoes e contratos. O objetivo e impedir que uma mesma pessoa acumule funcoes incompativeis, como planejar, licitar, fiscalizar e pagar.

## Principio da Segregacao de Funcoes

### Conceito

A segregacao de funcoes consiste na separacao de atribuicoes entre diferentes agentes para que nenhuma pessoa tenha controle sobre todas as etapas de um processo. No contexto contratual:

- **Quem planeja** nao deve ser quem licita
- **Quem licita** nao deve ser quem fiscaliza
- **Quem fiscaliza** nao deve ser quem paga
- **Quem autoriza** nao deve ser quem executa

### Base Legal

O Art. 7, paragrafo 1, estabelece que a segregacao de funcoes veda a designacao do mesmo agente publico para atuacao simultanea em funcoes mais suscetiveis a riscos. Essa vedacao complementa-se com o Art. 9, que trata dos impedimentos.

## Conflito de Interesses

### Definicao

Conflito de interesses ocorre quando o agente publico possui interesse pessoal, direto ou indireto, que possa comprometer a imparcialidade de suas decisoes. O Art. 9 da Lei 14.133/2021 detalha as situacoes de impedimento.

### Situacoes Tipicas de Conflito

1. **Parentesco:** fiscal que e parente de socio da contratada
2. **Interesse financeiro:** servidor que possui acoes da empresa contratada
3. **Atividade paralela:** fiscal que presta consultoria para a contratada
4. **Vinculo anterior:** ex-funcionario da contratada designado como fiscal
5. **Favorecimento:** fiscal que recebe vantagens da contratada

### Vedacoes do Art. 9

O Art. 9 da Lei 14.133/2021 impede que participem direta ou indiretamente da licitacao ou da execucao do contrato:

- O autor do projeto basico ou executivo (pessoa fisica ou juridica)
- Empresa cujo proprietario guarde relacao de parentesco com agente publico
- Pessoa que tenha relacao de parentesco com licitante ou contratado
- Servidor ou agente politico do orgao contratante

## Mecanismos de Prevencao

### Declaracao de Ausencia de Conflito

O fiscal designado deve declarar formalmente que nao possui conflito de interesses com a contratada. Essa declaracao deve ser:

- Prestada por escrito no momento da designacao
- Atualizada quando houver alteracao nas circunstancias
- Arquivada no processo administrativo do contrato

### Rotatividade de Fiscais

E recomendavel estabelecer rotatividade na designacao de fiscais para evitar:

- Relacoes de dependencia com a contratada
- Acomodacao na fiscalizacao
- Pressoes indevidas sobre o fiscal

## Jurisprudencia do TCU

- **Acordao 2.776/2016-Plenario:** A segregacao de funcoes e principio fundamental que deve ser observado em todas as etapas da contratacao
- **Acordao 1.375/2015-Plenario:** A ausencia de segregacao de funcoes configura falha grave de controle interno`,
        quiz: {
          title: 'Quiz — Segregacao de Funcoes e Conflito de Interesses',
          questions: [
            {
              text: 'O que o principio da segregacao de funcoes busca evitar?',
              options: [
                { id: 'a', text: 'Que servidores inexperientes atuem em contratos complexos', isCorrect: false },
                { id: 'b', text: 'Que o mesmo agente acumule funcoes incompativeis como planejar, licitar e fiscalizar', isCorrect: true },
                { id: 'c', text: 'Que a fiscalizacao seja feita por mais de um servidor', isCorrect: false },
                { id: 'd', text: 'Que servidores temporarios atuem em licitacoes', isCorrect: false },
              ],
              explanation: 'A segregacao de funcoes visa impedir a concentracao de atribuicoes numa unica pessoa, evitando que ela controle todas as etapas do processo de contratacao.',
            },
            {
              text: 'Em qual artigo da Lei 14.133/2021 estao previstos os impedimentos para participacao em licitacoes e contratos?',
              options: [
                { id: 'a', text: 'Art. 5', isCorrect: false },
                { id: 'b', text: 'Art. 7', isCorrect: false },
                { id: 'c', text: 'Art. 9', isCorrect: true },
                { id: 'd', text: 'Art. 117', isCorrect: false },
              ],
              explanation: 'O Art. 9 da Lei 14.133/2021 detalha as situacoes de impedimento para participacao direta ou indireta em licitacoes e execucao de contratos.',
            },
            {
              text: 'Qual das situacoes abaixo NAO configura conflito de interesses na fiscalizacao contratual?',
              options: [
                { id: 'a', text: 'Fiscal que e cunhado do socio da contratada', isCorrect: false },
                { id: 'b', text: 'Fiscal que presta consultoria remunerada para a contratada', isCorrect: false },
                { id: 'c', text: 'Fiscal que possui especializacao na area do objeto do contrato', isCorrect: true },
                { id: 'd', text: 'Fiscal que possui acoes da empresa contratada', isCorrect: false },
              ],
              explanation: 'Possuir especializacao na area e, na verdade, um requisito desejavel para o fiscal, nao um conflito de interesses. Conflito ocorre quando ha interesse pessoal que comprometa a imparcialidade.',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'Lei 14.133/2021 — Planalto',
            description: 'Texto integral da Nova Lei de Licitacoes e Contratos Administrativos.',
            url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
            category: 'legislacao',
          },
          {
            title: 'CGU — Conflito de Interesses',
            description: 'Orientacoes da CGU sobre prevencao e gestao de conflitos de interesse no servico publico.',
            url: 'https://www.gov.br/cgu',
            category: 'legislacao',
          },
        ],
      },
    ],
  },
  {
    title: '(teste) Modulo 2 — Recebimento e Atesto',
    description: 'Procedimentos de recebimento provisorio e definitivo, atesto e liquidacao da despesa, e gestao de garantias contratuais.',
    displayOrder: 1,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 2.1 — Recebimento provisorio e definitivo',
        slug: 'teste-recebimento-provisorio-definitivo',
        description: 'Procedimentos de recebimento provisorio e definitivo conforme o Art. 140 da Lei 14.133/2021, prazos legais e documentacao necessaria.',
        estimatedMinutes: 25,
        leiArticles: ['140', '141', '142'],
        isPublished: true,
        content: `# Recebimento Provisorio e Definitivo

## Introducao

O recebimento do objeto contratual e uma das etapas mais relevantes da execucao contratual. A Lei 14.133/2021 disciplina o tema nos Arts. 140 a 142, estabelecendo procedimentos rigorosos para garantir que o objeto entregue corresponda ao que foi contratado.

O recebimento se desdobra em duas fases distintas — provisorio e definitivo — cada uma com finalidades e prazos proprios. Essa sistematica visa proteger o interesse publico, permitindo verificacao adequada antes da aceitacao final.

## Recebimento Provisorio (Art. 140, I, "a" e II, "a")

### Conceito

O recebimento provisorio consiste na verificacao inicial do objeto entregue, de forma sumaria, para efeito de posterior verificacao detalhada.

### Para Obras e Servicos de Engenharia

- Realizado pelo fiscal tecnico
- Mediante termo detalhado
- Quando envolve aparelhagem e verificacao tecnica
- Prazo: ate **15 dias** da comunicacao escrita do contratado

### Para Bens e Servicos

- Realizado pelo responsavel pelo acompanhamento
- Para efeito de posterior verificacao de conformidade
- Prazo: de acordo com o contrato

### Documentacao Necessaria

1. Nota fiscal ou documento equivalente
2. Termo de recebimento provisorio
3. Relatorio fotografico (quando aplicavel)
4. Registro de medicao (para obras)

## Recebimento Definitivo (Art. 140, I, "b" e II, "b")

### Conceito

O recebimento definitivo representa a aceitacao final do objeto, apos verificacao completa de qualidade e conformidade com as especificacoes.

### Para Obras e Servicos de Engenharia

- Realizado por servidor ou comissao designada pela autoridade competente
- Mediante termo detalhado que comprove adequacao ao contratado
- Prazo: ate **90 dias** do recebimento provisorio (salvo estipulacao diversa)

### Para Bens e Servicos

- Realizado por servidor ou comissao designada
- Apos verificacao de conformidade com as especificacoes
- Prazo: de acordo com o contrato

### Verificacoes Obrigatorias

- Conformidade com o termo de referencia / projeto basico
- Quantidade entregue vs. quantidade contratada
- Qualidade e especificacoes tecnicas
- Prazos de entrega
- Embalagem e acondicionamento (para bens)

## Responsabilidade Pos-Recebimento

O Art. 140, paragrafo 2, estabelece que o recebimento provisorio ou definitivo **nao exclui** a responsabilidade civil pela solidez e pela seguranca da obra ou servico, nem a responsabilidade etico-profissional pela perfeita execucao do contrato.

## Dispensa de Recebimento Formal

O Art. 140, paragrafo 3, preve que o recebimento provisorio pode ser dispensado nos casos de:

- Generos pereciveis e alimentacao preparada
- Servicos profissionais
- Obras e servicos de valor ate o limite para dispensa de licitacao

## Jurisprudencia do TCU

- **Acordao 1.248/2015-Plenario:** O recebimento definitivo deve ser precedido de verificacao efetiva, nao sendo mera formalidade
- **Acordao 2.455/2018-Plenario:** A omissao no recebimento provisorio e definitivo configura falha na fiscalizacao contratual`,
        quiz: {
          title: 'Quiz — Recebimento Provisorio e Definitivo',
          questions: [
            {
              text: 'Qual e o prazo maximo para o recebimento definitivo de obras e servicos de engenharia, contado do recebimento provisorio?',
              options: [
                { id: 'a', text: '30 dias', isCorrect: false },
                { id: 'b', text: '60 dias', isCorrect: false },
                { id: 'c', text: '90 dias', isCorrect: true },
                { id: 'd', text: '120 dias', isCorrect: false },
              ],
              explanation: 'O Art. 140, I, "b", estabelece que o recebimento definitivo de obras e servicos de engenharia deve ocorrer em ate 90 dias do recebimento provisorio, salvo estipulacao diversa no contrato.',
            },
            {
              text: 'O recebimento definitivo exclui a responsabilidade civil do contratado pela solidez e seguranca da obra?',
              options: [
                { id: 'a', text: 'Sim, o recebimento definitivo encerra todas as responsabilidades', isCorrect: false },
                { id: 'b', text: 'Nao, a responsabilidade pela solidez e seguranca persiste apos o recebimento definitivo', isCorrect: true },
                { id: 'c', text: 'Sim, exceto para obras de grande vulto', isCorrect: false },
                { id: 'd', text: 'Depende do que estiver previsto no contrato', isCorrect: false },
              ],
              explanation: 'O Art. 140, paragrafo 2, e expresso ao dispor que o recebimento provisorio ou definitivo nao exclui a responsabilidade civil pela solidez e seguranca da obra ou servico.',
            },
            {
              text: 'Em quais situacoes o recebimento provisorio pode ser dispensado?',
              options: [
                { id: 'a', text: 'Em contratos de grande vulto com fiscalizacao reforçada', isCorrect: false },
                { id: 'b', text: 'Generos pereciveis, servicos profissionais e obras/servicos de valor ate o limite de dispensa', isCorrect: true },
                { id: 'c', text: 'Contratos com prazo de execucao inferior a 30 dias', isCorrect: false },
                { id: 'd', text: 'Quando o fiscal tecnico e o administrativo sao o mesmo servidor', isCorrect: false },
              ],
              explanation: 'O Art. 140, paragrafo 3, permite a dispensa do recebimento provisorio para generos pereciveis, alimentacao preparada, servicos profissionais e obras/servicos ate o limite de dispensa.',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'Lei 14.133/2021 — Planalto',
            description: 'Texto integral da Lei de Licitacoes — Arts. 140 a 142 sobre recebimento.',
            url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
            category: 'legislacao',
          },
          {
            title: 'Portal Nacional de Contratacoes Publicas (PNCP)',
            description: 'Portal oficial para consulta de contratos e atos de execucao contratual.',
            url: 'https://www.pncp.gov.br/',
            category: 'legislacao',
          },
        ],
      },
      {
        title: '(teste) Aula 2.2 — Atesto e liquidacao da despesa',
        slug: 'teste-atesto-liquidacao',
        description: 'Fluxo de atesto e liquidacao da despesa na execucao contratual, conferencia fiscal e relacao com o pagamento.',
        estimatedMinutes: 20,
        leiArticles: ['140', '141', '92'],
        isPublished: true,
        content: `# Atesto e Liquidacao da Despesa

## Introducao

O atesto e a liquidacao da despesa sao etapas essenciais do fluxo de pagamento nos contratos administrativos. A Lei 14.133/2021 disciplina essas etapas em conjunto com as regras de recebimento, criando uma cadeia logica desde a entrega do objeto ate o efetivo pagamento ao contratado.

O processo de pagamento em contratos publicos segue a logica orcamentaria e financeira estabelecida pela Lei 4.320/1964 (empenho, liquidacao e pagamento), agora integrada com os procedimentos da nova lei de licitacoes.

## Conceito de Atesto

### O que e o atesto?

O atesto e o ato pelo qual o fiscal do contrato confirma que o objeto contratado foi recebido em conformidade com as especificacoes e condicoes pactuadas. E a declaracao formal de que o servico foi prestado ou o bem foi entregue adequadamente.

### Quem atesta?

- O fiscal do contrato (tecnico ou administrativo, conforme a natureza)
- Pode ser o gestor do contrato, quando acumula a funcao
- Em caso de comissao de recebimento, todos os membros

### Requisitos do Atesto

1. Verificacao da efetiva prestacao do servico ou entrega do bem
2. Conformidade com as especificacoes contratuais
3. Conferencia das quantidades
4. Conferencia da nota fiscal (dados, valores, tributos)
5. Registro formal no processo

## Liquidacao da Despesa

### Base Legal

A liquidacao da despesa, conforme a Lei 4.320/1964 (Art. 63), consiste na verificacao do direito adquirido pelo credor com base nos seguintes documentos:

- Contrato ou ajuste
- Nota de empenho
- Comprovantes de entrega ou prestacao

### Etapas da Liquidacao

1. **Conferencia documental:** nota fiscal, certidoes, contrato
2. **Verificacao da execucao:** comparacao com o contratado
3. **Ateste do fiscal:** declaracao de conformidade
4. **Analise financeira:** verificacao de valores, descontos, retencoes
5. **Aprovacao:** autorizacao para pagamento pelo gestor/ordenador

## Fluxo Completo: Da Execucao ao Pagamento

\`\`\`
1. Contratado executa o objeto
   |
2. Contratado comunica a conclusao + emite nota fiscal
   |
3. Fiscal tecnico verifica a conformidade (recebimento provisorio)
   |
4. Fiscal administrativo confere documentacao
   |
5. Recebimento definitivo (aceite formal)
   |
6. Atesto da nota fiscal pelo fiscal
   |
7. Liquidacao da despesa (conferencia financeira)
   |
8. Autorizacao de pagamento pelo ordenador de despesas
   |
9. Pagamento ao contratado
\`\`\`

## Prazo de Pagamento

O Art. 92, V, da Lei 14.133/2021 estabelece que o contrato deve prever as condicoes de pagamento. Em geral:

- **Ate 30 dias** do recebimento da nota fiscal atestada
- **Atualizacao financeira** se ultrapassado o prazo (sem culpa do contratado)
- **Ordem cronologica** de pagamentos (Art. 141)

## Retencoes Obrigatorias

Ao atestar a nota fiscal, o fiscal deve verificar as retencoes tributarias:

| Tributo | Aliquota | Base |
|---------|----------|------|
| IRRF | Variavel | Tabela progressiva |
| CSLL | 1% | Valor do servico |
| PIS/Pasep | 0,65% | Valor do servico |
| COFINS | 3% | Valor do servico |
| ISS | 2-5% | Lei municipal |
| INSS | 11% | Servicos com cessao de mao de obra |

## Jurisprudencia do TCU

- **Acordao 1.397/2013-Plenario:** O atesto deve ser fundamentado em verificacao real, nao meramente formal
- **Acordao 2.640/2017-Plenario:** A Administracao deve observar a ordem cronologica de pagamentos`,
        quiz: {
          title: 'Quiz — Atesto e Liquidacao da Despesa',
          questions: [
            {
              text: 'O que e o atesto no contexto da execucao contratual?',
              options: [
                { id: 'a', text: 'A autorizacao do ordenador de despesas para iniciar o pagamento', isCorrect: false },
                { id: 'b', text: 'A declaracao formal do fiscal confirmando que o objeto foi recebido conforme o contratado', isCorrect: true },
                { id: 'c', text: 'A emissao da nota de empenho pela area financeira', isCorrect: false },
                { id: 'd', text: 'A publicacao do extrato de pagamento no diario oficial', isCorrect: false },
              ],
              explanation: 'O atesto e o ato pelo qual o fiscal do contrato confirma formalmente que o objeto contratado foi recebido em conformidade com as especificacoes e condicoes pactuadas.',
            },
            {
              text: 'Qual e o prazo geral para pagamento ao contratado apos o recebimento da nota fiscal atestada?',
              options: [
                { id: 'a', text: 'Ate 15 dias', isCorrect: false },
                { id: 'b', text: 'Ate 30 dias', isCorrect: true },
                { id: 'c', text: 'Ate 45 dias', isCorrect: false },
                { id: 'd', text: 'Ate 60 dias', isCorrect: false },
              ],
              explanation: 'O prazo geral e de ate 30 dias a partir do recebimento da nota fiscal atestada. Se ultrapassado sem culpa do contratado, ha direito a atualizacao financeira.',
            },
            {
              text: 'Qual a sequencia correta do fluxo de pagamento em contratos administrativos?',
              options: [
                { id: 'a', text: 'Empenho > Pagamento > Liquidacao', isCorrect: false },
                { id: 'b', text: 'Liquidacao > Empenho > Pagamento', isCorrect: false },
                { id: 'c', text: 'Empenho > Liquidacao > Pagamento', isCorrect: true },
                { id: 'd', text: 'Pagamento > Empenho > Liquidacao', isCorrect: false },
              ],
              explanation: 'Conforme a Lei 4.320/1964, o fluxo correto e: empenho (reserva orcamentaria), liquidacao (verificacao do direito do credor), e pagamento (desembolso efetivo).',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'Tesouro Nacional — SIAFI',
            description: 'Sistema de administracao financeira do Governo Federal com normas sobre execucao orcamentaria.',
            url: 'https://www.gov.br/tesouronacional',
            category: 'legislacao',
          },
          {
            title: 'Portal de Compras do Governo Federal',
            description: 'Orientacoes sobre execucao contratual e fluxos de pagamento.',
            url: 'https://www.gov.br/compras',
            category: 'legislacao',
          },
        ],
      },
      {
        title: '(teste) Aula 2.3 — Gestao de garantias contratuais',
        slug: 'teste-garantias-contratuais',
        description: 'Tipos de garantia contratual previstos nos Arts. 96 a 102 da Lei 14.133/2021, condicoes de exigencia e procedimentos de liberacao.',
        estimatedMinutes: 18,
        leiArticles: ['96', '97', '98', '99', '100', '102'],
        isPublished: true,
        content: `# Gestao de Garantias Contratuais

## Introducao

As garantias contratuais sao instrumentos de protecao da Administracao Publica contra eventuais inadimplementos do contratado. A Lei 14.133/2021 disciplina o tema nos Arts. 96 a 102, trazendo inovacoes significativas em relacao a legislacao anterior, especialmente no que tange ao seguro-garantia.

A exigencia de garantia nao e obrigatoria em todos os contratos, mas sua previsao no edital e no contrato e fundamental para salvaguardar o interesse publico em contratacoes de maior vulto ou complexidade.

## Tipos de Garantia (Art. 96)

### Opcoes do Contratado

O Art. 96 preve que o edital podera exigir prestacao de garantia, cabendo ao contratado optar por uma das seguintes modalidades:

**I — Caucao em dinheiro ou em titulos da divida publica**
- Deposito em conta vinculada
- Titulos devem ter valor de mercado compativel
- Garantia mais simples e direta

**II — Seguro-garantia**
- Emitido por seguradora autorizada pela SUSEP
- Inovacao da Lei 14.133: clausula de retomada (Art. 102)
- Modalidade mais robusta para obras de grande vulto

**III — Fianca bancaria**
- Emitida por instituicao financeira
- Deve conter clausula de renunciaa ao beneficio de ordem
- Custo geralmente repassado ao contratado

### Comparativo

| Modalidade | Vantagem | Desvantagem |
|-----------|----------|-------------|
| Caucao | Simples, imediata | Imobiliza capital do contratado |
| Seguro-garantia | Nao imobiliza capital, clausula de retomada | Custo do premio |
| Fianca bancaria | Nao imobiliza capital | Custo elevado, burocracia |

## Percentual da Garantia (Art. 98)

### Regra Geral
- Ate **5%** do valor inicial do contrato

### Obras, Servicos e Fornecimentos de Grande Vulto
- Ate **10%** do valor inicial do contrato
- Mediante justificativa fundamentada

### Seguro-garantia com Clausula de Retomada
- Ate **30%** do valor inicial do contrato (Art. 99)
- Exclusivo para obras e servicos de engenharia de grande vulto

## Clausula de Retomada (Art. 102)

### Inovacao da Lei 14.133/2021

O Art. 102 traz uma das maiores inovacoes em materia de garantias: o **seguro-garantia com clausula de retomada**. Nessa modalidade:

1. Em caso de inadimplemento do contratado, a seguradora assume a execucao do contrato
2. A seguradora pode contratar terceiros para concluir o objeto
3. O prazo para retomada e definido no contrato
4. A garantia cobre ate o valor integral do contrato

### Finalidade

Evitar a paralisacao de obras publicas por inadimplemento do contratado — problema cronico na Administracao Publica brasileira.

## Liberacao da Garantia

A garantia deve ser liberada ou restituida apos:

1. **Execucao integral** do contrato e recebimento definitivo
2. **Extincao do contrato** sem pendencias
3. **Reducao proporcional** em caso de execucao parcial (quando aplicavel)

### Prazo para Devolucao

A caucao em dinheiro deve ser devolvida com correcao monetaria. O prazo para liberacao deve estar previsto no contrato.

## Jurisprudencia do TCU

- **Acordao 1.670/2017-Plenario:** A exigencia de garantia deve ser proporcional ao objeto e justificada no ETP
- **Acordao 2.241/2019-Plenario:** A Administracao deve acompanhar a vigencia das garantias e exigir renovacao quando necessario`,
        quiz: {
          title: 'Quiz — Garantias Contratuais',
          questions: [
            {
              text: 'Qual o percentual maximo da garantia contratual previsto como regra geral na Lei 14.133/2021?',
              options: [
                { id: 'a', text: 'Ate 3% do valor do contrato', isCorrect: false },
                { id: 'b', text: 'Ate 5% do valor do contrato', isCorrect: true },
                { id: 'c', text: 'Ate 10% do valor do contrato', isCorrect: false },
                { id: 'd', text: 'Ate 15% do valor do contrato', isCorrect: false },
              ],
              explanation: 'O Art. 98 da Lei 14.133/2021 estabelece que a garantia contratual sera de ate 5% do valor inicial do contrato como regra geral.',
            },
            {
              text: 'O que e a clausula de retomada prevista no Art. 102 da Lei 14.133/2021?',
              options: [
                { id: 'a', text: 'Direito da Administracao de retomar o objeto sem pagar indenizacao', isCorrect: false },
                { id: 'b', text: 'Obrigacao da seguradora de assumir a execucao do contrato em caso de inadimplemento do contratado', isCorrect: true },
                { id: 'c', text: 'Direito do contratado de retomar a obra apos suspensao temporaria', isCorrect: false },
                { id: 'd', text: 'Clausula que permite ao banco garantidor executar o contrato', isCorrect: false },
              ],
              explanation: 'O Art. 102 inova ao permitir que, no seguro-garantia com clausula de retomada, a seguradora assuma a execucao do contrato em caso de inadimplemento, podendo contratar terceiros para concluir o objeto.',
            },
            {
              text: 'Quais sao as tres modalidades de garantia que o contratado pode escolher, segundo o Art. 96?',
              options: [
                { id: 'a', text: 'Caucao em dinheiro, seguro-garantia e hipoteca de bens imoveis', isCorrect: false },
                { id: 'b', text: 'Caucao em dinheiro, carta de credito e fianca bancaria', isCorrect: false },
                { id: 'c', text: 'Caucao em dinheiro ou titulos da divida publica, seguro-garantia e fianca bancaria', isCorrect: true },
                { id: 'd', text: 'Deposito judicial, seguro-garantia e aval de terceiros', isCorrect: false },
              ],
              explanation: 'O Art. 96 preve tres modalidades: (I) caucao em dinheiro ou em titulos da divida publica, (II) seguro-garantia e (III) fianca bancaria, cabendo ao contratado a escolha.',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'SUSEP — Superintendencia de Seguros Privados',
            description: 'Orgao regulador de seguros com normas sobre seguro-garantia para contratos publicos.',
            url: 'https://www.gov.br/susep',
            category: 'legislacao',
          },
          {
            title: 'Lei 14.133/2021 — Planalto',
            description: 'Texto integral da lei — Arts. 96 a 102 sobre garantias contratuais.',
            url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
            category: 'legislacao',
          },
        ],
      },
    ],
  },
  {
    title: '(teste) Modulo 3 — Sancoes e Rescisao Contratual',
    description: 'Infracoes e sancoes administrativas, processo de apuracao e defesa, e hipoteses de extincao e rescisao contratual.',
    displayOrder: 2,
    isPublished: true,
    lessons: [
      {
        title: '(teste) Aula 3.1 — Infracoes e sancoes administrativas',
        slug: 'teste-sancoes-administrativas',
        description: 'Tipos de sancao previstos nos Arts. 155 a 163 da Lei 14.133/2021, criterios de dosimetria e gradacao das penalidades.',
        estimatedMinutes: 25,
        leiArticles: ['155', '156', '157', '158', '161', '163'],
        isPublished: true,
        content: `# Infracoes e Sancoes Administrativas

## Introducao

O regime sancionatorio da Lei 14.133/2021 representou significativa evolucao em relacao a legislacao anterior. Os Arts. 155 a 163 disciplinam de forma sistematica as infracoes administrativas, as sancoes aplicaveis e os criterios de dosimetria, oferecendo maior previsibilidade e seguranca juridica tanto para a Administracao quanto para os contratados.

A tipificacao mais detalhada das infracoes e a previsao expressa de criterios para a dosimetria das sancoes sao avancos importantes para a reducao da discricionariedade e o fortalecimento do principio da proporcionalidade.

## Infracoes Administrativas (Art. 155)

O Art. 155 da Lei 14.133/2021 tipifica as infracoes administrativas:

### Condutas Tipificadas

1. **Dar causa a inexecucao parcial** do contrato
2. **Dar causa a inexecucao total** do contrato
3. **Deixar de entregar** a documentacao exigida para o certame
4. **Nao manter a proposta** — salvo em decorrencia de fato superveniente
5. **Nao celebrar o contrato** ou nao entregar a documentacao para contratacao no prazo
6. **Ensejar o retardamento** da execucao ou da entrega do objeto
7. **Apresentar declaracao ou documentacao falsa** ou cometer fraude fiscal
8. **Praticar atos ilegais** com vistas a frustrar os objetivos da licitacao
9. **Praticar ato lesivo** previsto no Art. 5 da Lei 12.846/2013 (anticorrupcao)

## Sancoes Aplicaveis (Art. 156)

O Art. 156 preve as seguintes sancoes, em ordem crescente de gravidade:

### I — Advertencia
- Para infracoes leves
- Que nao acarretem prejuizo significativo
- Aplicavel apenas para inexecucao parcial (Art. 155, I)

### II — Multa
- Percentual sobre o valor do contrato
- Pode ser cumulada com outras sancoes
- Limite de **30%** do valor do contrato (Art. 156, paragrafo 3)
- Compensavel com garantia ou pagamentos devidos

### III — Impedimento de Licitar e Contratar
- Prazo maximo: **3 anos**
- Para infracoes de media gravidade (Art. 155, II a VI)
- Abrange o ente federativo que aplicou a sancao

### IV — Declaracao de Inidoneidade
- Sancao mais grave
- Prazo: de **3 a 6 anos**
- Para infracoes gravissimas (Art. 155, VII a IX)
- Abrange todos os entes federativos (efeito nacional)
- Competencia exclusiva do Ministro de Estado ou Secretario Estadual/Municipal

## Dosimetria (Art. 156, paragrafo 1)

### Criterios Legais

A dosimetria das sancoes deve considerar:

1. **Natureza e gravidade** da infracao
2. **Peculiaridades** do caso concreto
3. **Circunstancias agravantes ou atenuantes**
4. **Danos** causados a Administracao
5. **Proporcionalidade** e **razoabilidade**

### Circunstancias que Podem Atenuar

- Primeiro registro de infracao
- Colaboracao do contratado para apuracao
- Adocao de medidas corretivas imediatas
- Ausencia de dolo

### Circunstancias que Podem Agravar

- Reincidencia
- Magnitude dos danos
- Presenca de dolo ou ma-fe
- Beneficio auferido com a infracao

## Registro no PNCP (Art. 161)

As sancoes devem ser registradas no **Portal Nacional de Contratacoes Publicas (PNCP)** e no **Cadastro Nacional de Empresas Inidôneas e Suspensas (CEIS)**, garantindo publicidade e eficacia das penalidades em ambito nacional.

## Jurisprudencia do TCU

- **Acordao 2.466/2019-Plenario:** A aplicacao de sancoes deve observar os principios do contraditorio e da ampla defesa
- **Acordao 754/2015-Plenario:** A dosimetria da multa deve ser proporcional a gravidade da infracao e ao dano causado`,
        quiz: {
          title: 'Quiz — Infracoes e Sancoes Administrativas',
          questions: [
            {
              text: 'Qual e o prazo maximo da sancao de impedimento de licitar e contratar prevista na Lei 14.133/2021?',
              options: [
                { id: 'a', text: '1 ano', isCorrect: false },
                { id: 'b', text: '2 anos', isCorrect: false },
                { id: 'c', text: '3 anos', isCorrect: true },
                { id: 'd', text: '5 anos', isCorrect: false },
              ],
              explanation: 'O Art. 156, III, preve que o impedimento de licitar e contratar tera prazo maximo de 3 anos, aplicavel as infracoes de media gravidade previstas no Art. 155, II a VI.',
            },
            {
              text: 'Qual das sancoes abaixo pode ser aplicada cumulativamente com as demais?',
              options: [
                { id: 'a', text: 'Advertencia', isCorrect: false },
                { id: 'b', text: 'Multa', isCorrect: true },
                { id: 'c', text: 'Impedimento de licitar e contratar', isCorrect: false },
                { id: 'd', text: 'Declaracao de inidoneidade', isCorrect: false },
              ],
              explanation: 'A multa e a unica sancao que pode ser aplicada cumulativamente com as demais (advertencia, impedimento ou inidoneidade), conforme previsto no Art. 156, paragrafo 7.',
            },
            {
              text: 'Quem tem competencia para aplicar a sancao de declaracao de inidoneidade?',
              options: [
                { id: 'a', text: 'O pregoeiro ou presidente da comissao de licitacao', isCorrect: false },
                { id: 'b', text: 'O fiscal do contrato', isCorrect: false },
                { id: 'c', text: 'Ministro de Estado ou Secretario Estadual/Municipal equivalente', isCorrect: true },
                { id: 'd', text: 'O ordenador de despesas do orgao', isCorrect: false },
              ],
              explanation: 'A declaracao de inidoneidade, por ser a sancao mais grave, exige competencia exclusiva do Ministro de Estado ou autoridade de nivel hierarquico equivalente (Secretario Estadual/Municipal).',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'PNCP — Portal Nacional de Contratacoes Publicas',
            description: 'Portal oficial com registros de sancoes aplicadas a fornecedores.',
            url: 'https://www.pncp.gov.br/',
            category: 'legislacao',
          },
          {
            title: 'CGU — CEIS',
            description: 'Cadastro Nacional de Empresas Inidoneas e Suspensas mantido pela CGU.',
            url: 'https://www.portaltransparencia.gov.br/sancoes/ceis',
            category: 'legislacao',
          },
        ],
      },
      {
        title: '(teste) Aula 3.2 — Processo de apuracao e defesa',
        slug: 'teste-processo-apuracao',
        description: 'Due process na aplicacao de sancoes administrativas, prazos para defesa, contraditorio e ampla defesa.',
        estimatedMinutes: 20,
        leiArticles: ['157', '158', '159', '160'],
        isPublished: true,
        content: `# Processo de Apuracao e Defesa

## Introducao

A aplicacao de sancoes administrativas na Lei 14.133/2021 deve observar rigorosamente o devido processo legal, assegurando ao contratado o exercicio do contraditorio e da ampla defesa. Os Arts. 157 a 160 disciplinam os procedimentos de apuracao.

A garantia do devido processo legal nao e mera formalidade — e requisito constitucional (Art. 5, LV, da CF/88) cuja inobservancia pode acarretar a nulidade da sancao aplicada, com potencial responsabilizacao do agente publico.

## Fases do Processo Sancionatorio

### 1. Instauracao

O processo sancionatorio e instaurado a partir de:

- **Registro do fiscal** sobre irregularidade na execucao
- **Relatorio de recebimento** indicando nao conformidade
- **Comunicacao interna** de qualquer agente que tenha conhecimento da infracao
- **Representacao** de terceiros ou orgaos de controle

### 2. Notificacao do Contratado

O contratado deve ser notificado:

- **Pessoalmente** ou por meio eletronico com confirmacao de recebimento
- Com descricao clara e precisa da infracao imputada
- Com indicacao das provas e evidencias
- Com informacao sobre o prazo para defesa

### 3. Defesa Previa (Art. 157)

O Art. 157 assegura ao contratado o direito de defesa previa:

| Sancao | Prazo para Defesa |
|--------|-------------------|
| Advertencia | **15 dias uteis** |
| Multa | **15 dias uteis** |
| Impedimento | **15 dias uteis** |
| Inidoneidade | **15 dias uteis** |

A defesa deve ser apresentada por escrito, com os documentos e provas que o contratado julgar pertinentes.

### 4. Instrucao

Apos a defesa:

- **Analise das alegacoes** e dos documentos apresentados
- **Producao de provas complementares**, se necessario
- **Parecer tecnico** sobre os fatos
- **Parecer juridico**, quando exigido

### 5. Decisao

A autoridade competente deve proferir decisao fundamentada, considerando:

- Os fatos apurados e as provas produzidas
- As alegacoes da defesa
- A dosimetria adequada da sancao
- Os precedentes administrativos do orgao

### 6. Recurso (Art. 158)

O Art. 158 da Lei 14.133/2021 assegura o direito de recurso:

- **Prazo: 15 dias uteis** da notificacao da decisao
- Dirigido a autoridade que proferiu a decisao
- Se nao reconsiderar, encaminha a autoridade superior
- **Efeito suspensivo** automatico

## Garantias Fundamentais

### Contraditorio e Ampla Defesa

- Direito de ser ouvido antes da decisao
- Direito de apresentar provas e documentos
- Direito de ter acesso ao processo (vista)
- Direito de ser assistido por advogado

### Motivacao da Decisao

A decisao que aplicar sancao deve ser:

- **Escrita e fundamentada**
- Com indicacao dos fatos e provas
- Com justificativa da dosimetria
- Com referencia a legislacao aplicavel

### Publicidade

As sancoes devem ser publicadas no PNCP e nos diarios oficiais, garantindo:

- Transparencia do processo
- Eficacia da sancao
- Direito de terceiros tomarem conhecimento

## Prescricao (Art. 158, paragrafo 4)

A pretensao punitiva da Administracao prescreve em **5 anos**, contados da data da ciencia da infracao, salvo se for tambem apurada como ilicito penal.

## Jurisprudencia do TCU

- **Acordao 3.529/2014-Plenario:** A aplicacao de sancao sem observancia do contraditorio e da ampla defesa e nula
- **Acordao 754/2015-Plenario:** A decisao sancionatoria deve ser fundamentada com indicacao dos criterios de dosimetria`,
        quiz: {
          title: 'Quiz — Processo de Apuracao e Defesa',
          questions: [
            {
              text: 'Qual e o prazo para apresentacao de defesa previa no processo sancionatorio da Lei 14.133/2021?',
              options: [
                { id: 'a', text: '5 dias uteis', isCorrect: false },
                { id: 'b', text: '10 dias uteis', isCorrect: false },
                { id: 'c', text: '15 dias uteis', isCorrect: true },
                { id: 'd', text: '30 dias uteis', isCorrect: false },
              ],
              explanation: 'O Art. 157 da Lei 14.133/2021 preve o prazo de 15 dias uteis para a apresentacao de defesa previa, independentemente da sancao a ser aplicada.',
            },
            {
              text: 'Qual e o prazo prescricional da pretensao punitiva da Administracao para infracoes administrativas?',
              options: [
                { id: 'a', text: '2 anos', isCorrect: false },
                { id: 'b', text: '3 anos', isCorrect: false },
                { id: 'c', text: '5 anos', isCorrect: true },
                { id: 'd', text: '10 anos', isCorrect: false },
              ],
              explanation: 'O Art. 158, paragrafo 4, estabelece que a pretensao punitiva prescreve em 5 anos, contados da data da ciencia da infracao pela Administracao.',
            },
            {
              text: 'O recurso contra sancao administrativa na Lei 14.133/2021 possui efeito suspensivo?',
              options: [
                { id: 'a', text: 'Nao, nunca possui efeito suspensivo', isCorrect: false },
                { id: 'b', text: 'Sim, possui efeito suspensivo automatico', isCorrect: true },
                { id: 'c', text: 'Apenas se concedido pela autoridade competente', isCorrect: false },
                { id: 'd', text: 'Apenas para sancoes de multa e advertencia', isCorrect: false },
              ],
              explanation: 'O recurso contra sancao administrativa possui efeito suspensivo automatico, conforme previsto na Lei 14.133/2021, garantindo que a sancao so produz efeitos apos o transito em julgado administrativo.',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'Lei 14.133/2021 — Planalto',
            description: 'Texto integral — Arts. 155 a 163 sobre sancoes e processo administrativo.',
            url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
            category: 'legislacao',
          },
          {
            title: 'TCU — Jurisprudencia',
            description: 'Pesquisa de jurisprudencia do TCU sobre sancoes em contratos administrativos.',
            url: 'https://pesquisa.apps.tcu.gov.br/',
            category: 'jurisprudencia',
          },
        ],
      },
      {
        title: '(teste) Aula 3.3 — Extincao e rescisao contratual',
        slug: 'teste-extincao-rescisao',
        description: 'Hipoteses de extincao contratual previstas nos Arts. 137 a 139 da Lei 14.133/2021, procedimentos e consequencias.',
        estimatedMinutes: 22,
        leiArticles: ['137', '138', '139', '104'],
        isPublished: true,
        content: `# Extincao e Rescisao Contratual

## Introducao

A Lei 14.133/2021 adotou a terminologia "extincao" em substituicao a "rescisao" utilizada pela Lei 8.666/1993, abrangendo todas as hipoteses de encerramento do vinculo contratual. Os Arts. 137 a 139 disciplinam as causas, formas e procedimentos de extincao dos contratos administrativos.

A compreensao adequada das hipoteses de extincao e fundamental para o fiscal de contratos, pois e durante a execucao contratual que se verificam as situacoes que podem levar ao encerramento prematuro do vinculo, exigindo atuacao diligente e documentada.

## Formas de Extincao (Art. 137)

### I — Determinada por Ato Unilateral da Administracao

A Administracao pode extinguir unilateralmente o contrato quando:

1. **Inexecucao total ou parcial** que enseje rescisao
2. **Atraso injustificado** no inicio da execucao
3. **Paralisacao** sem justa causa e sem comunicacao previa
4. **Subcontratacao nao autorizada**
5. **Desatendimento** das determinacoes regulares da fiscalizacao
6. **Cometimento reiterado** de faltas na execucao
7. **Decretacao de falencia** ou insolvencia do contratado
8. **Razoes de interesse publico** justificadas pela autoridade maxima

### II — Consensual

- Por acordo entre as partes
- Formalizado por escrito no processo
- Desde que haja conveniencia para a Administracao
- Nao pode prejudicar interesse publico

### III — Determinada por Decisao Judicial

- Em acao proposta pelo contratado contra a Administracao
- Quando esgotadas as vias administrativas
- Sentenca judicial transitada em julgado ou decisao liminar

### IV — Determinada por Decisao Arbitral (Art. 138)

Inovacao da Lei 14.133/2021:
- Arbitragem conforme Lei 9.307/1996
- Em direito, no Brasil, em lingua portuguesa
- Para contratos que versem sobre direitos patrimoniais disponiveis

## Procedimentos (Art. 138)

### Extincao Unilateral

O procedimento para extincao unilateral deve observar:

1. **Notificacao previa** ao contratado com descricao dos motivos
2. **Prazo para defesa:** 15 dias uteis (Art. 138, paragrafo 1)
3. **Parecer juridico** sobre a regularidade do procedimento
4. **Decisao fundamentada** da autoridade competente
5. **Publicacao** do ato de extincao

### Consequencias da Extincao

A extincao do contrato acarreta:

- **Execucao da garantia** contratual (se houver)
- **Retencao de creditos** ate o limite dos prejuizos
- **Apuracao de responsabilidade** e eventual sancao
- **Assuncao do objeto** pela Administracao (Art. 139, I)

## Direitos do Contratado na Extincao (Art. 137, paragrafo 2)

Quando a extincao ocorre sem culpa do contratado:

- Ressarcimento dos prejuizos comprovados
- Devolucao da garantia contratual
- Pagamento dos servicos executados ate a data da extincao
- Pagamento do custo de desmobilizacao

## Extincao por Culpa da Administracao

O Art. 137, paragrafo 2, reconhece que o contratado pode pleitear a extincao quando:

1. **Suspensao da execucao** por prazo superior ao previsto no contrato
2. **Atraso de pagamento** superior a 2 meses (exceto em calamidade)
3. **Nao liberacao** de area, local ou objeto para execucao
4. **Alteracoes contratuais** que modifiquem o valor em mais de 25%

### Procedimento pelo Contratado

O contratado deve:

1. Notificar a Administracao por escrito
2. Aguardar pronunciamento da Administracao
3. Se nao atendido, recorrer ao Judiciario ou a arbitragem
4. **Manter a execucao** do contrato ate decisao final (Art. 137, paragrafo 3)

## Continuidade dos Servicos (Art. 139)

### Ocupacao Temporaria

O Art. 139 preve a possibilidade de a Administracao:

- **Assumir imediatamente** o objeto do contrato
- **Ocupar e utilizar** o local, instalacoes e equipamentos
- **Executar a garantia** contratual
- **Reter creditos** para ressarcimento de prejuizos

### Transicao Contratual

Para servicos continuos, a extincao deve prever:

- Periodo de transicao para novo contratado
- Transferencia de conhecimento
- Inventario de bens e documentos
- Garantia de continuidade dos servicos essenciais

## Jurisprudencia do TCU

- **Acordao 1.068/2014-Plenario:** A extincao unilateral deve ser precedida de notificacao e garantia de defesa
- **Acordao 3.011/2016-Plenario:** A Administracao deve documentar todos os fatos que fundamentam a extincao do contrato`,
        quiz: {
          title: 'Quiz — Extincao e Rescisao Contratual',
          questions: [
            {
              text: 'Quais sao as formas de extincao contratual previstas na Lei 14.133/2021?',
              options: [
                { id: 'a', text: 'Apenas unilateral pela Administracao e judicial', isCorrect: false },
                { id: 'b', text: 'Unilateral, consensual, judicial e por decisao arbitral', isCorrect: true },
                { id: 'c', text: 'Unilateral, consensual e por decurso do prazo', isCorrect: false },
                { id: 'd', text: 'Judicial, administrativa e legislativa', isCorrect: false },
              ],
              explanation: 'O Art. 137 preve quatro formas de extincao: por ato unilateral da Administracao, consensual (acordo), por decisao judicial e por decisao arbitral — esta ultima sendo inovacao da Lei 14.133/2021.',
            },
            {
              text: 'Em caso de atraso de pagamento pela Administracao, a partir de quanto tempo o contratado pode pleitear a extincao?',
              options: [
                { id: 'a', text: '30 dias', isCorrect: false },
                { id: 'b', text: '60 dias (2 meses)', isCorrect: true },
                { id: 'c', text: '90 dias (3 meses)', isCorrect: false },
                { id: 'd', text: '120 dias (4 meses)', isCorrect: false },
              ],
              explanation: 'O Art. 137, paragrafo 2, preve que o contratado pode pleitear a extincao quando o atraso de pagamento superar 2 meses, exceto em caso de calamidade publica.',
            },
            {
              text: 'Quando o contratado pleiteia a extincao por culpa da Administracao, ele deve:',
              options: [
                { id: 'a', text: 'Paralisar imediatamente a execucao do contrato', isCorrect: false },
                { id: 'b', text: 'Manter a execucao do contrato ate a decisao final', isCorrect: true },
                { id: 'c', text: 'Executar apenas 50% das obrigacoes contratadas', isCorrect: false },
                { id: 'd', text: 'Notificar a imprensa sobre a inadimplencia da Administracao', isCorrect: false },
              ],
              explanation: 'O Art. 137, paragrafo 3, estabelece que o contratado deve manter a execucao do contrato ate que seja proferida decisao sobre a extincao, evitando a interrupcao unilateral.',
            },
          ],
        },
        recommendedSites: [
          {
            title: 'Lei 14.133/2021 — Planalto',
            description: 'Texto integral — Arts. 137 a 139 sobre extincao contratual.',
            url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
            category: 'legislacao',
          },
          {
            title: 'TCU — Jurisprudencia',
            description: 'Acordaos do TCU sobre extincao e rescisao de contratos administrativos.',
            url: 'https://pesquisa.apps.tcu.gov.br/',
            category: 'jurisprudencia',
          },
          {
            title: 'Portal de Compras do Governo Federal',
            description: 'Manuais e orientacoes sobre gestao contratual e procedimentos de extincao.',
            url: 'https://www.gov.br/compras',
            category: 'legislacao',
          },
        ],
      },
    ],
  },
];

// ============================================================================
// FUNCOES
// ============================================================================

async function cleanup() {
  console.log('Removendo dados de teste do Curso 3...\n');

  const testModules = await prisma.module.findMany({
    where: { courseId: COURSE_ID, title: { contains: '(teste)' } },
    select: { id: true, title: true },
  });

  if (testModules.length === 0) {
    console.log('Nenhum dado de teste encontrado.');
    return;
  }

  console.log(`Encontrados ${testModules.length} modulos de teste:`);
  testModules.forEach(m => console.log(`  - ${m.title}`));

  if (isDryRun) {
    console.log('\n[DRY RUN] Nenhuma alteracao feita.');
    return;
  }

  const result = await prisma.module.deleteMany({
    where: { courseId: COURSE_ID, title: { contains: '(teste)' } },
  });

  console.log(`\n${result.count} modulos removidos (com todas as licoes e vinculos).`);
}

async function populate() {
  console.log('Populando LMS — Curso 3: Gestao e Fiscalizacao de Contratos\n');
  console.log(`Curso ID: ${COURSE_ID}`);
  console.log(`Modulos: ${TEST_MODULES.length}`);
  const totalLessonsExpected = TEST_MODULES.reduce((sum, m) => sum + m.lessons.length, 0);
  console.log(`Licoes: ${totalLessonsExpected}`);
  console.log(`Quizzes: ${totalLessonsExpected}`);
  console.log(`Perguntas: ${TEST_MODULES.reduce((sum, m) => sum + m.lessons.reduce((s, l) => s + l.quiz.questions.length, 0), 0)}`);
  console.log('');

  // Verificar dados de teste existentes
  const existing = await prisma.module.count({
    where: { courseId: COURSE_ID, title: { contains: '(teste)' } },
  });

  if (existing > 0) {
    console.log(`Ja existem ${existing} modulos de teste. Use --cleanup primeiro.`);
    return;
  }

  if (isDryRun) {
    console.log('[DRY RUN] Estrutura que seria criada:\n');
    for (const mod of TEST_MODULES) {
      console.log(`  ${mod.title}`);
      for (const lesson of mod.lessons) {
        console.log(`    ${lesson.title} (${lesson.estimatedMinutes}min, Art. ${lesson.leiArticles.join(', ')})`);
        console.log(`      Quiz: ${lesson.quiz.questions.length} perguntas`);
        console.log(`      Sites: ${lesson.recommendedSites.length} recomendados`);
      }
    }
    console.log('\n[DRY RUN] Nenhuma alteracao feita.');
    return;
  }

  let totalLessons = 0;
  let totalQuizzes = 0;
  let totalQuestions = 0;
  let totalSites = 0;

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
    console.log(`Modulo: ${mod.title}`);

    for (let i = 0; i < mod.lessons.length; i++) {
      const lessonData = mod.lessons[i];

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
      console.log(`  Licao: ${lessonData.title}`);

      // Criar Quiz
      const quiz = await prisma.quiz.create({
        data: {
          lessonId: lesson.id,
          title: lessonData.quiz.title,
          passingScore: 60,
          isPublished: true,
        },
      });
      totalQuizzes++;

      // Criar perguntas do Quiz
      for (let q = 0; q < lessonData.quiz.questions.length; q++) {
        const questionData = lessonData.quiz.questions[q];
        await prisma.quizQuestion.create({
          data: {
            quizId: quiz.id,
            type: 'multiple_choice',
            text: questionData.text,
            options: JSON.stringify(questionData.options),
            explanation: questionData.explanation,
            displayOrder: q,
            points: 1,
          },
        });
        totalQuestions++;
      }
      console.log(`    Quiz: ${lessonData.quiz.questions.length} perguntas`);

      // Criar sites recomendados
      for (let s = 0; s < lessonData.recommendedSites.length; s++) {
        const siteData = lessonData.recommendedSites[s];

        // Verificar se o site ja existe
        let site = await prisma.recommendedSite.findFirst({
          where: { url: siteData.url },
        });

        if (!site) {
          site = await prisma.recommendedSite.create({
            data: {
              title: siteData.title,
              description: siteData.description,
              url: siteData.url,
              category: siteData.category,
              displayOrder: s,
              isActive: true,
            },
          });
        }

        // Vincular ao curso (upsert para evitar duplicatas)
        await prisma.siteToCourse.upsert({
          where: {
            siteId_courseId: {
              siteId: site.id,
              courseId: COURSE_ID,
            },
          },
          update: {},
          create: {
            siteId: site.id,
            courseId: COURSE_ID,
            displayOrder: s,
          },
        });
        totalSites++;
      }
      console.log(`    Sites: ${lessonData.recommendedSites.length} recomendados`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`\nLMS populado com sucesso!`);
  console.log(`  Modulos: ${TEST_MODULES.length}`);
  console.log(`  Licoes: ${totalLessons}`);
  console.log(`  Quizzes: ${totalQuizzes}`);
  console.log(`  Perguntas: ${totalQuestions}`);
  console.log(`  Sites recomendados: ${totalSites}`);
  console.log(`\nAcesse: /admin/lms para gerenciar`);
  console.log(`Acesse: /area-restrita (curso "Gestao e Fiscalizacao de Contratos") para visualizar como aluno`);
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
