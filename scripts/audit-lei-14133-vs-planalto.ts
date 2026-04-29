/**
 * Audita e atualiza data/lei-14133-artigos.ts (e tabela LeiArticle no DB)
 * comparando com o texto vigente da Lei 14.133/2021 no Planalto.
 *
 * Estratégia:
 *   1. Baixa o HTML da Lei direto do Planalto (charset ISO-8859-1).
 *   2. Para cada Art. listado em ARTICLES_TO_AUDIT, extrai o texto vigente
 *      (descartando partes "tachadas" — redações revogadas — quando possível).
 *   3. Compara com o ementa do static file e DB. Se diferentes, mostra diff
 *      e (com --apply) atualiza ambos.
 *   4. Marca artigos atualizados pra re-índex de embeddings.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-lei-14133-vs-planalto.ts            # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-lei-14133-vs-planalto.ts --apply
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');
const SOURCE_URL = 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm';

// Artigos identificados como possivelmente alterados por leis posteriores
// (Lei 14.628/2023, 14.770/2023, 15.210/2025, 15.266/2025).
const ARTICLES_TO_AUDIT = [
  '20',  // possíveis ajustes
  '44-A',// novo (Lei 15.210/2025)
  '79',  // Lei 15.266 — IV (Sicx), VII a-f, §1º renumerado, §2º
  '86',  // Lei 14.770
  '87',  // Lei 15.266 — caput
  '90',  // Lei 14.770
  '96',  // Lei 14.770
  '105', // Lei 14.770
  '174', // Lei 15.266 — VII (Sicx) no §3º, §3º-A novo
  '175', // Lei 15.266 — §1º
  '184', // Lei 14.770
  '184-A',// Lei 14.770 (artigo novo)
];

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[#\w]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove versões revogadas em pares consecutivos de marcadores estruturais
 * iguais (ex: "§ 1º ... § 1º ... (Redação dada pela Lei nº X)"). Planalto
 * exibe a redação tachada + a nova lado a lado quando uma alteração
 * legislativa atinge cada paragráfo/inciso.
 *
 * Heurística: quebra o texto em segmentos a cada marcador estrutural
 * (§ N, inciso romano, Art. N) e elimina cada segmento que é seguido por
 * outro com o MESMO marcador (mantém o último — vigente).
 */
function removeRevokedDuplicates(text: string): string {
  // Split mantendo o marcador como início do segmento. Marcadores cobertos:
  // §\d, Art.\d, I-XX (romanos no início).
  const tokens = text.split(/(?=(?:Art\.\s*\d+(?:-[A-Z])?\.|§\s*\d+(?:[º°o])?\.?))/);

  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const curMarker = (cur.match(/^(Art\.\s*\d+(?:-[A-Z])?\.|§\s*\d+(?:[º°o])?\.?)/) || [])[1];
    if (!curMarker) {
      out.push(cur);
      continue;
    }
    // Olha o próximo token: se mesmo marcador, descarta o atual
    const next = tokens[i + 1];
    const nextMarker = next ? (next.match(/^(Art\.\s*\d+(?:-[A-Z])?\.|§\s*\d+(?:[º°o])?\.?)/) || [])[1] : null;
    if (nextMarker && curMarker.replace(/\s+/g, '') === nextMarker.replace(/\s+/g, '')) {
      // Token atual é versão revogada — pular
      continue;
    }
    out.push(cur);
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractArticle(html: string, num: string): string | null {
  const numEsc = escapeRegex(num);

  // Acha TODAS as ocorrências de "Art. X." e descarta as que são parte da
  // seção "vetos parciais" no final do html (padrão "Art. X .........") —
  // só considera ocorrências cujo conteúdo subsequente tem texto substantivo
  // (palavra >3 chars no início). Planalto mostra versão tachada + versão
  // nova quando caput foi alterado, por isso pegamos a ÚLTIMA ocorrência.
  const reArt = new RegExp(`Art\\.\\s*${numEsc}\\.?\\s`, 'g');
  const occurrences: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = reArt.exec(html)) !== null) {
    const head = html.slice(m.index + m[0].length, m.index + m[0].length + 80);
    // Aceita só se houver palavra substantiva imediatamente após (não dots)
    if (/^[A-ZÀ-Ú(]/.test(head.trim())) occurrences.push(m.index);
  }
  if (occurrences.length === 0) return null;

  const blockStart = occurrences[0];
  const lastOccurrence = occurrences[occurrences.length - 1];

  // Final do bloco: próximo Art. com número diferente
  const reAny = /Art\.\s*(\d+(?:-[A-Z])?)/g;
  reAny.lastIndex = blockStart + 5;
  let blockEnd = blockStart + 8000;
  let next: RegExpExecArray | null;
  while ((next = reAny.exec(html)) !== null) {
    if (next[1] !== num) {
      blockEnd = next.index;
      break;
    }
  }

  // Se houver múltiplas versões do mesmo artigo, pega só do último Art. X
  // até o blockEnd — isso é a versão vigente (com "(Incluído/Redação dada
  // pela Lei nº ...)") logo após o caput.
  const start = occurrences.length > 1 ? lastOccurrence : blockStart;
  const block = html.slice(start, blockEnd).trim();
  // Para parágrafos/incisos repetidos dentro do bloco (Planalto exibe
  // versão revogada + nova lado a lado), mantém apenas a última de cada par.
  return removeRevokedDuplicates(block);
}

async function fetchPlanalto(): Promise<string> {
  const buf = fs.existsSync('/tmp/lei14133.html')
    ? fs.readFileSync('/tmp/lei14133.html')
    : Buffer.from(await (await fetch(SOURCE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })).arrayBuffer());

  if (!fs.existsSync('/tmp/lei14133.html')) {
    fs.writeFileSync('/tmp/lei14133.html', buf);
  }
  return cleanHtml(buf.toString('latin1'));
}

async function main() {
  console.log(`=== Audit Lei 14.133/2021 vs Planalto ===`);
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  const planaltoText = await fetchPlanalto();
  console.log(`HTML do Planalto: ${planaltoText.length} chars limpos.\n`);

  const staticPath = path.join(process.cwd(), 'data', 'lei-14133-artigos.ts');
  let staticContent = fs.readFileSync(staticPath, 'utf-8');

  type Audit = { numero: string; planaltoText: string; staticText: string | null; status: string };
  const audits: Audit[] = [];

  for (const num of ARTICLES_TO_AUDIT) {
    const planaltoArt = extractArticle(planaltoText, num);
    if (!planaltoArt) {
      audits.push({ numero: num, planaltoText: '', staticText: null, status: 'NÃO ACHADO no Planalto' });
      continue;
    }
    // Lê do DB (LeiArticle)
    const dbRow = await prisma.leiArticle.findFirst({
      where: { numero: num },
      select: { numero: true, ementa: true },
    });
    const status = dbRow
      ? (dbRow.ementa.includes(planaltoArt.slice(20, 80)) ? 'OK (sub-string match)' : 'DIVERGE')
      : 'AUSENTE no DB';
    audits.push({ numero: num, planaltoText: planaltoArt, staticText: dbRow?.ementa ?? null, status });
  }

  console.log('Numero    Status                            Planalto-len  DB-len');
  for (const a of audits) {
    const pl = String(a.planaltoText.length).padStart(5);
    const db = String(a.staticText?.length ?? 0).padStart(5);
    console.log(`  ${a.numero.padEnd(8)}${a.status.padEnd(34)}${pl}      ${db}`);
  }

  // Mostrar primeiras divergências
  const diffs = audits.filter(a => a.status === 'DIVERGE');
  console.log(`\nDivergências (${diffs.length}):`);
  for (const d of diffs.slice(0, 12)) {
    console.log(`\n--- Art. ${d.numero} ---`);
    console.log(`  Planalto (${d.planaltoText.length} chars):  "${d.planaltoText.slice(0, 250)}…"`);
    console.log(`  DB       (${d.staticText?.length ?? 0} chars): "${(d.staticText ?? '').slice(0, 250)}…"`);
  }

  if (!APPLY) {
    console.log('\n(dry-run — nada gravado)');
    await prisma.$disconnect();
    return;
  }

  // Backup do static file antes de mexer
  const backupPath = path.join(
    process.cwd(),
    'data',
    'backups',
    `lei-14133-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  // Backup minimo: salva só os artigos que serão tocados
  const backup: Record<string, string> = {};
  for (const d of diffs) backup[d.numero] = d.staticText ?? '';
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup salvo em ${backupPath}`);

  // Atualiza DB
  let updated = 0;
  for (const d of diffs) {
    await prisma.leiArticle.updateMany({
      where: { numero: d.numero },
      data: { ementa: d.planaltoText },
    });
    updated++;
    console.log(`  ✅ DB Art. ${d.numero} atualizado (${d.planaltoText.length} chars)`);
  }
  console.log(`\nTotal atualizado no DB: ${updated}`);

  // Atualiza static file (apenas o ementa de cada — preserva resto)
  // Padrão: numero: "X", ementa: "...",
  let updatedInStatic = 0;
  for (const d of diffs) {
    const numRegex = escapeRegex(d.numero);
    // Match flexível para o bloco do artigo
    const blockRe = new RegExp(
      `(numero:\\s*"${numRegex}",[\\s\\S]*?ementa:\\s*)"((?:[^"\\\\]|\\\\.)*)"`,
      'm',
    );
    const m = blockRe.exec(staticContent);
    if (!m) {
      console.log(`  ⚠️  Static: Art. ${d.numero} não casou com o regex — pular`);
      continue;
    }
    // Normaliza para template do static (com Art. Xº . prefixo)
    const newEmenta = d.planaltoText
      .replace(/"/g, '\\"')   // escapa aspas
      .replace(/\n/g, '\\n');  // string literal
    staticContent = staticContent.slice(0, m.index)
      + m[1] + `"${newEmenta}"`
      + staticContent.slice(m.index + m[0].length);
    updatedInStatic++;
  }
  fs.writeFileSync(staticPath, staticContent);
  console.log(`Static file: ${updatedInStatic} ementas atualizadas em ${staticPath}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
