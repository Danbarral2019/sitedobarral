import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import OnboardingForm from "@/components/planejamento/OnboardingForm";

export const dynamic = "force-dynamic";

export default function NovaContratacaoPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href="/area-restrita/planejamento"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mt-4 font-serif text-3xl text-brand-900">
        Nova contratação
      </h1>
      <p className="mt-2 mb-8 max-w-2xl text-gray-600">
        Descreva, em linguagem natural, a contratação que pretende elaborar.
        Inclua o objeto principal, estimativa inicial de volume e contexto do
        órgão. O assistente sugere a trilha adequada e monta a estrutura do
        ETP a partir daí.
      </p>
      <OnboardingForm />
    </main>
  );
}
