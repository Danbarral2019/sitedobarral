/**
 * Script para migrar posts hardcoded para o banco de dados
 *
 * Uso:
 *   node scripts/migrate-blog-posts.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const blogPosts = [
  {
    id: '1',
    slug: 'nova-lei-licitacoes-principais-mudancas',
    title: 'Nova Lei de Licitações: Principais Mudanças e Impactos',
    excerpt: 'Análise detalhada das principais inovações trazidas pela Lei 14.133/2021 e seus impactos na prática das contratações públicas.',
    content: `A Lei nº 14.133/2021 representa um marco significativo na modernização das contratações públicas no Brasil.

Após quase 30 anos de vigência da Lei 8.666/93, a nova legislação traz importantes inovações que prometem tornar os processos licitatórios mais eficientes, transparentes e alinhados com as melhores práticas internacionais.

Entre as principais mudanças, destacam-se:

1. Portal Nacional de Contratações Públicas (PNCP)
A criação de um portal único centraliza todas as informações sobre licitações e contratos, aumentando significativamente a transparência.

2. Novas Modalidades de Licitação
O diálogo competitivo surge como uma modalidade inovadora para contratações complexas, permitindo maior interação entre a Administração e os licitantes.

3. Planejamento Obrigatório
A exigência de um Plano de Contratações Anual fortalece a fase de planejamento, reduzindo contratações emergenciais desnecessárias.

4. Gestão por Riscos
A matriz de riscos torna-se obrigatória em diversas situações, promovendo uma gestão mais profissional dos contratos.

5. Profissionalização dos Agentes Públicos
A lei estabelece requisitos mínimos de capacitação para agentes que atuam em licitações e contratos.`,
    author: 'Prof. Daniel Barral',
    publishedAt: new Date('2024-03-15'),
    tags: ['Lei 14.133/2021', 'Licitações', 'Inovações', 'PNCP'],
    isPublished: true,
  },
  {
    id: '2',
    slug: 'dialogo-competitivo-quando-utilizar',
    title: 'Diálogo Competitivo: Quando e Como Utilizar',
    excerpt: 'Entenda a nova modalidade licitatória introduzida pela Lei 14.133/2021 e suas aplicações práticas.',
    content: `O diálogo competitivo representa uma das mais significativas inovações da Lei 14.133/2021, inspirada em modelos europeus de contratação pública.

Esta modalidade é especialmente adequada para contratações complexas onde a Administração não consegue definir previamente as especificações técnicas com precisão suficiente.

Situações adequadas para o diálogo competitivo:
- Soluções inovadoras de tecnologia
- Projetos de infraestrutura complexos
- Parcerias público-privadas
- Contratações que envolvem múltiplas soluções técnicas possíveis

O procedimento divide-se em duas fases principais:
1. Fase de Diálogo: interação com os participantes para desenvolver soluções
2. Fase Competitiva: apresentação de propostas finais com base nas soluções desenvolvidas

A grande vantagem é permitir que a Administração aproveite o conhecimento do mercado antes de definir a solução final.`,
    author: 'Prof. Daniel Barral',
    publishedAt: new Date('2024-03-10'),
    tags: ['Diálogo Competitivo', 'Modalidades', 'Inovação', 'Lei 14.133/2021'],
    isPublished: true,
  },
  {
    id: '3',
    slug: 'matriz-riscos-contratos-administrativos',
    title: 'Matriz de Riscos em Contratos Administrativos',
    excerpt: 'Como elaborar e gerenciar a matriz de riscos exigida pela nova lei de licitações.',
    content: `A gestão de riscos tornou-se elemento central na nova sistemática de contratações públicas estabelecida pela Lei 14.133/2021.

A matriz de riscos é obrigatória em diversos casos, especialmente em:
- Contratações de grande vulto
- Contratos de eficiência
- Obras e serviços de engenharia
- Serviços contínuos

Elementos essenciais da matriz de riscos:

1. Identificação dos Riscos
Mapear todos os eventos que podem impactar o contrato, sejam positivos ou negativos.

2. Análise Qualitativa e Quantitativa
Avaliar probabilidade e impacto de cada risco identificado.

3. Alocação de Responsabilidades
Definir claramente quem assume cada risco: contratante, contratado ou compartilhado.

4. Medidas de Mitigação
Estabelecer ações preventivas e planos de contingência.

5. Monitoramento Contínuo
Acompanhar a evolução dos riscos durante toda a execução contratual.

A adequada gestão de riscos reduz conflitos, melhora a precificação e aumenta a segurança jurídica das contratações.`,
    author: 'Prof. Daniel Barral',
    publishedAt: new Date('2024-03-05'),
    tags: ['Matriz de Riscos', 'Gestão Contratual', 'Lei 14.133/2021', 'Planejamento'],
    isPublished: true,
  },
  {
    id: '4',
    slug: 'etp-estudo-tecnico-preliminar',
    title: 'ETP - Estudo Técnico Preliminar: Guia Completo',
    excerpt: 'Passo a passo para elaboração do Estudo Técnico Preliminar conforme a Lei 14.133/2021.',
    content: `O Estudo Técnico Preliminar (ETP) consolidou-se como peça fundamental do planejamento das contratações públicas.

Elementos obrigatórios do ETP:

1. Necessidade da Contratação
Demonstrar o problema a ser resolvido e os resultados esperados.

2. Requisitos da Contratação
Especificar requisitos técnicos, legais e de sustentabilidade.

3. Estimativa de Quantidades
Fundamentar as quantidades com base em séries históricas ou projeções.

4. Levantamento de Mercado
Identificar soluções disponíveis e fornecedores potenciais.

5. Estimativa de Preços
Realizar pesquisa de preços conforme metodologia da IN 65/2021.

6. Justificativa da Solução Escolhida
Demonstrar porque a solução escolhida é a mais adequada.

7. Análise de Riscos
Identificação preliminar dos principais riscos.

O ETP bem elaborado reduz significativamente os problemas durante a licitação e execução contratual.`,
    author: 'Prof. Daniel Barral',
    publishedAt: new Date('2024-02-28'),
    tags: ['ETP', 'Planejamento', 'Contratações', 'Lei 14.133/2021'],
    isPublished: true,
  },
  {
    id: '5',
    slug: 'sancoes-administrativas-nova-lei',
    title: 'Sanções Administrativas na Nova Lei de Licitações',
    excerpt: 'Mudanças no regime sancionatório e os cuidados necessários na aplicação de penalidades.',
    content: `A Lei 14.133/2021 trouxe importantes modificações no regime de sanções administrativas aplicáveis a licitantes e contratados.

Principais mudanças:

1. Tipificação mais clara das infrações
A nova lei detalha melhor as condutas passíveis de sanção, reduzindo a margem de discricionariedade.

2. Gradação das penalidades
Estabelece critérios objetivos para dosimetria das sanções, considerando:
- Natureza e gravidade da infração
- Vantagens obtidas
- Circunstâncias agravantes e atenuantes
- Antecedentes do infrator

3. Processo administrativo sancionador
Reforça as garantias do contraditório e ampla defesa, com prazos específicos para cada fase.

4. Reabilitação
Define condições claras para reabilitação do sancionado, incluindo prazos e requisitos.

5. Cadastro Nacional de Empresas Punidas
Centraliza informações sobre sanções aplicadas, aumentando a transparência.

É fundamental que os gestores observem rigorosamente o devido processo legal para evitar nulidades.`,
    author: 'Prof. Daniel Barral',
    publishedAt: new Date('2024-02-20'),
    tags: ['Sanções', 'Penalidades', 'Processo Administrativo', 'Lei 14.133/2021'],
    isPublished: true,
  },
];

async function migrateBlogPosts() {
  console.log('\n🔄 Iniciando migração de posts do blog...\n');

  let created = 0;
  let skipped = 0;

  for (const post of blogPosts) {
    try {
      // Verificar se já existe
      const existing = await prisma.blogPost.findUnique({
        where: { slug: post.slug }
      });

      if (existing) {
        console.log(`⏭️  Post "${post.title}" já existe (slug: ${post.slug})`);
        skipped++;
        continue;
      }

      // Criar post
      await prisma.blogPost.create({
        data: {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          author: post.author,
          publishedAt: post.publishedAt,
          isPublished: post.isPublished,
          tags: JSON.stringify(post.tags),
        },
      });

      console.log(`✅ Post "${post.title}" criado com sucesso`);
      created++;
    } catch (error) {
      console.error(`❌ Erro ao criar post "${post.title}":`, error.message);
    }
  }

  console.log('\n📊 Resumo da migração:');
  console.log(`   ✅ ${created} posts criados`);
  console.log(`   ⏭️  ${skipped} posts já existiam`);
  console.log(`   📝 Total: ${blogPosts.length} posts\n`);
}

migrateBlogPosts()
  .catch((error) => {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
