/**
 * Atualiza ONs revisadas em 2026 (lote 2) com a NOVA REDAÇÃO oficial do DOU.
 * Todas alteradas por Portarias AGU de 11/06/2026 (DOU 12/06/2026, Ed.108, Seção 1):
 *   ON 04/2009 ← Portaria 110  | ON 47/2014 ← Portaria 142
 *   ON 61/2020 ← Portaria 141  | ON 86/2024 ← Portaria 174
 *
 * (ON 60 e ON 45 já foram atualizadas anteriormente.)
 *
 * Registro PRINCIPAL (type='link') recebe description+content+url+tags+metadados DOU;
 * registros legados (type='pdf') têm só a description sincronizada. Cada alteração gera
 * DocumentVersion. Idempotente (detectChanges evita regravar).
 *
 * Uso: npx tsx scripts/update-ons-revisadas.ts [--apply]
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';
import { detectChanges, saveDocumentVersion } from '../lib/agu-modules/versioning';
import { CacheInvalidation } from '../lib/cache/redis-client';

const APPLY = process.argv.includes('--apply');
const DOU_NOTA = 'DOU de 12/06/2026, Edição 108, Seção 1';

function buildContent(num: string, dataOrig: string, portaria: string, enun: string, ref: string, fonte?: string) {
  return `ORIENTAÇÃO NORMATIVA AGU Nº ${num}, de ${dataOrig} (redação dada pela Portaria AGU nº ${portaria}, de 11 de junho de 2026).

Enunciado:

${enun}

Referência: ${ref}${fonte ? `\n\nFonte: ${fonte}` : ''}

(Redação dada pela Portaria AGU nº ${portaria}, de 11/06/2026 — ${DOU_NOTA}.)`;
}

interface OnUpdate {
  onNumber: number; onYear: number; enunciado: string; content: string;
  url: string; alternativeUrls: string[]; tags: string[]; douUrl: string;
}

const ON04 = `A despesa sem cobertura contratual deverá ser objeto de reconhecimento da obrigação de indenizar nos termos do art. 59, parágrafo único, da Lei nº 8.666, de 1993, e do art. 149 da Lei nº 14.133, de 2021, sem prejuízo da apuração da responsabilidade de quem lhe der causa.`;
const ON47 = `Em licitação dividida em itens ou lotes/grupos, deverá ser adotada a participação exclusiva de microempresa, empresa de pequeno porte ou sociedade cooperativa (art. 34 da Lei nº 11.488, de 2007) em relação aos itens ou lotes/grupos cujo valor seja igual ou inferior a R$ 80.000,00 (oitenta mil reais), desde que não haja a subsunção a quaisquer das situações previstas pelo art. 10 do Decreto nº 8.538, de 6 de outubro de 2015.`;
const ON61 = `A exclusão do regime tributário do Simples Nacional, por ato voluntário da contratada ou por superação dos limites de receita bruta anual de que cuida o art. 30 da Lei Complementar nº 123, de 2006, não enseja o reequilíbrio econômico-financeiro do contrato administrativo.`;
const ON86 = `I - A demissão de servidor público, em decorrência de fato equiparado a ato de improbidade, tem o condão de provocar a incompatibilidade temporária para nova investidura em cargo público federal pelo prazo de 8 (oito) anos, contados da respectiva decisão, nos moldes do art. 1º, inciso I, alínea "o", da Lei Complementar nº 64, de 1990 (com redação dada pela Lei Complementar nº 219/2025), cumulado com o art. 5º, inciso II, da Lei nº 8.112, de 1990.
II - As infrações disciplinares mencionadas no art. 137, caput e parágrafo único, da Lei nº 8.112, de 1990, incompatibilizam o ex-servidor público demitido para nova investidura em cargo público federal pelo prazo de 5 (cinco) anos, ressalvadas as respectivas hipóteses de demissão preceituadas no art. 137 da Lei nº 8.112, de 1990, decorrentes de 'fato equiparado a ato de improbidade', casos em que o prazo de incompatibilidade temporária aplicável é de 8 (oito) anos.
III - Não há proibição legal temporária para nova investidura em cargo público federal a ex-servidor público demitido quando, cumulativamente, a respectiva infração que gerou a demissão não se enquadre nas hipóteses previstas no caput e no parágrafo único do art. 137 da Lei nº 8.112, de 1990, bem como não esteja inserida na situação descrita no art. 1º, inciso I, alínea "o", da Lei Complementar nº 64, de 1990.
IV - As hipóteses de incompatibilidade temporária para nova investidura em cargo público federal, previstas tanto no art. 137, caput e parágrafo único, da Lei nº 8.112, de 1990, quanto no art. 1º, inciso I, alínea "o", da Lei Complementar nº 64, de 1990, aplicam-se aos casos de 'destituição de cargo em comissão' e de 'cassação de aposentadoria e de disponibilidade', nas infrações puníveis com demissão.`;

const UPDATES: OnUpdate[] = [
  {
    onNumber: 4, onYear: 2009, enunciado: ON04,
    content: buildContent('04', '1º de abril de 2009', '110', ON04,
      'arts. 59, parágrafo único, e 60, parágrafo único, da Lei nº 8.666, de 1993; art. 63, da Lei nº 4.320, de 1964; Acórdão TCU 375/1999-Segunda Câmara; arts. 95, §2º, e 149, da Lei nº 14.133, de 2021; PARECER Nº 00023/2025/CNLCA/CGU/AGU.'),
    url: 'https://www.in.gov.br/web/dou/-/portaria-agu-n-110-de-11-de-junho-de-2026-711714016',
    alternativeUrls: [], tags: ['AGU', 'ON 4/2009', 'Contratos', 'Despesa sem cobertura', 'Lei 14.133'],
    douUrl: 'https://www.in.gov.br/web/dou/-/portaria-agu-n-110-de-11-de-junho-de-2026-711714016',
  },
  {
    onNumber: 47, onYear: 2014, enunciado: ON47,
    content: buildContent('47', '25 de abril de 2014', '142', ON47,
      'Parecer nº 00022/2025/CNLCA/CGU/AGU; art. 10 do Decreto nº 8.538, de 2015; art. 146, inciso III, alínea "d", da CF; arts. 47 e 48 da Lei Complementar nº 123, de 2006; NOTA DECOR/CGU/AGU nº 356, de 2008 - PCN; Parecer PGFN/CJU/CLC nº 2.750, de 2008; Súmula nº 247 do Tribunal de Contas da União.'),
    url: 'https://www.in.gov.br/web/dou/-/portaria-agu-n-142-de-11-de-junho-de-2026-711722597',
    alternativeUrls: [], tags: ['AGU', 'ON 47/2014', 'Licitações', 'ME/EPP', 'Participação Exclusiva'],
    douUrl: 'https://www.in.gov.br/web/dou/-/portaria-agu-n-142-de-11-de-junho-de-2026-711722597',
  },
  {
    onNumber: 61, onYear: 2020, enunciado: ON61,
    content: buildContent('61', '29 de maio de 2020', '141', ON61,
      'Parecer nº 00022/2025/CNLCA/CGU/AGU; art. 134 da Lei nº 14.133, de 2021; Parecer nº 89/2014/DECOR/CGU/AGU; Parecer nº 90/2014/DECOR/CGU/AGU; Parecer nº 92/2019/FDECOR/CGU/AGU; art. 65, inciso II, alínea "d", e § 5º, da Lei nº 8.666, de 1993; art. 3º, § 3º, e art. 30 da Lei Complementar nº 123, de 2006.'),
    url: 'https://www.in.gov.br/web/dou/-/portaria-agu-n-141-de-11-de-junho-de-2026-711730183',
    alternativeUrls: [], tags: ['AGU', 'ON 61/2020', 'Contratos', 'Reequilíbrio Econômico-Financeiro', 'Simples Nacional'],
    douUrl: 'https://www.in.gov.br/web/dou/-/portaria-agu-n-141-de-11-de-junho-de-2026-711730183',
  },
  {
    onNumber: 86, onYear: 2024, enunciado: ON86,
    content: buildContent('86', '05 de julho de 2024', '174', ON86,
      'Art. 1º, inciso I, alínea "o", da Lei Complementar nº 64, de 1990; art. 5º, inciso II, e art. 137, caput e parágrafo único, ambos da Lei nº 8.112, de 1990.',
      'PARECER Nº 00002/2026/CNPAD/CGU/AGU.'),
    url: 'https://www.in.gov.br/web/dou/-/portaria-agu-n-174-de-11-de-junho-de-2026-711711637',
    alternativeUrls: [], tags: ['AGU', 'ON 86/2024', 'Servidores Públicos', 'Improbidade', 'Investidura'],
    douUrl: 'https://www.in.gov.br/web/dou/-/portaria-agu-n-174-de-11-de-junho-de-2026-711711637',
  },
];

async function main() {
  console.log(`\n=== Atualizar ONs revisadas lote 2 (04, 47, 61, 86) — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===\n`);
  let updated = 0, unchanged = 0;

  for (const u of UPDATES) {
    const docs = await prisma.document.findMany({
      where: { category: 'orientacao-normativa', onNumber: u.onNumber, onYear: u.onYear },
    });
    console.log('─'.repeat(64));
    console.log(`ON ${u.onNumber}/${u.onYear} — ${docs.length} registro(s)`);
    if (docs.length === 0) { console.log('  ⚠️  Nenhum registro encontrado!'); continue; }

    for (const doc of docs) {
      const isPrincipal = doc.type === 'link';
      const newData: Record<string, unknown> = isPrincipal
        ? {
            description: u.enunciado, content: u.content, url: u.url,
            alternativeUrls: u.alternativeUrls.length ? JSON.stringify(u.alternativeUrls) : doc.alternativeUrls,
            tags: JSON.stringify(u.tags), douUrl: u.douUrl,
            douData: new Date(Date.UTC(2026, 5, 12)), douSecao: '1', douEdicao: '108',
          }
        : { description: u.enunciado };

      const change = await detectChanges(doc, newData as never);
      const role = isPrincipal ? 'PRINCIPAL(link)' : `legado(${doc.type})`;
      if (!change.hasChanges) { unchanged++; console.log(`  • ${role} id=${doc.id.slice(0, 8)} — sem mudanças`); continue; }
      console.log(`  • ${role} id=${doc.id.slice(0, 8)} — ${change.changesSummary}`);
      if (APPLY) {
        await prisma.document.update({ where: { id: doc.id }, data: newData as never });
        await saveDocumentVersion(doc.id, change, 'portaria-agu-2026');
        await prisma.document.update({ where: { id: doc.id }, data: { embeddingStatus: 'pending' } });
        updated++;
      }
    }
  }

  console.log('\n' + '='.repeat(64));
  if (APPLY) {
    console.log(`Resumo: ${updated} registro(s) atualizado(s) (embeddingStatus=pending), ${unchanged} sem mudanças.`);
    if (updated > 0) {
      try {
        await CacheInvalidation.courseDocuments();
        await CacheInvalidation.vectorSearch();
        await CacheInvalidation.synthesizedAnswers();
        await CacheInvalidation.douStats();
        console.log('🗑️  Cache invalidado.');
      } catch (e) { console.log(`⚠️  cache: ${e instanceof Error ? e.message : String(e)}`); }
    }
  } else {
    console.log('DRY-RUN concluído. Rode com --apply.');
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
