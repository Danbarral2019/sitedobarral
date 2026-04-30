/**
 * scrape-ons-content.ts
 *
 * Leva 4 — captura texto integral das ONs que têm URL DOU específica.
 *
 * Para cada ON com `url` apontando pra in.gov.br, faz fetch da página DOU,
 * extrai todos os `<p class="dou-paragraph">` (preâmbulo + enunciado + referência
 * + fonte + vigência) e salva concatenado em `Document.content`.
 *
 * Read-only por padrão. Use --apply pra escrever no DB.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/scrape-ons-content.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/scrape-ons-content.ts --apply
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

const THROTTLE_MS = 1500; // 1.5s entre fetches pra não sobrecarregar in.gov.br

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&aelig;/g, 'æ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

async function fetchDouContent(url: string): Promise<{
  ok: boolean;
  content?: string;
  paragraphCount?: number;
  error?: string;
}> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const html = await r.text();

    const paragraphs = Array.from(
      html.matchAll(/<p[^>]*class="[^"]*dou-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)
    ).map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
    );

    if (paragraphs.length === 0) return { ok: false, error: 'sem dou-paragraph' };

    const content = paragraphs.join('\n\n');
    return { ok: true, content, paragraphCount: paragraphs.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const today = new Date().toISOString().slice(0, 10);

  console.log('='.repeat(60));
  console.log(`SCRAPE-ONS-CONTENT — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));

  // Pega ONs com URL DOU específica (in.gov.br) e content vazio ou desatualizado
  const ons = await prisma.document.findMany({
    where: {
      category: 'orientacao-normativa',
      isPublic: true,
      url: { contains: 'in.gov.br' },
    },
    select: {
      id: true,
      onNumber: true,
      onYear: true,
      url: true,
      content: true,
    },
    orderBy: [{ onYear: 'desc' }, { onNumber: 'desc' }],
  });

  console.log(`Candidatos (ONs com URL DOU): ${ons.length}\n`);

  type Result = {
    id: string;
    numero: number | null;
    ano: number | null;
    url: string;
    status: 'success' | 'failed' | 'skipped';
    paragraphCount?: number;
    contentLength?: number;
    error?: string;
  };

  const results: Result[] = [];

  let i = 0;
  for (const on of ons) {
    i++;
    process.stdout.write(`[${i}/${ons.length}] ON ${on.onNumber}/${on.onYear}... `);

    const fetched = await fetchDouContent(on.url);
    if (!fetched.ok) {
      console.log(`FAIL (${fetched.error})`);
      results.push({
        id: on.id,
        numero: on.onNumber,
        ano: on.onYear,
        url: on.url,
        status: 'failed',
        error: fetched.error,
      });
      await sleep(THROTTLE_MS);
      continue;
    }

    const content = fetched.content!;
    console.log(`✓ ${fetched.paragraphCount} paragrafos, ${content.length} chars`);

    if (apply) {
      try {
        await prisma.document.update({
          where: { id: on.id },
          data: {
            content,
            reviewed: false,
            reviewedAt: null,
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ⚠ DB update falhou: ${msg}`);
        results.push({
          id: on.id,
          numero: on.onNumber,
          ano: on.onYear,
          url: on.url,
          status: 'failed',
          error: `DB: ${msg}`,
        });
        await sleep(THROTTLE_MS);
        continue;
      }
    }

    results.push({
      id: on.id,
      numero: on.onNumber,
      ano: on.onYear,
      url: on.url,
      status: 'success',
      paragraphCount: fetched.paragraphCount,
      contentLength: content.length,
    });

    await sleep(THROTTLE_MS);
  }

  // Stats
  const success = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  console.log('');
  console.log('='.repeat(60));
  console.log(`✅ Sucesso: ${success}`);
  console.log(`❌ Falhas: ${failed}`);
  if (failed > 0) {
    console.log('\nFalhas:');
    for (const f of results.filter((r) => r.status === 'failed')) {
      console.log(`  ON ${f.numero}/${f.ano}: ${f.error}`);
    }
  }

  // Log
  const logPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-ons-content-${apply ? 'apply' : 'dryrun'}-log.json`
  );
  fs.writeFileSync(
    logPath,
    JSON.stringify({ runAt: new Date().toISOString(), apply, results }, null, 2)
  );
  console.log(`\n📄 Log: ${logPath}`);

  if (!apply) {
    console.log('\nPara aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/scrape-ons-content.ts --apply');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
