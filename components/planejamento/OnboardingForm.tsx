"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

interface ClassifyResult {
  naturezaSugerida: string;
  confianca: number;
  perguntasFollowUp: string[];
  trailTemplateId?: string;
}

export default function OnboardingForm() {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classification, setClassification] = useState<ClassifyResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // 1) cria sessão
      const createRes = await fetch("/api/planejamento/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: titulo.trim() || "Nova contratação" }),
      });
      if (!createRes.ok) {
        const j = await safeJson(createRes);
        throw new Error(j?.error ?? "Não foi possível criar a sessão");
      }
      const { session } = await createRes.json();
      setSessionId(session.id);

      // 2) envia onboarding (classifica + materializa ETP quando possível)
      const onbRes = await fetch(
        `/api/planejamento/sessions/${session.id}/onboarding`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descricaoLivre: descricao.trim() }),
        },
      );
      if (!onbRes.ok) {
        const j = await safeJson(onbRes);
        throw new Error(j?.error ?? "Falha ao processar descrição");
      }
      const { classification: c, document } = await onbRes.json();
      setClassification(c);
      if (document?.id) setDocumentId(document.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  if (classification && sessionId) {
    return (
      <div className="rounded-[6px] border border-brand-100 bg-brand-50 p-6">
        <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-brand-800">
          <Sparkles className="h-4 w-4" /> Classificação sugerida
        </div>
        <p className="mb-1 text-lg font-medium text-brand-900">
          {friendlyNatureza(classification.naturezaSugerida)}
        </p>
        <p className="mb-4 text-sm text-ink-muted">
          Confiança estimada: {(classification.confianca * 100).toFixed(0)}%
        </p>
        {classification.perguntasFollowUp.length > 0 && (
          <div className="mb-4 rounded-[6px] bg-white p-4">
            <p className="mb-2 text-sm font-medium text-ink-secondary">
              Para refinar, considere:
            </p>
            <ul className="space-y-1 text-sm text-ink-secondary">
              {classification.perguntasFollowUp.map((q, i) => (
                <li key={i}>· {q}</li>
              ))}
            </ul>
          </div>
        )}
        {!documentId && (
          <p className="mb-4 rounded-[6px] bg-amber-accent-soft p-3 text-sm text-ink-primary">
            Trilha ainda não publicada para esta natureza. O time do curso
            receberá sinalização automática. Por enquanto você pode abrir a
            sessão e continuar manualmente.
          </p>
        )}
        <button
          onClick={() =>
            router.push(`/area-restrita/planejamento/${sessionId}`)
          }
          className="inline-flex items-center gap-2 rounded-[6px] bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
        >
          Abrir trilha
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="titulo" className="mb-1 block text-sm font-medium text-ink-secondary">
          Título interno da contratação
        </label>
        <input
          id="titulo"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Limpeza e conservação — Edifício-sede 2026"
          className="w-full rounded-[6px] border-2 border-border-subtle px-4 py-2.5 text-sm focus:border-brand-600 focus:outline-none"
          maxLength={200}
          minLength={3}
          required
        />
      </div>

      <div>
        <label htmlFor="descricao" className="mb-1 block text-sm font-medium text-ink-secondary">
          Descrição da contratação
        </label>
        <textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Serviço continuado de limpeza e conservação para unidade com 4.000 m² e aproximadamente 20 postos, com dedicação exclusiva de mão de obra, em regime de 12 meses prorrogáveis."
          rows={8}
          className="w-full resize-none rounded-[6px] border-2 border-border-subtle px-4 py-3 text-sm leading-relaxed focus:border-brand-600 focus:outline-none"
          maxLength={4000}
          minLength={20}
          required
        />
        <p className="mt-1 text-xs text-ink-muted">
          Entre 20 e 4 000 caracteres. Quanto mais contexto, melhor a classificação.
        </p>
      </div>

      {error && (
        <p className="rounded-[6px] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-[6px] bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processando…
            </>
          ) : (
            <>Classificar e iniciar trilha</>
          )}
        </button>
      </div>
    </form>
  );
}

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function friendlyNatureza(n: string) {
  const map: Record<string, string> = {
    BEM_COMUM: "Bem comum",
    BEM_ESPECIAL: "Bem especial",
    SERVICO_COMUM: "Serviço comum",
    SERVICO_CONTINUADO: "Serviço continuado",
    SERVICO_ESPECIAL: "Serviço especial",
    OBRA: "Obra",
    SERVICO_ENGENHARIA: "Serviço de engenharia",
  };
  return map[n] ?? n;
}
