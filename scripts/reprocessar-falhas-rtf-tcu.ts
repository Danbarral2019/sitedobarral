/**
 * Reprocessa os acórdãos da carga de alvos citados (reviewedBy
 * 'alvos-citados-tcu') que ficaram sem inteiro teor por falha de RTF:
 * arquivo acima do teto de 20 MB, pilha estourada ou codificação que o
 * `rtf-parser` não conhecia. Medido em 30/09/2026: nesses arquivos, `\pict`
 * ocupava de 78% a 97% dos bytes.
 *
 * Usa o filtro de grupos binários durante o download (lib/tcu/rtf-filtro-binario.ts),
 * então o teto passa a valer para o texto e não para as imagens.
 *
 * Mesmas salvaguardas da carga: sem IA, sem fila de embeddings, sem promoção
 * a acervo público. Não exclui nada. Os acórdãos legados em `.doc`
 * (tcu.gov.br/acordaoslegados) ficam de fora: o formato é outro.
 *
 * Uso: npx tsx scripts/reprocessar-falhas-rtf-tcu.ts                  # dry-run
 *      npx tsx scripts/reprocessar-falhas-rtf-tcu.ts --execute --limite=5
 *      npx tsx scripts/reprocessar-falhas-rtf-tcu.ts --execute
 */
import { prisma } from '../lib/prisma';
import { catalogarAcordao } from '../lib/tcu/catalogar-acordao';
import { MARCA_ALVOS_CITADOS } from '../lib/tcu/alvos-citados';

const EXECUTE = process.argv.includes('--execute');
const limiteArg = process.argv.find((a) => a.startsWith('--limite='));
const LIMITE = limiteArg ? Number(limiteArg.split('=')[1]) : Infinity;

/** Um RTF de 383 MB do TCU desce em vários minutos; 30 min é folga. */
const TIMEOUT_MS = 30 * 60_000;

function causa(erro: string | null): string {
  if (!erro) return '(sem registro)';
  if (erro.includes('excede o teto')) return 'excede o teto';
  if (erro.startsWith('extração RTF:')) return erro.slice(0, 55);
  return erro.slice(0, 40);
}

async function main() {
  console.log(`=== REPROCESSAMENTO DE FALHAS DE RTF (alvos citados do TCU) ${EXECUTE ? '(EXECUTE)' : '(DRY-RUN)'} ===\n`);

  const docs = await prisma.document.findMany({
    where: {
      reviewedBy: MARCA_ALVOS_CITADOS,
      tcuTextoCompleto: null,
      tcuLinkPDF: { not: null },
      NOT: { tcuLinkPDF: { contains: 'acordaoslegados' } },
    },
    select: {
      id: true,
      title: true,
      tcuLinkPDF: true,
      leiArticlesArr: true,
      acordaoNumero: true,
      acordaoAno: true,
      tcuEnriquecimentoErro: true,
    },
    orderBy: [{ acordaoAno: 'desc' }, { acordaoNumero: 'desc' }],
  });

  const porCausa = new Map<string, number>();
  for (const d of docs) porCausa.set(causa(d.tcuEnriquecimentoErro), (porCausa.get(causa(d.tcuEnriquecimentoErro)) ?? 0) + 1);
  console.log(`   sem inteiro teor (fora os legados em .doc): ${docs.length}`);
  for (const [c, n] of [...porCausa].sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(4)}× ${c}`);
  if (!EXECUTE) {
    console.log('\n   DRY-RUN: nada foi gravado. Use --execute.');
    return;
  }

  let ok = 0;
  let falhas = 0;
  const erros = new Map<string, number>();
  const inicio = Date.now();
  for (const [i, d] of docs.slice(0, LIMITE).entries()) {
    const chave = `${d.acordaoNumero}/${d.acordaoAno}`;
    const t0 = Date.now();
    const r = await catalogarAcordao(d, {
      enfileirarEmbedding: false,
      promover: false,
      timeoutMs: TIMEOUT_MS,
      filtrarBinarios: true,
    });
    const seg = ((Date.now() - t0) / 1000).toFixed(0);
    const prefixo = `[${i + 1}/${Math.min(docs.length, LIMITE)}] ${chave}`;
    if (r.status === 'falha') {
      falhas++;
      erros.set(causa(r.erro ?? null), (erros.get(causa(r.erro ?? null)) ?? 0) + 1);
      console.log(`   ❌ ${prefixo}: ${r.erro} (${seg} s)`);
    } else {
      ok++;
      console.log(`   ✅ ${prefixo}: ${r.status}, ${(r.chars ?? 0).toLocaleString('pt-BR')} chars (${seg} s)`);
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log(`   recuperados com inteiro teor: ${ok}`);
  console.log(`   ainda com falha: ${falhas}`);
  for (const [c, n] of [...erros].sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(4)}× ${c}`);
  console.log(`   duração: ${((Date.now() - inicio) / 60000).toFixed(1)} min`);
}

main()
  .catch((e) => {
    console.error('💥', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
