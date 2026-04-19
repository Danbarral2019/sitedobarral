"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight, FileText, FileCheck2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/planejamento/cn";

interface Props {
  sessionId: string;
  activeType: "ETP" | "TR";
  etpPresent: boolean;
  trPresent: boolean;
  canTransitionTr: boolean;
  etpRequiredRemaining: number;
}

export default function DocumentTabs({
  sessionId,
  activeType,
  etpPresent,
  trPresent,
  canTransitionTr,
  etpRequiredRemaining,
}: Props) {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transitionToTR() {
    setTransitioning(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/planejamento/sessions/${sessionId}/transition-tr`,
        { method: "POST" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao iniciar o TR");
      }
      router.refresh();
      // garante que o documento TR aparece como ativo
      router.push(`/area-restrita/planejamento/${sessionId}?doc=TR`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {etpPresent && (
        <TabLink
          href={`/area-restrita/planejamento/${sessionId}?doc=ETP`}
          active={activeType === "ETP"}
          icon={<FileText className="h-3.5 w-3.5" />}
          label="ETP"
        />
      )}
      {trPresent ? (
        <TabLink
          href={`/area-restrita/planejamento/${sessionId}?doc=TR`}
          active={activeType === "TR"}
          icon={<FileCheck2 className="h-3.5 w-3.5" />}
          label="TR"
        />
      ) : canTransitionTr ? (
        <button
          onClick={transitionToTR}
          disabled={transitioning}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {transitioning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          Avançar para o TR
        </button>
      ) : etpPresent ? (
        <span
          className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500"
          title={
            etpRequiredRemaining > 0
              ? `Faltam ${etpRequiredRemaining} seções obrigatórias do ETP`
              : "TR ainda não disponível"
          }
        >
          <FileCheck2 className="h-3.5 w-3.5" />
          TR ({etpRequiredRemaining} pendências)
        </span>
      ) : null}

      {(etpPresent || trPresent) && (
        <Link
          href={`/area-restrita/planejamento/${sessionId}/revisao`}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-300 hover:text-brand-800"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Revisão final
        </Link>
      )}

      {error && (
        <p className="w-full rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-brand-700 text-white"
          : "border border-gray-200 bg-white text-gray-700 hover:border-brand-300",
      )}
    >
      {icon} {label}
    </Link>
  );
}
