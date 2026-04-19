"use client";

import { useEffect, useState } from "react";
import type {
  SectionDefinition,
  PlanningSectionSource,
} from "@/data/planejamento/types";
import type { SectionState } from "./SessionWorkspace";
import DidacticPanel from "./DidacticPanel";
import ProvenanceBadge from "./ProvenanceBadge";
import {
  BookOpen,
  BookMarked,
  ChevronDown,
  ChevronUp,
  Save,
  Check,
  Ban,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/planejamento/cn";

interface Props {
  documentId: string;
  def: SectionDefinition;
  state: SectionState & {
    conceptualCheckAnswerMd?: string | null;
    conceptualCheckPassed?: boolean | null;
    derivedFromSectionId?: string | null;
  };
  learningMode: boolean;
  isSaving: boolean;
  isGenerating: boolean;
  generationError: string | null;
  onSave: (patch: {
    contentMd?: string;
    status?: string;
    justificationSkipped?: string;
  }) => void;
  onGenerate: (mode: "fresh" | "refine", userHints?: string) => void;
  onOpenCitation: (s: PlanningSectionSource) => void;
  onSaveAsSnippet?: () => void;
}

export default function SectionEditor({
  documentId,
  def,
  state,
  learningMode,
  isSaving,
  isGenerating,
  generationError,
  onSave,
  onGenerate,
  onOpenCitation,
  onSaveAsSnippet,
}: Props) {
  const [content, setContent] = useState(state.contentMd);
  const [didacticOpen, setDidacticOpen] = useState(learningMode);
  const [skipMode, setSkipMode] = useState(false);
  const [justification, setJustification] = useState(
    state.justificationSkipped ?? "",
  );
  const [hints, setHints] = useState("");

  useEffect(() => {
    setContent(state.contentMd);
    setJustification(state.justificationSkipped ?? "");
    setSkipMode(state.status === "SKIPPED_WITH_JUSTIFICATION");
    setDidacticOpen(learningMode);
    setHints("");
  }, [state.id, state.contentMd, state.justificationSkipped, state.status, learningMode]);

  const dirty = content !== state.contentMd;
  const hasDraft = content.trim().length >= 20;
  const notAnchoredWarning =
    state.generationProvenance === "NOT_ANCHORED" && state.status !== "CONFIRMED";

  return (
    <article className="rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400">
            Seção {def.ordem} · {def.required ? "obrigatória" : "opcional"}
          </p>
          <h2 className="mt-0.5 font-serif text-xl text-brand-900">{def.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
            {def.legalAnchors.map((a, i) => (
              <span
                key={i}
                className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700"
              >
                {a.label}
              </span>
            ))}
          </div>
        </div>
        <ProvenanceBadge
          provenance={state.generationProvenance}
          anchorageScore={state.sufficiencyScore ?? undefined}
        />
      </header>

      <div className="border-b border-gray-100">
        <button
          onClick={() => setDidacticOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          <span className="inline-flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand-700" /> Painel didático
          </span>
          {didacticOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        <DidacticPanel
          def={def}
          documentId={documentId}
          open={didacticOpen}
          onOpenCitation={onOpenCitation}
        />
      </div>

      {state.derivedFromSectionId && (
        <p className="border-b border-brand-100 bg-brand-50/40 px-6 py-2 text-[11px] text-brand-800">
          Conteúdo inicialmente herdado da seção correspondente do ETP · edite
          livremente; a origem fica registrada para o coherence check da
          revisão final.
        </p>
      )}

      <div className="px-6 py-5">
        {skipMode && def.discretionary ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Justificativa para dispensar esta seção
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={5}
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 text-sm leading-relaxed focus:border-brand-600 focus:outline-none"
              placeholder="Informe o fundamento fático e jurídico pelo qual esta seção é dispensada."
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() =>
                  onSave({
                    status: "SKIPPED_WITH_JUSTIFICATION",
                    justificationSkipped: justification,
                    contentMd: "",
                  })
                }
                disabled={isSaving || justification.trim().length < 20}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Confirmar dispensa
              </button>
              <button
                onClick={() => setSkipMode(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1 text-xs font-medium text-brand-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  Gerar texto-base ancorado na base do curso
                </p>
                {isGenerating && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-brand-700">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    gerando…
                  </span>
                )}
              </div>
              <textarea
                value={hints}
                onChange={(e) => setHints(e.target.value)}
                rows={2}
                placeholder="Observações opcionais (ex: incluir referência à sustentabilidade, indicar que o órgão é municipal)."
                className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-xs focus:border-brand-600 focus:outline-none"
                maxLength={1500}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => onGenerate("fresh", hints || undefined)}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  <Sparkles className="h-3 w-3" />
                  Gerar do zero
                </button>
                <button
                  onClick={() => onGenerate("refine", hints || undefined)}
                  disabled={isGenerating || !hasDraft}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-50 disabled:opacity-60"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refinar rascunho
                </button>
              </div>
              {generationError && (
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
                  {generationError}
                </p>
              )}
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder="Escreva o conteúdo desta seção em prosa técnico-jurídica, ou use Gerar do zero para obter um texto-base ancorado."
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 font-mono text-sm leading-relaxed focus:border-brand-600 focus:outline-none"
            />

            {state.sources.length > 0 && (
              <CitationsFooter
                sources={state.sources}
                onOpen={onOpenCitation}
              />
            )}

            {notAnchoredWarning && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                Esta seção foi gerada sem fontes relevantes recuperadas da base
                do curso. Revise manualmente cada afirmação antes de confirmar.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-gray-500">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    statusColor(state.status),
                  )}
                >
                  {friendlyStatus(state.status)}
                </span>
                {dirty && (
                  <span className="ml-2 text-amber-700">
                    alterações não salvas
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {onSaveAsSnippet && state.contentMd.trim().length > 20 && (
                  <button
                    onClick={onSaveAsSnippet}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <BookMarked className="h-3.5 w-3.5" />
                    Salvar como snippet
                  </button>
                )}
                {def.discretionary && state.status !== "CONFIRMED" && (
                  <button
                    onClick={() => setSkipMode(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Dispensar com justificativa
                  </button>
                )}
                <button
                  onClick={() => onSave({ contentMd: content })}
                  disabled={isSaving || !dirty}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar rascunho
                </button>
                <button
                  onClick={() =>
                    onSave({ contentMd: content, status: "CONFIRMED" })
                  }
                  disabled={isSaving || content.trim().length < 20}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  Confirmar seção
                </button>
              </div>
            </div>
          </>
        )}

        {def.checkpoint && (
          <CheckpointBlock
            documentId={documentId}
            sectionKey={def.key}
            question={def.checkpoint.question}
            initialAnswer={state.conceptualCheckAnswerMd ?? ""}
            initialPassed={state.conceptualCheckPassed ?? null}
          />
        )}
      </div>
    </article>
  );
}

function CheckpointBlock({
  documentId,
  sectionKey,
  question,
  initialAnswer,
  initialPassed,
}: {
  documentId: string;
  sectionKey: string;
  question: string;
  initialAnswer: string;
  initialPassed: boolean | null;
}) {
  const [answer, setAnswer] = useState(initialAnswer);
  const [passed, setPassed] = useState<boolean | null>(initialPassed);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setAnswer(initialAnswer);
    setPassed(initialPassed);
    setSavedAt(null);
  }, [sectionKey, initialAnswer, initialPassed]);

  async function submit(selfEvaluation: "passed" | "uncertain") {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/planejamento/documents/${documentId}/sections/${sectionKey}/checkpoint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answerMd: answer, selfEvaluation }),
        },
      );
      if (res.ok) {
        setPassed(selfEvaluation === "passed");
        setSavedAt(new Date());
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">
        Checkpoint pedagógico
      </p>
      <p className="mt-1 text-sm text-gray-800">{question}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="Responda em 2-4 linhas. Resposta é informativa, não bloqueia a confirmação da seção."
        className="mt-2 w-full resize-none rounded-md border border-brand-100 bg-white px-3 py-2 text-xs focus:border-brand-600 focus:outline-none"
        maxLength={4000}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">
          {passed === true && "Marcado como compreendido"}
          {passed === false && "Marcado como incerto — revise o fundamento"}
          {savedAt && ` · ${savedAt.toLocaleTimeString("pt-BR")}`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => submit("uncertain")}
            disabled={saving || answer.trim().length < 5}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Ainda tenho dúvida
          </button>
          <button
            onClick={() => submit("passed")}
            disabled={saving || answer.trim().length < 5}
            className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Compreendi
          </button>
        </div>
      </div>
    </div>
  );
}

function CitationsFooter({
  sources,
  onOpen,
}: {
  sources: PlanningSectionSource[];
  onOpen: (s: PlanningSectionSource) => void;
}) {
  return (
    <div className="mt-3 rounded-md bg-gray-50 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
        Fontes ancoradas
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {sources.slice(0, 10).map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onOpen(s)}
              className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:border-brand-300 hover:text-brand-800"
              title={s.title}
            >
              {shortLabel(s)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function shortLabel(s: PlanningSectionSource) {
  if (s.sourceType === "lei-article") return `Art. ${s.articleNumber}`;
  if (s.title.length <= 42) return s.title;
  return s.title.slice(0, 40).trimEnd() + "…";
}

function friendlyStatus(s: string) {
  switch (s) {
    case "PENDING":
      return "pendente";
    case "IN_PROGRESS":
      return "em rascunho";
    case "DRAFTED":
      return "rascunho pronto";
    case "CONFIRMED":
      return "confirmada";
    case "SKIPPED_WITH_JUSTIFICATION":
      return "dispensada c/ justificativa";
    default:
      return s.toLowerCase();
  }
}

function statusColor(s: string) {
  switch (s) {
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-800";
    case "DRAFTED":
      return "bg-brand-50 text-brand-800";
    case "IN_PROGRESS":
      return "bg-amber-100 text-amber-800";
    case "SKIPPED_WITH_JUSTIFICATION":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-500";
  }
}
