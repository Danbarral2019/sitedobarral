import { execSync } from 'node:child_process'
import { recallAtK, reciprocalRank, ndcgAtK } from './metrics'
import type {
  GoldenSet,
  GoldenQuery,
  QueryEvalResult,
  MetricSummary,
  EvalRun,
  SearchFn,
  Difficulty,
} from './types'

/**
 * Avalia uma única query anotada. Retorna null se a query não está anotada
 * (sem itens em `relevant`).
 */
async function evalQuery(q: GoldenQuery, search: SearchFn): Promise<QueryEvalResult | null> {
  if (q.annotations.relevant.length === 0) return null

  const relevant = new Set(q.annotations.relevant)
  const highlyRelevant = new Set(q.annotations.highlyRelevant)

  const { documentIds, latencyMs } = await search(q.query)

  return {
    id: q.id,
    query: q.query,
    difficulty: q.difficulty,
    predicted: documentIds,
    recallAt5: recallAtK(documentIds, relevant, 5),
    recallAt10: recallAtK(documentIds, relevant, 10),
    recallAt5Primary: highlyRelevant.size > 0 ? recallAtK(documentIds, highlyRelevant, 5) : null,
    reciprocalRank: reciprocalRank(documentIds, relevant),
    ndcgAt10: ndcgAtK(documentIds, relevant, highlyRelevant, 10),
    latencyMs,
  }
}

/**
 * Avalia o golden set inteiro contra uma função de busca.
 * Pula queries não anotadas (incluídas em queriesSkipped).
 */
export async function runEval(goldenSet: GoldenSet, search: SearchFn): Promise<EvalRun> {
  const perQuery: QueryEvalResult[] = []
  let skipped = 0

  for (const q of goldenSet.queries) {
    const result = await evalQuery(q, search)
    if (result === null) {
      skipped++
    } else {
      perQuery.push(result)
    }
  }

  return {
    runAt: new Date().toISOString(),
    gitSha: getGitSha(),
    summary: aggregate(perQuery, goldenSet.queries.length, skipped),
    perQuery,
  }
}

function aggregate(
  results: QueryEvalResult[],
  total: number,
  skipped: number
): MetricSummary {
  const annotated = results.length

  const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
  const ndcgValues = results.map((r) => r.ndcgAt10).filter((v): v is number => v !== null)
  const primaryValues = results.map((r) => r.recallAt5Primary).filter((v): v is number => v !== null)

  const byDifficulty = {
    easy: subset(results, 'easy'),
    medium: subset(results, 'medium'),
    hard: subset(results, 'hard'),
  }

  return {
    queriesTotal: total,
    queriesAnnotated: annotated,
    queriesSkipped: skipped,
    recallAt5_avg: avg(results.map((r) => r.recallAt5)),
    recallAt10_avg: avg(results.map((r) => r.recallAt10)),
    recallAt5Primary_avg: avg(primaryValues),
    primaryTargetQueries: primaryValues.length,
    mrr: avg(results.map((r) => r.reciprocalRank)),
    ndcgAt10_avg: avg(ndcgValues),
    byDifficulty,
  }
}

function subset(results: QueryEvalResult[], d: Difficulty) {
  const filtered = results.filter((r) => r.difficulty === d)
  const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
  const ndcgValues = filtered.map((r) => r.ndcgAt10).filter((v): v is number => v !== null)
  return {
    count: filtered.length,
    recallAt5_avg: avg(filtered.map((r) => r.recallAt5)),
    recallAt10_avg: avg(filtered.map((r) => r.recallAt10)),
    mrr: avg(filtered.map((r) => r.reciprocalRank)),
    ndcgAt10_avg: avg(ndcgValues),
  }
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}
