/**
 * Limpeza one-shot do `data/lei-14133-artigos.ts` pra remover dívida técnica
 * de scrape que vaza pra renderização em prod (LeiComentadaClient.tsx usa
 * normalizeTextContent simples, sem cleanup runtime).
 *
 * Trata:
 *  1. Sufixos ALL CAPS de capítulo no fim da ementa (ex: "...artigo. DOS PRINCÍPIOS")
 *  2. Prefixo "Art. Nº ." com ponto extra → "Art. Nº "
 *  3. Linhas de pontos `..............` → `[…]`
 *  4. Espaços múltiplos horizontais (`  +`) → ` ` (preserva \n)
 *  5. Whitespace trailing por linha
 *
 * NÃO trata (decisão de produto pendente):
 *  - (VETADO) styling
 *  - (Vide Decreto) collapse/normalização
 *
 * Uso:
 *   npx tsx scripts/clean-lei-14133-source.ts --dry-run [--samples 5]
 *   npx tsx scripts/clean-lei-14133-source.ts                 # live, sobreescreve
 *
 * Spec: project_site_barral_lei14133_pendencias memory
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const FILE = join(process.cwd(), 'data', 'lei-14133-artigos.ts');

const TRAILING_CHAPTER_JUNK =
  /([.,;:!?])\s+(?:DA|DO|DAS|DOS)\s+[A-ZÀ-ÚÇÃÕÉÊÔÍÓÚÂÎÛ]+(?:[\s,]+(?:[A-ZÀ-ÚÇÃÕÉÊÔÍÓÚÂÎÛ]+|E|DA|DO|DAS|DOS))*\s*$/;

const ARTICLE_PREFIX_EXTRA_DOT =
  /^(Art\.\s+\d+(?:-[A-Z])?\s*[ºo°]?)\s+\.\s*/;

const DOTS_LINE = /\.{20,}/g;
const MULTI_HSPACE = /[ \t]{2,}/g;
const TRAILING_HSPACE = /[ \t]+$/gm;

interface CleanResult {
  ementa: string;
  changes: string[];
}

function cleanEmenta(raw: string): CleanResult {
  let text = raw;
  const changes: string[] = [];

  // 1. ALL CAPS chapter junk (apply up to 2x — concatenated chapters)
  for (let i = 0; i < 2; i++) {
    const m = text.trimEnd().match(TRAILING_CHAPTER_JUNK);
    if (!m) break;
    const trimmed = text.trimEnd();
    const punct = m[1];
    text = trimmed.slice(0, trimmed.length - m[0].length) + punct + '\n';
    text = text.trimEnd() + (raw.endsWith('\n') ? '\n' : '');
    changes.push(`stripped-chapter-junk: "${m[0].trim().slice(0, 40)}…"`);
  }

  // 2. "Art. Nº . " prefix extra dot → "Art. Nº "
  if (ARTICLE_PREFIX_EXTRA_DOT.test(text)) {
    text = text.replace(ARTICLE_PREFIX_EXTRA_DOT, '$1 ');
    changes.push('stripped-prefix-dot');
  }

  // 3. Lines of dots → [...]
  if (DOTS_LINE.test(text)) {
    const matches = text.match(DOTS_LINE)?.length ?? 0;
    text = text.replace(DOTS_LINE, '[…]');
    changes.push(`dots-line→ellipsis (${matches}x)`);
  }

  // 4. Trim trailing horizontal whitespace per line (run BEFORE multi-hspace
  // so a single trailing space doesn't end up in middle after collapse)
  if (TRAILING_HSPACE.test(text)) {
    text = text.replace(TRAILING_HSPACE, '');
    changes.push('stripped-trailing-hspace');
  }

  // 5. Multiple horizontal spaces → single (preserves \n)
  if (MULTI_HSPACE.test(text)) {
    text = text.replace(MULTI_HSPACE, ' ');
    changes.push('collapsed-multi-hspace');
  }

  return { ementa: text, changes };
}

interface FileTransform {
  newSource: string;
  affected: Array<{ numero: string; before: string; after: string; changes: string[] }>;
  totalArticles: number;
}

function transformFile(source: string): FileTransform {
  const affected: FileTransform['affected'] = [];
  let totalArticles = 0;

  // Match each ementa: `…` block. Lazy match captures shortest content until
  // first closing backtick (data has no nested backticks).
  const EMENTA_RE = /(ementa:\s*`)([\s\S]*?)(`)/g;

  // Also need numero pra logging — find the `numero: "X"` BEFORE each ementa
  const NUMERO_RE = /numero:\s*"([^"]+)"/g;
  const numeroMatches: Array<{ numero: string; index: number }> = [];
  let nm: RegExpExecArray | null;
  while ((nm = NUMERO_RE.exec(source)) !== null) {
    numeroMatches.push({ numero: nm[1], index: nm.index });
  }

  function findNumeroBefore(idx: number): string {
    let best = '?';
    for (const m of numeroMatches) {
      if (m.index < idx) best = m.numero;
      else break;
    }
    return best;
  }

  const newSource = source.replace(EMENTA_RE, (full, prefix, content, suffix, offset) => {
    totalArticles++;
    const numero = findNumeroBefore(offset);
    const { ementa: cleaned, changes } = cleanEmenta(content);
    if (changes.length > 0) {
      affected.push({ numero, before: content, after: cleaned, changes });
    }
    return `${prefix}${cleaned}${suffix}`;
  });

  return { newSource, affected, totalArticles };
}

function snippet(s: string, max = 200): string {
  const trimmed = s.trim().replace(/\n/g, '⏎');
  return trimmed.length > max ? trimmed.slice(0, max) + '…' : trimmed;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const samplesIdx = args.indexOf('--samples');
  const samples = samplesIdx >= 0 ? parseInt(args[samplesIdx + 1] || '5', 10) : 5;

  console.log(`[clean-lei] file=${FILE}`);
  console.log(`[clean-lei] mode=${dryRun ? 'DRY-RUN' : 'LIVE'}`);

  const source = readFileSync(FILE, 'utf-8');
  const { newSource, affected, totalArticles } = transformFile(source);

  console.log(`\n[clean-lei] artigos varridos: ${totalArticles}`);
  console.log(`[clean-lei] artigos afetados: ${affected.length}`);

  // Stats by transform type
  const byChange = new Map<string, number>();
  for (const a of affected) {
    for (const c of a.changes) {
      const key = c.split(':')[0].split('→')[0].trim();
      byChange.set(key, (byChange.get(key) ?? 0) + 1);
    }
  }
  console.log('\n[clean-lei] transformações aplicadas:');
  for (const [k, n] of [...byChange.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }

  console.log(`\n[clean-lei] Amostra (até ${samples} artigos com mudança):\n`);
  for (const a of affected.slice(0, samples)) {
    console.log(`── art ${a.numero} [${a.changes.join(', ')}]`);
    console.log(`  ANTES: ${snippet(a.before)}`);
    console.log(`  DEPOIS: ${snippet(a.after)}`);
    console.log();
  }

  if (dryRun) {
    console.log('[clean-lei] dry-run: nenhuma escrita.');
    return;
  }

  if (affected.length === 0) {
    console.log('[clean-lei] nada pra escrever.');
    return;
  }

  writeFileSync(FILE, newSource, 'utf-8');
  console.log(`[clean-lei] ✅ escrito ${FILE} (${affected.length} ementas atualizadas)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
