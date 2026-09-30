/**
 * Gravação do histórico de busca do assistente pelo SERVIDOR (30/09/2026).
 *
 * Antes, o cliente enviava a resposta da IA e as fontes para
 * `POST /api/area-restrita/search-history`, e o compartilhamento público
 * (`/busca/[shareId]`) exibia esse conteúdo: qualquer usuário logado podia
 * publicar, no domínio do site, uma "resposta do assistente" que ele mesmo
 * escreveu. Agora a rota que gerou a resposta grava a entrada, marcada com
 * `respostaDoServidor = true`, e só essas entradas podem ser compartilhadas.
 */
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';

export interface FonteDoHistorico {
  title: string;
  category: string;
  url?: string;
}

export interface FonteLegalDoHistorico {
  type: string;
  title: string;
  url: string;
}

export interface EntradaDoHistorico {
  userId: string;
  type: 'documents' | 'jurisprudencia';
  query: string;
  filters?: unknown;
  aiAnswer: string | null;
  sources?: FonteDoHistorico[] | null;
  legalSources?: FonteLegalDoHistorico[] | null;
}

/** Formato do shareId novo: base64url de 16 bytes (128 bits) = 22 caracteres. */
export const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{22}$/;

/** Links antigos (8 caracteres) e qualquer outro formato deixam de abrir. */
export function shareIdValido(shareId: unknown): shareId is string {
  return typeof shareId === 'string' && SHARE_ID_REGEX.test(shareId);
}

/** Histórico desligado por env (mesma chave que o endpoint antigo respeitava). */
export function historicoDeBuscaDesligado(): boolean {
  return process.env.SEARCH_ANALYTICS_ENABLED === 'false';
}

/**
 * Grava a entrada e devolve o id, ou `null` se o histórico estiver desligado
 * ou a gravação falhar (nunca derruba a resposta ao usuário).
 */
export async function registrarBuscaNoHistorico(entrada: EntradaDoHistorico): Promise<string | null> {
  if (historicoDeBuscaDesligado()) return null;
  const query = entrada.query.trim();
  if (!query) return null;

  try {
    const entry = await prisma.searchHistory.create({
      data: {
        userId: entrada.userId,
        type: entrada.type,
        query,
        filters: entrada.filters ? JSON.stringify(entrada.filters) : null,
        aiAnswer: entrada.aiAnswer,
        sources: entrada.sources ? JSON.stringify(entrada.sources) : null,
        legalSources: entrada.legalSources ? JSON.stringify(entrada.legalSources) : null,
        respostaDoServidor: true,
      },
      select: { id: true },
    });
    return entry.id;
  } catch (err) {
    apiLogger.error({ err, userId: entrada.userId, type: entrada.type }, 'Falha ao gravar a busca no SearchHistory');
    return null;
  }
}

export interface BuscaCompartilhada {
  query: string;
  aiAnswer: string | null;
  sources: FonteDoHistorico[];
  legalSources: FonteLegalDoHistorico[];
  createdAt: Date;
}

function parseLista<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Busca compartilhada pelo shareId (página /busca/[shareId] e API pública).
 * `null` quando o formato não é o novo (links antigos de 8 caracteres), o
 * compartilhamento não existe ou a resposta não foi gravada pelo servidor.
 */
export async function buscarCompartilhamento(shareId: unknown): Promise<BuscaCompartilhada | null> {
  if (!shareIdValido(shareId)) return null;

  const entry = await prisma.searchHistory.findFirst({
    where: { shareId, isPublic: true, respostaDoServidor: true },
    select: { query: true, aiAnswer: true, sources: true, legalSources: true, createdAt: true },
  });
  if (!entry) return null;

  return {
    query: entry.query,
    aiAnswer: entry.aiAnswer,
    sources: parseLista<FonteDoHistorico>(entry.sources),
    legalSources: parseLista<FonteLegalDoHistorico>(entry.legalSources),
    createdAt: entry.createdAt,
  };
}
