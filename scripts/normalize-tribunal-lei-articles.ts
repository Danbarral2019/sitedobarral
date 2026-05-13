/**
 * Normaliza `TribunalDecision.leiArticles` para o formato esperado pelo índice
 * `data/lei-14133-artigos.ts` (apenas o número, sem o prefixo "Art.").
 *
 * Problema: scrapers salvaram valores como "Art. 29", "Art. 166-A", "art.30",
 * mas `LEI_14133_ARTIGOS` é indexado por chave numérica pura ("29", "166-A").
 * Auditoria de 2026-05-13 achou 345 refs mortas em 887 decisões.
 *
 * Estratégia: remove prefixo "Art." (case-insensitive, com/sem ponto, com/sem
 * espaço) e descarta valores que não casam com o índice depois da limpeza.
 * Preserva sufixos tipo "166-A".
 *
 * Por padrão é dry-run. Com `--apply`, atualiza `Document` (read JSON, transforma,
 * write JSON). Cria backup em `docs/audits/tribunal-leiarticles-backup-<date>.json`
 * com o estado antes de aplicar.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/normalize-tribunal-lei-articles.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/normalize-tribunal-lei-articles.ts --apply
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

const VALID = new Set(Object.keys(LEI_14133_ARTIGOS));

/** "Art. 29" → "29", "art.166-A" → "166-A", "Artigo 30" → "30", "29" → "29" */
function stripArtPrefix(raw: string): string {
  return raw
    .trim()
    .replace(/^artigos?\s*\.?\s*/i, '')
    .replace(/^arts?\s*\.?\s*/i, '')
    .trim();
}

interface Change {
  decisionId: string;
  label: string;
  before: string[];
  after: string[];
  dropped: string[];
}

function parseArr(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

async function main() {
  console.log(`\n=== Normalização TribunalDecision.leiArticles ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`);

  const decisions = await prisma.tribunalDecision.findMany({
    where: { leiArticles: { not: null } },
    select: { id: true, tribunalCode: true, decisionNumber: true, leiArticles: true },
  });
  console.log(`Decisões com leiArticles: ${decisions.length}`);

  const changes: Change[] = [];
  let touchedTotal = 0;
  let stillDead = 0;

  for (const d of decisions) {
    const before = parseArr(d.leiArticles);
    if (before.length === 0) continue;

    const after: string[] = [];
    const dropped: string[] = [];
    let mutated = false;

    for (const raw of before) {
      const stripped = stripArtPrefix(raw);
      if (raw !== stripped) mutated = true;
      if (VALID.has(stripped)) {
        after.push(stripped);
      } else {
        // Tenta também o original (caso já estivesse correto)
        if (VALID.has(raw)) {
          after.push(raw);
        } else {
          dropped.push(raw);
          stillDead++;
        }
      }
    }

    if (mutated || dropped.length > 0) {
      changes.push({
        decisionId: d.id,
        label: `${d.tribunalCode} ${d.decisionNumber}`,
        before,
        after,
        dropped,
      });
      touchedTotal++;
    }
  }

  console.log(`Decisões com alterações: ${touchedTotal}`);
  console.log(`Itens ainda mortos após strip (não normalizáveis, serão descartados): ${stillDead}\n`);

  if (changes.length === 0) {
    console.log('✅ Nada a fazer.');
    await prisma.$disconnect();
    return;
  }

  console.log('Amostra (até 10):');
  for (const c of changes.slice(0, 10)) {
    console.log(`  ${c.label}`);
    console.log(`    before: ${JSON.stringify(c.before)}`);
    console.log(`    after:  ${JSON.stringify(c.after)}`);
    if (c.dropped.length > 0) console.log(`    dropped: ${JSON.stringify(c.dropped)}`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Rode com --apply para atualizar ${changes.length} decisões.`);
    await prisma.$disconnect();
    return;
  }

  // Backup
  const ts = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(process.cwd(), 'docs', 'audits', `tribunal-leiarticles-backup-${ts}.json`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(changes, null, 2));
  console.log(`\nBackup salvo em: ${backupPath}`);

  console.log(`\nAplicando ${changes.length} updates...`);
  let ok = 0;
  for (const c of changes) {
    await prisma.tribunalDecision.update({
      where: { id: c.decisionId },
      data: { leiArticles: JSON.stringify(c.after) },
    });
    ok++;
    if (ok % 50 === 0) console.log(`  ${ok}/${changes.length}...`);
  }
  console.log(`\n✅ ${ok} decisão(ões) atualizada(s).`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
