/**
 * Runner do golden-set da matriz de decisão.
 *
 * Uso: `npx tsx eval/planejamento/run-decision.ts`
 *
 * Cada caso é determinístico: mesmos inputs devem produzir a mesma saída.
 * O runner verifica (modalidade, criterio, ruleId). Falhas viram exit code != 0,
 * adequado a CI/CD ou pre-commit de edições na matriz.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  getDecisionMatrixBySlug,
} from "../../data/planejamento/decision-matrix/modalidade-julgamento-v1";
import { runDecisionMatrix } from "../../lib/planejamento/decision-engine";

interface Case {
  id: string;
  descricao: string;
  inputs: Record<string, string | number | boolean>;
  expected: {
    modalidade: string;
    criterio: string;
    ruleId: string | null;
  };
}

interface GoldenSet {
  version: number;
  matrixSlug: string;
  cases: Case[];
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = await readFile(
    join(here, "decision-golden-set.json"),
    "utf-8",
  );
  const gs = JSON.parse(raw) as GoldenSet;
  const matrix = getDecisionMatrixBySlug(gs.matrixSlug);
  if (!matrix) {
    console.error(`Matriz ${gs.matrixSlug} não encontrada.`);
    process.exit(2);
  }

  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  for (const c of gs.cases) {
    const res = runDecisionMatrix(matrix, c.inputs);
    const ok =
      res.modalidade === c.expected.modalidade &&
      res.criterio === c.expected.criterio &&
      res.matchedRuleId === c.expected.ruleId;

    if (ok) {
      pass++;
      console.log(
        `  ✓ ${c.id.padEnd(16)} → ${res.modalidade} / ${res.criterio}`,
      );
    } else {
      fail++;
      const msg =
        `  ✗ ${c.id.padEnd(16)} ESPERADO ${c.expected.modalidade}/${c.expected.criterio}` +
        ` (rule=${c.expected.ruleId ?? "fallback"}) ` +
        `OBTIDO ${res.modalidade}/${res.criterio} (rule=${res.matchedRuleId ?? "fallback"})`;
      failures.push(msg);
      console.log(msg);
    }
  }

  console.log(
    `\n${pass}/${gs.cases.length} casos passaram · ${fail} falharam.`,
  );
  if (fail > 0) {
    console.error("\nFalhas:");
    for (const m of failures) console.error(m);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
