/**
 * Publica no acervo restrito as teses elegíveis (spec §10.1).
 *
 * Uso:
 *   npx tsx scripts/publicar-acervo-teses.ts               # dry-run
 *   npx tsx scripts/publicar-acervo-teses.ts --executar
 *   npx tsx scripts/publicar-acervo-teses.ts --executar --limit 20
 *   npx tsx scripts/publicar-acervo-teses.ts --despublicar --executar
 *
 * `--despublicar` desfaz apenas o que este script fez: enunciados com
 * `publicado = true` e `vitrinePublica = false`. Não toca no que já foi
 * promovido à vitrine — despublicar por baixo de uma promoção editorial seria
 * desfazer decisão de outra pessoa.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { selecionarParaPublicar } from '../lib/tcu/publicar-acervo';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function despublicar(executar: boolean) {
  const alvos = await prisma.teseEnunciado.findMany({
    where: { publicado: true, vitrinePublica: false },
    select: { id: true },
  });
  console.log(`\nA despublicar: ${alvos.length} enunciados`);
  console.log('(enunciados na vitrine não são tocados)');
  if (!executar) {
    console.log('\nDry-run. Para aplicar: --executar\n');
    return;
  }
  const r = await prisma.teseEnunciado.updateMany({
    where: { id: { in: alvos.map(a => a.id) } },
    data: { publicado: false },
  });
  console.log(`\nDespublicados: ${r.count}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const executar = args.includes('--executar');
  const i = args.indexOf('--limit');
  const limite = i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : undefined;

  if (args.includes('--despublicar')) {
    await despublicar(executar);
    return;
  }

  const { publicaveis, foraPorMotivo } = await selecionarParaPublicar();
  const alvos = limite ? publicaveis.slice(0, limite) : publicaveis;

  console.log('\n=== PUBLICAÇÃO DO ACERVO RESTRITO ===\n');
  console.log(`Elegíveis e ainda não publicados: ${publicaveis.length}`);
  if (limite) console.log(`Limitado a: ${alvos.length}`);
  const fora = Object.entries(foraPorMotivo);
  if (fora.length > 0) {
    console.log('\nFicaram de fora:');
    for (const [motivo, n] of fora) console.log(`  ${motivo}: ${n}`);
  }
  console.log(executar ? '\nModo: EXECUTAR\n' : '\nModo: dry-run (nada será gravado)\n');

  if (!executar) {
    console.log('Para aplicar: --executar\n');
    return;
  }

  const r = await prisma.teseEnunciado.updateMany({
    where: { id: { in: alvos } },
    data: { publicado: true },
  });
  console.log(`Publicados: ${r.count}\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
