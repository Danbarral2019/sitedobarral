/**
 * Script para atualizar artigos da Lei 14.133 com alteracoes da Lei 15.266/2025
 * DOU 24.11.2025 - Sistema de Compras Expressas (Sicx)
 *
 * Artigos alterados: 79, 87, 174, 175
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const art79 = `O credenciamento podera ser usado nas seguintes hipoteses de contratacao:

I - paralela e nao excludente: caso em que e viavel e vantajosa para a Administracao a realizacao de contratacoes simultaneas em condicoes padronizadas;

II - com selecao a criterio de terceiros: caso em que a selecao do contratado esta a cargo do beneficiario direto da prestacao;

III - em mercados fluidos: caso em que a flutuacao constante do valor da prestacao e das condicoes de contratacao inviabiliza a selecao de agente por meio de processo de licitacao.

IV - comercio eletronico: caso em que a Administracao visa a contratar bens e servicos comuns padronizados ofertados no Sistema de Compras Expressas (Sicx). (Incluido pela Lei n. 15.266, de 2025)

Par. 1o Os procedimentos de credenciamento serao definidos em regulamento, observadas as seguintes regras: (Redacao dada pela Lei n. 15.266, de 2025)

I - a Administracao devera divulgar e manter a disposicao do publico, em sitio eletronico oficial, edital de chamamento de interessados, de modo a permitir o cadastramento permanente de novos interessados;

II - na hipotese do inciso I do caput deste artigo, quando o objeto nao permitir a contratacao imediata e simultanea de todos os credenciados, deverao ser adotados criterios objetivos de distribuicao da demanda;

III - o edital de chamamento de interessados devera prever as condicoes padronizadas de contratacao e, nas hipoteses dos incisos I e II do caput deste artigo, devera definir o valor da contratacao;

IV - na hipotese do inciso III do caput deste artigo, a Administracao devera registrar as cotacoes de mercado vigentes no momento da contratacao;

V - nao sera permitido o cometimento a terceiros do objeto contratado sem autorizacao expressa da Administracao;

VI - sera admitida a denuncia por qualquer das partes nos prazos fixados no edital.

VII - na hipotese do inciso IV do caput deste artigo, regulamento do Poder Executivo federal dispora sobre: (Incluido pela Lei n. 15.266, de 2025)

a) as condicoes de admissao e de permanencia dos fornecedores, observado o disposto no art. 87 desta Lei;

b) as regras para inclusao de bens e servicos e para formacao e alteracao dos precos;

c) os prazos e os metodos para entrega e recebimento dos bens e servicos;

d) as regras de instrucao processual e de uso da plataforma;

e) as condicoes de pagamento, com prazo nao superior a 30 (trinta) dias, contado do recebimento do bem ou servico;

f) as sancoes aplicaveis ao responsavel por infracoes, observado o disposto nos arts. 155 a 163 desta Lei.

Par. 2o O Sicx podera ser disponibilizado para os orgaos e entidades de que trata o caput do art. 1o desta Lei, para empresas publicas, para sociedades de economia mista e suas subsidiarias e para entidades privadas sem fins lucrativos. (Incluido pela Lei n. 15.266, de 2025)`;

const art87 = `Para os fins desta Lei, os orgaos e entidades da Administracao Publica deverao utilizar o sistema de registro cadastral unificado disponivel no Portal Nacional de Contratacoes Publicas (PNCP), para efeito de cadastro unificado de licitantes e de contratados, na forma estabelecida em regulamento do Poder Executivo federal. (Redacao dada pela Lei n. 15.266, de 2025)

Par. 1o O sistema de registro cadastral unificado sera publico e devera ser amplamente divulgado e estar permanentemente aberto aos interessados, e sera obrigatoria a realizacao de chamamento publico pela internet, no minimo anualmente, para atualizacao dos registros existentes e para ingresso de novos interessados.

Par. 2o E proibida a exigencia, pelo orgao ou entidade licitante, de registro cadastral complementar para acesso a edital e anexos.

Par. 3o A Administracao podera realizar licitacao restrita a fornecedores cadastrados, atendidos os criterios, as condicoes e os limites estabelecidos em regulamento, bem como a ampla publicidade dos procedimentos para o cadastramento.

Par. 4o Na hipotese a que se refere o Par. 3o deste artigo, sera admitido fornecedor que realize seu cadastro dentro do prazo previsto no edital para apresentacao de propostas.`;

const art174 = `E criado o Portal Nacional de Contratacoes Publicas (PNCP), sitio eletronico oficial destinado a:

I - divulgacao centralizada e obrigatoria dos atos exigidos por esta Lei;

II - realizacao facultativa das contratacoes pelos orgaos e entidades dos Poderes Executivo, Legislativo e Judiciario de todos os entes federativos.

Par. 1o O PNCP sera gerido pelo Comite Gestor da Rede Nacional de Contratacoes Publicas, a ser presidido por representante indicado pelo Presidente da Republica e composto de:

I - 3 (tres) representantes da Uniao indicados pelo Presidente da Republica;

II - 2 (dois) representantes dos Estados e do Distrito Federal indicados pelo Conselho Nacional de Secretarios de Estado da Administracao;

III - 2 (dois) representantes dos Municipios indicados pela Confederacao Nacional de Municipios.

Par. 2o O PNCP contera, entre outras, as seguintes informacoes acerca das contratacoes:

I - planos de contratacao anuais;

II - catalogos eletronicos de padronizacao;

III - editais de credenciamento e de pre-qualificacao, avisos de contratacao direta e editais de licitacao e respectivos anexos;

IV - atas de registro de precos;

V - contratos e termos aditivos;

VI - notas fiscais eletronicas, quando for o caso.

Par. 3o O PNCP devera, entre outras funcionalidades, oferecer:

I - sistema de registro cadastral unificado;

II - painel para consulta de precos, banco de precos em saude e acesso a base nacional de notas fiscais eletronicas;

III - sistema de planejamento e gerenciamento de contratacoes, incluido o cadastro de atesto de cumprimento de obrigacoes previsto no Par. 4o do art. 88 desta Lei;

IV - sistema eletronico para a realizacao de sessoes publicas;

V - acesso ao Cadastro Nacional de Empresas Inidoneas e Suspensas (Ceis) e ao Cadastro Nacional de Empresas Punidas (Cnep);

VI - sistema de gestao compartilhada com a sociedade de informacoes referentes a execucao do contrato, que possibilite:

a) envio, registro, armazenamento e divulgacao de mensagens de texto, imagens e documentos entre os agentes publicos e a sociedade;

b) acompanhamento do cronograma fisico e financeiro dos contratos;

c) avaliacao da qualidade de obras e servicos prestados.

VII - o Sicx. (Incluido pela Lei n. 15.266, de 2025)

Par. 3o-A. As funcionalidades a que se refere o Par. 3o deste artigo serao os sistemas adotados e oferecidos pelo Poder Executivo federal. (Incluido pela Lei n. 15.266, de 2025)

Par. 4o As funcionalidades a que se refere o Par. 3o deste artigo poderao ser disponibilizadas aos orgaos e as entidades dos Poderes Executivo, Legislativo e Judiciario de todos os entes federativos, nos termos estabelecidos pelo Comite Gestor.

Par. 5o Sem prejuizo de outros documentos, editais, atas de registro de precos e contratos deverao ser cadastrados no PNCP.`;

const art175 = `Sem prejuizo do disposto no art. 174 desta Lei, os entes federativos poderao instituir sitio eletronico oficial para divulgacao complementar e realizacao das respectivas contratacoes.

Par. 1o Desde que mantida a integracao com o PNCP, as contratacoes poderao ser realizadas por meio de sistema eletronico fornecido por pessoa juridica de direito publico ou privado, na forma de regulamento do Poder Executivo federal. (Redacao dada pela Lei n. 15.266, de 2025)

Par. 2o Ate 31 de dezembro de 2023, os Municipios deverao realizar divulgacao complementar de suas contratacoes mediante publicacao de extrato de edital de licitacao em jornal diario de grande circulacao local. (Promulgacao partes vetadas)`;

const UPDATES = { '79': art79, '87': art87, '174': art174, '175': art175 };

async function main() {
  console.log('Atualizando Lei 14.133 com alteracoes da Lei 15.266/2025...');
  console.log('   Sistema de Compras Expressas (Sicx)\n');

  let updated = 0;
  for (const [numero, ementa] of Object.entries(UPDATES)) {
    const article = await prisma.leiArticle.findUnique({ where: { numero } });
    if (!article) {
      console.log('Art. ' + numero + ' nao encontrado');
      continue;
    }
    await prisma.leiArticle.update({ where: { numero }, data: { ementa } });
    console.log('Art. ' + numero + ' atualizado');
    updated++;
  }

  console.log('\n' + '='.repeat(50));
  console.log('Resultado: ' + updated + ' artigos atualizados');
  console.log('='.repeat(50));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Erro:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
