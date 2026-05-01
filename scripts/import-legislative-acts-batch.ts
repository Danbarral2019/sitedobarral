/**
 * Batch import de LegislativeAct a partir de JSON.
 *
 * Aceita um arquivo JSON com a estrutura:
 *   {
 *     "metadata": { ... },
 *     "legislativeActs": [
 *       {
 *         "type": "in" | "decreto" | "portaria" | "lei" | "medida-provisoria" | "ordem-servico",
 *         "number": "190",
 *         "year": 2024,
 *         "fullNumber": "IN SEGES 190/2024",
 *         "title": "...",
 *         "ementa": "...",
 *         "summary"?: "...",
 *         "issuer": "SEGES",
 *         "publishDate": "2024-12-05",
 *         "effectiveDate"?: "2025-01-01",
 *         "hierarchyLevel": 4,
 *         "leiArticles"?: ["115", "180"],
 *         "themes"?: ["terceirizacao", "jornada"],
 *         "officialUrl"?: "...",
 *         "pdfUrl"?: "..."
 *       }
 *     ]
 *   }
 *
 * Comportamento de update (campo MERGE, não REPLACE):
 *   Em UPDATEs, só campos PRESENTES no JSON são escritos. Campos opcionais
 *   ausentes do JSON ficam fora do UPDATE → o valor existente no banco é
 *   preservado. Isso evita o bug histórico onde rodar este batch zerava
 *   `themes` e `content` que tinham sido populados por scripts de enrichment.
 *
 *   Em CREATEs, o objeto inteiro é gravado (campos opcionais ausentes ficam null,
 *   o que é o comportamento esperado pra um ato novo).
 *
 * Faz upsert por `fullNumber`. Atos novos são criados com `embeddingStatus='pending'`
 * para serem indexados depois por `scripts/index-legislative-acts.ts`.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-legislative-acts-batch.ts <json-path>
 *   npx dotenv -e .env.local -- npx tsx scripts/import-legislative-acts-batch.ts <json-path> --dry-run
 *
 *   --dry-run            Simula sem alterar o banco. Mostra DIFF por campo.
 *   --allow-clearing     Necessário se o JSON quiser explicitamente setar um campo
 *                        opcional pra null (ex: `"content": null`). Sem essa flag,
 *                        nulls são tratados como "campo ausente" (preserva existente).
 *
 * Exemplo:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-legislative-acts-batch.ts ins-faltantes-2026-02.json --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { detectAndSaveRelationsHybrid } from '../lib/legislative-acts/relations';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { normalizeIssuer } from '../lib/legislative-acts/issuers';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface ActInput {
  type: string;
  number: string;
  year: number;
  fullNumber: string;
  title: string;
  ementa: string;
  summary?: string;
  issuer: string;
  publishDate: string;
  effectiveDate?: string;
  hierarchyLevel: number;
  leiArticles?: string[];
  themes?: string[];
  officialUrl?: string | null;
  pdfUrl?: string | null;
  content?: string | null;
  esfera?: string;
}

interface BatchInput {
  metadata?: Record<string, unknown>;
  legislativeActs: ActInput[];
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ALLOW_CLEARING = args.includes('--allow-clearing');
const ALLOW_INVALID_CONTENT = args.includes('--allow-invalid-content');
const jsonPath = args.find((a) => !a.startsWith('--'));

if (!jsonPath) {
  console.error('Uso: tsx scripts/import-legislative-acts-batch.ts <json-path> [--dry-run] [--allow-clearing]');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Indica se uma chave do JSON está PRESENTE (mesmo que com valor `null` —
 * caso o autor queira explicitamente limpar um campo). `undefined` ou ausência
 * total é tratado como "preserva o valor existente".
 */
function isProvided<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;
}

/** Stringify JSON ou retorna null se valor for null/undefined. */
function jsonOrNull(v: unknown): string | null {
  return v == null ? null : JSON.stringify(v);
}

/**
 * Monta o `data` do UPDATE só com campos efetivamente fornecidos pelo JSON.
 * Campos não-fornecidos ficam de fora → Prisma não toca neles.
 */
function buildUpdateData(act: ActInput): Record<string, unknown> {
  // Campos obrigatórios — sempre presentes no schema, sempre vão pro update.
  // `ementa` é normalizada (remove ruído de UI/boilerplate caso JSON tenha
  // sido feito por copy-paste de gov.br/in.gov.br).
  const data: Record<string, unknown> = {
    type: act.type,
    number: act.number,
    year: act.year,
    title: act.title,
    ementa: normalizeScrapedText(act.ementa),
    issuer: normalizeIssuer(act.issuer),
    publishDate: new Date(act.publishDate),
    hierarchyLevel: act.hierarchyLevel,
    esfera: act.esfera ?? 'federal',
  };

  // Campos opcionais — só inclui se o JSON fornecer (presente AND não-undefined)
  if (isProvided(act, 'summary')) {
    data.summary = act.summary ? normalizeScrapedText(act.summary) : null;
  }
  if (isProvided(act, 'effectiveDate')) {
    data.effectiveDate = act.effectiveDate ? new Date(act.effectiveDate) : null;
  }
  if (isProvided(act, 'leiArticles')) data.leiArticles = jsonOrNull(act.leiArticles);
  if (isProvided(act, 'themes')) data.themes = jsonOrNull(act.themes);
  if (isProvided(act, 'officialUrl')) data.officialUrl = act.officialUrl ?? null;
  if (isProvided(act, 'pdfUrl')) data.pdfUrl = act.pdfUrl ?? null;
  if (isProvided(act, 'content')) {
    data.content = act.content ? normalizeScrapedText(act.content) : null;
  }

  return data;
}

/**
 * Monta o `data` do CREATE incluindo todos os campos. Campos opcionais ausentes
 * ficam null — comportamento esperado pra ato novo.
 */
function buildCreateData(act: ActInput): Record<string, unknown> {
  return {
    fullNumber: act.fullNumber,
    type: act.type,
    number: act.number,
    year: act.year,
    title: act.title,
    ementa: normalizeScrapedText(act.ementa),
    summary: act.summary ? normalizeScrapedText(act.summary) : null,
    issuer: normalizeIssuer(act.issuer),
    publishDate: new Date(act.publishDate),
    effectiveDate: act.effectiveDate ? new Date(act.effectiveDate) : null,
    hierarchyLevel: act.hierarchyLevel,
    leiArticles: jsonOrNull(act.leiArticles),
    themes: jsonOrNull(act.themes),
    officialUrl: act.officialUrl ?? null,
    pdfUrl: act.pdfUrl ?? null,
    content: act.content ? normalizeScrapedText(act.content) : null,
    esfera: act.esfera ?? 'federal',
    embeddingStatus: 'pending',
    createdBy: 'batch-import',
  };
}

interface FieldDiff {
  field: string;
  before: string;
  after: string;
  isClearing: boolean;
}

/**
 * Compara o registro existente com o `data` que seria escrito no UPDATE,
 * retornando um array de mudanças. Detecta clearings (valor → null) pra
 * gatilho de proteção.
 */
function diffUpdate(
  existing: Record<string, unknown>,
  data: Record<string, unknown>
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const key of Object.keys(data)) {
    const before = existing[key];
    const after = data[key];

    // Normaliza Date pra string ISO pra comparação justa
    const beforeNorm = before instanceof Date ? before.toISOString() : before;
    const afterNorm = after instanceof Date ? after.toISOString() : after;

    if (beforeNorm === afterNorm) continue;
    // Date+Date que coincidem em valor mas referência diferente
    if (
      before instanceof Date && after instanceof Date &&
      before.getTime() === after.getTime()
    ) continue;

    const fmt = (v: unknown): string => {
      if (v === null || v === undefined) return 'null';
      if (typeof v === 'string') {
        return v.length > 60 ? `"${v.slice(0, 57)}..." (${v.length} chars)` : `"${v}"`;
      }
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v);
    };

    diffs.push({
      field: key,
      before: fmt(before),
      after: fmt(after),
      isClearing: (before !== null && before !== undefined && before !== '') && (after === null || after === ''),
    });
  }
  return diffs;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const fullPath = resolve(process.cwd(), jsonPath!);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Batch Import de Atos Legislativos`);
  console.log(`  Arquivo: ${fullPath}`);
  console.log(`  ${DRY_RUN ? '🔍 MODO DRY-RUN' : '✅ MODO EXECUÇÃO'}`);
  if (ALLOW_CLEARING) console.log(`  ⚠️  --allow-clearing ATIVO (vai aceitar zerar campos)`);
  if (ALLOW_INVALID_CONTENT) console.log(`  ⚠️  --allow-invalid-content ATIVO (vai aceitar conteúdo com erros de validação)`);
  console.log(`${'='.repeat(60)}\n`);

  const raw = readFileSync(fullPath, 'utf-8');
  const parsed: BatchInput = JSON.parse(raw);

  if (!Array.isArray(parsed.legislativeActs)) {
    console.error('JSON inválido: campo "legislativeActs" não é array');
    process.exit(1);
  }

  const acts = parsed.legislativeActs;
  console.log(`Atos no JSON: ${acts.length}\n`);

  const stats = { criados: 0, atualizados: 0, inalterados: 0, bloqueados: 0, invalidos: 0, erros: 0 };
  const blockedActs: { fullNumber: string; clearings: FieldDiff[] }[] = [];

  for (const act of acts) {
    try {
      // Validação prévia: se o JSON traz content/officialUrl, checar se passa
      // pelos sanity checks (URL não-FAQ, conteúdo não-FAQ, sem ruído residual,
      // tamanho mínimo). Bloqueia errors a menos que --allow-invalid-content.
      if (act.content || act.officialUrl) {
        const validation = validateActContent({
          url: act.officialUrl,
          content: act.content ? normalizeScrapedText(act.content) : '',
        });
        if (validation.errors.length > 0 && !ALLOW_INVALID_CONTENT) {
          stats.invalidos++;
          console.log(`🛑 INVÁLIDO: ${act.fullNumber}`);
          for (const e of validation.errors) console.log(`   ❌ ${e}`);
          for (const w of validation.warnings) console.log(`   ⚠️  ${w}`);
          continue;
        }
        if (validation.warnings.length > 0) {
          console.log(`⚠️  Avisos em ${act.fullNumber}:`);
          for (const w of validation.warnings) console.log(`     ${w}`);
        }
      }

      const existing = await prisma.legislativeAct.findUnique({
        where: { fullNumber: act.fullNumber },
      });

      if (existing) {
        const updateData = buildUpdateData(act);
        const diffs = diffUpdate(existing as unknown as Record<string, unknown>, updateData);

        if (diffs.length === 0) {
          stats.inalterados++;
          continue;
        }

        const clearings = diffs.filter((d) => d.isClearing);
        if (clearings.length > 0 && !ALLOW_CLEARING) {
          stats.bloqueados++;
          blockedActs.push({ fullNumber: act.fullNumber, clearings });
          console.log(`🛑 BLOQUEADO: ${act.fullNumber}`);
          for (const c of clearings) {
            console.log(`   ${c.field}: ${c.before} → ${c.after}  ⚠️ ZERAR campo`);
          }
          continue;
        }

        console.log(`🔄 Atualiza: ${act.fullNumber}`);
        for (const d of diffs) {
          const flag = d.isClearing ? ' ⚠️ ZERAR' : '';
          console.log(`   ${d.field}: ${d.before} → ${d.after}${flag}`);
        }

        if (!DRY_RUN) {
          await prisma.legislativeAct.update({
            where: { id: existing.id },
            data: updateData,
          });
        }
        stats.atualizados++;
      } else {
        const createData = buildCreateData(act);
        console.log(`✅ Cria: ${act.fullNumber}`);
        // Mostra os principais campos do create
        const showFields = ['title', 'themes', 'leiArticles', 'officialUrl'];
        for (const f of showFields) {
          if (createData[f] != null) {
            const v = createData[f];
            const display = typeof v === 'string' && v.length > 60 ? `"${v.slice(0, 57)}..."` : JSON.stringify(v);
            console.log(`   ${f}: ${display}`);
          }
        }

        if (!DRY_RUN) {
          await prisma.legislativeAct.create({ data: createData as never });
        }
        stats.criados++;
      }

      // Detector de relações roda só em created/updated reais. Usa heurística +
      // IA opt-in (env DETECT_AMENDMENTS_AI=true).
      if (!DRY_RUN) {
        const sourceAct = await prisma.legislativeAct.findUnique({
          where: { fullNumber: act.fullNumber },
          select: { id: true, ementa: true, content: true },
        });
        if (sourceAct) {
          const r = await detectAndSaveRelationsHybrid(sourceAct.id, sourceAct.ementa, sourceAct.content || '');
          if (r.heuristicCount > 0 || r.aiAdded > 0) {
            const skipDesc = r.skippedTargets.length > 0
              ? ` (targets ausentes: ${r.skippedTargets.slice(0, 3).join(', ')}${r.skippedTargets.length > 3 ? '...' : ''})`
              : '';
            const aiDesc = r.aiAdded > 0 ? ` [+${r.aiAdded} IA]` : '';
            console.log(`   🔗 Relações: ${r.created} criadas, ${r.skipped} puladas${aiDesc}${skipDesc}`);
          }
        }
      }
    } catch (err) {
      stats.erros++;
      console.error(`❌ Erro em ${act.fullNumber}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTADO ${DRY_RUN ? '(simulado)' : ''}:`);
  console.log(`  ✅ Criados:        ${stats.criados}`);
  console.log(`  🔄 Atualizados:    ${stats.atualizados}`);
  console.log(`  ⏸️  Inalterados:    ${stats.inalterados}`);
  console.log(`  🛑 Bloqueados:     ${stats.bloqueados}  (clearing detectado — use --allow-clearing pra forçar)`);
  console.log(`  🚫 Inválidos:      ${stats.invalidos}  (validação de conteúdo falhou — use --allow-invalid-content pra forçar)`);
  console.log(`  ❌ Erros:          ${stats.erros}`);
  console.log(`${'='.repeat(60)}\n`);

  if (stats.bloqueados > 0) {
    console.log(`⚠️  ${stats.bloqueados} ato(s) bloqueado(s) por tentativa de zerar campos populados.`);
    console.log(`   Decida caso a caso:`);
    console.log(`   - Se o JSON deve PRESERVAR os campos: remova as chaves do JSON ou ignore (não rode --allow-clearing)`);
    console.log(`   - Se o JSON deve REALMENTE zerar: rode novamente com --allow-clearing`);
    console.log(``);
  }

  if (!DRY_RUN && stats.criados > 0) {
    console.log('💡 Próximo passo: gerar embeddings dos novos atos:');
    console.log('   npx dotenv -e .env.local -- npx tsx scripts/index-legislative-acts.ts');
  }

  // Exit code: 1 se houve bloqueios e não foi dry-run (sinaliza ação manual necessária)
  if (!DRY_RUN && stats.bloqueados > 0) {
    process.exit(2);
  }
}

main()
  .catch((err) => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
