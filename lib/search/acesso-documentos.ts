/**
 * Regra única de visibilidade de Document para as superfícies de busca e
 * listagem (auditoria de acesso de 30/09/2026).
 *
 * Um não-admin vê o documento quando:
 * - `isPublic`; OU
 * - `isCommon` e tem acesso ativo (matrícula válida ou assinatura ativa); OU
 * - `courseId` é de um curso em que tem acesso válido; OU
 * - o documento é privado, sem curso e não comum, e há acesso ativo (mesma
 *   regra de `hasAccessToDocument` em lib/auth.ts).
 * Exceção: `acordao-grafo` (combustível do grafo de precedentes) nunca é
 * visível a não-admin. Admin vê tudo.
 *
 * Três formas da mesma regra, que precisam andar juntas:
 * - `podeVerDocumento` (pura, para pós-filtro em memória);
 * - `whereDocumentoVisivel` (Prisma, para findMany);
 * - `documentoVisivelSql` (SQL cru, para as buscas FTS/vetoriais).
 *
 * Matrícula válida = `isLifetime` OU `expiresAt` nulo (assinatura) OU
 * `expiresAt` no futuro — o critério de `hasAccessToCourse`.
 */
import type { Prisma } from '@prisma/client';
import { courses } from '@/data/courses';
import { CATEGORIA_GRAFO } from '@/lib/tcu/backfill-retroativo';
import type { AuthPayload } from '@/lib/auth';

export { CATEGORIA_GRAFO };

export interface AcessoDoUsuario {
  isAdmin: boolean;
  /** Matrícula válida em qualquer curso OU assinatura ativa. */
  temAcessoAtivo: boolean;
  /** Cursos com acesso válido (matrícula válida ou coberto por assinatura ativa). */
  cursosAtivos: string[];
}

/** Visitante sem sessão. */
export const ACESSO_ANONIMO: AcessoDoUsuario = Object.freeze({
  isAdmin: false,
  temAcessoAtivo: false,
  cursosAtivos: [],
}) as AcessoDoUsuario;

/** Campos de um Document que decidem a visibilidade. */
export interface DocumentoVisibilidade {
  isPublic: boolean;
  isCommon: boolean;
  courseId: string | null | undefined;
  category: string | null | undefined;
}

/** Filtro Prisma de matrícula válida (vitalícia, assinatura ou não vencida). */
export function whereMatriculaValida(agora: Date = new Date()): Prisma.EnrollmentWhereInput {
  return {
    OR: [
      { isLifetime: true },
      { expiresAt: null },
      { expiresAt: { gt: agora } },
    ],
  };
}

interface AcessoDeps {
  prisma: {
    enrollment: { findMany: (args: Prisma.EnrollmentFindManyArgs) => Promise<Array<{ courseId: string }>> };
    subscription: {
      findMany: (args: Prisma.SubscriptionFindManyArgs) => Promise<Array<{ plan: string; courseId: string | null }>>;
    };
  };
}

async function prismaPadrao(): Promise<AcessoDeps['prisma']> {
  const { prisma } = await import('@/lib/prisma');
  return prisma as unknown as AcessoDeps['prisma'];
}

/**
 * Resolve o acesso do usuário a partir do payload do JWT (userId + role).
 * `null` = visitante anônimo. Admin não consulta o banco.
 */
export async function getAcessoDoUsuario(
  user: Pick<AuthPayload, 'userId' | 'role'> | null | undefined,
  deps?: Partial<AcessoDeps>,
): Promise<AcessoDoUsuario> {
  if (!user) return { ...ACESSO_ANONIMO, cursosAtivos: [] };
  if (user.role === 'admin') {
    return { isAdmin: true, temAcessoAtivo: true, cursosAtivos: courses.map((c) => c.id) };
  }

  const db = deps?.prisma ?? (await prismaPadrao());
  const [matriculas, assinaturas] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: user.userId, ...whereMatriculaValida() },
      select: { courseId: true },
    }),
    db.subscription.findMany({
      where: { userId: user.userId, status: 'active' },
      select: { plan: true, courseId: true },
    }),
  ]);

  const cursos = new Set(matriculas.map((m) => m.courseId));
  for (const a of assinaturas) {
    if (a.plan === 'premium') courses.forEach((c) => cursos.add(c.id));
    else if (a.courseId) cursos.add(a.courseId);
  }

  return {
    isAdmin: false,
    temAcessoAtivo: matriculas.length > 0 || assinaturas.length > 0,
    cursosAtivos: [...cursos],
  };
}

/** Versão pura da regra, para pós-filtro em memória. */
export function podeVerDocumento(doc: DocumentoVisibilidade, acesso: AcessoDoUsuario): boolean {
  if (acesso.isAdmin) return true;
  if (doc.category === CATEGORIA_GRAFO) return false;
  if (doc.isPublic) return true;
  if (doc.isCommon) return acesso.temAcessoAtivo;
  if (doc.courseId) return acesso.cursosAtivos.includes(doc.courseId);
  return acesso.temAcessoAtivo;
}

/**
 * `where` Prisma equivalente a `podeVerDocumento`. Compor com o filtro do
 * chamador via `AND: [filtroDoChamador, whereDocumentoVisivel(acesso)]`.
 */
export function whereDocumentoVisivel(acesso: AcessoDoUsuario): Prisma.DocumentWhereInput {
  if (acesso.isAdmin) return {};

  const ramos: Prisma.DocumentWhereInput[] = [{ isPublic: true }];
  if (acesso.temAcessoAtivo) {
    ramos.push({ isCommon: true }, { courseId: null });
  }
  if (acesso.cursosAtivos.length > 0) {
    ramos.push({ courseId: { in: acesso.cursosAtivos } });
  }

  return {
    category: { not: CATEGORIA_GRAFO },
    OR: ramos,
  };
}

function literal(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/**
 * Fragmento SQL (sem parâmetros, literais escapados) equivalente a
 * `podeVerDocumento`, para as queries cruas sobre "Document". `alias` é o
 * prefixo da tabela (ex.: 'd'); vazio usa as colunas sem prefixo.
 */
export function documentoVisivelSql(acesso: AcessoDoUsuario, alias = ''): string {
  if (acesso.isAdmin) return 'TRUE';
  const p = alias ? `${alias}.` : '';

  const ramos = [`${p}"isPublic" = true`];
  if (acesso.temAcessoAtivo) {
    ramos.push(`${p}"isCommon" = true`, `${p}"courseId" IS NULL`);
  }
  if (acesso.cursosAtivos.length > 0) {
    ramos.push(`${p}"courseId" IN (${acesso.cursosAtivos.map(literal).join(', ')})`);
  }

  return `(${p}category <> ${literal(CATEGORIA_GRAFO)} AND (${ramos.join(' OR ')}))`;
}

/**
 * Pós-filtro de resultados de busca (vector/híbrida). Só os de
 * `sourceType === 'document'` passam pela regra; atos, decisões e teses têm
 * portões próprios na origem. `isPublic` ausente conta como privado (falha
 * fechada).
 */
export function filtrarResultadosVisiveis<
  T extends {
    sourceType?: string;
    isPublic?: boolean;
    isCommon: boolean;
    courseId?: string | null;
    category: string;
  },
>(results: T[], acesso: AcessoDoUsuario): T[] {
  if (acesso.isAdmin) return results;
  return results.filter(
    (r) =>
      r.sourceType !== 'document' ||
      podeVerDocumento(
        { isPublic: r.isPublic === true, isCommon: r.isCommon, courseId: r.courseId ?? null, category: r.category },
        acesso,
      ),
  );
}
