import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { withUserApi } from "@/lib/api/handler";
import { ApiError, NotFoundError, ValidationError } from "@/lib/errors/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/cache/rate-limit-helper";
import { zExportBody } from "@/data/planejamento/types";
import { exportArtifacts } from "@/lib/planejamento/export";
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";
import { uploadToR2, getSignedR2Url } from "@/lib/storage/r2-client";

export const GET = withUserApi<{ id: string }>(async (_request, { params, user, logger }) => {
  const { id } = params;
  const userId = user.userId;
  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    select: { id: true },
  });
  if (!doc) {
    throw new NotFoundError("Documento");
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
      signedUrl: await safeSignedUrl(e.r2Key, logger),
    })),
  );
  return NextResponse.json({ exports: withUrls });
});

export const POST = withUserApi<{ id: string }>(async (request, { params, user, logger }) => {
  const { id } = params;
  const userId = user.userId;
  await enforceRateLimit(`planejamento:export:${userId}`, 5, 60);

  const body = await request.json().catch(() => ({}));
  const parsed = zExportBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Dados inválidos", parsed.error.issues);
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
    throw new NotFoundError("Documento");
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
        signedUrl: await safeSignedUrl(key, logger),
      });
    } catch (err) {
      logger.error({ err, format: art.format }, "[planejamento/exports] falhou upload");
      if (err instanceof Error && err.message.includes("R2")) {
        throw new ApiError(
          500,
          "Cloudflare R2 não configurado — defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET_NAME para habilitar exportação.",
          "R2_NOT_CONFIGURED",
        );
      }
      throw new ApiError(500, `Falha ao exportar formato ${art.format}`, "EXPORT_FAILED");
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

async function safeSignedUrl(
  key: string,
  logger?: { warn: (obj: unknown, msg?: string) => void },
): Promise<string | null> {
  try {
    return await getSignedR2Url(key, 60 * 60, "GET");
  } catch (err) {
    logger?.warn({ err, key }, "[planejamento/exports] signedUrl falhou");
    return null;
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
