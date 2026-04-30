/**
 * audit-enunciados-autenticidade.ts
 *
 * Audita autenticidade dos enunciados no DB comparando com fontes oficiais:
 *  - CJF: já tratado em import-cjf-enunciados.ts (resultado limpo)
 *  - IBDA: scrape de https://enunciados.ibda.com.br/
 *  - INCP: URL oficial pendente — gera lista pra revisão manual
 *
 * Read-only. Output: docs/audits/2026-04-30-enunciados-audit.md + JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface OfficialEnunciado {
  numero: number;
  texto: string;
  source: string;
}

async function fetchIbdaEnunciados(): Promise<OfficialEnunciado[]> {
  console.log('Fetch IBDA enunciados.ibda.com.br...');
  const r = await fetch('https://enunciados.ibda.com.br/', {
    headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
  });
  if (!r.ok) {
    console.error(`IBDA HTTP ${r.status}`);
    return [];
  }
  const html = await r.text();
  console.log(`  HTML carregado (${(html.length / 1024).toFixed(1)} KB)`);

  // Padrões possíveis para IBDA. Vou tentar:
  // - <p>Enunciado N. texto</p>
  // - <h2/h3>Enunciado N</h2><p>texto</p>
  // - <li>Enunciado N: texto</li>
  // - blocos com data-id ou class específica

  const enunciados: OfficialEnunciado[] = [];

  // Tentativa 1: <strong>Enunciado N</strong> ... texto antes da próxima ocorrência
  const pattern1 = /Enunciado\s+(\d{1,3})\.?\s*[:\.]\s*([\s\S]{30,1500}?)(?=Enunciado\s+\d{1,3}\.?\s*[:\.]|$)/gi;
  let m: RegExpExecArray | null;
  pattern1.lastIndex = 0;
  while ((m = pattern1.exec(html)) !== null) {
    const numero = parseInt(m[1], 10);
    let texto = m[2].replace(/<[^>]+>/g, ' ');
    texto = decodeHtml(texto).replace(/\s+/g, ' ').trim();
    if (texto.length < 30) continue;
    if (enunciados.some((e) => e.numero === numero)) continue;
    enunciados.push({ numero, texto, source: 'enunciados.ibda.com.br' });
  }

  console.log(`  IBDA: ${enunciados.length} enunciados extraídos`);
  return enunciados;
}

interface DbEnunciado {
  id: string;
  title: string;
  description: string | null;
  tags: string | null;
  ente: string | null;
  numero: number | null;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  console.log('='.repeat(60));
  console.log('AUDIT — autenticidade dos enunciados');
  console.log('='.repeat(60));

  // 1. Carrega enunciados do DB
  const dbAll = await prisma.document.findMany({
    where: { category: 'enunciados', isPublic: true },
    select: { id: true, title: true, description: true, tags: true },
  });

  // Parsea ente e número
  const dbEnun: DbEnunciado[] = dbAll.map((e) => {
    let ente: string | null = null;
    try {
      const tags = e.tags ? JSON.parse(e.tags) : [];
      const enteList = ['CJF', 'IBDA', 'INCP'];
      ente = tags.find((t: string) => enteList.includes(t)) || null;
    } catch {
      // ignore
    }
    const m = e.title.match(/n[º°]?\s*(\d+)/i);
    const numero = m ? parseInt(m[1], 10) : null;
    return { id: e.id, title: e.title, description: e.description, tags: e.tags, ente, numero };
  });

  console.log(`\nDB enunciados: ${dbEnun.length}`);
  console.log(`  CJF: ${dbEnun.filter((e) => e.ente === 'CJF').length}`);
  console.log(`  IBDA: ${dbEnun.filter((e) => e.ente === 'IBDA').length}`);
  console.log(`  INCP: ${dbEnun.filter((e) => e.ente === 'INCP').length}`);

  // 2. Carrega CJF do scrape (já feito)
  const cjfPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-cjf-enunciados-scraped.json`
  );
  const cjfOfficial: OfficialEnunciado[] = fs.existsSync(cjfPath)
    ? (JSON.parse(fs.readFileSync(cjfPath, 'utf-8')).enunciados as Array<{
        numero: number;
        texto: string;
      }>).map((e) => ({ numero: e.numero, texto: e.texto, source: 'CJF (Irene Nohara)' }))
    : [];

  // 3. Scrape IBDA
  const ibdaOfficial = await fetchIbdaEnunciados();

  // 4. INCP — sem fonte automática; só lista

  // 5. Compara
  type AuditRow = {
    id: string;
    ente: string;
    numero: number | null;
    title: string;
    descDb: string;
    descOfficial?: string;
    similaridade?: number;
    matches?: boolean;
    sourceUrl?: string;
  };

  function jaccard(a: string, b: string): number {
    const wa = new Set(normalize(a).split(' '));
    const wb = new Set(normalize(b).split(' '));
    const inter = Array.from(wa).filter((w) => wb.has(w)).length;
    return (2 * inter) / (wa.size + wb.size);
  }

  const rows: AuditRow[] = [];

  for (const e of dbEnun) {
    const descDb = (e.description || '').trim();
    const row: AuditRow = {
      id: e.id,
      ente: e.ente || '?',
      numero: e.numero,
      title: e.title,
      descDb,
    };

    if (e.ente === 'CJF' && e.numero) {
      const off = cjfOfficial.find((o) => o.numero === e.numero);
      if (off) {
        row.descOfficial = off.texto;
        row.sourceUrl = 'cjf.jus.br';
        row.similaridade = jaccard(descDb, off.texto);
        row.matches = row.similaridade >= 0.9;
      }
    } else if (e.ente === 'IBDA' && e.numero) {
      const off = ibdaOfficial.find((o) => o.numero === e.numero);
      if (off) {
        row.descOfficial = off.texto;
        row.sourceUrl = 'enunciados.ibda.com.br';
        row.similaridade = jaccard(descDb, off.texto);
        row.matches = row.similaridade >= 0.7; // IBDA pode ter parsing menos preciso
      }
    } else if (e.ente === 'INCP') {
      row.sourceUrl = '(fonte oficial INCP não disponível pra audit automático)';
    }

    rows.push(row);
  }

  // Stats
  const cjfRows = rows.filter((r) => r.ente === 'CJF');
  const ibdaRows = rows.filter((r) => r.ente === 'IBDA');
  const incpRows = rows.filter((r) => r.ente === 'INCP');

  function statsFor(rows: AuditRow[], name: string) {
    const comFonte = rows.filter((r) => r.descOfficial);
    const matches = rows.filter((r) => r.matches).length;
    const semFonte = rows.filter((r) => !r.descOfficial).length;
    const naoMatch = comFonte.length - matches;
    console.log(
      `\n${name}: ${rows.length} total | match=${matches} | não-match=${naoMatch} | sem fonte=${semFonte}`
    );
    return { total: rows.length, match: matches, naoMatch, semFonte };
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESULTADOS');
  console.log('='.repeat(60));
  const cjfStats = statsFor(cjfRows, 'CJF');
  const ibdaStats = statsFor(ibdaRows, 'IBDA');
  const incpStats = statsFor(incpRows, 'INCP');

  // Salva relatório
  const md: string[] = [];
  md.push(`# Auditoria de Autenticidade — Enunciados (${today})`);
  md.push('');
  md.push('## Resumo');
  md.push('');
  md.push(`| Ente | Total | Match | Não-match | Sem fonte |`);
  md.push(`|---|---|---|---|---|`);
  md.push(`| CJF | ${cjfStats.total} | ${cjfStats.match} | ${cjfStats.naoMatch} | ${cjfStats.semFonte} |`);
  md.push(`| IBDA | ${ibdaStats.total} | ${ibdaStats.match} | ${ibdaStats.naoMatch} | ${ibdaStats.semFonte} |`);
  md.push(`| INCP | ${incpStats.total} | ${incpStats.match} | ${incpStats.naoMatch} | ${incpStats.semFonte} (fonte oficial não disponível pra audit automático) |`);
  md.push('');

  // Lista não-matches
  const naoMatch = rows.filter((r) => r.descOfficial && !r.matches);
  md.push('## Não-matches (DB difere do oficial)');
  md.push('');
  if (naoMatch.length === 0) {
    md.push('_Nenhum não-match detectado nas fontes auditadas_');
  } else {
    md.push(`Total: ${naoMatch.length}`);
    md.push('');
    for (const r of naoMatch.slice(0, 20)) {
      md.push(`### ${r.title} (ente=${r.ente}, sim=${r.similaridade?.toFixed(2)})`);
      md.push('');
      md.push('**DB:**');
      md.push('> ' + r.descDb.slice(0, 500));
      md.push('');
      md.push('**Oficial:**');
      md.push('> ' + (r.descOfficial?.slice(0, 500) || ''));
      md.push('');
      md.push('---');
      md.push('');
    }
  }

  md.push('## INCP (fonte oficial não auditada)');
  md.push('');
  md.push(
    `Os ${incpStats.total} enunciados do INCP no DB não foram auditados automaticamente porque não localizei a página oficial do INCP brasileiro com a lista de enunciados das reuniões técnicas. Para auditar manualmente:`
  );
  md.push('');
  md.push('1. Localizar URL oficial do INCP brasileiro');
  md.push('2. Extrair texto oficial dos 43 enunciados (1ª e 2ª Reunião Técnica)');
  md.push('3. Rodar comparação semelhante ao IBDA');

  const outMd = path.join(process.cwd(), 'docs', 'audits', `${today}-enunciados-audit.md`);
  const outJson = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-enunciados-audit.json`
  );
  fs.writeFileSync(outMd, md.join('\n'));
  fs.writeFileSync(
    outJson,
    JSON.stringify(
      { stats: { cjf: cjfStats, ibda: ibdaStats, incp: incpStats }, rows },
      null,
      2
    )
  );
  console.log(`\n📄 Markdown: ${outMd}`);
  console.log(`📄 JSON:     ${outJson}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
