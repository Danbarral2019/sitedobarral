"use client";

import type { TrailDefinition } from "@/data/planejamento/types";
import type { SectionState } from "./SessionWorkspace";
import {
  Circle,
  CircleDot,
  CheckCircle2,
  CircleDashed,
  GraduationCap,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/planejamento/cn";

interface Props {
  trail: TrailDefinition;
  sections: SectionState[];
  activeKey: string;
  onSelect: (key: string) => void;
  learningMode: boolean;
  onToggleLearningMode: () => void;
}

export default function TrailSidebar({
  trail,
  sections,
  activeKey,
  onSelect,
  learningMode,
  onToggleLearningMode,
}: Props) {
  const byKey = Object.fromEntries(
    sections.map((s) => [s.sectionKey, s]),
  ) as Record<string, SectionState>;

  const totalRequired = trail.sections.filter((s) => s.required).length;
  const doneRequired = trail.sections.filter(
    (s) => s.required && byKey[s.key]?.status === "CONFIRMED",
  ).length;

  return (
    <div className="sticky top-20 rounded-[6px] border border-border-subtle bg-white p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Trilha
        </h2>
        <button
          onClick={onToggleLearningMode}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            learningMode
              ? "bg-brand-50 text-brand-800"
              : "bg-surface-deep text-ink-secondary",
          )}
          title={
            learningMode
              ? "Modo aprendizagem — painéis didáticos abertos"
              : "Modo execução — painéis didáticos colapsados"
          }
        >
          {learningMode ? (
            <>
              <GraduationCap className="h-3 w-3" /> aprendizagem
            </>
          ) : (
            <>
              <Wrench className="h-3 w-3" /> execução
            </>
          )}
        </button>
      </div>

      <div className="mb-3 px-1 text-[11px] text-ink-muted">
        {doneRequired}/{totalRequired} seções obrigatórias concluídas
      </div>

      <ol className="space-y-0.5">
        {trail.sections.map((s) => {
          const st = byKey[s.key];
          const active = activeKey === s.key;
          return (
            <li key={s.key}>
              <button
                onClick={() => onSelect(s.key)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition",
                  active
                    ? "bg-brand-50 text-brand-900"
                    : "text-ink-secondary hover:bg-surface-raised",
                )}
              >
                <span className="mt-0.5">{renderIcon(st?.status)}</span>
                <span className="flex-1">
                  <span className="block leading-snug">{s.title}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-ink-muted">
                    {s.required ? "obrigatória" : "opcional"}
                    {s.discretionary && " · dispensável c/ justificativa"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function renderIcon(status?: string) {
  switch (status) {
    case "CONFIRMED":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "DRAFTED":
      return <CircleDot className="h-4 w-4 text-brand-700" />;
    case "IN_PROGRESS":
      return <CircleDashed className="h-4 w-4 text-amber-accent-deep" />;
    case "SKIPPED_WITH_JUSTIFICATION":
      return <CircleDashed className="h-4 w-4 text-ink-muted" />;
    default:
      return <Circle className="h-4 w-4 text-ink-muted" />;
  }
}
