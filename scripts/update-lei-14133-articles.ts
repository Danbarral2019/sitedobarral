/**
 * Atualiza Art. 79, 87, 174 e 175 da Lei 14.133/2021 com a redação vigente
 * pós-Lei 15.266/2025 (que introduziu o Sicx — Sistema de Compras Expressas).
 *
 * Texto curado manualmente a partir do Planalto (versão atualizada). Edição
 * direta porque o auto-extract precisa lidar com Planalto exibindo redação
 * tachada + nova lado a lado, e a precisão do texto legal é crítica.
 *
 * Atualiza:
 *   - tabela LeiArticle no DB (usado pela busca IA / lei-comentada)
 *   - data/lei-14133-artigos.ts (static file usado em build/seed)
 *   - re-índex dos embeddings via embeddingStatus='pending' nos atos afetados
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/update-lei-14133-articles.ts            # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/update-lei-14133-articles.ts --apply
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');

interface ArticleUpdate {
  numero: string;
  ementa: string;
  motivo: string;
}

const UPDATES: ArticleUpdate[] = [
  {
    numero: '79',
    motivo: 'Lei 15.266/2025 — incluiu inciso IV (Sicx), §1º (renumerado), inciso VII com alíneas a-f e §2º',
    ementa: `Art. 79. O credenciamento poderá ser usado nas seguintes hipóteses de contratação:

I - paralela e não excludente: caso em que é viável e vantajosa para a Administração a realização de contratações simultâneas em condições padronizadas;

II - com seleção a critério de terceiros: caso em que a seleção do contratado está a cargo do beneficiário direto da prestação;

III - em mercados fluidos: caso em que a flutuação constante do valor da prestação e das condições de contratação inviabiliza a seleção de agente por meio de processo de licitação;

IV - comércio eletrônico: caso em que a Administração visa a contratar bens e serviços comuns padronizados ofertados no Sistema de Compras Expressas (Sicx). (Incluído pela Lei nº 15.266, de 2025)

§ 1º Os procedimentos de credenciamento serão definidos em regulamento, observadas as seguintes regras: (Redação dada pela Lei nº 15.266, de 2025)

I - a Administração deverá divulgar e manter à disposição do público, em sítio eletrônico oficial, edital de chamamento de interessados, de modo a permitir o cadastramento permanente de novos interessados;

II - na hipótese do inciso I do caput deste artigo, quando o objeto não permitir a contratação imediata e simultânea de todos os credenciados, deverão ser adotados critérios objetivos de distribuição da demanda;

III - o edital de chamamento de interessados deverá prever as condições padronizadas de contratação e, nas hipóteses dos incisos I e II do caput deste artigo, deverá definir o valor da contratação;

IV - na hipótese do inciso III do caput deste artigo, a Administração deverá registrar as cotações de mercado vigentes no momento da contratação;

V - não será permitido o cometimento a terceiros do objeto contratado sem autorização expressa da Administração;

VI - será admitida a denúncia por qualquer das partes nos prazos fixados no edital;

VII - na hipótese do inciso IV do caput deste artigo, regulamento do Poder Executivo federal disporá sobre: (Incluído pela Lei nº 15.266, de 2025)

a) as condições de admissão e de permanência dos fornecedores, observado o disposto no art. 87 desta Lei;

b) as regras para inclusão de bens e serviços e para formação e alteração dos preços;

c) os prazos e os métodos para entrega e recebimento dos bens e serviços;

d) as regras de instrução processual e de uso da plataforma;

e) as condições de pagamento, com prazo não superior a 30 (trinta) dias, contado do recebimento do bem ou serviço;

f) as sanções aplicáveis ao responsável por infrações, observado o disposto nos arts. 155 a 163 desta Lei.

§ 2º O Sicx poderá ser disponibilizado para os órgãos e entidades de que trata o art. 1º desta Lei e, no que couber, para os entes federativos, suas subsidiárias e para entidades privadas sem fins lucrativos. (Incluído pela Lei nº 15.266, de 2025)`,
  },
  {
    numero: '87',
    motivo: 'Lei 15.266/2025 — caput passou a incluir "e de contratados" + "regulamento do Poder Executivo federal"',
    ementa: `Art. 87. Para os fins desta Lei, os órgãos e entidades da Administração Pública deverão utilizar o sistema de registro cadastral unificado disponível no Portal Nacional de Contratações Públicas (PNCP), para efeito de cadastro unificado de licitantes e de contratados, na forma estabelecida em regulamento do Poder Executivo federal. (Redação dada pela Lei nº 15.266, de 2025)

§ 1º O sistema de registro cadastral unificado será público e deverá ser amplamente divulgado e estar permanentemente aberto aos interessados, e será obrigatória a realização de chamamento público pela internet, no mínimo anualmente, para atualização dos registros existentes e para ingresso de novos interessados.

§ 2º É proibida a exigência, pelo órgão ou entidade licitante, de registro cadastral complementar para acesso a edital e anexos.

§ 3º A Administração poderá realizar licitação restrita a fornecedores cadastrados, atendidos os critérios, as condições e os limites estabelecidos em regulamento, bem como a ampla publicidade dos procedimentos para o cadastramento.

§ 4º Na hipótese a que se refere o § 3º deste artigo, será admitido fornecedor que realize seu cadastro dentro do prazo previsto no edital para apresentação de propostas.`,
  },
  {
    numero: '174',
    motivo: 'Lei 15.266/2025 — adicionou inciso VII (Sicx) ao §3º e novo §3º-A',
    ementa: `Art. 174. É criado o Portal Nacional de Contratações Públicas (PNCP), sítio eletrônico oficial destinado à:

I - divulgação centralizada e obrigatória dos atos exigidos por esta Lei;

II - realização facultativa das contratações pelos órgãos e entidades dos Poderes Executivo, Legislativo e Judiciário de todos os entes federativos.

§ 1º O PNCP será gerido pelo Comitê Gestor da Rede Nacional de Contratações Públicas, a ser presidido por representante indicado pelo Presidente da República e composto de:

I - 3 (três) representantes da União indicados pelo Presidente da República;

II - 2 (dois) representantes dos Estados e do Distrito Federal indicados pelo Conselho Nacional de Secretários de Estado da Administração;

III - 2 (dois) representantes dos Municípios indicados pela Confederação Nacional de Municípios.

§ 2º O PNCP conterá, entre outras, as seguintes informações acerca das contratações:

I - planos de contratação anuais;

II - catálogos eletrônicos de padronização;

III - editais de credenciamento e de pré-qualificação, avisos de contratação direta e editais de licitação e respectivos anexos;

IV - atas de registro de preços;

V - contratos e termos aditivos;

VI - notas fiscais eletrônicas, quando for o caso.

§ 3º O PNCP deverá, entre outras funcionalidades, oferecer:

I - sistema de registro cadastral unificado;

II - painel para consulta de preços, banco de preços em saúde e acesso à base nacional de notas fiscais eletrônicas;

III - sistema de planejamento e gerenciamento de contratações, incluído o cadastro de atesto de cumprimento de obrigações previsto no § 4º do art. 88 desta Lei;

IV - sistema eletrônico para a realização de sessões públicas;

V - acesso ao Cadastro Nacional de Empresas Inidôneas e Suspensas (Ceis) e ao Cadastro Nacional de Empresas Punidas (Cnep);

VI - sistema de gestão compartilhada com a sociedade de informações referentes à execução do contrato, que possibilite:

a) envio, registro, armazenamento e divulgação de mensagens de texto ou imagens pelo interessado previamente identificado;

b) acesso ao sistema informatizado de acompanhamento de obras a que se refere o inciso III do caput do art. 19 desta Lei;

c) comunicação entre a população e representantes da Administração e do contratado designados para prestar as informações e esclarecimentos pertinentes, na forma de regulamento;

d) divulgação, na forma de regulamento, de relatório final com informações sobre a consecução dos objetivos que tenham justificado a contratação e eventuais condutas a serem adotadas para o aprimoramento das atividades da Administração;

VII - o Sicx. (Incluído pela Lei nº 15.266, de 2025)

§ 3º-A. As funcionalidades a que se refere o § 3º deste artigo serão os sistemas adotados e oferecidos pelo Poder Executivo federal. (Incluído pela Lei nº 15.266, de 2025)

§ 4º O PNCP adotará o formato de dados abertos e observará as exigências previstas na Lei nº 12.527, de 18 de novembro de 2011.

§ 5º (VETADO).`,
  },
  {
    numero: '175',
    motivo: 'Lei 15.266/2025 — §1º passou a admitir pessoa jurídica de direito público OU privado, com regulamento federal',
    ementa: `Art. 175. Sem prejuízo do disposto no art. 174 desta Lei, os entes federativos poderão instituir sítio eletrônico oficial para divulgação complementar e realização das respectivas contratações.

§ 1º Desde que mantida a integração com o PNCP, as contratações poderão ser realizadas por meio de sistema eletrônico fornecido por pessoa jurídica de direito público ou privado, na forma de regulamento do Poder Executivo federal. (Redação dada pela Lei nº 15.266, de 2025)

§ 2º Até 31 de dezembro de 2023, os Municípios deverão realizar divulgação complementar de suas contratações mediante publicação de extrato de edital de licitação em jornal diário de grande circulação local. (Promulgação partes vetadas)`,
  },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  console.log(`=== Atualização Lei 14.133/2021 (Lei 15.266/2025) ===`);
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  for (const u of UPDATES) {
    console.log(`Art. ${u.numero}: ${u.motivo}`);
    console.log(`  novo (${u.ementa.length} chars): "${u.ementa.slice(0, 200).replace(/\n/g, ' ')}…"`);
  }

  if (!APPLY) {
    console.log('\n(dry-run — nada gravado)');
    await prisma.$disconnect();
    return;
  }

  // Backup
  const staticPath = path.join(process.cwd(), 'data', 'lei-14133-artigos.ts');
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(staticPath, path.join(backupDir, `lei-14133-artigos-pre-15266-${ts}.ts`));
  console.log(`\n✅ Backup do static file salvo em data/backups/`);

  // 1) Atualiza LeiArticle (usado pela página lei-comentada)
  for (const u of UPDATES) {
    const r = await prisma.leiArticle.updateMany({
      where: { numero: u.numero },
      data: { ementa: u.ementa },
    });
    console.log(`  ✅ LeiArticle Art. ${u.numero}: ${r.count} linha(s) atualizada(s)`);
  }

  // 2) Atualiza Document(category='lei-artigo').content — usado pelo
  // pipeline de embeddings da busca IA. Marca embeddingStatus=pending para
  // forçar re-indexação.
  for (const u of UPDATES) {
    const docs = await prisma.document.findMany({
      where: { category: 'lei-artigo', title: { contains: `Art. ${u.numero}` } },
      select: { id: true, title: true },
    });
    for (const doc of docs) {
      // O title é exatamente "Art. N - Lei 14.133/2021" — confirma match exato.
      const exactMatch = new RegExp(`^Art\\.\\s*${u.numero}\\s*-`).test(doc.title);
      if (!exactMatch) continue;
      await prisma.document.update({
        where: { id: doc.id },
        data: { content: u.ementa, embeddingStatus: 'pending' },
      });
      console.log(`  ✅ Document Art. ${u.numero} (${doc.id.slice(0, 8)}): content atualizado + pending re-índex`);
    }
  }

  // 2) Static file edits
  let staticContent = fs.readFileSync(staticPath, 'utf-8');
  let staticUpdated = 0;
  for (const u of UPDATES) {
    const numEsc = escapeRegex(u.numero);
    const blockRe = new RegExp(
      `(numero:\\s*"${numEsc}",[\\s\\S]*?ementa:\\s*)"((?:[^"\\\\]|\\\\.)*)"`,
      'm',
    );
    const m = blockRe.exec(staticContent);
    if (!m) {
      console.log(`  ⚠️  Static: Art. ${u.numero} não casou — pular`);
      continue;
    }
    const escaped = u.ementa.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    staticContent = staticContent.slice(0, m.index)
      + m[1] + `"${escaped}"`
      + staticContent.slice(m.index + m[0].length);
    staticUpdated++;
  }
  fs.writeFileSync(staticPath, staticContent);
  console.log(`  ✅ Static file: ${staticUpdated} ementas atualizadas`);

  console.log(`\n⏳ Próximo passo: re-rodar embedding indexing pra esses artigos.`);
  console.log(`   (LeiArticle não usa o pipeline padrão de embeddings — talvez seja preciso`);
  console.log(`    rodar um script específico ou dependa do FTS via tsvector.)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
