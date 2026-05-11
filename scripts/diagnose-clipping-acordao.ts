/**
 * Diagnóstico de um acórdão específico no pipeline do clipping diário.
 *
 * Mostra:
 *  - O Document no DB (ementa, link PDF/RTF, relator)
 *  - O ClippingItemExtract correspondente (método, dispositivos, bullets IA)
 *  - Reproduz fetch do RTF e mostra se chega ao parser
 *  - Reproduz extração com regex e mostra o que sai
 *
 * Uso:
 *   npx tsx scripts/diagnose-clipping-acordao.ts "1144/2026"
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { prisma } from '../lib/prisma';
import { rtfToText, extractDispositivos, type DocumentLike } from '../lib/clipping/dispositivo-extractor';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchRtfRaw(url: string): Promise<string | null> {
  const rtfUrl = url.replace(/SvlVisualizarRelVotoAc(?=\?)/, 'SvlVisualizarRelVotoAcRtf');
  const res = await fetch(rtfUrl, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/rtf,*/*' },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.log(`  fetch falhou: ${res.status} ${res.statusText}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.slice(0, 6).toString('latin1');
  console.log(`  buffer=${buf.length} bytes, head="${head}"`);
  if (!head.startsWith('{\\rtf')) {
    console.log('  ⚠ resposta não é RTF');
    return null;
  }
  return buf.toString('latin1');
}

async function main() {
  const ref = process.argv[2];
  if (!ref) {
    console.error('Uso: npx tsx scripts/diagnose-clipping-acordao.ts "1144/2026"');
    process.exit(1);
  }

  // Procura tanto "1144/2026" puro quanto formato "AC-1144/2026-P"
  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { tcuNumeroAcordao: { contains: ref } },
        { title: { contains: ref } },
      ],
    },
    select: {
      id: true,
      title: true,
      tcuNumeroAcordao: true,
      tcuRelator: true,
      tcuDataJulgamento: true,
      tcuEmentaCompleta: true,
      tcuLinkPDF: true,
    },
    take: 5,
  });

  if (docs.length === 0) {
    console.log(`Nenhum documento encontrado para "${ref}".`);
    return;
  }

  for (const doc of docs) {
    console.log(`\n=== ${doc.tcuNumeroAcordao || doc.title} (id=${doc.id}) ===`);
    console.log(`Relator: ${doc.tcuRelator ?? '—'}`);
    console.log(`Sessão: ${doc.tcuDataJulgamento?.toISOString().slice(0, 10) ?? '—'}`);
    console.log(`Link PDF: ${doc.tcuLinkPDF ?? '—'}`);
    console.log(`Ementa (${doc.tcuEmentaCompleta?.length ?? 0} chars):`);
    console.log(`  ${doc.tcuEmentaCompleta?.slice(0, 400) ?? '(vazia)'}${(doc.tcuEmentaCompleta?.length ?? 0) > 400 ? '…' : ''}`);

    const extract = await prisma.clippingItemExtract.findUnique({
      where: { documentId: doc.id },
    });
    if (!extract) {
      console.log(`\nClippingItemExtract: nenhum (extract nunca rodou)`);
    } else {
      console.log(`\nClippingItemExtract:`);
      console.log(`  method: ${extract.extractMethod}`);
      console.log(`  pdfFetchFailed: ${extract.pdfFetchFailed}`);
      console.log(`  extractedAt: ${extract.extractedAt.toISOString()}`);
      const disps = extract.dispositivos ? JSON.parse(extract.dispositivos) : [];
      console.log(`  dispositivos: ${disps.length} item(s)`);
      disps.slice(0, 3).forEach((d: { numero: string; texto: string }) =>
        console.log(`    ${d.numero}: ${d.texto.slice(0, 120)}${d.texto.length > 120 ? '…' : ''}`),
      );
      const bullets = extract.aiBullets ? JSON.parse(extract.aiBullets) : null;
      console.log(`  aiBullets: ${bullets ? `${bullets.length} bullet(s)` : 'null'}`);
      if (bullets) {
        bullets.forEach((b: string, i: number) => console.log(`    [${i + 1}] ${b.slice(0, 160)}`));
      }
      console.log(`  aiGeneratedAt: ${extract.aiGeneratedAt?.toISOString() ?? '—'}`);
    }

    // Reproduz fetch RTF + parse limpo (com a nova sanitização)
    if (doc.tcuLinkPDF) {
      console.log(`\nReproduzindo fetch RTF…`);
      const raw = await fetchRtfRaw(doc.tcuLinkPDF);
      if (raw) {
        const text = rtfToText(raw);
        console.log(`  rtfToText → ${text.length} chars`);
        console.log(`  preview: ${text.slice(0, 300).replace(/\s+/g, ' ')}…`);
        const hasHlk = /_Hlk\d+/.test(text);
        console.log(`  ainda tem _Hlk*?: ${hasHlk}`);
        // Procura "ACORDAM os Ministros"
        const acordamIdx = text.search(/ACORDAM\s+os\s+[mM]inistros/);
        console.log(`  posição "ACORDAM": ${acordamIdx >= 0 ? acordamIdx : 'NÃO ENCONTRADO'}`);
        if (acordamIdx >= 0) {
          const block = text.slice(acordamIdx, acordamIdx + 800);
          console.log(`  bloco ACORDAM (800 chars): ${block.replace(/\s+/g, ' ')}…`);
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
