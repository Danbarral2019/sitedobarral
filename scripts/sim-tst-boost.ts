/**
 * Simulação A/B do boost de similarity TST em queries strong-labor.
 *
 * Roda hybridSearch DUAS vezes para cada query (sem boost vs com boost 1.20)
 * e compara: quantos documentos TST entram no top-10 e em que posição. Também
 * loga a decisão da heurística strong-labor (institutional/tier-2/matchCount).
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/sim-tst-boost.ts
 */

import { hybridSearch } from '@/lib/embeddings/hybrid-search';
import type { SearchResult } from '@/lib/embeddings/vector-search';

// ── Réplicas das listas em app/api/documents/query/route.ts ──────────────────
// (Inline aqui para evitar refatoração; se a heurística for promovida para
// lib/, este script importa direto.)

const tribunalPatterns: RegExp[] = [
  /\btce\b/i,
  /\btribuna(?:l|is)\s+de\s+contas\s+estadua(?:l|is)\b/i,
  /\btce-(?:sp|mg|pr|sc|rj|rs|pe)\b/i,
  /\btribunal\s+estadual\b/i,
  /\bdecis(?:ão|ões)\s+estadua(?:l|is)\b/i,
  /\bjurisprud[êe]ncia\s+estadual\b/i,
  /\bcorte\s+de\s+contas\s+estadual\b/i,
  /\btst\b/i,
  /\btribunal\s+superior\s+do\s+trabalho\b/i,
  /\bjustiça\s+do\s+trabalho\b/i,
  /\bjurisprud[êe]ncia\s+trabalhista\b/i,
  /\bclt\b/i,
  /\bconsolida[çc][ãa]o\s+das\s+leis\s+do\s+trabalho\b/i,
  /\breforma\s+trabalhista\b/i,
  /\blei\s+13\.?467(?:\/2017)?\b/i,
  /\bterceiriz/i,
  /\btomador\b/i,
  /\bempresa\s+interposta\b/i,
  /\bv[íi]nculo(?:\s+(?:de\s+emprego|empregat[íi]cio))?\b/i,
  /\bsubsidi[áa]ri/i,
  /\bsolidari[ea]/i,
  /\baviso[\s-]+pr[ée]vio\b/i,
  /\bequipara[çc][ãa]o\s+salarial\b/i,
  /\bpericulosidade\b/i,
  /\binsalubridade\b/i,
  /\badicional\s+(?:de\s+)?(?:periculosidade|insalubridade|noturno)\b/i,
  /\bhoras?\s+extras?\b/i,
  /\bintervalo\s+intrajornada\b/i,
  /\bjornada\s+de\s+trabalho\b/i,
  /\brepactua[çc][ãa]o\b/i,
  /\bplanilha\s+de\s+custos\b/i,
  /\bverbas?\s+trabalhista/i,
  /\bf[ée]rias\s+(?:proporcionais|vencidas|indenizadas)\b/i,
  /\bestabilidade\s+(?:provis[óo]ria|de\s+emprego|gestante|cipeiro|acidentado)\b/i,
  /\b13[ºo]?\s+sal[áa]rio\b/i,
  /\bgratifica[çc][ãa]o\s+natalina\b/i,
  /\bfgts\b/i,
  /\bempregad(?:o|or|a|ora)\b/i,
  /\bempregat[íi]cio\b/i,
  /\bcontrato\s+de\s+trabalho\b/i,
  /\brela[çc][ãa]o\s+de\s+emprego\b/i,
  /\bcarteira\s+(?:de\s+trabalho|profissional|assinada)\b/i,
  /\bctps\b/i,
  /\bdesconto(?:s)?\s+(?:no|do|em)\s+sal[áa]rio\b/i,
  /\bdano(?:s)?\s+causad[oa]s?\s+(?:pelo\s+)?empregad/i,
  /\bsal[áa]ri[oa](?:l|s)?\b(?=.*(?:trabalh|empregad|patron|sindical|categoria|m[íi]nimo|piso))/i,
  /\bremunera[çc][ãa]o\s+(?:do\s+empregado|do\s+trabalhador)\b/i,
  /\bpiso\s+salarial\b/i,
  /\bsal[áa]rio\s+m[íi]nimo\b/i,
  /\bsal[áa]rio[\s-]+(?:fam[íi]lia|maternidade)\b/i,
  /\brescis[ãa]o(?:\s+(?:contratual|indireta|do\s+contrato))?\b/i,
  /\bjusta\s+causa\b/i,
  /\bdemiss[ãa]o\b/i,
  /\bdispensa\s+(?:imotivada|sem\s+justa\s+causa|por\s+justa\s+causa|discrimin)/i,
  /\bjusti[çc]a\s+do\s+trabalho\b/i,
  /\breclama[çc][ãa]o\s+trabalhista\b/i,
  /\binqu[ée]rito\s+judicial\b/i,
  /\bacidente\s+(?:de\s+|do\s+)?trabalho\b/i,
  /\bdoen[çc]a\s+(?:ocupacional|profissional|do\s+trabalho)\b/i,
  /\baux[íi]lio[\s-]+doen[çc]a\b/i,
  /\baposentadoria\s+por\s+invalidez\b/i,
  /\bvale[\s-]?(?:transporte|refei[çc][ãa]o|alimenta[çc][ãa]o)\b/i,
  /\bsobreaviso\b/i,
  /\bbanco\s+de\s+horas\b/i,
  /\bcompensa[çc][ãa]o\s+de\s+jornada\b/i,
  /\bperiodo\s+noturno\b/i,
  /\bsindicato\b/i,
  /\bsindical\b/i,
  /\bcategoria\s+profissional\b/i,
  /\bbanc[áa]ri[ao]s?\b/i,
  /\bferrovi[áa]ri[ao]s?\b/i,
  /\bmotorista(?:s)?\s+(?:profissional|de\s+caminh|de\s+carga)/i,
  /\borienta[çc](?:[ãa]o|[õo]es)\s+jurisprudencia(?:l|is)\b/i,
  /\boj[-\s]?sbdi[-\s]?[i12]+t?\b/i,
  /\boj[-\s]?sdc\b/i,
  /\bsbdi[-\s]?[i12]+\b/i,
  /\bsubse[çc][ãa]o\b/i,
  /\btribunal\s+pleno\b/i,
  /\b[óo]rg[ãa]o\s+especial\b/i,
  /\bprecedente(?:s)?\s+normativo(?:s)?\b/i,
  /\bdiss[íi]dio(?:s)?\s+coletivo(?:s)?\b/i,
  /\bnegocia[çc][ãa]o\s+coletiva\b/i,
  /\bcl[áa]usula\s+normativa\b/i,
  /\bconven[çc][ãa]o\s+coletiva\b/i,
  /\bacordo\s+coletivo\b/i,
];

const strongInstitutionalLaborPatterns: RegExp[] = [
  /\btst\b/i,
  /\btribunal\s+superior\s+do\s+trabalho\b/i,
  /\bjustiça\s+do\s+trabalho\b/i,
  /\bclt\b/i,
  /\bconsolida[çc][ãa]o\s+das\s+leis\s+do\s+trabalho\b/i,
  /\breforma\s+trabalhista\b/i,
  /\bjurisprud[êe]ncia\s+trabalhista\b/i,
  /\breclama[çc][ãa]o\s+trabalhista\b/i,
];

const tier2StrongLaborPatterns: RegExp[] = [
  /\brescis[ãa]o\s+indireta\b/i,
  /\bjusta\s+causa\b/i,
  /\bdispensa\s+(?:imotivada|sem\s+justa\s+causa|por\s+justa\s+causa|discrimin)/i,
  /\baviso[\s-]+pr[ée]vio\b/i,
  /\bfgts\b/i,
  /\b13[ºo]?\s+sal[áa]rio\b/i,
  /\bgratifica[çc][ãa]o\s+natalina\b/i,
  /\bintervalo\s+intrajornada\b/i,
  /\bjornada\s+de\s+trabalho\b/i,
  /\bhoras?\s+extras?\b/i,
  /\badicional\s+(?:de\s+)?(?:periculosidade|insalubridade|noturno)\b/i,
  /\bpericulosidade\b/i,
  /\binsalubridade\b/i,
  /\bequipara[çc][ãa]o\s+salarial\b/i,
  /\bv[íi]nculo\s+(?:de\s+emprego|empregat[íi]cio)\b/i,
  /\bcarteira\s+(?:de\s+trabalho|profissional|assinada)\b/i,
  /\bctps\b/i,
  /\bdiss[íi]dio(?:s)?\s+coletivo(?:s)?\b/i,
  /\bnorma\s+coletiva\b/i,
  /\bconven[çc][ãa]o\s+coletiva\b/i,
  /\bacordo\s+coletivo\b/i,
  /\bnegocia[çc][ãa]o\s+coletiva\b/i,
  /\bcl[áa]usula\s+normativa\b/i,
  /\bprecedente(?:s)?\s+normativo(?:s)?\b/i,
  /\borienta[çc](?:[ãa]o|[õo]es)\s+jurisprudencia(?:l|is)\b/i,
  /\bestabilidade\s+(?:provis[óo]ria|gestante|cipeiro|acidentado)\b/i,
  /\bf[ée]rias\s+(?:proporcionais|vencidas|indenizadas)\b/i,
  /\bverbas?\s+trabalhista/i,
  /\bacidente\s+(?:de\s+|do\s+)?trabalho\b/i,
  /\bdoen[çc]a\s+(?:ocupacional|profissional|do\s+trabalho)\b/i,
  /\bsobreaviso\b/i,
  /\bbanco\s+de\s+horas\b/i,
  /\bempresa\s+interposta\b/i,
];

function detectStrongLabor(query: string) {
  const matchCount = tribunalPatterns.reduce((n, re) => (re.test(query) ? n + 1 : n), 0);
  const institutional = strongInstitutionalLaborPatterns.some((re) => re.test(query));
  const tier2 = tier2StrongLaborPatterns.some((re) => re.test(query));
  const includeTribunal = matchCount > 0;
  const isStrong = institutional || tier2 || matchCount >= 2;
  return { matchCount, institutional, tier2, includeTribunal, isStrong };
}

// ── Conjunto de queries ──────────────────────────────────────────────────────
// 9 trabalhistas (mix institucional, tier-2, mista) + 4 controle Lei 14.133.

interface QueryCase {
  id: string;
  text: string;
  bucket: 'institutional' | 'tier2' | 'multi' | 'borderline' | 'control-licit';
  notes?: string;
}

const queries: QueryCase[] = [
  // Trabalhistas — institucionais explícitos
  { id: 'L1', text: 'O TST permite terceirização da atividade-fim?', bucket: 'institutional' },
  { id: 'L2', text: 'Qual a posição da Justiça do Trabalho sobre fiscalização de contrato de prestação de serviços?', bucket: 'institutional' },
  // Trabalhistas — tier-2 isolados
  { id: 'L3', text: 'Em que casos cabe rescisão indireta do contrato de trabalho?', bucket: 'tier2', notes: 'Q3 caso real falho' },
  { id: 'L4', text: 'O empregador pode dispensar por justa causa por embriaguez habitual?', bucket: 'tier2' },
  { id: 'L5', text: 'Qual a base de cálculo do adicional de periculosidade?', bucket: 'tier2' },
  { id: 'L6', text: 'Intervalo intrajornada não concedido gera horas extras?', bucket: 'tier2' },
  // Trabalhistas — combo temático (multi-match)
  { id: 'L7', text: 'Responsabilidade subsidiária do tomador de serviço em caso de inadimplência do empregador', bucket: 'multi', notes: 'Q9-like' },
  { id: 'L8', text: 'O empregador pode descontar do salário danos causados pelo empregado?', bucket: 'multi', notes: 'Caso real Rodada 2' },
  { id: 'L9', text: 'Rescisão indireta por descumprimento de norma coletiva do sindicato', bucket: 'multi', notes: 'Q3 real do user' },
  // Controle Lei 14.133 — não deve ativar boost
  { id: 'C1', text: 'Quais os requisitos para contratação direta por dispensa de licitação no art. 75 da Lei 14.133?', bucket: 'control-licit' },
  { id: 'C2', text: 'Como funciona o diálogo competitivo na Nova Lei de Licitações?', bucket: 'control-licit' },
  { id: 'C3', text: 'Quando cabe rescisão contratual unilateral pela Administração no art. 137 da Lei 14.133?', bucket: 'control-licit', notes: 'rescisão SEM "indireta" — não deve ativar' },
  { id: 'C4', text: 'Responsabilidade subsidiária da Administração contratante em contratos de prestação de serviços', bucket: 'control-licit', notes: 'subsidiária+contratante isolados' },
];

// ── Helpers de análise ───────────────────────────────────────────────────────

function isTstDoc(r: SearchResult): boolean {
  // TribunalDecision canônica do TST tem fullIdentifier começando com "TST "
  // e sourceType='tribunal-decision'. Acordãos de TCE/STJ não casam.
  return r.sourceType === 'tribunal-decision' && /^TST\s/i.test(r.documentTitle);
}

interface TstStats {
  count: number;       // # de TST docs em top-10
  topPos: number | null; // posição (1-based) do primeiro TST, ou null
  titles: string[];
}

function tstStats(results: SearchResult[]): TstStats {
  const titles: string[] = [];
  let topPos: number | null = null;
  for (let i = 0; i < results.length; i++) {
    if (isTstDoc(results[i])) {
      if (topPos === null) topPos = i + 1;
      titles.push(results[i].documentTitle);
    }
  }
  return { count: titles.length, topPos, titles };
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function runOne(q: QueryCase) {
  const det = detectStrongLabor(q.text);
  const opts = {
    query: q.text,
    limit: 10,
    alpha: 0.6,
    useCache: false,
    includeTribunalDecisions: det.includeTribunal,
    excludeInactiveSumulas: true,
    rerank: false,
  } as const;

  const baseline = await hybridSearch(opts);
  const boosted = det.isStrong
    ? await hybridSearch({ ...opts, tribunalBoost: { code: 'TST', factor: 1.2 } })
    : baseline; // sem strong-labor, baseline=boosted (no-op)

  const sBase = tstStats(baseline.results);
  const sBoost = tstStats(boosted.results);

  return { q, det, sBase, sBoost };
}

async function main() {
  const wantStrongIds = new Set(queries.filter((q) => q.bucket !== 'control-licit').map((q) => q.id));
  const results: Awaited<ReturnType<typeof runOne>>[] = [];

  for (const q of queries) {
    process.stdout.write(`[${q.id}] ${q.text.slice(0, 60)}${q.text.length > 60 ? '…' : ''}\n`);
    try {
      const r = await runOne(q);
      results.push(r);
      const tag = r.det.isStrong ? 'STRONG' : 'weak ';
      const inst = r.det.institutional ? 'I' : '-';
      const t2 = r.det.tier2 ? 'T' : '-';
      const mc = String(r.det.matchCount).padStart(2, ' ');
      const baseStr = `count=${r.sBase.count} topPos=${r.sBase.topPos ?? '—'}`;
      const boostStr = `count=${r.sBoost.count} topPos=${r.sBoost.topPos ?? '—'}`;
      const delta = r.det.isStrong
        ? `Δcount=${r.sBoost.count - r.sBase.count}, Δpos=${r.sBase.topPos && r.sBoost.topPos ? r.sBase.topPos - r.sBoost.topPos : 'n/a'}`
        : 'sem boost';
      console.log(`  heur: ${tag} [${inst}${t2} mc=${mc}]  base: ${baseStr}  boost: ${boostStr}  ${delta}`);
    } catch (e) {
      console.log(`  ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Resumo ──────────────────────────────────────────────────────────────
  console.log('\n=== RESUMO ===');

  let falsePositives = 0; // controle marcou strong indevidamente
  let trueNegatives = 0;  // controle ficou weak (correto)
  let truePositives = 0;  // trabalhista marcou strong (correto)
  let falseNegatives = 0; // trabalhista ficou weak (perde boost)
  let positionsImproved = 0;
  let countsImproved = 0;
  let tstAbsentBoth = 0;

  for (const r of results) {
    const isControl = r.q.bucket === 'control-licit';
    if (isControl) {
      if (r.det.isStrong) falsePositives++;
      else trueNegatives++;
    } else {
      if (r.det.isStrong) truePositives++;
      else falseNegatives++;
    }
    // efeito do boost
    if (r.det.isStrong) {
      const baseTop = r.sBase.topPos ?? Infinity;
      const boostTop = r.sBoost.topPos ?? Infinity;
      if (boostTop < baseTop) positionsImproved++;
      if (r.sBoost.count > r.sBase.count) countsImproved++;
      if (r.sBase.count === 0 && r.sBoost.count === 0) tstAbsentBoth++;
    }
  }

  console.log(`Heurística: TP=${truePositives}/${truePositives + falseNegatives} (trabalhistas)  TN=${trueNegatives}/${trueNegatives + falsePositives} (controle)  FP=${falsePositives}  FN=${falseNegatives}`);
  console.log(`Efeito do boost (entre as ${truePositives} strong): pos-melhorou=${positionsImproved}  count-aumentou=${countsImproved}  TST-ausente-em-ambos=${tstAbsentBoth}`);
  console.log(`Esperado strong: ${wantStrongIds.size}  Marcadas strong: ${truePositives}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
