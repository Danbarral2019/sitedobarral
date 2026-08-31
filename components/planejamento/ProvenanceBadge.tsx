"use client";

import { ShieldCheck, ShieldAlert, Shield, Pencil } from "lucide-react";
import { cn } from "@/lib/planejamento/cn";

interface Props {
  provenance: string | null;
  anchorageScore?: number;
  className?: string;
}

export default function ProvenanceBadge({ provenance, anchorageScore, className }: Props) {
  if (!provenance) return null;
  const meta = metaFor(provenance);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        meta.bg,
        meta.text,
        className,
      )}
      title={meta.title}
    >
      <meta.Icon className="h-3 w-3" />
      {meta.label}
      {typeof anchorageScore === "number" && provenance !== "USER_WRITTEN" && (
        <span className="opacity-70">· {(anchorageScore * 100).toFixed(0)}%</span>
      )}
    </span>
  );
}

function metaFor(p: string) {
  switch (p) {
    case "RAG_ANCHORED":
      return {
        label: "ancorada",
        bg: "bg-emerald-100",
        text: "text-emerald-800",
        Icon: ShieldCheck,
        title:
          "Geração fundamentada em trechos recuperados da base do curso. Revise mesmo assim.",
      };
    case "PARTIALLY_ANCHORED":
      return {
        label: "parcialmente ancorada",
        bg: "bg-amber-accent-soft",
        text: "text-amber-accent-deep",
        Icon: Shield,
        title:
          "Parte do texto foi ancorada no contexto. Verifique as afirmações sem citação.",
      };
    case "NOT_ANCHORED":
      return {
        label: "não ancorada",
        bg: "bg-red-100",
        text: "text-red-800",
        Icon: ShieldAlert,
        title:
          "Texto gerado sem fontes relevantes recuperadas. Requer revisão humana antes de confirmar.",
      };
    case "USER_WRITTEN":
    default:
      return {
        label: "redação manual",
        bg: "bg-surface-deep",
        text: "text-ink-secondary",
        Icon: Pencil,
        title: "Escrito pelo aluno sem apoio de geração.",
      };
  }
}
