import { NextRequest, NextResponse } from "next/server";
import { withAdminApi } from "@/lib/api/handler";
import { ValidationError, NotFoundError } from "@/lib/errors/api-error";
import { prisma } from "@/lib/prisma";
import { PLANNING_TRAILS, getTrailBySlug } from "@/data/planejamento/trails";
import { zTrailDefinition } from "@/data/planejamento/types";

/**
 * GET /api/planejamento/admin/trails
 * Retorna o catálogo TS (fonte de curadoria) mesclado com o estado atual do
 * DB — quais estão publicadas, em que versão, e quando.
 */
export const GET = withAdminApi(async () => {
  const dbTemplates = await prisma.planningTrailTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  const dbBySlug = Object.fromEntries(dbTemplates.map((t) => [t.slug, t]));

  const trails = PLANNING_TRAILS.map((t) => {
    const db = dbBySlug[t.slug];
    return {
      slug: t.slug,
      title: t.title,
      natureza: t.natureza,
      documentType: t.documentType,
      catalogVersion: t.version,
      publishedVersion: db?.publishedAt ? db.version : null,
      publishedAt: db?.publishedAt ?? null,
      templateId: db?.id ?? null,
      needsUpdate: db?.publishedAt ? db.version !== t.version : true,
      sectionsCount: t.sections.length,
    };
  });
  return NextResponse.json({ trails });
});

/**
 * POST /api/planejamento/admin/trails/publish
 * Body: { slug: string, changelogMd?: string }
 * Publica a versão atual do catálogo TS no DB, incrementando a versão se já
 * existir um registro com `definitionJsonCache` distinto.
 */
export const POST = withAdminApi(async (request: NextRequest, ctx) => {
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug : "";
  const changelogMd =
    typeof body.changelogMd === "string" ? body.changelogMd : null;
  if (!slug) {
    throw new ValidationError("slug obrigatório");
  }
  const trail = getTrailBySlug(slug);
  if (!trail) {
    throw new NotFoundError("trilha");
  }
  const validated = zTrailDefinition.safeParse(trail);
  if (!validated.success) {
    throw new ValidationError("trilha inválida", { issues: validated.error.issues });
  }
  const userId = ctx.user.userId;
  const existing = await prisma.planningTrailTemplate.findUnique({
    where: { slug },
  });
  const snapshot = JSON.stringify(validated.data);

  if (!existing) {
    const created = await prisma.planningTrailTemplate.create({
      data: {
        slug,
        natureza: trail.natureza,
        documentType: trail.documentType,
        version: trail.version,
        definitionJsonCache: snapshot,
        changelogMd,
        authorId: userId,
        publishedAt: new Date(),
      },
    });
    await upsertSectionTemplates(created.id, trail);
    return NextResponse.json({ template: created, created: true });
  }

  const nextVersion =
    existing.definitionJsonCache === snapshot
      ? existing.version
      : Math.max(existing.version + 1, trail.version);
  const updated = await prisma.planningTrailTemplate.update({
    where: { slug },
    data: {
      version: nextVersion,
      natureza: trail.natureza,
      documentType: trail.documentType,
      definitionJsonCache: snapshot,
      changelogMd,
      authorId: userId,
      publishedAt: new Date(),
    },
  });
  await upsertSectionTemplates(updated.id, trail);
  return NextResponse.json({ template: updated, created: false });
});

async function upsertSectionTemplates(
  trailTemplateId: string,
  trail: ReturnType<typeof getTrailBySlug> & object,
) {
  for (const s of trail.sections) {
    await prisma.planningSectionTemplate.upsert({
      where: {
        trailTemplateId_sectionKey: {
          trailTemplateId,
          sectionKey: s.key,
        },
      },
      create: {
        trailTemplateId,
        sectionKey: s.key,
        promptTemplateMd: s.promptSpec.userTemplate,
        ragFilterJson: JSON.stringify(s.ragFilter),
        placeholderTextMd: null,
      },
      update: {
        promptTemplateMd: s.promptSpec.userTemplate,
        ragFilterJson: JSON.stringify(s.ragFilter),
      },
    });
  }
}
