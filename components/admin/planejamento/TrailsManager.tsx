"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";

interface TrailRow {
  slug: string;
  title: string;
  natureza: string;
  documentType: string;
  catalogVersion: number;
  publishedVersion: number | null;
  publishedAt: string | null;
  templateId: string | null;
  needsUpdate: boolean;
  sectionsCount: number;
}

export default function TrailsManager() {
  const [rows, setRows] = useState<TrailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [publishing, setPublishing] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<Record<string, string>>({});

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/planejamento/admin/trails");
      if (!res.ok) throw new Error("Falha ao carregar trilhas");
      const { trails } = await res.json();
      setRows(trails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePublish(slug: string) {
    setPublishing(slug);
    try {
      const res = await fetch("/api/planejamento/admin/trails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, changelogMd: changelog[slug] ?? null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao publicar");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setPublishing(null);
    }
  }

  if (!rows) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-3">Trilha</th>
              <th className="px-4 py-3">Natureza</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Seções</th>
              <th className="px-4 py-3">Catálogo</th>
              <th className="px-4 py-3">Publicada</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.slug} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-brand-900">{r.title}</p>
                  <p className="font-mono text-[11px] text-gray-500">{r.slug}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">{r.natureza}</td>
                <td className="px-4 py-3 text-gray-700">{r.documentType}</td>
                <td className="px-4 py-3 text-gray-700">{r.sectionsCount}</td>
                <td className="px-4 py-3">v{r.catalogVersion}</td>
                <td className="px-4 py-3">
                  {r.publishedVersion == null ? (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" /> não publicada
                    </span>
                  ) : r.needsUpdate ? (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      v{r.publishedVersion} desatualizada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> v{r.publishedVersion}
                    </span>
                  )}
                  {r.publishedAt && (
                    <p className="text-[11px] text-gray-500">
                      {new Date(r.publishedAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Changelog (opcional)"
                      value={changelog[r.slug] ?? ""}
                      onChange={(e) =>
                        setChangelog((prev) => ({
                          ...prev,
                          [r.slug]: e.target.value,
                        }))
                      }
                      className="w-56 rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-brand-600 focus:outline-none"
                    />
                    <button
                      onClick={() =>
                        startTransition(() => {
                          handlePublish(r.slug);
                        })
                      }
                      disabled={publishing === r.slug}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60"
                    >
                      {publishing === r.slug ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      {r.publishedVersion == null ? "Publicar" : "Republicar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
