/**
 * Audit completo de portarias: cruza banco com lista oficial gov.br/compras.
 */
import { prisma } from '../lib/prisma';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface OfficialPortaria {
  number: string;
  year: number;
  title: string;
  url: string;
  /** Sub-tipo: normativa, interministerial, conjunta, simples */
  subtype?: string;
}

// Lista oficial (61 portarias) — gov.br/compras 2026-05-01
const OFFICIAL: OfficialPortaria[] = [
  // Página 1 — vigentes recentes (30 portarias)
  { number: '7.604', year: 2025, title: 'Termo de Adesão para acesso ao Portal AntecipaGov', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-7-604-de-8-de-setembro-de-2025' },
  { number: '6.521', year: 2025, title: 'Percentuais para instituições financeiras tipo I AntecipaGov', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-6-521-de-8-de-agosto-de-2025' },
  { number: '1.363', year: 2025, title: 'Institui o Tramita GOV.BR', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-1-363-de-21-de-fevereiro-de-2025' },
  { number: '9.598', year: 2024, title: 'Altera regime de transição da Lei 14.133/2021', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-9-598-de-17-de-dezembro-de-2024' },
  { number: '2.162', year: 2024, title: 'Revoga Portaria 179/2019 (racionalização de gastos)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-mgi-no-2-162-de-5-de-abril-de-2024' },
  { number: '7.911', year: 2023, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-7-911-de-30-de-novembro-de-2023' },
  { number: '1.344', year: 2023, title: 'Limites financeiros para suprimento de fundos', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-normativa-mf-no-1-344-de-31-de-outubro-de-2023', subtype: 'normativa' },
  { number: '6.238', year: 2023, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-6-238-de-11-de-outubro-de-2023' },
  { number: '5.376', year: 2023, title: 'Modelo de referência do Plano Diretor de Logística Sustentável', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-5376-de-14-de-setembro-de-2023' },
  { number: '4.932', year: 2023, title: 'Altera preâmbulo da Portaria 1.769/2023', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-4-932-de-30-de-agosto-de-2023' },
  { number: '4.111', year: 2023, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-4-111-de-28-de-julho-de-2023' },
  { number: '1.769', year: 2023, title: 'Regime de transição da Lei 14.133/2021', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-1-769-de-25-de-abril-de-2023' },
  { number: '15.496', year: 2021, title: 'Redirecionamento para Portal PNCP', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-me-no-15-496-de-29-de-dezembro-de-2021-atualizada' },
  { number: '14.584', year: 2021, title: 'Divulgação do consumo de energia elétrica federal', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-14-584-de-13-de-dezembro-de-2021' },
  { number: '8.678', year: 2021, title: 'Governança das contratações públicas federais', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-8-678-de-19-de-julho-de-2021' },
  { number: '8.389', year: 2021, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-8-389-de-12-de-julho-de-2021' },
  { number: '4.544', year: 2021, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-4-544-de-5-de-maio-de-2021' },
  { number: '10.988', year: 2022, title: 'Canal Protocolo.GOV.BR', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-10-988-de-23-de-dezembro-de-2022' },
  { number: '9.097', year: 2022, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-9-097-de-3-de-novembro-de-2022' },
  { number: '7.828', year: 2022, title: 'Decreto 10.193/2019 — limites de contratação', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-me-no-7-828-de-30-de-agosto-de-2022' },
  { number: '4.378', year: 2022, title: 'Altera Portaria 232/2020 sobre Sistema Siads', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-me-no-4-378-de-11-de-maio-de-2022' },
  { number: '1.948', year: 2022, title: 'Revoga Portaria 249/2012 conforme Decreto 10.139/2019', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-1948-de-7-de-marco-de-2022' },
  { number: '244', year: 2012, title: 'Portaria Interministerial', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-interministerial-no-244-de-6-de-junho-de-2012', subtype: 'interministerial' },
  { number: '23.888', year: 2020, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-23888-de-20-de-novembro-de-2020' },
  { number: '372', year: 2020, title: 'Revoga Portarias do extinto Ministério do Planejamento', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-372-de-6-de-novembro-de-2020' },
  { number: '22.455', year: 2020, title: 'Revoga Portaria 31/2012 conforme Decreto 10.139/2019', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-no-22-455-de-16-de-outubro-de-2020' },
  { number: '21.262', year: 2020, title: 'Planilha de custos em contratações com dedicação exclusiva', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-21-262-de-23-de-setembro-de-2020' },
  { number: '12.395', year: 2020, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-12-395-de-15-de-maio-de-2020' },
  { number: '306', year: 2001, title: 'Sistema de Cotação Eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-306-de-13-de-dezembro-de-2001' },
  { number: '1', year: 2006, title: 'Altera Portaria 41/2005 (CPGF)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-1-de-4-de-janeiro-de-2006' },
  // Página 2 — históricas (30 portarias)
  { number: '3', year: 2014, title: 'Modelo de governança do Sistema Eletrônico de Informações - SEI', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-conjunta-no-3-de-16-de-dezembro-de-2014', subtype: 'conjunta' },
  { number: '13.623', year: 2019, title: 'Redimensionamento de Unidades Administrativas de Serviços Gerais', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-13-623-de-10-de-dezembro-de-2019' },
  { number: '11', year: 2019, title: 'Procedimentos de utilização do Número Único de Protocolo - NUP', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-interministerial-no-11-de-25-de-novembro-de-2019', subtype: 'interministerial' },
  { number: '406', year: 2019, title: 'Declara revogação de portarias de caráter normativo', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-406-de-23-de-agosto-de-2019' },
  { number: '355', year: 2019, title: 'Sistema de Gestão de Acesso – SGA — SIASG', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-355-de-09-de-agosto-de-2019' },
  { number: '443', year: 2018, title: 'Serviços preferencialmente objeto de execução indireta', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-443-de-27-de-dezembro-de-2018' },
  { number: '295', year: 2018, title: 'Exclusividade da Central de Compras (materiais de consumo)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-295-de-26-de-setembro-de-2018' },
  { number: '165', year: 2018, title: 'Institui a Rede Nacional de Compras Públicas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-165-de-18-de-junho-de-2018' },
  { number: '6', year: 2018, title: 'Exclusividade da Central de Compras (transporte)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-6-de-15-de-janeiro-de-2018' },
  { number: '2', year: 2018, title: 'Afasta IN 2 para projeto piloto', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-normativa-no-2-de-30-de-janeiro-de-2018', subtype: 'normativa' },
  { number: '490', year: 2017, title: 'Portaria de 29/12/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-490-de-29-de-dezembro-de-2017' },
  { number: '252', year: 2017, title: 'Portaria de 02/08/2017 (Atualizada)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-252-de-02-de-agosto-de-2017' },
  { number: '194', year: 2017, title: 'SIASG para contratação plurianual', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-194-de-26-de-junho-de-2017' },
  { number: '80', year: 2016, title: 'Revoga portarias anteriores de 2002 e 2009', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-80-de-25-de-abril-de-2016' },
  { number: '2.162', year: 2015, title: 'Altera vigência da Portaria Interministerial 2.321', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-interministerial-mj-mp-no-2-162-de-24-de-dezembro-de-2015', subtype: 'interministerial' },
  { number: '1.677', year: 2015, title: 'Procedimentos para atividades de protocolo', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-interministerial-ndeg-1-677-de-07-de-outubro-de-2015', subtype: 'interministerial' },
  { number: '851', year: 2015, title: 'Altera vigência Portaria Interministerial 2.320 (Protocolo Integrado)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-interministerial-ndeg-851-de-03-de-junho-de-2015', subtype: 'interministerial' },
  { number: '8', year: 2015, title: 'Indicadores para monitoramento de Energia Elétrica e Água', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-conjunta-no-8-de-17-de-abril-de-2015', subtype: 'conjunta' },
  { number: '20', year: 2015, title: 'Revoga Portaria 505 (bilhetes aéreos e SCDP)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-20-de-11-de-fevereiro-de-2015' },
  { number: '555', year: 2014, title: 'Portaria de 30/12/2014', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-555-de-30-de-dezembro-de-2014' },
  { number: '2.320', year: 2014, title: 'Sistema Protocolo Integrado na Administração Pública Federal', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-interministerial-no-2-320-de-30-de-dezembro-de-2014', subtype: 'interministerial' },
  { number: '441', year: 2014, title: 'Portaria de 20/11/2014', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-interministerial-no-441-de-20-de-novembro-de-2014', subtype: 'interministerial' },
  { number: '370', year: 2012, title: 'Portaria de 23/08/2012', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-370-de-23-de-agosto-de-2012' },
  { number: '90', year: 2009, title: 'Sistema do Cartão de Pagamento - SCP', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-90-de-24-de-abril-de-2009' },
  { number: '44', year: 2006, title: 'Altera Portaria 41 (CPGF)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-44-de-14-de-marco-de-2006' },
  { number: '41', year: 2005, title: 'Normas complementares para utilização do CPGF', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-41-de-4-de-marco-de-2005' },
  { number: '04', year: 2002, title: 'Portaria de 19/12/2002', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-normativa-no-04-de-19-de-dezembro-de-2002', subtype: 'normativa' },
  { number: '2.296', year: 1997, title: 'Portaria de 23/07/1997', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-2-296-de-23-de-julho-de-1997' },
  { number: '149', year: 2020, title: 'Revoga Portaria 23 (Energia/Água)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-149-de-7-de-abril-de-2020' },
  { number: '232', year: 2020, title: 'Sistema Integrado de Gestão Patrimonial - Siads', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-232-de-2-de-junho-de-2020' },
  // Página 3
  { number: '17.405', year: 2020, title: 'Altera Anexo Portaria 252/2017', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-17-405-de-20-de-julho-de-2020' },
];

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    where: { OR: [{ type: 'portaria' }, { fullNumber: { startsWith: 'Portaria' } }] },
    orderBy: [{ year: 'desc' }, { number: 'desc' }],
  });

  // Cruzamento
  const dbKeys = new Set(acts.map((a) => `${a.number}/${a.year}`));
  const missing = OFFICIAL.filter((o) => !dbKeys.has(`${o.number}/${o.year}`));

  // Validação
  const errored: typeof acts = [];
  const warned: typeof acts = [];
  for (const act of acts) {
    const v = validateActContent({ url: act.officialUrl, content: act.content });
    if (!v.ok) errored.push(act);
    else if (v.warnings.length > 0) warned.push(act);
  }

  // Categorizar faltantes por relevância pra Lei 14.133
  const REGEX_14133 = /14\.?133|nllc|registro de pre|govern|contrata|licitac|terceiriz|jornada|sustentab|in\s*[º]?\s*5|ant[ie]cip|trans[i]ç|catalogo/i;
  const high = missing.filter((m) => REGEX_14133.test(m.title));
  const low = missing.filter((m) => !REGEX_14133.test(m.title));

  // Markdown
  const today = new Date().toISOString().slice(0, 10);
  let md = `# Auditoria de Portarias — gov.br/compras\n\n**Gerado:** ${today}\n\n`;
  md += `**Fonte:** [gov.br/compras — Portarias Vigentes](https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias) (61 portarias)\n\n`;
  md += `## Resumo\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Portarias no banco | **${acts.length}** |\n`;
  md += `| Portarias no oficial | **${OFFICIAL.length}** |\n`;
  md += `| ❌ Errors | ${errored.length} |\n`;
  md += `| ⚠️ Warnings | ${warned.length} |\n`;
  md += `| 📥 Faltando no banco | ${missing.length} |\n`;
  md += `| **— relevantes p/ Lei 14.133** | **${high.length}** |\n`;
  md += `| — outras (gestão geral) | ${low.length} |\n\n`;

  if (errored.length) {
    md += `## ❌ Errors\n\n`;
    for (const e of errored) {
      md += `### ${e.fullNumber} (${(e.content?.length ?? 0)} chars)\n`;
      md += `URL: ${e.officialUrl}\n\n`;
    }
  }

  md += `## 🎯 Portarias relevantes p/ Lei 14.133/2021 faltando\n\n`;
  if (high.length === 0) md += `_Nenhuma._\n\n`;
  else {
    md += `| Nº/Ano | Tema | Tipo | URL |\n|---|---|---|---|\n`;
    for (const m of high) {
      md += `| **${m.number}/${m.year}** | ${m.title.slice(0, 80)} | ${m.subtype || '—'} | ${m.url} |\n`;
    }
    md += `\n`;
  }

  md += `## 📋 Outras portarias do gov.br/compras faltando (gestão administrativa geral)\n\n`;
  if (low.length === 0) md += `_Nenhuma._\n\n`;
  else {
    md += `| Nº/Ano | Tema | Tipo |\n|---|---|---|\n`;
    for (const m of low) {
      md += `| ${m.number}/${m.year} | ${m.title.slice(0, 90)} | ${m.subtype || '—'} |\n`;
    }
    md += `\n`;
  }

  md += `## Detalhe — todas portarias no banco\n\n`;
  md += `| Portaria | chars | OK? |\n|---|---|---|\n`;
  for (const a of acts) {
    const v = validateActContent({ url: a.officialUrl, content: a.content });
    const ok = !v.ok ? '❌' : v.warnings.length > 0 ? '⚠️' : '✅';
    md += `| ${a.fullNumber} | ${a.content?.length ?? 0} | ${ok} |\n`;
  }

  const outFile = join(process.cwd(), 'docs', 'audits', `${today}-portarias-audit-completo.md`);
  writeFileSync(outFile, md);
  console.log(`📄 ${outFile}\n`);
  console.log(`📊 Portarias no banco: ${acts.length}`);
  console.log(`📊 No oficial:         ${OFFICIAL.length}`);
  console.log(`📥 Faltando:           ${missing.length}`);
  console.log(`🎯 Relevantes 14.133:  ${high.length}`);
  console.log(`❌ Errors:             ${errored.length}`);
  console.log(`⚠️ Warnings:           ${warned.length}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
