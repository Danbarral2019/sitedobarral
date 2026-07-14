import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { detectChanges, saveDocumentVersion } from '../lib/agu-modules/versioning';

/**
 * backfill-ons-from-agu-page.ts
 *
 * Preenche LACUNAS das ONs a partir da página oficial da AGU (fonte autoritativa,
 * verificada 2026-07-14). Cirúrgico e não-destrutivo:
 *   - content: só preenche se o registro estiver VAZIO (<50 chars). Nunca sobrescreve.
 *   - douUrl : só preenche se VAZIO. Nunca sobrescreve.
 *   - douData: derivada do slug do DOU quando possível; douSecao='1'.
 *   - description (enunciado auditado) e url NÃO são tocados.
 * Atualiza apenas o registro PRINCIPAL (type='link') de cada ON — mesmo critério
 * do update-ons-revisadas.ts. Cria DocumentVersion e marca embeddingStatus='pending'.
 *
 * EXCLUI 104/2026 e 106/2026 (temas de pessoal, removidas a pedido — não reimportar).
 * Não cria ONs novas (backfill ≠ import). Sem --apply = dry-run.
 *
 * Uso:
 *   npx tsx scripts/backfill-ons-from-agu-page.ts            # dry-run
 *   npx tsx scripts/backfill-ons-from-agu-page.ts --apply    # grava
 *   depois:  npx tsx scripts/migrate-to-embeddings.ts --category orientacao-normativa
 */

const URL = 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';
const EXCLUIDAS = new Set(['104/2026', '106/2026']);
const CONTENT_MIN = 50;

const MES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

type PageON = { key: string; onNumber: number; onYear: number; corpo: string; douUrl: string | null };

function parseDouData(url: string | null): Date | null {
  if (!url) return null;
  const m = url.match(/-de-(\d{1,2})-de-([a-zç]+)-de-(\d{4})/i);
  if (!m) return null;
  const mes = MES[m[2].toLowerCase()];
  if (!mes) return null;
  return new Date(Date.UTC(parseInt(m[3], 10), mes - 1, parseInt(m[1], 10)));
}

function decodeBest(buf: Buffer): string {
  // O servidor é inconsistente (ora utf-8, ora iso-8859-1). Decodifica das duas
  // formas e escolhe a com MENOS artefatos: utf-8 errado gera "�"; latin-1 errado
  // (bytes utf-8 lidos como latin-1) gera sequências "Ã./Â.".
  const utf8 = buf.toString('utf-8');
  const latin1 = buf.toString('latin1');
  const badUtf8 = (utf8.match(/�/g) || []).length;
  const badLatin1 = (latin1.match(/[ÃÂ][\x80-\xBF -¿]/g) || []).length;
  return badUtf8 <= badLatin1 ? utf8 : latin1;
}

async function fetchPage(): Promise<string> {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return decodeBest(Buffer.from(await res.arrayBuffer()));
}

function parse(html: string): PageON[] {
  const $ = cheerio.load(html);
  const out: PageON[] = [];
  $('.on-card').each((_, el) => {
    const card = $(el);
    const m = card.find('.on-titulo').text().match(/Normativa\s+n?[º°.]?\s*(\d+)\s*\/\s*(\d{4})/i);
    if (!m) return;
    const href = card.find('.on-titulo a').first().attr('href') || null;
    out.push({
      key: `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}`,
      onNumber: parseInt(m[1], 10),
      onYear: parseInt(m[2], 10),
      corpo: card.find('.on-corpo').text().replace(/\s+/g, ' ').trim(),
      douUrl: href && /in\.gov\.br/i.test(href) ? href : null,
    });
  });
  return out;
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  console.log('='.repeat(64));
  console.log(`BACKFILL ONs ← página AGU — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(64));

  const page = parse(await fetchPage());
  console.log(`Cards parseados: ${page.length}\n`);

  let fillContent = 0, fillDou = 0, semRegistro = 0, semPrincipal = 0, semLacuna = 0, versoes = 0;
  const contentList: string[] = [], douList: string[] = [];

  for (const p of page) {
    if (EXCLUIDAS.has(p.key)) continue;

    const docs = await prisma.document.findMany({
      where: { category: 'orientacao-normativa', onNumber: p.onNumber, onYear: p.onYear },
    });
    if (docs.length === 0) { semRegistro++; console.log(`ON ${p.key} — na página mas SEM registro no banco (pulada; import é outro passo)`); continue; }

    // Alvo = principal (type='link'); fallback público; fallback primeiro.
    const target = docs.find((d) => d.type === 'link' && d.isPublic)
      || docs.find((d) => d.type === 'link')
      || docs.find((d) => d.isPublic)
      || docs[0];
    if (target.type !== 'link') semPrincipal++;

    const needContent = (target.content ?? '').trim().length < CONTENT_MIN && p.corpo.length >= CONTENT_MIN;
    const needDou = !((target.douUrl ?? '').trim()) && !!p.douUrl;
    if (!needContent && !needDou) { semLacuna++; continue; }

    const newData: Record<string, unknown> = {};
    if (needContent) { newData.content = p.corpo; contentList.push(p.key); fillContent++; }
    if (needDou) {
      newData.douUrl = p.douUrl;
      const dt = parseDouData(p.douUrl);
      if (dt && !target.douData) { newData.douData = dt; newData.douSecao = target.douSecao ?? '1'; }
      douList.push(p.key); fillDou++;
    }

    const change = await detectChanges(target as never, newData as never);
    const parts = [needContent ? `+content(${p.corpo.length})` : '', needDou ? '+douUrl' : ''].filter(Boolean).join(' ');
    console.log(`ON ${p.key}  ${target.type === 'link' ? 'principal' : `⚠️${target.type}`}  ${parts}${change.hasChanges ? '' : '  (detectChanges: sem mudança)'}`);

    if (APPLY && change.hasChanges) {
      await prisma.document.update({ where: { id: target.id }, data: newData as never });
      await saveDocumentVersion(target.id, change, 'backfill-agu-onsagu-2026-07');
      await prisma.document.update({ where: { id: target.id }, data: { embeddingStatus: 'pending' } });
      versoes++;
    }
  }

  console.log('\n' + '='.repeat(64));
  console.log(`Preencheriam CONTENT (${fillContent}): ${contentList.sort().join(' ')}`);
  console.log(`\nPreencheriam DOU_URL (${fillDou}): ${douList.sort().join(' ')}`);
  console.log(`\nONs na página sem registro no banco: ${semRegistro} · alvo não-principal: ${semPrincipal} · sem lacuna (já completas): ${semLacuna}`);
  if (APPLY) console.log(`\n✅ ${versoes} registro(s) atualizados + versionados + embeddingStatus='pending'.\n   Rode: npx tsx scripts/migrate-to-embeddings.ts --category orientacao-normativa`);
  else console.log('\n(DRY-RUN — nada gravado. Rode com --apply para gravar.)');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
