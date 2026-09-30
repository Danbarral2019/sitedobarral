/**
 * Retirada editorial de teses (spec §5).
 *
 * Torna o enunciado inelegível em TODOS os consumidores. `retiradoMotivo` é
 * obrigatório: retirada sem motivo registrado é retirada que ninguém consegue
 * auditar depois.
 *
 * Uso:
 *   npx tsx scripts/retirar-teses.ts --chave 1724/2025 --motivo "matéria de pessoal"
 *   npx tsx scripts/retirar-teses.ts --chave 1724/2025 --motivo "..." --executar
 *   npx tsx scripts/retirar-teses.ts --chave 1724/2025 --motivo "..." --executar --expect-count 3
 *
 * Desfazer uma retirada (devolve a tese ao acervo; a vitrine volta pelo
 * promover-vitrine-teses.ts, que refaz as conferências dela):
 *   npx tsx scripts/retirar-teses.ts --chave 1618/2025 --desfazer
 *   npx tsx scripts/retirar-teses.ts --chave 1618/2025 --desfazer --executar --expect-count 1
 *
 * O desfazer limpa `retiradoEm`/`retiradoMotivo` e religa `publicado` só no
 * enunciado que volta a satisfazer o predicado do acervo (veredito `fiel` e
 * evidência íntegra, `lib/tcu/elegibilidade-tese.ts`). O que não satisfaz fica
 * despublicado: desfazer a retirada não pode publicar tese reprovada.
 *
 * `--expect-count N`: confere o dry-run antes de aplicar. Se a quantidade de
 * enunciados encontrada no momento do --executar for diferente de N, o script
 * aborta sem gravar nada — protege contra o alvo ter mudado (nova
 * redestilação, por exemplo) entre o dry-run que o operador conferiu e a
 * execução real.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { evidenciaIntegral } from '../lib/tcu/elegibilidade-tese';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const args = process.argv.slice(2);
  const val = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const chave = val('--chave');
  const motivo = val('--motivo');
  const executar = args.includes('--executar');
  const desfazer = args.includes('--desfazer');
  const expectCountStr = val('--expect-count');
  const expectCount = expectCountStr !== undefined ? parseInt(expectCountStr, 10) : undefined;

  if (!chave || (!motivo && !desfazer)) {
    console.error('Uso: --chave <numero/ano> --motivo "<texto>" [--executar] [--expect-count N]');
    console.error('     --chave <numero/ano> --desfazer [--executar] [--expect-count N]');
    process.exit(1);
  }
  if (expectCountStr !== undefined && (!Number.isFinite(expectCount) || expectCount! < 0)) {
    console.error(`--expect-count inválido: "${expectCountStr}"`);
    process.exit(1);
  }

  if (desfazer) {
    await desfazerRetirada(chave, executar, expectCount);
    return;
  }

  const alvos = await prisma.teseEnunciado.findMany({
    where: { destilacao: { chave, atual: true }, retiradoEm: null },
    select: { id: true, enunciado: true },
  });

  console.log(`\nTeses de ${chave} a retirar: ${alvos.length}`);
  for (const a of alvos) console.log(`  - ${a.enunciado.slice(0, 90)}...`);
  console.log(`\nMotivo: ${motivo}`);

  if (!executar) {
    console.log('\nDry-run. Para aplicar: --executar\n');
    return;
  }

  if (expectCount !== undefined && alvos.length !== expectCount) {
    console.error(
      `\nAbortado sem gravar: esperava ${expectCount} enunciado(s), encontrado ${alvos.length} agora. ` +
        `Confira o que mudou desde o dry-run antes de aplicar de novo.\n`,
    );
    process.exit(1);
  }

  const r = await prisma.teseEnunciado.updateMany({
    where: { id: { in: alvos.map((a) => a.id) } },
    data: { retiradoEm: new Date(), retiradoMotivo: motivo, publicado: false, vitrinePublica: false },
  });
  console.log(`\nRetiradas: ${r.count}\n`);
}

async function desfazerRetirada(chave: string, executar: boolean, expectCount: number | undefined) {
  const alvos = await prisma.teseEnunciado.findMany({
    where: { destilacao: { chave, atual: true }, retiradoEm: { not: null } },
    select: {
      id: true,
      enunciado: true,
      veredito: true,
      retiradoMotivo: true,
      trechosFonte: true,
      trechos: {
        select: { ordem: true, origemDocumentId: true, origemUrl: true, origemLinkPDF: true },
      },
    },
  });

  const voltaAoAcervo = (a: (typeof alvos)[number]) =>
    a.veredito === 'fiel' && a.trechos.length > 0 && evidenciaIntegral(a);

  console.log(`\nTeses retiradas de ${chave} a restaurar: ${alvos.length}`);
  for (const a of alvos) {
    const destino = voltaAoAcervo(a) ? 'volta ao acervo' : 'fica despublicada (não elegível)';
    console.log(`  - ${a.enunciado.slice(0, 90)}...`);
    console.log(`    motivo da retirada: ${a.retiradoMotivo ?? '(sem motivo)'} | ${destino}`);
  }

  if (!executar) {
    console.log('\nDry-run. Para aplicar: --executar\n');
    return;
  }

  if (expectCount !== undefined && alvos.length !== expectCount) {
    console.error(
      `\nAbortado sem gravar: esperava ${expectCount} enunciado(s), encontrado ${alvos.length} agora. ` +
        `Confira o que mudou desde o dry-run antes de aplicar de novo.\n`,
    );
    process.exit(1);
  }

  const elegiveis = alvos.filter(voltaAoAcervo).map((a) => a.id);
  const demais = alvos.filter((a) => !voltaAoAcervo(a)).map((a) => a.id);
  const [r1, r2] = await prisma.$transaction([
    prisma.teseEnunciado.updateMany({
      where: { id: { in: elegiveis } },
      data: { retiradoEm: null, retiradoMotivo: null, publicado: true },
    }),
    prisma.teseEnunciado.updateMany({
      where: { id: { in: demais } },
      data: { retiradoEm: null, retiradoMotivo: null },
    }),
  ]);
  console.log(`\nRestauradas: ${r1.count + r2.count} (${r1.count} de volta ao acervo)`);
  console.log('A vitrine não volta sozinha: rode promover-vitrine-teses.ts (dry-run primeiro).\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
