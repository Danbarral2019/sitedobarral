import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/cache/rate-limit-helper";
import { zExportBody } from "@/data/planejamento/types";
import { exportArtifacts } from "@/lib/planejamento/export";
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";
import { uploadToR2, getSignedR2Url } from "@/lib/storage/r2-client";

interface Ctx {
  params: Promise<{ id: string }>;
  user: { userId: string };
}

export const GET = withAuth(async (_request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    select: { id: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  const exports = await prisma.planningExport.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const withUrls = await Promise.all(
    exports.map(async (e) => ({
      id: e.id,
      format: e.format,
      sizeBytes: e.sizeBytes,
      createdAt: e.createdAt,
      signedUrl: await safeSignedUrl(e.r2Key),
    })),
  );
  return NextResponse.json({ exports: withUrls });
});

export const POST = withAuth(async (request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  await enforceRateLimit(`planejamento:export:${userId}`, 5, 60);

  const body = await request.json().catch(() => ({}));
  const parsed = zExportBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    include: {
      session: {
        include: {
          trailTemplate: true,
          decisionRuns: { orderBy: { executedAt: "desc" }, take: 1 },
        },
      },
      sections: { orderBy: { ordem: "asc" } },
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  const trail = resolveTrail(
    doc.session.natureza,
    doc.type,
    doc.session.trailTemplate?.definitionJsonCache,
  );

  const { artifacts } = await exportArtifacts(
    {
      session: {
        id: doc.session.id,
        titulo: doc.session.titulo,
        natureza: doc.session.natureza,
      },
      document: {
        type: doc.type,
        sections: doc.sections.map((s) => ({
          sectionKey: s.sectionKey,
          ordem: s.ordem,
          status: s.status,
          contentMd: s.contentMd,
          justificationSkipped: s.justificationSkipped,
          sourcesJson: s.sourcesJson,
        })),
      },
      trail,
      decisionRun: doc.session.decisionRuns[0] ?? null,
    },
    parsed.data.formats,
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTitle = slugify(doc.session.titulo).slice(0, 40) || "documento";

  const records = [];
  for (const art of artifacts) {
    const key = `planejamento/${userId}/${doc.id}/${timestamp}-${doc.type.toLowerCase()}-${safeTitle}.${art.extension}`;
    try {
      await uploadToR2(key, art.buffer, {
        contentType: art.contentType,
        cacheControl: "private, no-cache",
        metadata: {
          sessionId: doc.session.id,
          documentId: doc.id,
          documentType: doc.type,
          format: art.format,
          userId,
        },
      });
      const checksum = crypto
        .createHash("sha256")
        .update(art.buffer)
        .digest("hex");
      const rec = await prisma.planningExport.create({
        data: {
          documentId: doc.id,
          format: art.format,
          r2Key: key,
          sizeBytes: art.buffer.byteLength,
          checksum,
        },
      });
      records.push({
        ...rec,
        signedUrl: await safeSignedUrl(key),
      });
    } catch (err) {
      console.error("[planejamento/exports] falhou upload", art.format, err);
      return NextResponse.json(
        {
          error:
            err instanceof Error && err.message.includes("R2")
              ? "Cloudflare R2 não configurado — defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET_NAME para habilitar exportação."
              : `Falha ao exportar formato ${art.format}`,
        },
        { status: 500 },
      );
    }
  }

  await prisma.planningSession.update({
    where: { id: doc.session.id },
    data: { status: "EXPORT" },
  });

  return NextResponse.json({ exports: records }, { status: 201 });
});

function resolveTrail(
  natureza: string | null,
  type: string,
  cache: string | null | undefined,
): TrailDefinition | null {
  if (cache) {
    try {
      return JSON.parse(cache) as TrailDefinition;
    } catch {
      /* ignore */
    }
  }
  if (natureza === "SERVICO_CONTINUADO") {
    return (
      getTrailBySlug(
        type === "TR"
          ? "servico-comum-continuado-tr"
          : "servico-comum-continuado-etp",
      ) ?? null
    );
  }
  return null;
}

async function safeSignedUrl(key: string): Promise<string | null> {
  try {
    return await getSignedR2Url(key, 60 * 60, "GET");
  } catch {
    return null;
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
