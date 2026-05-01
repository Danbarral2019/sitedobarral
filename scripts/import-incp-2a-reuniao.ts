/**
 * import-incp-2a-reuniao.ts
 *
 * Cria os enunciados 44–54 do INCP (2ª Reunião Técnica) no DB.
 * Texto autoritativo é o mesmo de scripts/fix-incp-3a-edicao-text.ts (validado
 * pelo Prof. Daniel em 2026-05-01) — não usamos o JSON scraped porque o texto
 * do nº 54 no scrape vem com ruído de categorias/tags do rodapé do site.
 *
 * O apply de 30/04 (apply-incp-enunciados.ts) só faz UPDATE em ONs existentes,
 * por isso os 44–54 ficaram fora do DB mesmo tendo sido capturados pelo scrape.
 *
 * Padrão replicado dos enunciados 1–22 já existentes:
 *   - title: "Enunciado do INCP nº {n}"
 *   - type: "link", url da fonte oficial
 *   - tags: ["INCP","Enunciado",<tema>,"2ª Reunião Técnica INCP"]
 *   - courseId: null (todos os INCP existentes têm courseId null)
 *   - isPublic: true, isCommon: true, reviewed: false
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-incp-2a-reuniao.ts          # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/import-incp-2a-reuniao.ts --apply  # grava no DB
 */

import { prisma } from '../lib/prisma';

const FONTE_URL = 'https://incpbrasil.com.br/informativo-enunciados-2a-edicao/';
const REUNIAO_TAG = '2ª Reunião Técnica INCP';

const TEXTO_OFICIAL: Record<number, string> = {
  44: 'A ausência de previsão no edital não impede a autorização excepcional da subcontratação em contratos regidos pela Lei 13.303/2016, no caso de fato superveniente, observado o dever de motivação.',
  45: 'O fiscal e o gestor do contrato devem adotar postura colaborativa e dialógica com o contratado, buscando prevenir conflitos, mediante reuniões periódicas e tratativas formais para solução de problemas.',
  46: 'A Lei 14.133/2021 não obriga a adoção de dispensa eletrônica.',
  47: 'Considerando que a Lei 13.303/2016 não estabelece critérios específicos para a dosimetria das sanções aplicáveis pelas estatais, admite-se que os regulamentos internos definam aspectos objetivos — tais como gravidade, risco ao negócio, impacto reputacional, reincidência e colaboração do fornecedor — para parametrizar a decisão sancionadora.',
  48: 'Os instrumentos hábeis a substituir o termo de contrato sujeitam-se às normas de contratos administrativos.',
  49: 'A verificação de informações e documentos pelo agente público diretamente nos sítios eletrônicos oficiais de órgãos e entidades, desde que atestado nos autos, constitui meio legal de prova para todos os fins.',
  50: 'A omissão no dever de implementar a governança das contratações poderá ensejar responsabilização aos membros da alta administração de órgãos e entidades da Administração Pública.',
  51: 'Caso não seja realizada, durante o certame, a análise da proposta e da habilitação dos fornecedores incluídos no cadastro reserva do sistema de registro de preços, caberá a interposição de recurso administrativo por ocasião do chamamento desses fornecedores.',
  52: 'A adoção do orçamento sigiloso não afasta o dever de indicar a data do orçamento estimado no instrumento convocatório, para fins de definição da data-base para o reajustamento em sentido estrito.',
  53: 'Nas pesquisas de preços para obras e serviços de engenharia, é admissível a cotação com potenciais fornecedores, como fonte de preço subsidiária, caso esgotados os parâmetros previstos no art. 23, § 2º, da Lei 14.133/2021.',
  54: 'A previsão de regulamento do Poder Executivo federal no inciso VII do § 1º do art. 79 da Lei 14.133/2021 não impede a edição de regulamento pelos demais entes federativos e demais órgãos independentes.',
};

const TEMA_POR_NUM: Record<number, string> = {
  44: 'Estatais',
  45: 'Gestão Contratual',
  46: 'Contratação Direta',
  47: 'Estatais',
  48: 'Contratos',
  49: 'Habilitação',
  50: 'Governança',
  51: 'Registro de Preços',
  52: 'Orçamento',
  53: 'Pesquisa de Preços',
  54: 'Regulamentação',
};

function extrairArtigosLei14133(texto: string): string[] {
  const artigos = new Set<number>();
  const padroes = [
    /art(?:igos?)?\.?\s*(\d{1,3})(?:\s*[,e]\s*(\d{1,3}))?(?:\s*da\s+Lei\s+14\.133)?/gi,
    /Lei\s+14\.133[^.]*?art(?:igos?)?\.?\s*(\d{1,3})/gi,
  ];
  for (const re of padroes) {
    for (const m of texto.matchAll(re)) {
      for (let i = 1; i < m.length; i++) {
        if (m[i]) {
          const n = parseInt(m[i], 10);
          if (n > 0 && n <= 194) artigos.add(n);
        }
      }
    }
  }
  return Array.from(artigos).sort((a, b) => a - b).map(String);
}

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('='.repeat(60));
  console.log(`IMPORT-INCP-2A-REUNIAO — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));

  const numeros = Object.keys(TEXTO_OFICIAL).map((n) => parseInt(n, 10)).sort((a, b) => a - b);
  console.log(`Alvo: ${numeros.length} enunciados (${numeros[0]}–${numeros[numeros.length - 1]})\n`);

  let toCreate = 0;
  let alreadyExists = 0;
  const planos: Array<{ numero: number; action: 'create' | 'skip-exists'; title: string; leiArticles: string[]; tema: string }> = [];

  for (const n of numeros) {
    const titulo = `Enunciado do INCP nº ${n}`;
    const existente = await prisma.document.findFirst({
      where: { category: 'enunciados', entityType: 'INCP', enunciadoNumber: String(n) },
      select: { id: true, title: true },
    });
    const tema = TEMA_POR_NUM[n] || 'Diversos';
    const leiArticles = extrairArtigosLei14133(TEXTO_OFICIAL[n]);

    if (existente) {
      planos.push({ numero: n, action: 'skip-exists', title: existente.title, leiArticles, tema });
      alreadyExists++;
    } else {
      planos.push({ numero: n, action: 'create', title: titulo, leiArticles, tema });
      toCreate++;
    }
  }

  console.log(`Plano: 🆕 criar ${toCreate} | ⏭️ já existe ${alreadyExists}\n`);
  for (const p of planos) {
    const flag = p.action === 'create' ? '🆕' : '⏭️';
    const arts = p.leiArticles.length ? `arts ${p.leiArticles.join(',')}` : 'sem arts';
    console.log(`  ${flag} nº ${p.numero}: ${p.title} | tema="${p.tema}" | ${arts}`);
  }

  if (!apply) {
    console.log('\nPara aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/import-incp-2a-reuniao.ts --apply');
    await prisma.$disconnect();
    return;
  }

  console.log('\nCriando...');
  let success = 0;
  let errors = 0;
  for (const p of planos) {
    if (p.action !== 'create') continue;
    const texto = TEXTO_OFICIAL[p.numero];
    const tags = ['INCP', 'Enunciado', p.tema, REUNIAO_TAG];
    try {
      await prisma.document.create({
        data: {
          title: p.title,
          description: texto,
          content: texto,
          type: 'link',
          url: FONTE_URL,
          category: 'enunciados',
          entityType: 'INCP',
          enunciadoNumber: String(p.numero),
          isPublic: true,
          isCommon: true,
          reviewed: false,
          courseId: null,
          tags: JSON.stringify(tags),
          leiArticles: p.leiArticles.length > 0 ? JSON.stringify(p.leiArticles) : null,
        },
      });
      success++;
      console.log(`  ✅ nº ${p.numero}`);
    } catch (err) {
      errors++;
      console.log(`  ❌ nº ${p.numero}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n✅ Criadas: ${success} | ❌ Falhas: ${errors}`);
  const totalIncp = await prisma.document.count({ where: { category: 'enunciados', entityType: 'INCP' } });
  console.log(`Total INCP no DB: ${totalIncp}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
