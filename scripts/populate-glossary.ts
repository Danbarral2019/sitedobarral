/**
 * Popular Glossário de Licitações e Contratos
 *
 * Fase 1: Extrai ~50 definições do Art. 6 da Lei 14.133/2021 e reescreve via Gemini
 * Fase 2: Gera ~70 termos adicionais via Gemini
 * Pós: Resolve relatedTerms (nome → ID)
 *
 * Uso:
 *   cd sitedobarral
 *   npx tsx scripts/populate-glossary.ts --dry-run         # Simular
 *   npx tsx scripts/populate-glossary.ts --limit 5         # Testar poucos
 *   npx tsx scripts/populate-glossary.ts --phase1-only     # Apenas Art. 6
 *   npx tsx scripts/populate-glossary.ts --phase2-only     # Apenas geração IA
 *   npx tsx scripts/populate-glossary.ts --force            # Atualizar existentes
 *   npx tsx scripts/populate-glossary.ts                    # Executar tudo
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

const prisma = new PrismaClient();

// --- CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const PHASE1_ONLY = args.includes('--phase1-only');
const PHASE2_ONLY = args.includes('--phase2-only');

function getArgValue(flag: string, defaultValue: number): number {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    const val = parseInt(args[idx + 1], 10);
    return isNaN(val) ? defaultValue : val;
  }
  return defaultValue;
}

const LIMIT = getArgValue('--limit', 0);
const DELAY_MS = 1500;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

// --- Gemini API ---
async function callGemini(prompt: string, maxTokens = 4096): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada. Verifique .env.local');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();

  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text.trim();
  }

  throw new Error('Resposta do Gemini sem texto');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Slugify ---
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

// --- Parse Art. 6 incisos ---
interface RawInciso {
  inciso: string;
  term: string;
  definition: string;
}

function parseArt6(): RawInciso[] {
  const art6 = LEI_14133_ARTIGOS['6'];
  if (!art6) {
    throw new Error('Artigo 6 não encontrado em LEI_14133_ARTIGOS');
  }

  const text = art6.ementa;
  const results: RawInciso[] = [];

  // The text has mixed formatting: some incisos separated by \n\n, others by space/semicolon
  // Pattern: Roman numeral followed by dash and term with colon
  // Match at: start of string, after newline, or after "; " / ". " (inline)
  const romanPattern = /(?:^|[\n;.]\s*)(X{0,4}(?:IX|IV|V?I{0,3}))\s*[-–—]\s*/g;

  const parts: { inciso: string; startIdx: number; matchStart: number }[] = [];
  let match;
  while ((match = romanPattern.exec(text)) !== null) {
    const inciso = match[1];
    const val = romanToInt(inciso);
    // Validate: real Roman numeral I-XXV, and sequential (or close)
    if (val > 0 && val <= 60) {
      // Check it's followed by a term with colon (within 150 chars)
      const afterMatch = text.slice(match.index + match[0].length, match.index + match[0].length + 200);
      const hasColon = afterMatch.indexOf(':');
      if (hasColon > 0 && hasColon < 150) {
        parts.push({
          inciso,
          startIdx: match.index + match[0].length,
          matchStart: match.index,
        });
      }
    }
  }

  // Deduplicate: keep only the first occurrence of each roman numeral value
  const seen = new Set<number>();
  const uniqueParts = parts.filter(p => {
    const val = romanToInt(p.inciso);
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });

  for (let i = 0; i < uniqueParts.length; i++) {
    const { inciso, startIdx } = uniqueParts[i];
    const endIdx = i + 1 < uniqueParts.length ? uniqueParts[i + 1].matchStart : text.length;
    const rawText = text.slice(startIdx, endIdx).trim();

    // Extract term and definition: "termo: definição"
    const colonIdx = rawText.indexOf(':');
    if (colonIdx === -1 || colonIdx > 200) continue;

    const term = rawText.slice(0, colonIdx).trim();
    let definition = rawText.slice(colonIdx + 1).trim();

    // Clean trailing semicolon/period that separates from next inciso
    definition = definition.replace(/[;.]\s*$/, '.').trim();

    if (term.length > 0 && definition.length > 10) {
      results.push({
        inciso,
        term: capitalizeFirst(term),
        definition: definition.replace(/\n\n/g, ' ').replace(/\s+/g, ' ').trim(),
      });
    }
  }

  return results;
}

function romanToInt(s: string): number {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const curr = map[s[i]] || 0;
    const next = map[s[i + 1]] || 0;
    result += curr < next ? -curr : curr;
  }
  return result;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  // Capitalize first letter of each word for multi-word terms
  return s
    .split(' ')
    .map(w => {
      // Keep short prepositions/articles lowercase unless first word
      const lower = w.toLowerCase();
      if (['de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'em', 'por', 'com', 'para', 'não'].includes(lower)) {
        return lower;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

// --- FASE 1: Art. 6 + Reescrita Gemini ---
interface GlossaryEntry {
  term: string;
  slug: string;
  definition: string;
  shortDef: string;
  category: string;
  leiArticles: string;
  relatedTerms?: string[];
}

async function phase1RewriteBatch(incisos: RawInciso[]): Promise<GlossaryEntry[]> {
  const incisosList = incisos
    .map(i => `- Inciso ${i.inciso}: "${i.term}" — ${i.definition}`)
    .join('\n');

  const prompt = `Você é um professor de Direito Administrativo especializado em licitações e contratos.

Reescreva as definições abaixo do Art. 6º da Lei 14.133/2021 em linguagem didática e acessível para alunos.

Para cada termo, retorne um JSON array com objetos contendo:
- "inciso": o número romano original (ex: "I", "II")
- "term": o nome do termo (capitalizado corretamente, ex: "Órgão", "Pregão Eletrônico")
- "definition": explicação didática com 3-5 frases. Comece com uma explicação simples e prática. Inclua um exemplo concreto quando possível. Termine com: "Definição legal (Art. 6º, inciso [X], Lei 14.133/2021): [texto original resumido]."
- "shortDef": resumo em 1 frase de no máximo 150 caracteres
- "category": uma dentre: "Conceitos Gerais", "Agentes e Partes", "Modalidades", "Planejamento", "Tipos de Contratação", "Documentos", "Controle e Fiscalização", "Licitação", "Contrato"

Definições do Art. 6º:
${incisosList}

Retorne APENAS o JSON array, sem markdown ou texto adicional.`;

  const raw = await callGemini(prompt, 8192);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Resposta não é array');

    return parsed.map((item: any) => ({
      term: item.term || '',
      slug: slugify(item.term || ''),
      definition: item.definition || '',
      shortDef: (item.shortDef || '').slice(0, 250),
      category: item.category || 'Conceitos Gerais',
      leiArticles: JSON.stringify(['6']),
    }));
  } catch (err) {
    console.error('  Erro ao parsear JSON do Gemini (fase 1):', (err as Error).message);
    console.error('  Resposta raw (primeiros 500 chars):', raw.slice(0, 500));
    return [];
  }
}

async function runPhase1(): Promise<GlossaryEntry[]> {
  console.log('\n=== FASE 1: Extração do Art. 6º da Lei 14.133/2021 ===\n');

  const incisos = parseArt6();
  console.log(`Incisos extraídos: ${incisos.length}`);

  if (incisos.length === 0) {
    console.log('Nenhum inciso encontrado. Verifique o formato do Art. 6.');
    return [];
  }

  // Show first few
  incisos.slice(0, 5).forEach(i => {
    console.log(`  ${i.inciso} - ${i.term}: ${i.definition.slice(0, 80)}...`);
  });
  console.log('  ...\n');

  const limited = LIMIT > 0 ? incisos.slice(0, LIMIT) : incisos;

  // Process in batches of 10
  const BATCH_SIZE = 10;
  const allEntries: GlossaryEntry[] = [];

  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(limited.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches}: reescrevendo ${batch.length} termos via Gemini...`);

    try {
      const entries = await phase1RewriteBatch(batch);
      allEntries.push(...entries);
      console.log(`  ✓ ${entries.length} termos reescritos`);
    } catch (err) {
      console.error(`  ✗ Erro no batch ${batchNum}:`, (err as Error).message);
      // Fallback: use raw definitions
      for (const inciso of batch) {
        allEntries.push({
          term: inciso.term,
          slug: slugify(inciso.term),
          definition: `${inciso.definition}\n\nDefinição legal (Art. 6º, inciso ${inciso.inciso}, Lei 14.133/2021).`,
          shortDef: inciso.definition.slice(0, 150),
          category: 'Conceitos Gerais',
          leiArticles: JSON.stringify(['6']),
        });
      }
      console.log(`  → Fallback: ${batch.length} termos com definição original`);
    }

    if (i + BATCH_SIZE < limited.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nFase 1 total: ${allEntries.length} termos preparados`);
  return allEntries;
}

// --- FASE 2: Geração de termos adicionais ---
async function phase2GenerateBatch(
  existingTerms: string[],
  batchNum: number,
  totalBatches: number,
  count: number,
): Promise<GlossaryEntry[]> {
  const prompt = `Você é um professor de Direito Administrativo especializado em licitações e contratos administrativos.

Gere ${count} termos essenciais para um glossário de licitações e contratos administrativos que NÃO estejam nesta lista de termos já existentes:
${existingTerms.map(t => `- ${t}`).join('\n')}

Para cada termo, retorne um JSON array com objetos contendo:
- "term": nome do termo (capitalizado, ex: "Ata de Registro de Preços")
- "definition": explicação didática com 3-5 frases em linguagem acessível. Use exemplos práticos. Cite artigos da Lei 14.133/2021 quando relevante.
- "shortDef": resumo em 1 frase de no máximo 150 caracteres
- "category": uma dentre: "Conceitos Gerais", "Agentes e Partes", "Modalidades", "Planejamento", "Tipos de Contratação", "Documentos", "Controle e Fiscalização", "Sanções", "Licitação", "Contrato"
- "leiArticles": array de strings com números dos artigos da Lei 14.133 mais relevantes (ex: ["82", "83", "84"])
- "relatedTerms": array de nomes de termos relacionados (podem ser da lista existente ou novos desta geração)

Este é o batch ${batchNum} de ${totalBatches}. ${batchNum === 1 ? 'Cubra temas como: ata de registro de preços, sistema de registro de preços, pregão eletrônico, concorrência eletrônica, diálogo competitivo, inexigibilidade, dispensa de licitação, credenciamento, contrato administrativo, contrato de eficiência, termo aditivo, apostilamento, reequilíbrio econômico-financeiro, repactuação, reajuste, penalidades administrativas, cadastro de fornecedores, portal nacional de contratações públicas (PNCP), plano de contratações anual (PCA).' : batchNum === 2 ? 'Cubra temas como: estudo técnico preliminar (ETP), mapa de riscos, pesquisa de preços, projeto executivo, BDI, planilha de custos, seguro-garantia, garantia contratual, subcontratação, consórcio, habilitação, qualificação técnica, qualificação econômico-financeira, regularidade fiscal, proposta comercial, lance, fase recursal, impugnação ao edital, pedido de esclarecimento.' : 'Cubra temas como: homologação, adjudicação, revogação, anulação, desclassificação, inabilitação, fiscal de contrato, gestor de contrato, recebimento provisório, recebimento definitivo, ordem de serviço, medição, liquidação, empenho, nota de empenho, dotação orçamentária, catálogo eletrônico, padronização, compra compartilhada, tratamento diferenciado ME/EPP, margem de preferência, sigilo de orçamento.'}

Retorne APENAS o JSON array, sem markdown ou texto adicional.`;

  const raw = await callGemini(prompt, 8192);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Resposta não é array');

    return parsed.map((item: any) => ({
      term: item.term || '',
      slug: slugify(item.term || ''),
      definition: item.definition || '',
      shortDef: (item.shortDef || '').slice(0, 250),
      category: item.category || 'Conceitos Gerais',
      leiArticles: JSON.stringify(item.leiArticles || []),
      relatedTerms: item.relatedTerms || [],
    }));
  } catch (err) {
    console.error(`  Erro ao parsear JSON do Gemini (fase 2, batch ${batchNum}):`, (err as Error).message);
    console.error('  Resposta raw (primeiros 500 chars):', raw.slice(0, 500));
    return [];
  }
}

async function runPhase2(existingTerms: string[]): Promise<GlossaryEntry[]> {
  console.log('\n=== FASE 2: Geração de termos adicionais via Gemini ===\n');
  console.log(`Termos existentes (para evitar duplicatas): ${existingTerms.length}`);

  const TOTAL_BATCHES = 3;
  const TERMS_PER_BATCH = 25;
  const allEntries: GlossaryEntry[] = [];
  const allTermsSoFar = [...existingTerms];

  for (let b = 1; b <= TOTAL_BATCHES; b++) {
    const count = LIMIT > 0 ? Math.min(TERMS_PER_BATCH, LIMIT - allEntries.length) : TERMS_PER_BATCH;
    if (count <= 0) break;

    console.log(`Batch ${b}/${TOTAL_BATCHES}: gerando ${count} termos via Gemini...`);

    try {
      const entries = await phase2GenerateBatch(allTermsSoFar, b, TOTAL_BATCHES, count);
      allEntries.push(...entries);
      // Add to running list to avoid duplicates in next batch
      entries.forEach(e => allTermsSoFar.push(e.term));
      console.log(`  ✓ ${entries.length} termos gerados`);
    } catch (err) {
      console.error(`  ✗ Erro no batch ${b}:`, (err as Error).message);
    }

    if (b < TOTAL_BATCHES) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nFase 2 total: ${allEntries.length} termos gerados`);
  return allEntries;
}

// --- Upsert no banco ---
async function upsertTerms(entries: GlossaryEntry[]): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.term || !entry.slug || !entry.definition) {
      console.log(`  Pulando termo inválido: "${entry.term}"`);
      skipped++;
      continue;
    }

    const existing = await prisma.glossaryTerm.findUnique({ where: { slug: entry.slug } });

    if (existing && !FORCE) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${existing ? 'Atualizaria' : 'Criaria'}: "${entry.term}" (${entry.category})`);
      if (existing) updated++;
      else created++;
      continue;
    }

    const data = {
      term: entry.term,
      slug: entry.slug,
      definition: entry.definition,
      shortDef: entry.shortDef || null,
      category: entry.category,
      leiArticles: entry.leiArticles,
      isPublic: true,
      createdBy: 'script:populate-glossary',
    };

    if (existing) {
      await prisma.glossaryTerm.update({
        where: { slug: entry.slug },
        data,
      });
      updated++;
    } else {
      await prisma.glossaryTerm.create({ data });
      created++;
    }
  }

  return { created, updated, skipped };
}

// --- Pós-processamento: relatedTerms ---
async function resolveRelatedTerms(entries: GlossaryEntry[]): Promise<number> {
  const entriesWithRelated = entries.filter(e => e.relatedTerms && e.relatedTerms.length > 0);
  if (entriesWithRelated.length === 0) return 0;

  console.log(`\nResolvendo relatedTerms para ${entriesWithRelated.length} termos...`);

  // Build name→ID map from database
  const allTerms = await prisma.glossaryTerm.findMany({
    select: { id: true, term: true, slug: true },
  });
  const termMap = new Map<string, string>();
  for (const t of allTerms) {
    termMap.set(t.term.toLowerCase(), t.id);
    termMap.set(t.slug, t.id);
  }

  let resolvedCount = 0;
  for (const entry of entriesWithRelated) {
    if (!entry.relatedTerms) continue;

    const resolvedIds: string[] = [];
    for (const relName of entry.relatedTerms) {
      const id = termMap.get(relName.toLowerCase()) || termMap.get(slugify(relName));
      if (id) resolvedIds.push(id);
    }

    if (resolvedIds.length > 0 && !DRY_RUN) {
      await prisma.glossaryTerm.update({
        where: { slug: entry.slug },
        data: { relatedTerms: JSON.stringify(resolvedIds) },
      });
      resolvedCount++;
    } else if (resolvedIds.length > 0 && DRY_RUN) {
      console.log(`  [DRY-RUN] "${entry.term}" → ${resolvedIds.length} termos relacionados`);
      resolvedCount++;
    }
  }

  return resolvedCount;
}

// --- Main ---
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  Popular Glossário de Licitações e Contratos     ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log();
  console.log(`Configuração:`);
  console.log(`  DRY_RUN: ${DRY_RUN}`);
  console.log(`  FORCE: ${FORCE}`);
  console.log(`  LIMIT: ${LIMIT || 'sem limite'}`);
  console.log(`  PHASE1_ONLY: ${PHASE1_ONLY}`);
  console.log(`  PHASE2_ONLY: ${PHASE2_ONLY}`);
  console.log(`  GEMINI_MODEL: ${GEMINI_MODEL}`);

  if (!GEMINI_API_KEY) {
    console.error('\n✗ GEMINI_API_KEY não encontrada em .env.local');
    process.exit(1);
  }

  // Check existing terms
  const existingCount = await prisma.glossaryTerm.count();
  console.log(`\nTermos existentes no banco: ${existingCount}`);

  let phase1Entries: GlossaryEntry[] = [];
  let phase2Entries: GlossaryEntry[] = [];

  // --- FASE 1 ---
  if (!PHASE2_ONLY) {
    phase1Entries = await runPhase1();

    if (phase1Entries.length > 0) {
      console.log('\nInserindo termos da Fase 1...');
      const stats1 = await upsertTerms(phase1Entries);
      console.log(`  Criados: ${stats1.created} | Atualizados: ${stats1.updated} | Pulados: ${stats1.skipped}`);
    }
  }

  // --- FASE 2 ---
  if (!PHASE1_ONLY) {
    // Fetch existing terms to avoid duplicates
    const existingTerms = await prisma.glossaryTerm.findMany({
      select: { term: true },
    });
    const existingNames = existingTerms.map(t => t.term);

    phase2Entries = await runPhase2(existingNames);

    if (phase2Entries.length > 0) {
      console.log('\nInserindo termos da Fase 2...');
      const stats2 = await upsertTerms(phase2Entries);
      console.log(`  Criados: ${stats2.created} | Atualizados: ${stats2.updated} | Pulados: ${stats2.skipped}`);
    }
  }

  // --- PÓS: relatedTerms ---
  const allEntries = [...phase1Entries, ...phase2Entries];
  const relResolved = await resolveRelatedTerms(allEntries);

  // --- Resumo final ---
  const finalCount = await prisma.glossaryTerm.count();
  const categories = await prisma.glossaryTerm.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║                   RESUMO FINAL                   ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  Total de termos no banco: ${String(finalCount).padEnd(23)}║`);
  console.log(`║  Fase 1 (Art. 6):         ${String(phase1Entries.length).padEnd(23)}║`);
  console.log(`║  Fase 2 (Gemini):         ${String(phase2Entries.length).padEnd(23)}║`);
  console.log(`║  relatedTerms resolvidos: ${String(relResolved).padEnd(23)}║`);
  if (DRY_RUN) {
    console.log('║  ⚠️  MODO DRY-RUN (nada gravado)                 ║');
  }
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  Categorias:                                     ║');
  for (const cat of categories) {
    const name = (cat.category || 'Sem categoria').padEnd(35);
    const count = String(cat._count).padStart(4);
    console.log(`║    ${name}${count} ║`);
  }
  console.log('╚═══════════════════════════════════════════════════╝');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n✗ Erro fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
