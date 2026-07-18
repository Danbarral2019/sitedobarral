/**
 * Wishlist da rede de precedentes: os acórdãos mais citados que NÃO existem no
 * acervo (nós externos), ordenados por autoridade. É a lista de importação
 * prioritária da Fase 2. Só leitura.
 *
 * Uso: npx tsx scripts/wishlist-precedentes-tcu.ts
 */
import { writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';

const SAIDA = 'docs/audits/2026-07-18-wishlist-precedentes-tcu.json';

interface Linha { numeroAlvo: number; anoAlvo: number; citadoPor: bigint; citadoNoVoto: bigint }

async function main() {
  const linhas = await prisma.$queryRaw<Linha[]>`
    SELECT ac."numeroAlvo", ac."anoAlvo",
           COUNT(*) AS "citadoPor",
           COUNT(*) FILTER (WHERE ac."noVoto") AS "citadoNoVoto"
    FROM "AcordaoCitacao" ac
    WHERE NOT EXISTS (
      SELECT 1 FROM "Document" d
      WHERE d.category = 'acordao'
        AND d."acordaoNumero" = ac."numeroAlvo"
        AND d."acordaoAno" = ac."anoAlvo"
    )
    GROUP BY ac."numeroAlvo", ac."anoAlvo"
    ORDER BY COUNT(*) DESC
    LIMIT 100;
  `;

  const wishlist = linhas.map((l) => ({
    chave: `${l.numeroAlvo}/${l.anoAlvo}`,
    numero: l.numeroAlvo,
    ano: l.anoAlvo,
    citadoPor: Number(l.citadoPor),
    citadoNoVoto: Number(l.citadoNoVoto),
  }));

  const resumo = { geradoEm: '2026-07-18', total: wishlist.length, wishlist };
  writeFileSync(SAIDA, JSON.stringify(resumo, null, 2) + '\n', 'utf8');

  console.log(`Top 20 leading cases AUSENTES (a importar na Fase 2):\n`);
  for (const w of wishlist.slice(0, 20)) {
    console.log(`  ${w.chave.padEnd(12)} citado por ${String(w.citadoPor).padStart(3)} (voto: ${w.citadoNoVoto})`);
  }
  console.log(`\n📄 ${SAIDA} — ${wishlist.length} acórdãos ausentes rankeados`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
