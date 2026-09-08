/**
 * Quota anti-abuso do Assistente IA
 *
 * Objetivo: transformar "risco de custo ilimitado de Claude/Gemini" em
 * "custo previsível por usuário". Complementa o throttle anti-burst (10/min)
 * existente com quota diária + mensal por tier.
 *
 * Camadas:
 * - A (existente): anti-burst 10/min por usuário (checkRateLimit).
 * - B (aqui): quota diária + mensal por usuário, por tier.
 * - C (aqui): kill-switch global de custo (AI_DAILY_GLOBAL_CAP).
 *
 * Ao estourar a quota do tier, o caminho de produção degrada para o
 * fallback Gemini (mais barato) em vez de bloquear; o kill-switch global
 * degrada para busca-sem-IA. Ver o plano em
 * docs/superpowers/plans/2026-07-07-quota-anti-abuso-assistente-ia.md
 */

import { prisma } from '@/lib/prisma';
import { getCache, setCache, incrementCache } from '@/lib/cache/redis-client';
import { apiLogger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

// ===========================
// Tiers e limites
// ===========================

export type AiTier = 'admin' | 'premium' | 'basico' | 'trial';

export interface QuotaLimit {
  /** Máximo de respostas de IA por dia (UTC). */
  daily: number;
  /** Máximo de respostas de IA por mês (UTC). */
  monthly: number;
}

/**
 * Tetos anti-abuso por tier (alinhados à margem — decisão de 2026-07-08).
 * NÃO são orçamento do usuário mediano (que faz ~20-50/mês); são o teto da cauda.
 * Admin é ilimitado.
 */
export const AI_QUOTA_LIMITS: Record<AiTier, QuotaLimit> = {
  admin: { daily: Infinity, monthly: Infinity },
  premium: { daily: 40, monthly: 250 },
  basico: { daily: 20, monthly: 100 },
  trial: { daily: 30, monthly: 100 },
};

// ===========================
// Resolução de tier
// ===========================

/** TTL do cache de tier por usuário (segundos). Curto para refletir upgrades rápido. */
const TIER_CACHE_TTL = 60;

/** Chave de cache do tier de um usuário. */
function tierCacheKey(userId: string): string {
  return `ai:tier:${userId}`;
}

/**
 * Resolve o tier de IA do usuário.
 *
 * Admin (via role do JWT) tem bypass e não consulta o banco. Caso contrário,
 * consulta as subscriptions ativas: premium tem precedência sobre básico;
 * sem subscription paga ativa, o usuário é tratado como trial/QR (grátis).
 *
 * O resultado é cacheado por {@link TIER_CACHE_TTL}s para não bater no banco a
 * cada pergunta durante uma rajada de uso.
 *
 * @param userId - id do usuário autenticado
 * @param role - role do JWT ('admin' | 'student'); 'admin' faz bypass
 */
export async function resolveUserAiTier(
  userId: string,
  role?: string,
): Promise<AiTier> {
  if (role === 'admin') return 'admin';

  const cacheKey = tierCacheKey(userId);
  const cached = await getCache<AiTier>(cacheKey);
  if (cached) return cached;

  const subs = await prisma.subscription.findMany({
    where: { userId, status: 'active' },
    select: { plan: true },
  });

  let tier: AiTier = 'trial';
  if (subs.some((s) => s.plan === 'premium')) tier = 'premium';
  else if (subs.some((s) => s.plan === 'basico')) tier = 'basico';

  await setCache(cacheKey, tier, TIER_CACHE_TTL);
  return tier;
}

// ===========================
// Enforcement da quota (Camada B)
// ===========================

/**
 * Decisão do enforcement de quota. A rota de IA consome `action`:
 * - `allow`: dentro da quota → caminho premium (Claude Sonnet 5 + Citations).
 * - `degrade-gemini`: estourou a quota do tier → responder via fallback Gemini
 *   (muito mais barato); ainda entrega resposta de IA, sem citações verificáveis.
 * - `degrade-search`: kill-switch global de custo → busca crua (FTS), sem card de IA.
 */
export type AiQuotaDecision =
  | { action: 'allow' }
  | { action: 'degrade-gemini'; reason: 'daily' | 'monthly' }
  | { action: 'degrade-search'; reason: 'global' };

/** Chave do contador diário por usuário (janela UTC). */
function dayKey(userId: string, now: Date): string {
  return `ai:quota:d:${userId}:${now.toISOString().slice(0, 10)}`; // YYYY-MM-DD
}

/** Chave do contador mensal por usuário (janela UTC). */
function monthKey(userId: string, now: Date): string {
  return `ai:quota:m:${userId}:${now.toISOString().slice(0, 7)}`; // YYYY-MM
}

/** Chave do contador global diário de respostas de IA (kill-switch de custo). */
function globalKey(now: Date): string {
  return `ai:quota:global:${now.toISOString().slice(0, 10)}`; // YYYY-MM-DD
}

/** Teto global padrão (conservador — decisão de 2026-07-08). */
const DEFAULT_GLOBAL_CAP = 2000;

/** Lê o teto global do env `AI_DAILY_GLOBAL_CAP`, com fallback conservador. */
function getGlobalCap(): number {
  const raw = process.env.AI_DAILY_GLOBAL_CAP;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GLOBAL_CAP;
}

/** Segundos até o fim do dia UTC (usado como TTL da chave diária). */
function secondsUntilEndOfUtcDay(now: Date): number {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((end - now.getTime()) / 1000));
}

/** Segundos até o fim do mês UTC (usado como TTL da chave mensal). */
function secondsUntilEndOfUtcMonth(now: Date): number {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((end - now.getTime()) / 1000));
}

async function incrementAiQuotaCounter(
  key: string,
  ttl: number,
  scope: 'global' | 'daily' | 'monthly',
): Promise<number | null> {
  try {
    return await incrementCache(key, ttl, { failureMode: 'closed' });
  } catch (error) {
    apiLogger.warn(
      { event: 'ai.quota.unavailable', action: 'degrade-search', scope, err: error },
      'Contador de quota de IA indisponível, síntese degradada para busca',
    );
    return null;
  }
}

/**
 * Camada C — kill-switch global de custo, isolado. Conta TODA resposta de IA do
 * site (Claude + Gemini) num contador global diário; ao ultrapassar
 * `AI_DAILY_GLOBAL_CAP`, retorna `degrade-search` (busca-sem-IA em todo o site).
 * Alerta Sentry ao cruzar 80% do cap (uma vez). Reutilizado pelas rotas públicas
 * de IA (chat de artigo, busca da Lei 14.133), que não têm usuário/tier.
 *
 * @param now - instante de referência (injetável para testes); default agora
 */
export async function enforceGlobalAiCap(
  now: Date = new Date(),
): Promise<AiQuotaDecision> {
  const cap = getGlobalCap();
  const globalCount = await incrementAiQuotaCounter(
    globalKey(now),
    secondsUntilEndOfUtcDay(now),
    'global',
  );
  if (globalCount === null) return { action: 'degrade-search', reason: 'global' };
  if (globalCount === Math.floor(cap * 0.8)) {
    Sentry.captureMessage('ai.quota.global.threshold_80', {
      level: 'warning',
      extra: { globalCount, cap },
    });
  }
  if (globalCount > cap) {
    // Loga só no cruzamento (uma vez/dia), não a cada request degradada.
    if (globalCount === cap + 1) {
      apiLogger.warn(
        { event: 'ai.quota.degraded', action: 'degrade-search', reason: 'global', globalCount, cap },
        'Kill-switch global de custo acionado — síntese IA degradada para busca no site inteiro',
      );
    }
    return { action: 'degrade-search', reason: 'global' };
  }
  return { action: 'allow' };
}

/**
 * Aplica o kill-switch global (Camada C) + a quota diária + mensal por tier
 * (Camada B) e retorna a decisão de degradação.
 *
 * Contadores atômicos via Redis `incr` (o TTL é setado só na 1ª chamada do
 * período pelo helper `incrementCache`). Se o diário estoura, o mensal NÃO é
 * consumido. Admin tem bypass total. Ao estourar o tier, degrada para o Gemini
 * (não bloqueia — decisão de 2026-07-08).
 *
 * @param userId - id do usuário autenticado
 * @param role - role do JWT ('admin' faz bypass)
 * @param now - instante de referência (injetável para testes); default agora
 */
export async function enforceAiQuota(
  userId: string,
  role?: string,
  now: Date = new Date(),
): Promise<AiQuotaDecision> {
  const tier = await resolveUserAiTier(userId, role);
  if (tier === 'admin') return { action: 'allow' };

  // Camada C — kill-switch global (mais agressivo, site-wide).
  const globalDecision = await enforceGlobalAiCap(now);
  if (globalDecision.action !== 'allow') return globalDecision;

  // Camada B — quota diária + mensal por tier.
  const limits = AI_QUOTA_LIMITS[tier];

  const dailyCount = await incrementAiQuotaCounter(
    dayKey(userId, now),
    secondsUntilEndOfUtcDay(now),
    'daily',
  );
  if (dailyCount === null) return { action: 'degrade-search', reason: 'global' };
  if (dailyCount > limits.daily) {
    if (dailyCount === limits.daily + 1) {
      apiLogger.info(
        { event: 'ai.quota.degraded', action: 'degrade-gemini', reason: 'daily', userId, tier, count: dailyCount, limit: limits.daily },
        'Quota diária do tier atingida — resposta degradada para Gemini',
      );
    }
    return { action: 'degrade-gemini', reason: 'daily' };
  }

  const monthlyCount = await incrementAiQuotaCounter(
    monthKey(userId, now),
    secondsUntilEndOfUtcMonth(now),
    'monthly',
  );
  if (monthlyCount === null) return { action: 'degrade-search', reason: 'global' };
  if (monthlyCount > limits.monthly) {
    if (monthlyCount === limits.monthly + 1) {
      apiLogger.info(
        { event: 'ai.quota.degraded', action: 'degrade-gemini', reason: 'monthly', userId, tier, count: monthlyCount, limit: limits.monthly },
        'Quota mensal do tier atingida — resposta degradada para Gemini',
      );
    }
    return { action: 'degrade-gemini', reason: 'monthly' };
  }

  return { action: 'allow' };
}
