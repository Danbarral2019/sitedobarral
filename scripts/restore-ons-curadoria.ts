/**
 * restore-ons-curadoria.ts
 *
 * Desfaz o que o cron import-documents fez nas ONs a partir de 21/07/2026:
 * para cada ON reescrita pelo detector 'scraper-ons-agu', volta cada campo ao
 * valor anterior registrado no changeDetails da PRIMEIRA versão pós-corte
 * (isPublic, url, description, content, douUrl, courseId, tags, type,
 * aiClassification...). Depois limpa links DOU que não pertencem à própria ON
 * (douUrl e DocumentMetaDou apontando para outra ON ou para portaria), herança
 * do erro de bloco do parser do portal AGU.
 *
 * Nenhuma ON é excluída. As ONs CRIADAS pelo cron depois do corte ficam como
 * estão (privadas) e vão para a lista de pendências.
 *
 * Validação (skill inclusao-documentos): toda URL DOU restaurada em `url` é
 * aberta ao vivo no --apply; se não abrir (HTTP ≠ 200) ou o título não trouxer
 * o número/ano da ON, a url NÃO é restaurada (o resto é) e a ON vai para
 * pendências. Por isso o --apply precisa rodar na máquina local.
 *
 * Uso (depois do merge da correção do cron, antes de terça 2h UTC):
 *   npx tsx scripts/restore-ons-curadoria.ts            # dry-run + relatório
 *   npx tsx scripts/restore-ons-curadoria.ts --apply    # grava + invalida cache
 *
 * Saída: docs/audits/<data>-ons-restauracao.{md,json}
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

const APPLY = process.argv.includes('--apply');
const CUTOFF = new Date('2026-07-21T00:00:00Z');
const DETECTOR = 'scraper-ons-agu';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const SPECIFIC_DOU = /in\.gov\.br\/(?:en\/)?web\/dou\/-\//i;

type Conv = (old: string) => unknown;
const str: Conv = (o) => o;
const strOrNull: Conv = (o) => (o === '' ? null : o);
const bool: Conv = (o) => o === 'true';
const dateOrNull: Conv = (o) => (o === '' ? null : new Date(o));

/** Campos do Document que o cron reescreveu e como converter o oldValue (gravado como String). */
const RESTORABLE: Record<string, Conv> = {
  title: str,
  description: strOrNull,
  url: str,
  type: str,
  alternativeUrls: strOrNull,
  isPublic: bool,
  reviewed: bool,
  isCommon: bool,
  courseId: strOrNull,
  tags: strOrNull,
  content: strOrNull,
  aiClassification: strOrNull,
  douUrl: strOrNull,
  douData: dateOrNull,
  douSecao: strOrNull,
  douPagina: strOrNull,
  douEdicao: strOrNull,
};

interface Change { field: string; oldValue: string; newValue: string }

/** Link DOU que é de OUTRO ato (outra ON, portaria...) — não pertence a esta ON. */
function isForeignDouLink(url: string | null | undefined, onNumber: number): boolean {
  if (!url || !SPECIFIC_DOU.test(url)) return false;
  const m = url.match(/\/-\/orientacao-normativa(?:-agu)?-n-0*(\d+)-de/i);
  return !m || Number(m[1]) !== onNumber;
}

async function validateDouLive(url: string, onNumber: number, onYear: number): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (r.status !== 200) return `HTTP ${r.status}`;
    const html = await r.text();
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toLowerCase();
    const ident = html.match(/class="identifica"[^>]*>([\s\S]*?)<\//i)?.[1] ?? '';
    // Página do próprio ato: título "ORIENTAÇÃO NORMATIVA [AGU] Nº N, DE ... DE ANO".
    const proprioAto = new RegExp(`orientacao normativa(?: agu)?(?: n[ºo°.]*)?\\s*0*${onNumber}\\s*,.*\\b${onYear}\\b`);
    if (proprioAto.test(norm(ident))) return null;
    // Ato que alterou a redação da ON (ex.: portaria que dá nova redação à ON 45/2014):
    // o texto tem que citar a ON pelo número e ano.
    const texto = norm(html.replace(/<script[\s\S]*?<\/script>|<[^>]+>/gi, ' '));
    const citaOn = new RegExp(`orientacao normativa(?: agu)?\\s+n[ºo°.]*\\s*0*${onNumber}\\b[^.]{0,80}${onYear}`);
    if (citaOn.test(texto)) return null;
    return `página não é a ON nem cita a ON ${onNumber}/${onYear}: "${ident.trim().slice(0, 80)}"`;
  } catch (e) {
    return `erro de rede: ${e instanceof Error ? e.message : e}`;
  }
}

async function main() {
  const ons = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    include: { metaDou: true },
    orderBy: [{ onYear: 'asc' }, { onNumber: 'asc' }],
  });

  type Plan = {
    id: string;
    on: string;
    onNumber: number;
    onYear: number;
    data: Record<string, unknown>;
    campos: string[];
    urlRestaurada?: string;
    limparDouUrl: boolean;
    limparMetaDou: boolean;
    pendencia?: string;
  };
  const plans: Plan[] = [];
  const criadasPeloCron: string[] = [];

  for (const doc of ons) {
    const on = `${doc.onNumber}/${doc.onYear}`;
    const versions = await prisma.documentVersion.findMany({
      where: { documentId: doc.id, detectedBy: DETECTOR, detectedAt: { gte: CUTOFF } },
      orderBy: { versionNumber: 'desc' },
    });

    if (versions.some((v) => v.changeType === 'created')) {
      criadasPeloCron.push(on);
      continue;
    }

    // Aplica os oldValues da mais recente para a mais antiga: vence o valor
    // anterior à PRIMEIRA reescrita pós-corte.
    const data: Record<string, unknown> = {};
    for (const v of versions) {
      const changes = JSON.parse(v.changeDetails ?? '[]') as Change[];
      for (const c of changes) {
        const conv = RESTORABLE[c.field];
        if (conv) data[c.field] = conv(c.oldValue);
      }
    }

    const urlRestaurada = typeof data.url === 'string' && SPECIFIC_DOU.test(data.url) ? data.url : undefined;
    const douFinal = (data.douUrl as string | null | undefined) ?? (('douUrl' in data) ? null : doc.douUrl);
    const limparDouUrl = isForeignDouLink(douFinal, doc.onNumber!);
    const limparMetaDou = !!doc.metaDou && isForeignDouLink(doc.metaDou.url, doc.onNumber!);
    if (limparDouUrl) data.douUrl = null;

    if (Object.keys(data).length === 0 && !limparMetaDou) continue;
    plans.push({
      id: doc.id,
      on,
      onNumber: doc.onNumber!,
      onYear: doc.onYear!,
      data,
      campos: Object.keys(data),
      urlRestaurada,
      limparDouUrl,
      limparMetaDou,
    });
  }

  // Validação ao vivo das URLs DOU a restaurar (só no --apply; no dry-run
  // ficam marcadas como "a validar").
  if (APPLY) {
    for (const p of plans) {
      if (!p.urlRestaurada) continue;
      const erro = await validateDouLive(p.urlRestaurada, p.onNumber, p.onYear);
      if (erro) {
        delete p.data.url;
        delete p.data.type;
        p.campos = Object.keys(p.data);
        p.pendencia = `link DOU não restaurado (${erro}): ${p.urlRestaurada}`;
        p.urlRestaurada = undefined;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const count = (f: (p: Plan) => boolean) => plans.filter(f).length;
  const resumo = {
    onsARestaurar: plans.length,
    voltamAPublicas: count((p) => p.data.isPublic === true),
    linksDouRestaurados: count((p) => !!p.urlRestaurada),
    textoIntegralRestaurado: count((p) => typeof p.data.content === 'string' && (p.data.content as string).length > 0),
    douUrlDeOutraOnLimpo: count((p) => p.limparDouUrl),
    metaDouDeOutraOnLimpo: count((p) => p.limparMetaDou),
    pendencias: count((p) => !!p.pendencia),
    criadasPeloCronNaoTocadas: criadasPeloCron,
  };

  console.log('='.repeat(60));
  console.log(`RESTORE-ONS-CURADORIA — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));
  console.log(resumo);

  if (APPLY) {
    let ok = 0;
    for (const p of plans) {
      try {
        await prisma.document.update({ where: { id: p.id }, data: p.data });
        if (p.limparMetaDou) {
          await prisma.documentMetaDou.update({
            where: { documentId: p.id },
            data: { url: null, data: null, secao: null, pagina: null, edicao: null },
          });
        }
        ok++;
      } catch (e) {
        p.pendencia = `erro ao gravar: ${e instanceof Error ? e.message : e}`;
      }
    }
    console.log(`\nGravadas: ${ok} de ${plans.length}`);

    const { CacheInvalidation } = await import('../lib/cache/redis-client');
    await CacheInvalidation.courseDocuments();
    await CacheInvalidation.vectorSearch();
    await CacheInvalidation.synthesizedAnswers();
    console.log('Cache invalidado.');
  }

  const today = new Date().toISOString().slice(0, 10);
  const outBase = path.join(process.cwd(), 'docs', 'audits', `${today}-ons-restauracao${APPLY ? '-apply' : ''}`);
  fs.writeFileSync(`${outBase}.json`, JSON.stringify({ geradoEm: new Date().toISOString(), apply: APPLY, resumo, plans }, null, 2));
  const md = [
    `# Restauração das ONs reescritas pelo cron (${today}, ${APPLY ? 'apply' : 'dry-run'})`,
    '',
    '```',
    JSON.stringify(resumo, null, 2),
    '```',
    '',
    '| ON | Pública | Link DOU restaurado | Campos | douUrl alheio limpo | metaDou alheio limpo | Pendência |',
    '|---|---|---|---|---|---|---|',
    ...plans.map(
      (p) =>
        `| ${p.on} | ${p.data.isPublic === true ? 'sim' : '='} | ${p.urlRestaurada ?? ''}${!APPLY && p.urlRestaurada ? ' (a validar)' : ''} | ${p.campos.join(', ')} | ${p.limparDouUrl ? 'sim' : ''} | ${p.limparMetaDou ? 'sim' : ''} | ${p.pendencia ?? ''} |`,
    ),
    '',
  ].join('\n');
  fs.writeFileSync(`${outBase}.md`, md);
  console.log(`Relatório: ${outBase}.md`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
