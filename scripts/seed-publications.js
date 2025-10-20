/**
 * Script para adicionar publicações de teste
 *
 * Uso:
 *   node scripts/seed-publications.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPublications() {
  console.log('\n📚 Adicionando publicações de teste...\n');

  try {
    // Verificar se já existem publicações
    const count = await prisma.publication.count();
    if (count > 0) {
      console.log(`⚠️  Já existem ${count} publicação(ões) no banco de dados.`);
      console.log('❓ Deseja continuar e adicionar mais? (Ctrl+C para cancelar)');
      // Aguardar 3 segundos antes de continuar
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Livros
    const livros = [
      {
        type: 'livro',
        title: 'Lei 14.133/2021 Comentada',
        description: 'Análise completa e comentários sobre a nova Lei de Licitações e Contratos Administrativos, com interpretações práticas e orientações para gestores públicos.',
        author: 'Prof. Daniel Barral',
        publisher: 'Editora Fórum',
        isbn: '978-65-5518-234-5',
        coverImage: '/images/livro-lei14133.jpg',
        publishedAt: new Date('2022-03-15'),
        isPublished: true,
      },
      {
        type: 'livro',
        title: 'Planejamento nas Contratações Públicas',
        description: 'Obra essencial sobre a importância do planejamento no processo de contratação pública, abordando estudos técnicos preliminares, pesquisa de preços e análise de riscos.',
        author: 'Prof. Daniel Barral',
        publisher: 'Editora Juspodivm',
        isbn: '978-65-5978-456-7',
        coverImage: '/images/livro-planejamento.jpg',
        publishedAt: new Date('2023-08-20'),
        isPublished: true,
      },
      {
        type: 'livro',
        title: 'Gestão e Fiscalização de Contratos',
        description: 'Manual prático para gestores e fiscais de contratos administrativos, com modelos de documentos, checklists e estudos de casos reais.',
        author: 'Prof. Daniel Barral',
        publisher: 'Editora Método',
        isbn: '978-85-309-9876-1',
        coverImage: '/images/livro-gestao.jpg',
        publishedAt: new Date('2023-11-10'),
        isPublished: true,
      },
    ];

    console.log('📖 Criando livros...');
    for (const livro of livros) {
      await prisma.publication.create({ data: livro });
      console.log(`   ✓ ${livro.title}`);
    }

    // Artigos
    const artigos = [
      {
        type: 'artigo',
        title: 'Inovação e Sustentabilidade nas Contratações Públicas',
        description: 'Artigo científico sobre a aplicação de critérios de sustentabilidade e inovação nas licitações públicas brasileiras, analisando casos práticos e desafios na implementação.',
        author: 'Prof. Daniel Barral',
        journal: 'Revista de Direito Administrativo (RDA)',
        externalUrl: 'https://bibliotecadigital.fgv.br/ojs/index.php/rda',
        publishedAt: new Date('2024-01-15'),
        isPublished: true,
      },
      {
        type: 'artigo',
        title: 'Aspectos Jurídicos da Terceirização no Setor Público',
        description: 'Análise profunda sobre os limites e possibilidades da terceirização na Administração Pública à luz da jurisprudência do TCU e STF.',
        author: 'Prof. Daniel Barral',
        journal: 'Revista Brasileira de Direito Público (RBDP)',
        externalUrl: 'https://www.editoraforum.com.br/revista-rbdp',
        publishedAt: new Date('2023-09-20'),
        isPublished: true,
      },
      {
        type: 'artigo',
        title: 'Processo Administrativo Sancionador na Lei 14.133/2021',
        description: 'Estudo sobre as inovações trazidas pela nova lei no processo administrativo sancionador, com ênfase nas garantias do contraditório e ampla defesa.',
        author: 'Prof. Daniel Barral',
        journal: 'Revista de Informação Legislativa (RIL)',
        externalUrl: 'https://www12.senado.leg.br/ril',
        publishedAt: new Date('2023-05-10'),
        isPublished: true,
      },
      {
        type: 'artigo',
        title: 'Contratação Direta: Hipóteses e Controles',
        description: 'Exame detalhado das hipóteses de dispensa e inexigibilidade de licitação, com foco nos mecanismos de controle e transparência.',
        author: 'Prof. Daniel Barral',
        journal: 'Revista Zênite de Licitações e Contratos (ILC)',
        externalUrl: 'https://www.zenite.com.br',
        publishedAt: new Date('2024-03-05'),
        isPublished: true,
      },
    ];

    console.log('\n📄 Criando artigos científicos...');
    for (const artigo of artigos) {
      await prisma.publication.create({ data: artigo });
      console.log(`   ✓ ${artigo.title}`);
    }

    // Notícias/Eventos
    const noticias = [
      {
        type: 'noticia',
        title: 'Palestra: "Inovações da Lei 14.133/2021" no TCE-BA',
        description: 'O Prof. Daniel Barral ministrará palestra sobre as principais inovações trazidas pela nova Lei de Licitações para servidores do Tribunal de Contas do Estado da Bahia.',
        author: 'Prof. Daniel Barral',
        eventDate: new Date('2024-11-20T14:00:00'),
        location: 'Auditório do TCE-BA, Salvador/BA',
        externalUrl: 'https://www.tce.ba.gov.br/eventos',
        publishedAt: new Date('2024-10-15'),
        isPublished: true,
      },
      {
        type: 'noticia',
        title: 'Participação no III Congresso Brasileiro de Licitações',
        description: 'Apresentação do painel "Planejamento e Gestão de Riscos nas Contratações Públicas" no maior evento sobre licitações do país.',
        author: 'Prof. Daniel Barral',
        eventDate: new Date('2024-12-05T09:00:00'),
        location: 'Centro de Convenções, Brasília/DF',
        externalUrl: 'https://congressolicitacoes.com.br',
        publishedAt: new Date('2024-10-01'),
        isPublished: true,
      },
      {
        type: 'noticia',
        title: 'Lançamento de Novo Curso: Assessoramento Jurídico',
        description: 'Será lançado em breve o curso "Assessoramento Jurídico na Nova Lei de Licitações", voltado para procuradores e advogados públicos.',
        author: 'Prof. Daniel Barral',
        eventDate: new Date('2024-11-01'),
        location: 'Online - Plataforma EAD',
        externalUrl: null,
        publishedAt: new Date('2024-10-10'),
        isPublished: true,
      },
      {
        type: 'noticia',
        title: 'Entrevista: Desafios da Nova Lei de Licitações',
        description: 'Entrevista concedida ao Portal de Notícias Jus.com.br sobre os principais desafios enfrentados por gestores públicos na implementação da Lei 14.133/2021.',
        author: 'Prof. Daniel Barral',
        eventDate: new Date('2024-09-15'),
        location: 'Portal Jus.com.br',
        externalUrl: 'https://jus.com.br/artigos/entrevista-daniel-barral',
        publishedAt: new Date('2024-09-15'),
        isPublished: true,
      },
    ];

    console.log('\n📰 Criando notícias e eventos...');
    for (const noticia of noticias) {
      await prisma.publication.create({ data: noticia });
      console.log(`   ✓ ${noticia.title}`);
    }

    const total = livros.length + artigos.length + noticias.length;
    console.log(`\n✅ ${total} publicações adicionadas com sucesso!\n`);
    console.log('📊 Resumo:');
    console.log(`   📖 Livros: ${livros.length}`);
    console.log(`   📄 Artigos: ${artigos.length}`);
    console.log(`   📰 Notícias/Eventos: ${noticias.length}`);
    console.log('\n🎉 Acesse /publicacoes para visualizar!\n');

  } catch (error) {
    console.error('\n❌ Erro ao criar publicações:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedPublications();
