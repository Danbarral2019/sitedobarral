/**
 * Cron de saúde de dados do acervo. Roda checagens leves (só banco) que
 * detectam as classes de erro reais achadas em 12/07/2026 e alerta no Sentry
 * quando algo aparece — para nenhum "sentinela cego" deixar bug passar batido.
 *
 * Checagens:
 * - A) atos revoked que são falso positivo (revogador apenas ALTEROU o texto);
 * - B) decisões com leiArticlesArr mal formatado ("Art. N") = regressão do
 *      classifier de tribunais.
 *
 * Schedule em vercel.json. Auth via CRON_SECRET (verifyCronAuth).
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import {
  isArtigoMalFormatado,
  isArtigoInexistente,
  revokerFromNote,
  contentMostraAlteracao,
} from '@/lib/data-health/checks';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function checkRevokedFalsePositives(): Promise<{ count: number; sample: string[] }> {
  const revoked = await prisma.legislativeAct.findMany({
    where: { revoked: true },
    select: { fullNumber: true, revokedNote: true, content: true },
  });
  const bad: string[] = [];
  for (const a of revoked) {
    const rev = revokerFromNote(a.revokedNote);
    if (rev && contentMostraAlteracao(a.content, rev)) bad.push(a.fullNumber);
  }
  return { count: bad.length, sample: bad.slice(0, 10) };
}

async function checkArtigoFormat(): Promise<{ count: number; sample: string[] }> {
  const decisions = await prisma.tribunalDecision.findMany({
    where: { leiArticlesArr: { isEmpty: false } },
    select: { tribunalCode: true, decisionNumber: true, leiArticlesArr: true },
  });
  const bad: string[] = [];
  for (const d of decisions) {
    if (d.leiArticlesArr.some(isArtigoMalFormatado)) bad.push(`${d.tribunalCode} ${d.decisionNumber}`);
  }
  return { count: bad.length, sample: bad.slice(0, 10) };
}

/**
 * Artigo bem formatado que a Lei 14.133 não tem. Separado de
 * `checkArtigoFormat` de propósito: a causa é outra — não é o formato que
 * regrediu, é o número que veio de outro diploma (`detectLeiArticles` casava
 * qualquer "art. N" do texto). Misturar os dois num contador só esconderia
 * qual dos dois defeitos voltou.
 */
async function checkArtigoInexistente(): Promise<{ count: number; sample: string[] }> {
  const decisions = await prisma.tribunalDecision.findMany({
    where: { leiArticlesArr: { isEmpty: false } },
    select: { tribunalCode: true, decisionNumber: true, leiArticlesArr: true },
  });
  const bad: string[] = [];
  for (const d of decisions) {
    // Um valor mal formatado já é reportado pelo outro check; não conta duas vezes.
    const orfaos = d.leiArticlesArr.filter((a) => !isArtigoMalFormatado(a) && isArtigoInexistente(a));
    if (orfaos.length > 0) bad.push(`${d.tribunalCode} ${d.decisionNumber} (${orfaos.join(', ')})`);
  }
  return { count: bad.length, sample: bad.slice(0, 10) };
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('data-health', async () => {
      const [revokedFP, artigoFmt, artigoInex] = await Promise.all([
        checkRevokedFalsePositives(),
        checkArtigoFormat(),
        checkArtigoInexistente(),
      ]);

      const problems: string[] = [];
      if (revokedFP.count > 0) {
        problems.push(`${revokedFP.count} ato(s) revoked = falso positivo (só alterados): ${revokedFP.sample.join(', ')}`);
      }
      if (artigoFmt.count > 0) {
        problems.push(`${artigoFmt.count} decisão(ões) com leiArticlesArr mal formatado ("Art. N" — regressão do classifier): ${artigoFmt.sample.join(', ')}`);
      }
      if (artigoInex.count > 0) {
        problems.push(`${artigoInex.count} decisão(ões) com artigo que a Lei 14.133 não tem (artigo de outro diploma amarrado): ${artigoInex.sample.join(', ')}`);
      }

      if (problems.length > 0) {
        Sentry.captureMessage(`data-health: ${problems.length} problema(s) de dados detectado(s). ${problems.join(' | ')}`, 'warning');
      }

      responseBody = {
        ok: problems.length === 0,
        checks: { revokedFalsePositives: revokedFP, artigoFormat: artigoFmt, artigoInexistente: artigoInex },
      };
      const total = revokedFP.count + artigoFmt.count + artigoInex.count;
      return {
        itemsFound: total,
        itemsError: total,
        metadata: { revokedFP: revokedFP.count, artigoFmt: artigoFmt.count, artigoInex: artigoInex.count },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
