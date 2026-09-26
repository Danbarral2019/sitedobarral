/**
 * Backfill: captura o INTEIRO TEOR dos pareceres da AGU cujo link é PDF
 * público do DECOR (`https://cgu.agu.gov.br/decor/arquivos/*.pdf`).
 *
 * Drena o passivo (~609 documentos da CONUNI em 09/2026). As inclusões
 * futuras ficam com o cron `catalog-decor-inteiro-teor`; os dois usam o MESMO
 * núcleo (lib/agu/inteiro-teor-decor.ts), então a fila, a normalização, o
 * teto de 500 mil chars e o contador de tentativas são idênticos.
 *
 * A fila é auto-drenante e idempotente: quem ganha `textoIntegral` sai dela, e
 * quem falha 3 vezes também. Dá para interromper e retomar.
 *
 * Grava só `textoIntegral`, `textoIntegralFonte`, `textoIntegralEm` (ou
 * incrementa `textoIntegralTentativas`). Não toca em `content` nem no
 * embedding: o texto é para leitura na página do documento.
 *
 * Pré-requisito: a migração 20260926120000_add_texto_integral_documento
 * aplicada (o deploy da Vercel roda `prisma migrate deploy`).
 *
 * Uso:
 *   npx tsx scripts/backfill-decor-inteiro-teor.ts                    # simulação: conta a fila e testa 1 download, SEM gravar
 *   npx tsx scripts/backfill-decor-inteiro-teor.ts --executar --limit 20
 *   npx tsx scripts/backfill-decor-inteiro-teor.ts --executar         # a fila inteira
 *
 * Sem `--executar` NADA é gravado.
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import {
  capturarInteiroTeorDecor,
  contarFilaDecor,
  extrairInteiroTeorDecor,
  selecionarFilaDecor,
} from '../lib/agu/inteiro-teor-decor';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

/** Pausa entre downloads — a mesma do cron, educada com o servidor da AGU. */
const DELAY_MS = 1500;
/** Tamanho da página lida da fila por vez. */
const PAGINA = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Args {
  executar: boolean;
  limit?: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const i = a.indexOf('--limit');
  const limit = i >= 0 && a[i + 1] ? Number(a[i + 1]) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error(`--limit inválido: ${a[i + 1]}`);
  }
  return { executar: a.includes('--executar'), limit };
}

async function simular(): Promise<void> {
  const total = await contarFilaDecor(prisma);
  console.log(`Fila: ${total} documento(s) com PDF do DECOR sem inteiro teor (tentativas < 3).`);
  if (total === 0) return;

  const [amostra] = await selecionarFilaDecor(prisma, { take: 1 });
  console.log(`\nTeste de 1 download (NADA será gravado): ${amostra.title}\n  ${amostra.url}`);
  const t0 = Date.now();
  const r = await extrairInteiroTeorDecor(amostra.url);
  const ms = Date.now() - t0;
  if (!r.ok) {
    console.log(`  FALHA em ${ms} ms: ${r.erro}`);
    return;
  }
  console.log(`  OK em ${ms} ms: ${r.texto!.length} chars${r.truncado ? ' (truncado no teto)' : ''}`);
  console.log('  Início do texto normalizado:');
  console.log(
    r
      .texto!.slice(0, 600)
      .split('\n')
      .map((l) => `    | ${l}`)
      .join('\n'),
  );
  const estimativaMin = Math.ceil((total * (ms + DELAY_MS)) / 60_000);
  console.log(`\nEstimativa para a fila inteira: ~${estimativaMin} min. Rode com --executar para gravar.`);
}

async function executar(limit?: number): Promise<void> {
  const inicial = await contarFilaDecor(prisma);
  const alvoTotal = limit ? Math.min(limit, inicial) : inicial;
  console.log(`Fila: ${inicial}. Processando ${alvoTotal}.`);

  let ok = 0, falha = 0, truncados = 0, processados = 0;
  // Ids já tentados NESTA rodada: um documento que falha (tentativas 1 ou 2)
  // continua na fila e voltaria na próxima página; aqui ele não é repetido.
  const vistos = new Set<string>();

  while (processados < alvoTotal) {
    const pagina = (await selecionarFilaDecor(prisma, { take: PAGINA + vistos.size }))
      .filter((d) => !vistos.has(d.id))
      .slice(0, Math.min(PAGINA, alvoTotal - processados));
    if (pagina.length === 0) break;

    for (const doc of pagina) {
      vistos.add(doc.id);
      try {
        const r = await capturarInteiroTeorDecor(prisma, doc);
        if (r.status === 'ok') {
          ok++;
          if (r.truncado) truncados++;
          console.log(`[${processados + 1}/${alvoTotal}] OK    ${r.chars} chars  ${doc.title}`);
        } else {
          falha++;
          console.log(`[${processados + 1}/${alvoTotal}] FALHA ${r.erro}  ${doc.title}  ${doc.url}`);
        }
      } catch (err) {
        // Infraestrutura (banco): não gastou tentativa; volta numa próxima rodada.
        falha++;
        console.error(`[${processados + 1}/${alvoTotal}] ERRO  ${(err as Error).message}  ${doc.id}`);
      }
      processados++;
      if (processados < alvoTotal) await sleep(DELAY_MS);
    }
  }

  const restam = await contarFilaDecor(prisma);
  console.log(`\nConcluído: ${processados} processados, ${ok} ok (${truncados} truncados), ${falha} falhas. Restam na fila: ${restam}.`);
}

async function main() {
  const args = parseArgs();
  if (args.executar) await executar(args.limit);
  else await simular();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
