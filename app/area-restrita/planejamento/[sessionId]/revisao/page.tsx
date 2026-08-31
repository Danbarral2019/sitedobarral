import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import ReviewChecklist from "@/components/planejamento/ReviewChecklist";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function RevisaoPage({ params }: PageProps) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const token =
    cookieStore.get("auth-token")?.value ||
    cookieStore.get("auth_token")?.value;
  if (!token)
    redirect(`/login?redirect=/area-restrita/planejamento/${sessionId}/revisao`);
  const decoded = await verifyToken(token);
  if (!decoded)
    redirect(`/login?redirect=/area-restrita/planejamento/${sessionId}/revisao`);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/area-restrita/planejamento/${sessionId}`}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à trilha
      </Link>
      <h1 className="mt-3 font-serif text-2xl text-brand-900">
        Revisão final
      </h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-muted">
        Checklist de conformidade com a Lei 14.133/2021 e INs SEGES aplicáveis,
        mais um teste de coerência entre o ETP e o TR. Os achados são
        informativos — a decisão de exportar permanece com você.
      </p>
      <ReviewChecklist sessionId={sessionId} />
    </main>
  );
}
