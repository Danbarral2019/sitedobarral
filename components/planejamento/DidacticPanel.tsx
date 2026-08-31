"use client";

import { useEffect, useState } from "react";
import type { SectionDefinition, PlanningSectionSource } from "@/data/planejamento/types";
import { BookOpen, Scale, BookMarked, Gavel, FileText, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/planejamento/cn";

interface ContextPayload {
  excerpts: Array<{
    id: string;
    title: string;
    category: string;
    similarity: number;
    snippet: string;
    url?: string;
    sourceType: "document" | "legislative-act" | "tribunal-decision" | "lei-article";
  }>;
  articles: Array<{ numero: string; ementa: string }>;
  relatedActs: Array<{
    title: string;
    ementa: string;
    url: string;
    leiArticles: string[];
  }>;
  sources?: PlanningSectionSource[];
  anchorageScore: number;
  topSimilarity: number;
  note?: string;
}

interface Props {
  def: SectionDefinition;
  documentId: string;
  open: boolean;
  onOpenCitation: (s: PlanningSectionSource) => void;
}

type Tab = "conceito" | "excertos" | "artigos" | "atos";

export default function DidacticPanel({ def, documentId, open, onOpenCitation }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("conceito");
  const [ctx, setCtx] = useState<ContextPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (activeTab === "conceito") return;
    if (ctx) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/planejamento/documents/${documentId}/sections/${def.key}/context`,
        );
        if (!res.ok) throw new Error("Falha ao carregar contexto");
        const data = (await res.json()) as ContextPayload;
        if (!cancelled) setCtx(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeTab, ctx, documentId, def.key]);

  // Ao trocar de seção, limpa o contexto
  useEffect(() => {
    setCtx(null);
    setActiveTab("conceito");
  }, [def.key]);

  if (!open) return null;

  return (
    <div className="border-b border-border-subtle bg-brand-50/30">
      <div className="flex items-center gap-1 border-b border-brand-100/60 px-4">
        <TabButton active={activeTab === "conceito"} onClick={() => setActiveTab("conceito")}>
          <BookOpen className="h-3.5 w-3.5" /> Conceito
        </TabButton>
        <TabButton active={activeTab === "excertos"} onClick={() => setActiveTab("excertos")}>
          <FileText className="h-3.5 w-3.5" /> Excertos{ctx && ` (${ctx.excerpts.length})`}
        </TabButton>
        <TabButton active={activeTab === "artigos"} onClick={() => setActiveTab("artigos")}>
          <Scale className="h-3.5 w-3.5" /> Artigos{ctx && ` (${ctx.articles.length})`}
        </TabButton>
        <TabButton active={activeTab === "atos"} onClick={() => setActiveTab("atos")}>
          <BookMarked className="h-3.5 w-3.5" /> Atos{ctx && ` (${ctx.relatedActs.length})`}
        </TabButton>
      </div>

      <div className="px-6 py-4 text-sm leading-relaxed text-ink-secondary">
        {activeTab === "conceito" && <ConceptoTab def={def} />}

        {activeTab !== "conceito" && loading && (
          <p className="inline-flex items-center gap-2 text-xs text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando contexto…
          </p>
        )}

        {activeTab !== "conceito" && error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            {error}
          </p>
        )}

        {activeTab !== "conceito" && ctx && ctx.note === "onboarding-pendente" && (
          <p className="rounded-md border border-amber-accent-soft bg-amber-accent-soft p-3 text-xs text-ink-primary">
            A descrição da contratação está muito curta para recuperar contexto
            relevante. Refine o onboarding antes de solicitar excertos.
          </p>
        )}

        {activeTab === "excertos" && ctx && ctx.note !== "onboarding-pendente" && (
          <ExcerptsTab ctx={ctx} onOpenCitation={onOpenCitation} />
        )}
        {activeTab === "artigos" && ctx && ctx.note !== "onboarding-pendente" && (
          <ArticlesTab ctx={ctx} onOpenCitation={onOpenCitation} />
        )}
        {activeTab === "atos" && ctx && ctx.note !== "onboarding-pendente" && (
          <ActsTab ctx={ctx} onOpenCitation={onOpenCitation} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 border-b-2 px-3 py-2 text-xs font-medium transition",
        active
          ? "border-brand-700 text-brand-800"
          : "border-transparent text-ink-muted hover:text-ink-secondary",
      )}
    >
      {children}
    </button>
  );
}

function ConceptoTab({ def }: { def: SectionDefinition }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
          Conceito
        </p>
        <p>{def.didactic.conceito}</p>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
          Fundamento
        </p>
        <p>{def.didactic.fundamento}</p>
      </div>
      {def.legalAnchors.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
            Âncoras normativas
          </p>
          <ul className="space-y-1 text-xs">
            {def.legalAnchors.map((a, i) => (
              <li key={i} className="inline-flex items-center gap-1">
                <span className="rounded-[3px] bg-white px-2 py-0.5 text-ink-secondary">
                  {a.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="inline-flex items-center gap-1 text-[11px] italic text-ink-muted">
        <Sparkles className="h-3 w-3" />
        As abas Excertos/Artigos/Atos carregam contexto ancorado na base do curso sob demanda.
      </p>
    </div>
  );
}

function ExcerptsTab({
  ctx,
  onOpenCitation,
}: {
  ctx: ContextPayload;
  onOpenCitation: (s: PlanningSectionSource) => void;
}) {
  if (ctx.excerpts.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        Nenhum excerto relevante encontrado para esta seção.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {ctx.excerpts.map((e) => (
        <li key={e.id} className="rounded-md bg-white p-3 border border-border-subtle">
          <div className="mb-1 flex items-center justify-between gap-2">
            <button
              onClick={() =>
                onOpenCitation({
                  sourceType: e.sourceType,
                  id: e.id,
                  title: e.title,
                  url: e.url,
                  similarity: e.similarity,
                  snippet: e.snippet,
                })
              }
              className="text-left text-xs font-semibold text-brand-900 hover:underline"
            >
              {iconFor(e.sourceType)} {e.title}
            </button>
            <span className="text-[10px] text-ink-muted">
              {Math.round(e.similarity * 100)}%
            </span>
          </div>
          <p className="text-xs leading-relaxed text-ink-secondary">{e.snippet}</p>
        </li>
      ))}
    </ul>
  );
}

function ArticlesTab({
  ctx,
  onOpenCitation,
}: {
  ctx: ContextPayload;
  onOpenCitation: (s: PlanningSectionSource) => void;
}) {
  if (ctx.articles.length === 0) {
    return <p className="text-xs text-ink-muted">Sem artigos selecionados.</p>;
  }
  return (
    <ul className="space-y-2">
      {ctx.articles.map((a) => (
        <li key={a.numero} className="rounded-md bg-white p-3 border border-border-subtle">
          <button
            onClick={() =>
              onOpenCitation({
                sourceType: "lei-article",
                id: `lei-article:${a.numero}`,
                title: `Art. ${a.numero} · Lei 14.133/2021`,
                articleNumber: a.numero,
                url: `/area-restrita/artigo/${a.numero}`,
                snippet: a.ementa,
              })
            }
            className="text-left text-xs font-semibold text-brand-900 hover:underline"
          >
            Art. {a.numero} · Lei 14.133/2021
          </button>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            {truncate(a.ementa, 320)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ActsTab({
  ctx,
  onOpenCitation,
}: {
  ctx: ContextPayload;
  onOpenCitation: (s: PlanningSectionSource) => void;
}) {
  if (ctx.relatedActs.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        Sem atos normativos correlatos identificados.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {ctx.relatedActs.map((a, i) => (
        <li key={`${a.title}-${i}`} className="rounded-md bg-white p-3 border border-border-subtle">
          <button
            onClick={() =>
              onOpenCitation({
                sourceType: "legislative-act",
                id: `legislative-act:${a.title}`,
                title: a.title,
                url: a.url,
                snippet: a.ementa,
              })
            }
            className="text-left text-xs font-semibold text-brand-900 hover:underline"
          >
            {a.title}
          </button>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            {truncate(a.ementa, 260)}
          </p>
          {a.leiArticles.length > 0 && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted">
              vincula: {a.leiArticles.slice(0, 6).join(", ")}
              {a.leiArticles.length > 6 ? "…" : ""}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function iconFor(t: string) {
  switch (t) {
    case "legislative-act":
      return <BookMarked className="mr-1 inline h-3 w-3 text-brand-700" />;
    case "tribunal-decision":
      return <Gavel className="mr-1 inline h-3 w-3 text-brand-700" />;
    case "lei-article":
      return <Scale className="mr-1 inline h-3 w-3 text-brand-700" />;
    default:
      return <FileText className="mr-1 inline h-3 w-3 text-brand-700" />;
  }
}

function truncate(s: string, max: number) {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}
