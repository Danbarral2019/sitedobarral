/**
 * Audit das leis no banco. Lista por type + valida conteúdo + cruza
 * com lista mínima exigida pelo usuário.
 */
import { prisma } from '../lib/prisma';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface Required {
  /** Tipo no schema do projeto */
  type: 'lei' | 'lei-complementar' | 'decreto-lei';
  number: string;
  year: number;
  /** Apelido/sigla */
  apelido: string;
  ementaCurta: string;
  url: string;
}

// Lista mínima exigida pelo usuário (11 atos)
const REQUIRED: Required[] = [
  { type: 'lei', number: '14.133', year: 2021, apelido: 'LLCA — Nova Lei de Licitações',
    ementaCurta: 'Lei de Licitações e Contratos Administrativos (fundamento principal).',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm' },
  { type: 'lei', number: '14.973', year: 2024, apelido: 'Alterou a Lei do CADIN',
    ementaCurta: 'Altera a Lei nº 10.522/2002 (CADIN), entre outras providências.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14973.htm' },
  { type: 'lei', number: '13.709', year: 2018, apelido: 'LGPD — Lei Geral de Proteção de Dados',
    ementaCurta: 'Dispõe sobre a proteção de dados pessoais (LGPD).',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm' },
  { type: 'lei', number: '12.527', year: 2011, apelido: 'LAI — Lei de Acesso à Informação',
    ementaCurta: 'Regula o acesso a informações no âmbito da Administração Pública.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm' },
  { type: 'lei', number: '12.305', year: 2010, apelido: 'PNRS — Política Nacional de Resíduos Sólidos',
    ementaCurta: 'Institui a Política Nacional de Resíduos Sólidos.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12305.htm' },
  { type: 'lei', number: '14.195', year: 2021, apelido: 'Tradução juramentada',
    ementaCurta: 'Dispõe sobre facilitação para abertura de empresas; inclui tradução juramentada.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14195.htm' },
  { type: 'lei', number: '8.429', year: 1992, apelido: 'Lei de Improbidade Administrativa',
    ementaCurta: 'Dispõe sobre as sanções aplicáveis aos agentes públicos por atos de improbidade.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm' },
  { type: 'lei', number: '4.320', year: 1964, apelido: 'Normas gerais de direito financeiro',
    ementaCurta: 'Estatui normas gerais de direito financeiro para União, Estados, Municípios e DF.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l4320.htm' },
  { type: 'lei', number: '10.522', year: 2002, apelido: 'CADIN — Cadastro Informativo de Créditos',
    ementaCurta: 'Dispõe sobre o Cadastro Informativo de Créditos não quitados (CADIN).',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10522.htm' },
  { type: 'lei-complementar', number: '101', year: 2000, apelido: 'LRF — Lei de Responsabilidade Fiscal',
    ementaCurta: 'Estabelece normas de finanças públicas voltadas para a responsabilidade fiscal.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm' },
  { type: 'decreto-lei', number: '4.657', year: 1942, apelido: 'LINDB — Lei de Introdução às Normas',
    ementaCurta: 'Lei de Introdução às Normas do Direito Brasileiro.',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657.htm' },
];

async function main() {
  // Listar tudo do banco
  const acts = await prisma.legislativeAct.findMany({
    where: {
      type: { in: ['lei', 'lei-complementar', 'decreto-lei', 'medida-provisoria'] },
    },
    orderBy: [{ type: 'asc' }, { year: 'desc' }, { number: 'desc' }],
  });

  console.log(`📋 ${acts.length} leis/LCs/decretos-lei no banco.\n`);
  for (const a of acts) {
    const validation = validateActContent({ url: a.officialUrl, content: a.content });
    const flag = !validation.ok ? '❌' : validation.warnings.length > 0 ? '⚠️' : '✅';
    console.log(`   ${flag} ${a.type.padEnd(20)} ${a.fullNumber.padEnd(38)} ${(a.content?.length ?? 0)} chars`);
  }

  // Cruzar com lista exigida
  console.log(`\n📌 Lista exigida pelo usuário (11 atos):`);
  const missing: Required[] = [];
  for (const req of REQUIRED) {
    const found = acts.find(
      (a) => a.number === req.number && a.year === req.year && a.type === req.type,
    );
    const present = !!found;
    const flag = present ? '✅' : '❌ FALTA';
    console.log(
      `   ${flag} ${req.type.padEnd(20)} ${`${req.number}/${req.year}`.padEnd(15)} ${req.apelido}`,
    );
    if (!present) missing.push(req);
  }

  // Sumário
  const okCount = acts.filter((a) => {
    const v = validateActContent({ url: a.officialUrl, content: a.content });
    return v.ok && v.warnings.length === 0;
  }).length;

  console.log(`\n📊 Resumo:`);
  console.log(`   Banco:               ${acts.length}`);
  console.log(`   ✅ OK:                ${okCount}`);
  console.log(`   ❌ Exigidas faltando: ${missing.length}`);

  // Salvar relatório
  const today = new Date().toISOString().slice(0, 10);
  const outFile = join(process.cwd(), 'docs', 'audits', `${today}-leis-audit-db.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        bancoTotal: acts.length,
        bancoEntries: acts.map((a) => ({
          fullNumber: a.fullNumber,
          type: a.type,
          number: a.number,
          year: a.year,
          chars: a.content?.length ?? 0,
          officialUrl: a.officialUrl,
        })),
        requiredMissing: missing,
      },
      null,
      2,
    ),
  );
  console.log(`\n💾 ${outFile}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
