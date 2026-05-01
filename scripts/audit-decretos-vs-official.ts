/**
 * Audit completo dos decretos: cruza banco com lista oficial gov.br/compras
 * (decretos vigentes). Foco: identificar decretos que regulamentam a Lei
 * 14.133/2021 que estão faltando.
 */
import { prisma } from '../lib/prisma';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface OfficialDecreto {
  number: string;
  year: number;
  title: string;
  url: string;
  /** Heurística: regulamenta Lei 14.133 baseado no título */
  regulamenta14133?: boolean;
}

// Lista do gov.br/compras "Decretos Vigentes" (extraída em 2026-05-01)
// Selecionei os mais relevantes pra contratações públicas + todos que
// regulamentam Lei 14.133/2021.
const OFFICIAL_DECRETOS: OfficialDecreto[] = [
  // ── 2025-2026 ──
  { number: '12.807', year: 2025, title: 'Atualiza os valores estabelecidos na Lei nº 14.133, de 1º de abril de 2021.', url: 'https://www.in.gov.br/en/web/dou/-/decreto-n-12.807-de-29-de-dezembro-de-2025-678387990', regulamenta14133: true },
  { number: '12.785', year: 2025, title: 'Dispõe sobre mecanismos para promoção da circularidade de bens móveis.', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12785.htm' },
  { number: '12.516', year: 2025, title: 'Altera o Decreto nº 11.430 (mulheres vítimas de violência doméstica em contratações).', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12516.htm', regulamenta14133: true },
  // ── 2024 ──
  { number: '12.343', year: 2024, title: 'Atualiza os valores estabelecidos na Lei nº 14.133, de 1º de abril de 2021.', url: 'https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2024/Decreto/D12343.htm', regulamenta14133: true },
  { number: '12.304', year: 2024, title: 'Regulamenta art. 25, § 4º, art. 60, IV e art. 163, p.u. da Lei nº 14.133/2021 (programas de integridade).', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/decreto/D12304.htm', regulamenta14133: true },
  { number: '12.174', year: 2024, title: 'Garantias trabalhistas em contratos administrativos federais.', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/decreto/D12174.htm', regulamenta14133: true },
  { number: '11.890', year: 2024, title: 'Regulamenta art. 26 da Lei nº 14.133 (margem de preferência).', url: 'https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2024/Decreto/D11890.htm', regulamenta14133: true },
  { number: '11.878', year: 2024, title: 'Regulamenta art. 79 da Lei nº 14.133 (credenciamento).', url: 'https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2024/Decreto/D11878.htm', regulamenta14133: true },
  // ── 2023 ──
  { number: '11.871', year: 2023, title: 'Atualiza os valores estabelecidos na Lei nº 14.133, de 2021.', url: 'https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2023/Decreto/D11871.htm', regulamenta14133: true },
  { number: '11.476', year: 2023, title: 'Regulamenta o Programa de Aquisição de Alimentos.', url: 'http://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11476.htm' },
  { number: '11.462', year: 2023, title: 'Regulamenta arts. 82 a 86 da Lei nº 14.133 (Sistema de Registro de Preços).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11462.htm', regulamenta14133: true },
  { number: '11.461', year: 2023, title: 'Regulamenta art. 31 da Lei nº 14.133 (leilão eletrônico de bens móveis).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11461.htm', regulamenta14133: true },
  { number: '11.430', year: 2023, title: 'Regulamenta a Lei nº 14.133 (mulheres vítimas de violência doméstica).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11430.htm', regulamenta14133: true },
  // ── 2022 ──
  { number: '11.317', year: 2022, title: 'Atualiza os valores estabelecidos na Lei nº 14.133 (revogado pelo 11.871).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/D11317.htm', regulamenta14133: true },
  { number: '11.246', year: 2022, title: 'Regulamenta § 3º do art. 8º da Lei nº 14.133 (atuação do agente de contratação).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/D11246.htm', regulamenta14133: true },
  { number: '10.947', year: 2022, title: 'Regulamenta inciso VII do art. 12 da Lei nº 14.133 (plano anual de contratações).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/D10947.htm', regulamenta14133: true },
  { number: '10.929', year: 2022, title: 'Procedimento para consultas públicas de decretos da Lei nº 14.133.', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/D10929.htm', regulamenta14133: true },
  // ── 2021 ──
  { number: '10.818', year: 2021, title: 'Regulamenta art. 20 da Lei nº 14.133 (bens de luxo).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/decreto/D10818.htm', regulamenta14133: true },
  { number: '10.764', year: 2021, title: 'Comitê Gestor da Rede Nacional de Contratações Públicas (§ 1º art. 174 Lei 14.133).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/Decreto/D10764.htm', regulamenta14133: true },
  { number: '10.667', year: 2021, title: 'Altera Decreto 9.764 (recebimento de doações).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2021/Decreto/D10667.htm' },
  // ── 2020 ──
  { number: '10.554', year: 2020, title: 'Declara revogação de decretos normativos.', url: 'http://www.planalto.gov.br/CCIVIL_03/_Ato2019-2022/2020/Decreto/D10554.htm' },
  { number: '10.426', year: 2020, title: 'Descentralização de créditos.', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Decreto/D10426.htm' },
  { number: '10.340', year: 2020, title: 'Altera Decreto 9.373 (alienação de bens móveis).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Decreto/D10340.htm' },
  { number: '10.314', year: 2020, title: 'Altera Decreto 9.764 (recebimento de doações).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/D10314.htm' },
  { number: '10.309', year: 2020, title: 'Altera Decreto 9.287 (veículos oficiais).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Decreto/D10309.htm' },
  { number: '10.278', year: 2020, title: 'Digitalização de documentos públicos (Lei 13.874).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/D10278.htm' },
  { number: '10.273', year: 2020, title: 'Altera Decreto 8.538 (margem ME/EPP, Lei 11.488).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Decreto/D10273.htm' },
  // ── 2019 ──
  { number: '10.193', year: 2019, title: 'Limites e governança para contratações de bens, serviços, diárias e passagens.', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2019/Decreto/D10193.htm' },
  { number: '10.183', year: 2019, title: 'Altera Decreto 9.507 (execução indireta de serviços).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/D10183.htm' },
  { number: '10.132', year: 2019, title: 'Altera Decreto 7.983 (orçamento de referência de obras).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2019/Decreto/D10132.htm' },
  { number: '10.024', year: 2019, title: 'Pregão eletrônico para aquisição de bens e serviços comuns.', url: 'http://www.planalto.gov.br/CCIVIL_03/_Ato2019-2022/2019/Decreto/D10024.htm' },
  { number: '9.764', year: 2019, title: 'Recebimento de doações de bens móveis e serviços.', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2019/Decreto/D9764.htm' },
  // ── 2018 ──
  { number: '9.507', year: 2018, title: 'Execução indireta, mediante contratação, de serviços da administração federal.', url: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/D9507.htm' },
  { number: '9.488', year: 2018, title: 'Altera Decreto 7.892 (Sistema de Registro de Preços, Lei 8.666).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2015-2018/2018/Decreto/D9488.htm' },
  { number: '9.412', year: 2018, title: 'Atualiza valores das modalidades da Lei 8.666 (histórico).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/D9412.htm' },
  { number: '9.373', year: 2018, title: 'Alienação, cessão, transferência e destinação de bens móveis.', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2015-2018/2018/Decreto/D9373.htm' },
  { number: '9.287', year: 2018, title: 'Utilização de veículos oficiais.', url: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/D9287.htm' },
  // ── 2017 ──
  { number: '9.046', year: 2017, title: 'Contratação plurianual de obras, bens e serviços (Poder Executivo federal).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/decreto/D9046.htm' },
  // ── 2015 ──
  { number: '8.539', year: 2015, title: 'Uso do meio eletrônico para processo administrativo federal.', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2015-2018/2015/Decreto/D8539.htm' },
  { number: '8.535', year: 2015, title: 'Contratação de serviços de instituições financeiras pelo Executivo federal.', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2015-2018/2015/Decreto/D8535.htm' },
  // ── 2014 ──
  { number: '8.241', year: 2014, title: 'Regulamenta art. 3º da Lei 8.958 (fundações de apoio).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2014/Decreto/D8241.htm' },
  // ── 2013 ──
  { number: '7.983', year: 2013, title: 'Regras para orçamento de referência de obras e serviços de engenharia.', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2013/Decreto/D7983.htm' },
  { number: '7.892', year: 2013, title: 'Sistema de Registro de Preços (art. 15 Lei 8.666 — histórico).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2013/Decreto/D7892.htm' },
  // ── 2012 ──
  { number: '7.746', year: 2012, title: 'Regulamenta art. 3º Lei 8.666 (sustentabilidade).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2012/Decreto/D7746.htm' },
  // ── 2011 ──
  { number: '7.581', year: 2011, title: 'Regulamenta o RDC (Lei 12.462).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/Decreto/D7581.htm' },
  { number: '7.546', year: 2011, title: 'Regulamenta §§ 5º a 12 art. 3º Lei 8.666 (Comissão Interministerial Compras).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/Decreto/D7546.htm' },
  // ── 2010 ──
  { number: '7.404', year: 2010, title: 'Regulamenta a Política Nacional de Resíduos Sólidos (Lei 12.305).', url: 'http://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/Decreto/D7404.htm' },
  { number: '7.174', year: 2010, title: 'Contratação de bens e serviços de informática e automação.', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2007-2010/2010/Decreto/D7174.htm' },
  // ── outros relevantes ──
  { number: '7.892', year: 2013, title: 'SRP histórico (referenciado pela Lei 14.133)', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2013/Decreto/D7892.htm' },
  { number: '5.906', year: 2006, title: 'Regulamenta art. 4º Lei 11.077 (TI).', url: 'http://www.planalto.gov.br/ccivil_03/_Ato2004-2006/2006/Decreto/D5906.htm' },
  { number: '3.555', year: 2000, title: 'Regulamento do pregão.', url: 'http://www.planalto.gov.br/ccivil_03/decreto/D3555.htm' },
  { number: '2.271', year: 1997, title: 'Regulamenta execução indireta de serviços auxiliares.', url: 'http://www.planalto.gov.br/ccivil_03/decreto/D2271.htm' },
  { number: '1.094', year: 1994, title: 'SISG (Sistema de Serviços Gerais).', url: 'http://www.planalto.gov.br/ccivil_03/decreto/Antigos/D1094.htm' },
];

interface AuditEntry {
  fullNumber: string;
  number: string;
  year: number;
  title: string;
  contentLength: number;
  officialUrl: string | null;
  validation: { errors: string[]; warnings: string[]; ok: boolean };
  inOfficialList: boolean;
  regulamenta14133: boolean;
}

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    where: { OR: [{ type: 'decreto' }, { fullNumber: { startsWith: 'Decreto' } }] },
    orderBy: [{ year: 'desc' }, { number: 'desc' }],
  });

  const dbEntries: AuditEntry[] = acts.map((act) => {
    const validation = validateActContent({ url: act.officialUrl, content: act.content });
    const matched = OFFICIAL_DECRETOS.find((o) => o.number === act.number && o.year === act.year);
    return {
      fullNumber: act.fullNumber,
      number: act.number,
      year: act.year,
      title: act.title,
      contentLength: act.content?.length ?? 0,
      officialUrl: act.officialUrl,
      validation,
      inOfficialList: !!matched,
      regulamenta14133: !!matched?.regulamenta14133,
    };
  });

  const dbKeys = new Set(acts.map((a) => `${a.number}/${a.year}`));
  const missing = OFFICIAL_DECRETOS.filter((o) => !dbKeys.has(`${o.number}/${o.year}`));
  const missing14133 = missing.filter((m) => m.regulamenta14133);
  const missingOther = missing.filter((m) => !m.regulamenta14133);

  const okCount = dbEntries.filter((e) => e.validation.ok && e.validation.warnings.length === 0).length;
  const errors = dbEntries.filter((e) => !e.validation.ok);
  const warnings = dbEntries.filter((e) => e.validation.ok && e.validation.warnings.length > 0);

  // Markdown
  const today = new Date().toISOString().slice(0, 10);
  let md = `# Auditoria Completa — Decretos Federais\n\n`;
  md += `**Gerado em:** ${today}\n\n`;
  md += `**Fonte oficial:** [gov.br/compras — Decretos Vigentes](https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/decretos-vigentes) (151 decretos vigentes)\n\n`;

  md += `## Resumo\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Decretos no banco | **${acts.length}** |\n`;
  md += `| Decretos em ambos (banco ∩ oficial) | ${dbEntries.filter((e) => e.inOfficialList).length} |\n`;
  md += `| ✅ OK (sem erro/warning) | ${okCount} |\n`;
  md += `| ❌ Errors | ${errors.length} |\n`;
  md += `| ⚠️ Warnings | ${warnings.length} |\n`;
  md += `| 📥 Decretos do oficial faltando no banco | ${missing.length} |\n`;
  md += `| **dos quais regulamentam Lei 14.133** | **${missing14133.length}** |\n\n`;

  md += `## ❌ Decretos com errors\n\n`;
  if (errors.length === 0) md += `_Nenhum._\n\n`;
  else for (const e of errors) {
    md += `### ${e.fullNumber} (${e.contentLength} chars)\n`;
    md += `URL: ${e.officialUrl}\n\n`;
    for (const err of e.validation.errors) md += `- ❌ ${err}\n`;
    md += `\n`;
  }

  md += `## 🎯 Decretos da Lei 14.133/2021 faltando no banco\n\n`;
  md += `Estes são decretos que regulamentam ESPECIFICAMENTE a Lei 14.133 e ainda não estão cadastrados.\n\n`;
  if (missing14133.length === 0) {
    md += `✅ _Todos os decretos da Lei 14.133 estão cadastrados._\n\n`;
  } else {
    md += `| Número/Ano | Tema | URL |\n|---|---|---|\n`;
    for (const d of missing14133) {
      md += `| **${d.number}/${d.year}** | ${d.title.slice(0, 90)} | ${d.url} |\n`;
    }
    md += `\n`;
  }

  md += `## 📋 Outros decretos vigentes do gov.br/compras faltando\n\n`;
  md += `Decretos importantes para contratações públicas que estão na lista oficial mas fora do banco.\n\n`;
  if (missingOther.length === 0) md += `_Nenhum._\n\n`;
  else {
    md += `| Número/Ano | Tema |\n|---|---|\n`;
    for (const d of missingOther) {
      md += `| ${d.number}/${d.year} | ${d.title.slice(0, 100)} |\n`;
    }
    md += `\n`;
  }

  md += `## ⚠️ Decretos com warnings\n\n`;
  if (warnings.length === 0) md += `_Nenhum._\n\n`;
  else for (const e of warnings) {
    md += `- **${e.fullNumber}** (${e.contentLength} chars): ${e.validation.warnings.join('; ')}\n`;
  }
  md += `\n`;

  md += `## Detalhe — todos os decretos no banco\n\n`;
  md += `| Decreto | chars | OK? | Lista oficial? | Regulamenta 14.133? |\n|---|---|---|---|---|\n`;
  for (const e of dbEntries) {
    const ok = !e.validation.ok ? '❌' : e.validation.warnings.length > 0 ? '⚠️' : '✅';
    md += `| ${e.fullNumber} | ${e.contentLength} | ${ok} | ${e.inOfficialList ? '✅' : '—'} | ${e.regulamenta14133 ? '✅' : '—'} |\n`;
  }

  const outFile = join(process.cwd(), 'docs', 'audits', `${today}-decretos-audit-completo.md`);
  writeFileSync(outFile, md);

  console.log(`\n📄 Relatório: ${outFile}\n`);
  console.log(`📊 Resumo:`);
  console.log(`   Decretos no banco:       ${acts.length}`);
  console.log(`   ✅ OK:                    ${okCount}`);
  console.log(`   ❌ Errors:                ${errors.length}`);
  console.log(`   ⚠️ Warnings:              ${warnings.length}`);
  console.log(`   📥 Faltando no banco:    ${missing.length}`);
  console.log(`   🎯 Faltando da L14.133:  ${missing14133.length}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
