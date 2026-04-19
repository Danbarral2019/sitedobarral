import TrailsManager from "@/components/admin/planejamento/TrailsManager";

export const dynamic = "force-dynamic";

export default function AdminPlanejamentoTrilhasPage() {
  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-brand-900">
          Trilhas de Planejamento
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Catálogo de trilhas ETP/TR mantido em{" "}
          <code className="rounded bg-gray-100 px-1 text-xs">data/planejamento/trails/</code>.
          Publicar grava um snapshot versionado que alimenta as sessões dos alunos.
        </p>
      </header>
      <TrailsManager />
    </div>
  );
}
