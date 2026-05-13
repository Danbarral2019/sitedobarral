/**
 * Auditoria de caracteres de controle C1 (U+0080-U+009F) em LegislativeAct.content
 * e .ementa. Esses chars vêm de Windows-1252 (cp1252) mal decodificado como
 * UTF-8 e produzem "lixo invisível" no texto — quebra wrap, polui FTS, e
 * sinaliza decoding incorreto.
 *
 * Read-only: só reporta.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// U+0080–U+009F = C1 control chars
const C1_REGEX = /[-]/g;

// Mapeamento Windows-1252 → Unicode adequado (os codepoints C1 são reservados
// no Unicode mas o cp1252 os reaproveita pra punctuation comum).
const CP1252_MAP: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
  0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8A: 'Š',
  0x8B: '‹', 0x8C: 'Œ', 0x8E: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”',
  0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™',
  0x9A: 'š', 0x9B: '›', 0x9C: 'œ', 0x9E: 'ž', 0x9F: 'Ÿ',
};

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, ementa: true, content: true },
  });

  console.log(`\n=== Auditoria de C1 control chars (U+0080-U+009F) ===\n`);
  console.log(`Total atos: ${acts.length}\n`);

  interface Hit {
    fullNumber: string;
    field: 'ementa' | 'content';
    count: number;
    chars: Map<number, number>; // codepoint → count
    sample: string;
  }

  const hits: Hit[] = [];
  const allChars = new Map<number, number>();

  for (const a of acts) {
    for (const field of ['ementa', 'content'] as const) {
      const text = a[field];
      if (!text) continue;
      const matches = [...text.matchAll(C1_REGEX)];
      if (matches.length === 0) continue;

      const chars = new Map<number, number>();
      for (const m of matches) {
        const code = m[0].charCodeAt(0);
        chars.set(code, (chars.get(code) ?? 0) + 1);
        allChars.set(code, (allChars.get(code) ?? 0) + 1);
      }

      const firstIdx = matches[0].index ?? 0;
      const sample = text.slice(Math.max(0, firstIdx - 50), firstIdx + 80).replace(/\n/g, '⏎');

      hits.push({
        fullNumber: a.fullNumber,
        field,
        count: matches.length,
        chars,
        sample,
      });
    }
  }

  console.log(`Atos com C1 chars: ${hits.length}\n`);
  console.log('Distribuição global por codepoint:');
  for (const [code, count] of [...allChars].sort((a, b) => b[1] - a[1])) {
    const mapped = CP1252_MAP[code] ?? '?';
    console.log(`  U+00${code.toString(16).padStart(2, '0').toUpperCase()} (${count.toString().padStart(4)}x) → cp1252 "${mapped}"`);
  }

  console.log('\nTop 20 atos afetados:');
  for (const h of hits.sort((a, b) => b.count - a.count).slice(0, 20)) {
    const charList = [...h.chars]
      .map(([c, n]) => `U+00${c.toString(16).padStart(2, '0').toUpperCase()}×${n}`)
      .join(' ');
    console.log(`  ${h.fullNumber.padEnd(45)} ${h.field.padEnd(7)} ${h.count.toString().padStart(4)}× [${charList}]`);
    console.log(`    Amostra: ...${h.sample}...`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
