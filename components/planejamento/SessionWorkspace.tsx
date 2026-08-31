"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  SectionDefinition,
  TrailDefinition,
  PlanningSectionSource,
} from "@/data/planejamento/types";
import TrailSidebar from "./TrailSidebar";
import SectionEditor from "./SectionEditor";
import CitationDrawer from "./CitationDrawer";
import VersionHistoryButton from "./VersionHistoryButton";
import LibraryDrawer from "./LibraryDrawer";
import ExportDialog from "./ExportDialog";
import { BookMarked, Download } from "lucide-react";

export interface SectionState {
  id: string;
  sectionKey: string;
  ordem: number;
  status: string;
  contentMd: string;
  generationProvenance: string | null;
  justificationSkipped: string | null;
  sources: PlanningSectionSource[];
  sufficiencyScore: number | null;
  conceptualCheckAnswerMd: string | null;
  conceptualCheckPassed: boolean | null;
  derivedFromSectionId: string | null;
}

interface Props {
  sessionId: string;
  documentId: string;
  documentType?: "ETP" | "TR";
  learningMode: boolean;
  trail: TrailDefinition;
  sections: SectionState[];
}

interface LibrarySeed {
  corpoMd?: string;
  titulo?: string;
  sourceSectionId?: string;
}

export default function SessionWorkspace({
  sessionId,
  documentId,
  documentType = "ETP",
  learningMode: initialLearningMode,
  trail,
  sections: initialSections,
}: Props) {
  const [sections, setSections] = useState<SectionState[]>(initialSections);
  const [activeKey, setActiveKey] = useState<string>(
    initialSections[0]?.sectionKey ?? trail.sections[0].key,
  );
  const [learningMode, setLearningMode] = useState(initialLearningMode);
  const [isSaving, startSaving] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [drawerSource, setDrawerSource] = useState<PlanningSectionSource | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySeed, setLibrarySeed] = useState<LibrarySeed>({});
  const [exportOpen, setExportOpen] = useState(false);

  function persistLearningMode(next: boolean) {
    setLearningMode(next);
    fetch(`/api/planejamento/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learningMode: next }),
    }).catch(() => {
      /* best-effort */
    });
  }

  function handleInsertSnippet(corpoMd: string) {
    if (!activeState) return;
    const next =
      activeState.contentMd.trim().length === 0
        ? corpoMd
        : `${activeState.contentMd}\n\n${corpoMd}`;
    // Persiste via API e atualiza estado local
    fetch(`/api/planejamento/documents/${documentId}/sections/${activeKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentMd: next }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const { section } = await res.json();
        setSections((prev) =>
          prev.map((s) =>
            s.sectionKey === activeKey
              ? { ...s, contentMd: section.contentMd ?? next, status: section.status }
              : s,
          ),
        );
      })
      .catch(() => {});
  }

  function openLibraryForSaveCurrent() {
    setLibrarySeed({
      corpoMd: activeState?.contentMd ?? "",
      titulo: activeDef ? `${activeDef.title} — ${trail.title}` : "",
      sourceSectionId: activeState?.id,
    });
    setLibraryOpen(true);
  }

  function openLibraryForBrowse() {
    setLibrarySeed({});
    setLibraryOpen(true);
  }

  const trailByKey = useMemo(
    () => Object.fromEntries(trail.sections.map((s) => [s.key, s])) as Record<
      string,
      SectionDefinition
    >,
    [trail],
  );
  const activeDef = trailByKey[activeKey];
  const activeState = sections.find((s) => s.sectionKey === activeKey);

  function handleSaveSection(patch: {
    contentMd?: string;
    status?: string;
    justificationSkipped?: string;
  }) {
    if (!activeState) return;
    startSaving(async () => {
      const res = await fetch(
        `/api/planejamento/documents/${documentId}/sections/${activeKey}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      if (res.ok) {
        const { section } = await res.json();
        setSections((prev) =>
          prev.map((s) =>
            s.sectionKey === activeKey
              ? {
                  ...s,
                  contentMd: section.contentMd ?? "",
                  status: section.status,
                  justificationSkipped: section.justificationSkipped ?? null,
                }
              : s,
          ),
        );
      }
    });
  }

  async function handleGenerate(mode: "fresh" | "refine", userHints?: string) {
    if (!activeState) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const res = await fetch(
        `/api/planejamento/documents/${documentId}/sections/${activeKey}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, userHints }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao gerar texto");
      }
      const { section, generation } = await res.json();
      setSections((prev) =>
        prev.map((s) =>
          s.sectionKey === activeKey
            ? {
                ...s,
                contentMd: section.contentMd ?? "",
                status: section.status,
                generationProvenance: generation.provenance,
                sources: generation.sources ?? [],
                sufficiencyScore: generation.anchorageScore ?? null,
              }
            : s,
        ),
      );
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Erro ao gerar texto");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 px-4 pt-4">
        <button
          onClick={openLibraryForBrowse}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-300 hover:text-brand-800"
        >
          <BookMarked className="h-3.5 w-3.5" /> Biblioteca
        </button>
        <VersionHistoryButton documentId={documentId} />
        <button
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-surface-page hover:bg-brand-800"
        >
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 py-4">
        <aside className="col-span-12 md:col-span-3">
          <TrailSidebar
            trail={trail}
            sections={sections}
            activeKey={activeKey}
            onSelect={setActiveKey}
            learningMode={learningMode}
            onToggleLearningMode={() => persistLearningMode(!learningMode)}
          />
        </aside>

        <section className="col-span-12 md:col-span-9">
          {activeDef && activeState ? (
            <SectionEditor
              documentId={documentId}
              def={activeDef}
              state={activeState}
              learningMode={learningMode}
              isSaving={isSaving}
              isGenerating={isGenerating}
              generationError={generationError}
              onSave={handleSaveSection}
              onGenerate={handleGenerate}
              onOpenCitation={setDrawerSource}
              onSaveAsSnippet={openLibraryForSaveCurrent}
            />
          ) : (
            <p className="text-sm text-gray-500">Selecione uma seção à esquerda.</p>
          )}
        </section>
      </div>

      <CitationDrawer
        open={drawerSource !== null}
        source={drawerSource}
        onClose={() => setDrawerSource(null)}
      />
      <LibraryDrawer
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onInsert={handleInsertSnippet}
        seedCorpoMd={librarySeed.corpoMd}
        seedTitulo={librarySeed.titulo}
        seedSourceSectionId={librarySeed.sourceSectionId}
      />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        documentId={documentId}
        documentType={documentType}
      />
    </>
  );
}
