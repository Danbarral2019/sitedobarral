/**
 * scrape-ons-douurls.ts
 *
 * Leva 2: extrai TODOS os links DOU do portal AGU/onsagu e mapeia por número
 * da ON. Independente de delimitação de bloco — usa só o número embutido no
 * próprio URL do DOU (ex.: "orientacao-normativa-n-102-de-...").
 *
 * Read-only. Output: docs/audits/2026-04-30-ons-dou-urls.json
 *
 * Uso: npx tsx scripts/scrape-ons-douurls.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface DouEntry {
  numero: number;
  url: string;
  hasAguPrefix: boolean; // true para ON ≤77 (orientacao-normativa-agu-n-X), false pra 78+ (orientacao-normativa-n-X)
  douDate?: string; // capturado do próprio path se possível
}

async function main() {
  console.log('Fetch https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu...');
  const r = await fetch('https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!r.ok) {
    console.error(`HTTP ${r.status}`);
    process.exit(1);
  }
  const html = await r.text();
  console.log(`HTML carregado (${(html.length / 1024).toFixed(0)} KB)`);

  // Regex: captura URL DOU de ON e o número embutido
  // Padrão: in.gov.br/.../orientacao-normativa(-agu)?-n-NUMERO-de-DIA-de-MES-de-ANO-ID
  const douPattern =
    /https?:\/\/(?:www\.)?in\.gov\.br[^\s"'<>)]*orientacao-normativa(-agu)?-n-(\d+)-de-(\d+)-de-([a-zç]+)-de-(\d{4})-(\d+)/gi;

  const seen = new Map<number, DouEntry>(); // dedup por número
  let match: RegExpExecArray | null;
  douPattern.lastIndex = 0;
  while ((match = douPattern.exec(html)) !== null) {
    const fullUrl = match[0];
    const hasAgu = !!match[1];
    const numero = parseInt(match[2], 10);
    const dia = match[3];
    const mes = match[4];
    const ano = match[5];

    // Se já tem essa ON, mantém a primeira (provavelmente é a publicação original)
    if (seen.has(numero)) continue;

    seen.set(numero, {
      numero,
      url: fullUrl,
      hasAguPrefix: hasAgu,
      douDate: `${dia}/${mes}/${ano}`,
    });
  }

  const entries = Array.from(seen.values()).sort((a, b) => a.numero - b.numero);
  console.log(`Encontradas ${entries.length} ONs com link DOU específico\n`);

  // Mostra amostra
  console.log('Primeiras 10:');
  entries.slice(0, 10).forEach((e) => {
    console.log(`  ON ${e.numero} → ${e.url}`);
  });
  console.log('\nÚltimas 10:');
  entries.slice(-10).forEach((e) => {
    console.log(`  ON ${e.numero} → ${e.url}`);
  });

  // Stats
  const withAgu = entries.filter((e) => e.hasAguPrefix).length;
  const withoutAgu = entries.length - withAgu;
  console.log(`\nPrefixo "-agu-n-" (ONs antigas): ${withAgu}`);
  console.log(`Prefixo "-n-" (ONs novas, 2025+):    ${withoutAgu}`);

  // Salva
  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-ons-dou-urls.json`
  );
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        scrapedAt: new Date().toISOString(),
        source: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu',
        total: entries.length,
        entries,
      },
      null,
      2
    )
  );
  console.log(`\n✅ JSON salvo: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
