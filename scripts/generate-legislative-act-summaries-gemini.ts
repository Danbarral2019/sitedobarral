/**
 * generate-legislative-act-summaries-gemini.ts
 *
 * Gera o `summary` (resumo didático para alunos) dos LegislativeActs que estão
 * com summary NULL. Usa Gemini (gemini-3-flash-preview com fallback 2.5-flash).
 * Atualmente 154 atos estão sem summary; o script é idempotente — re-rodar
 * só pega os que ainda estão NULL.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-legislative-act-summaries-gemini.ts                 # dry-run, mostra plano
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-legislative-act-summaries-gemini.ts --apply --limit=3  # processa só 3 (sample)
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-legislative-act-summaries-gemini.ts --apply           # processa tudo
 */

import { prisma } from '../lib/prisma';
import { queryGeminiText } from '../lib/gemini/cached-client';

const TYPE_LABEL: Record<string, string> = {
  'lei': 'Lei',
  'lei-complementar': 'Lei Complementar',
  'decreto': 'Decreto',
  'decreto-lei': 'Decreto-Lei',
  'portaria': 'Portaria',
  'in': 'Instrução Normativa',
  'ordem-servico': 'Ordem de Serviço',
  'medida-provisoria': 'Medida Provisória',
};

function buildPrompt(act: {
  fullNumber: string;
  title: string;
  type: string;
  issuer: string;
  ementa: string;
  content: string | null;
}): string {
  const typeLabel = TYPE_LABEL[act.type] || act.type;
  // ementa às vezes é boilerplate do scrape; content é mais confiável
  const contentTrimmed = act.content
    ? act.content.replace(/\s+/g, ' ').trim().slice(0, 6000)
    : '';
  const ementaShort = act.ementa.replace(/\s+/g, ' ').trim().slice(0, 1000);

  return `Você é especialista em Direito Administrativo brasileiro com foco em licitações e contratos públicos (Lei 14.133/2021).

TAREFA: Escreva um RESUMO DIDÁTICO em 2-3 parágrafos curtos (150-250 palavras totais) de um ato normativo, destinado a estudantes/agentes públicos que precisam entender rapidamente o que o ato faz e por que importa.

ATO:
- ${typeLabel}: ${act.fullNumber}
- Título: ${act.title}
- Emissor: ${act.issuer}
- Ementa oficial: ${ementaShort}
${contentTrimmed ? `\n- Conteúdo:\n"""\n${contentTrimmed}\n"""` : ''}

INSTRUÇÕES:
1. **Parágrafo 1**: O que o ato disciplina/altera/cria — em linguagem clara.
2. **Parágrafo 2**: Os pontos práticos mais relevantes (quem se aplica, prazo, mecanismo principal). Se o ato altera a Lei 14.133/2021, mencione brevemente como.
3. **Parágrafo 3 (opcional)**: Para que serve no dia a dia — exemplo prático ou caso de uso típico.

REGRAS:
- NÃO repita literalmente a ementa oficial.
- Use linguagem técnica mas acessível, evitando jargão excessivo.
- Foque em "o quê" e "para quê", não em "como o texto está escrito".
- Se a ementa for boilerplate ("Este texto não substitui o publicado..."), ignore-a e use só o conteúdo.
- Não invente dispositivos, prazos ou efeitos não comprovados pelo conteúdo.

RESPONDA APENAS UM JSON, SEM TEXTO ADICIONAL:
{"summary": "Texto do resumo didático em 2-3 parágrafos separados por \\n\\n."}`;
}

function parseResponse(raw: string): string | null {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.summary === 'string' && parsed.summary.trim().length >= 50) {
      return parsed.summary.trim();
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('='.repeat(60));
  console.log(`GENERATE-LEGISLATIVE-ACT-SUMMARIES — ${apply ? 'APPLY' : 'DRY-RUN'}${limit ? ` (limit=${limit})` : ''}`);
  console.log('='.repeat(60) + '\n');

  const candidatos = await prisma.legislativeAct.findMany({
    where: { summary: null },
    select: { id: true, fullNumber: true, title: true, type: true, issuer: true, ementa: true, content: true },
    orderBy: [{ hierarchyLevel: 'asc' }, { publishDate: 'desc' }],
    take: limit,
  });

  console.log(`Atos sem summary: ${candidatos.length}${limit ? ` (limit aplicado)` : ''}\n`);

  if (candidatos.length === 0) {
    console.log('Nada a fazer.');
    await prisma.$disconnect();
    return;
  }

  let success = 0;
  let skipped = 0;
  let errors = 0;
  const sampleResumos: Array<{ fullNumber: string; resumo: string }> = [];

  for (const act of candidatos) {
    process.stdout.write(`  🤖 ${act.fullNumber.padEnd(28)} `);
    if (!act.ementa && !act.content) {
      console.log('SKIP: sem ementa nem content');
      skipped++;
      continue;
    }
    try {
      const result = await queryGeminiText(buildPrompt(act), {
        temperature: 0.3,
        maxOutputTokens: 1024,
        useCache: false,
        thinkingBudget: 0,
      });
      const summary = parseResponse(result.response);
      if (!summary) {
        console.log(`ERRO: parse falhou (${result.latency}ms)`);
        errors++;
        continue;
      }
      console.log(`✓ ${summary.length} chars (${result.latency}ms, ${result.tokens?.total ?? '?'} tk)`);

      if (sampleResumos.length < 3) {
        sampleResumos.push({ fullNumber: act.fullNumber, resumo: summary });
      }

      if (apply) {
        await prisma.legislativeAct.update({
          where: { id: act.id },
          data: { summary },
        });
      }
      success++;
    } catch (err) {
      console.log(`ERRO Gemini: ${err instanceof Error ? err.message : err}`);
      errors++;
    }
  }

  if (sampleResumos.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('AMOSTRA DE RESUMOS GERADOS');
    console.log('='.repeat(60));
    for (const s of sampleResumos) {
      console.log(`\n--- ${s.fullNumber} ---`);
      console.log(s.resumo);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Resumo: ${apply ? 'gravadas' : 'geradas (dry-run)'} ${success} | skipped ${skipped} | erros ${errors}`);
  if (!apply) {
    console.log('\nPara aplicar tudo:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/generate-legislative-act-summaries-gemini.ts --apply');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
