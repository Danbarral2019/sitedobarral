/**
 * Snapshots e diffs de documentos de planejamento.
 *
 * Snapshot: cópia congelada da árvore de seções em JSON, usada como unidade
 * de versionamento. Cria-se automaticamente quando uma seção é confirmada
 * (gatilho em `markSectionConfirmed`) e manualmente via API.
 *
 * Diff: line-based LCS simples, por seção. Evita dependência externa no MVP
 * e produz saída estruturada (hunks) para a UI renderizar.
 */
import { prisma } from "@/lib/prisma";

export interface SectionSnapshot {
  sectionKey: string;
  ordem: number;
  status: string;
  contentMd: string;
  generationProvenance: string | null;
  justificationSkipped: string | null;
  sufficiencyScore: number | null;
}

export interface DocumentSnapshot {
  documentId: string;
  documentType: string;
  takenAt: string;
  sections: SectionSnapshot[];
}

export type DiffLineOp = "equal" | "add" | "del";

export interface DiffLine {
  op: DiffLineOp;
  content: string;
}

export interface SectionDiff {
  sectionKey: string;
  changeKind: "added" | "removed" | "modified" | "unchanged";
  lines?: DiffLine[];
  summary: string;
}

export interface DocumentDiff {
  fromVersion: number | null;
  toVersion: number;
  sections: SectionDiff[];
  totalChanges: number;
}

export async function captureSnapshot(
  documentId: string,
): Promise<DocumentSnapshot> {
  const doc = await prisma.planningDocument.findUnique({
    where: { id: documentId },
    include: {
      sections: { orderBy: { ordem: "asc" } },
    },
  });
  if (!doc) throw new Error("Documento não encontrado para snapshot");
  return {
    documentId: doc.id,
    documentType: doc.type,
    takenAt: new Date().toISOString(),
    sections: doc.sections.map((s) => ({
      sectionKey: s.sectionKey,
      ordem: s.ordem,
      status: s.status,
      contentMd: s.contentMd ?? "",
      generationProvenance: s.generationProvenance,
      justificationSkipped: s.justificationSkipped,
      sufficiencyScore: s.sufficiencyScore,
    })),
  };
}

export interface CreateVersionInput {
  documentId: string;
  authorKind: "user" | "ai" | "system";
  authorId?: string;
  label?: string;
  /**
   * Se true, pula criação quando o snapshot for idêntico ao da versão anterior.
   * Default: true (evita poluir histórico com saves redundantes).
   */
  skipIfIdentical?: boolean;
}

export async function createVersion(input: CreateVersionInput) {
  const snapshot = await captureSnapshot(input.documentId);
  const snapshotJson = JSON.stringify(snapshot);

  const last = await prisma.planningDocumentVersion.findFirst({
    where: { documentId: input.documentId },
    orderBy: { versionNumber: "desc" },
  });

  if ((input.skipIfIdentical ?? true) && last && last.snapshotJson === snapshotJson) {
    return { version: last, reused: true as const };
  }

  const nextNumber = (last?.versionNumber ?? 0) + 1;
  const diffJson = last
    ? JSON.stringify(
        diffSnapshots(
          JSON.parse(last.snapshotJson) as DocumentSnapshot,
          snapshot,
          { fromVersion: last.versionNumber, toVersion: nextNumber },
        ),
      )
    : null;

  const created = await prisma.planningDocumentVersion.create({
    data: {
      documentId: input.documentId,
      versionNumber: nextNumber,
      snapshotJson,
      diffJson,
      authorKind: input.authorKind,
      authorId: input.authorId ?? null,
      label: input.label ?? null,
    },
  });

  await prisma.planningDocument.update({
    where: { id: input.documentId },
    data: { currentVersionId: created.id },
  });

  return { version: created, reused: false as const };
}

// ---------- diff ----------

export function diffSnapshots(
  a: DocumentSnapshot,
  b: DocumentSnapshot,
  meta: { fromVersion: number | null; toVersion: number },
): DocumentDiff {
  const byKeyA = Object.fromEntries(a.sections.map((s) => [s.sectionKey, s]));
  const byKeyB = Object.fromEntries(b.sections.map((s) => [s.sectionKey, s]));
  const allKeys = new Set<string>([...Object.keys(byKeyA), ...Object.keys(byKeyB)]);

  const sections: SectionDiff[] = [];
  let totalChanges = 0;

  for (const key of Array.from(allKeys).sort(compareByOrdem(byKeyA, byKeyB))) {
    const av = byKeyA[key];
    const bv = byKeyB[key];
    if (!av && bv) {
      sections.push({
        sectionKey: key,
        changeKind: "added",
        summary: `Seção adicionada (${bv.contentMd.length} caracteres).`,
        lines: linesOf(bv.contentMd).map((l) => ({ op: "add", content: l })),
      });
      totalChanges++;
      continue;
    }
    if (av && !bv) {
      sections.push({
        sectionKey: key,
        changeKind: "removed",
        summary: "Seção removida.",
        lines: linesOf(av.contentMd).map((l) => ({ op: "del", content: l })),
      });
      totalChanges++;
      continue;
    }
    if (!av || !bv) continue;
    if (av.contentMd === bv.contentMd && av.status === bv.status) {
      sections.push({
        sectionKey: key,
        changeKind: "unchanged",
        summary: statusSummary(av.status),
      });
      continue;
    }
    const lines = diffLines(av.contentMd, bv.contentMd);
    const added = lines.filter((l) => l.op === "add").length;
    const removed = lines.filter((l) => l.op === "del").length;
    sections.push({
      sectionKey: key,
      changeKind: "modified",
      summary:
        av.status !== bv.status
          ? `${statusSummary(bv.status)} · +${added} / -${removed} linhas`
          : `+${added} / -${removed} linhas`,
      lines,
    });
    totalChanges++;
  }

  return {
    fromVersion: meta.fromVersion,
    toVersion: meta.toVersion,
    sections,
    totalChanges,
  };
}

function statusSummary(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "confirmada";
    case "DRAFTED":
      return "rascunho";
    case "IN_PROGRESS":
      return "em rascunho";
    case "SKIPPED_WITH_JUSTIFICATION":
      return "dispensada";
    default:
      return status.toLowerCase();
  }
}

function compareByOrdem(
  a: Record<string, SectionSnapshot>,
  b: Record<string, SectionSnapshot>,
) {
  return (k1: string, k2: string) => {
    const o1 = (a[k1] ?? b[k1]).ordem;
    const o2 = (a[k2] ?? b[k2]).ordem;
    return o1 - o2;
  };
}

function linesOf(s: string): string[] {
  if (!s) return [];
  return s.split(/\r?\n/);
}

/**
 * LCS line-based simples. Produz array de DiffLine.
 * Complexidade O(n·m); ok para textos de seção (até ~350 linhas).
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = linesOf(before);
  const b = linesOf(after);
  const n = a.length;
  const m = b.length;
  // matriz LCS
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "equal", content: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: "del", content: a[i] });
      i++;
    } else {
      out.push({ op: "add", content: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: "del", content: a[i++] });
  while (j < m) out.push({ op: "add", content: b[j++] });
  return out;
}
