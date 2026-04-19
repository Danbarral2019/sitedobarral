import Link from "next/link";
import { DECISION_MATRICES } from "@/data/planejamento/decision-matrix/modalidade-julgamento-v1";
import {
  friendlyCriterio,
  friendlyModalidade,
} from "@/lib/planejamento/decision-engine";
import { ExternalLink, FileCode } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Visualização da matriz de decisão em modo read-only. A edição por UI
 * (CRUD com validação Zod) fica para sprint futuro; o MVP mantém a matriz
 * versionada em TypeScript (git) — igual ao restante do catálogo.
 */
export default function AdminMatrizPage() {
  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-brand-900">
          Matriz de decisão — modalidade e critério
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Regras declarativas versionadas em{" "}
          <code className="rounded bg-gray-100 px-1 text-xs">
            data/planejamento/decision-matrix/
          </code>
          . Cada publicação nova exige bump de <code>version</code> e entrada
          correspondente no golden-set de eval.
        </p>
      </header>

      {DECISION_MATRICES.map((m) => (
        <section
          key={m.slug}
          className="mb-6 rounded-xl border border-gray-200 bg-white"
        >
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                {m.slug} · v{m.version}
              </p>
              <h2 className="font-serif text-lg text-brand-900">{m.title}</h2>
            </div>
            <p className="text-xs text-gray-500">
              {m.inputs.length} inputs · {m.rules.length} regras
            </p>
          </header>

          <div className="divide-y divide-gray-100">
            {m.rules.map((r, idx) => (
              <article key={r.id} className="px-5 py-4">
                <div className="mb-1 flex items-start justify-between">
                  <p className="text-xs font-semibold text-brand-900">
                    #{idx + 1} · <code>{r.id}</code>
                  </p>
                  <p className="text-xs font-medium text-brand-800">
                    → {friendlyModalidade(r.then.modalidade)} /{" "}
                    {friendlyCriterio(r.then.criterio)}
                  </p>
                </div>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-50 p-2 font-mono text-[11px] text-gray-700">
                  {JSON.stringify(r.when, null, 2)}
                </pre>
                <p className="mt-2 text-xs leading-relaxed text-gray-700">
                  {r.rationaleMd}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.citations.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700"
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </article>
            ))}

            <article className="bg-amber-50/60 px-5 py-4">
              <p className="text-xs font-semibold text-amber-900">
                Fallback — quando nenhuma regra casa
              </p>
              <p className="mt-1 text-xs font-medium text-brand-800">
                → {friendlyModalidade(m.fallback.modalidade)} /{" "}
                {friendlyCriterio(m.fallback.criterio)}
              </p>
              <p className="mt-1 text-xs text-gray-700">{m.fallback.rationaleMd}</p>
            </article>
          </div>
        </section>
      ))}

      <p className="mt-4 inline-flex items-center gap-1 text-xs text-gray-500">
        <FileCode className="h-3 w-3" />
        Para editar regras: abra{" "}
        <code className="rounded bg-gray-100 px-1">
          data/planejamento/decision-matrix/modalidade-julgamento-v1.ts
        </code>
        , suba a versão e rode{" "}
        <Link
          href="#"
          className="inline-flex items-center gap-0.5 text-brand-700 hover:underline"
        >
          npm run eval:planejamento:decision
          <ExternalLink className="h-3 w-3" />
        </Link>
        .
      </p>
    </div>
  );
}
