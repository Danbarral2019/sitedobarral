/**
 * Re-audit dos enunciados (CJF/IBDA/INCP) contra as fontes oficiais.
 *
 * Memory 2026-04-30: CJF/IBDA 100% match; INCP parcial.
 *
 * Estratégia: fetch das páginas oficiais, extrair text + contar
 * ocorrências de "Enunciado nº X" / "ENUNCIADO X". Compara com a
 * cobertura local. Não compara texto completo (HTML structure varia).
 */
import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { detectCharsetFromResponse } from '../lib/legislative-scrapers/normalize';

interface SourceConfig {
  source: 'CJF' | 'IBDA' | 'INCP';
  url: string;
  // Regex pra capturar números de enunciados na página
  pattern: RegExp;
}

const SOURCES: SourceConfig[] = [
  {
    source: 'CJF',
    url: 'https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/jornadas-de-direito-administrativo',
    pattern: /enunciado\s+n[º°o.]?\s*(\d{1,3})/gi,
  },
  {
    source: 'IBDA',
    url: 'https://www.ibda.com.br/noticias/resultado-da-iii-jornada-de-direito-administrativo-2024',
    pattern: /enunciado\s+n[º°o.]?\s*(\d{1,3})/gi,
  },
  {
    source: 'INCP',
    url: 'https://incpbrasil.com.br/enunciados-aprovados/',
    pattern: /enunciado\s+n[º°o.]?\s*(\d{1,3})/gi,
  },
];

async function fetchDecoded(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sitedobarral-audit/1.0)' },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const charset = detectCharsetFromResponse(res.headers.get('content-type'), buf);
    return new TextDecoder(charset, { fatal: false }).decode(buf);
  } catch {
    return null;
  }
}

async function main() {
  const localBySource = new Map<string, Set<number>>();
  const docs = await prisma.document.findMany({
    where: { category: 'enunciados' },
    select: { title: true },
  });
  for (const d of docs) {
    const m = d.title.match(/Enunciado\s+(?:do\s+)?(CJF|IBDA|INCP)\s+n[º°o.]?\s*(\d+)/i);
    if (!m) continue;
    const src = m[1].toUpperCase();
    const num = parseInt(m[2], 10);
    let s = localBySource.get(src);
    if (!s) { s = new Set(); localBySource.set(src, s); }
    s.add(num);
  }

  console.log(`📋 Cobertura local:`);
  for (const [s, set] of localBySource) console.log(`   ${s}: ${set.size} enunciados`);

  for (const cfg of SOURCES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🌐 Verificando ${cfg.source} contra fonte oficial...`);
    console.log(`   ${cfg.url}`);
    const html = await fetchDecoded(cfg.url);
    if (!html) {
      console.log(`   ❌ fetch falhou`);
      continue;
    }
    const $ = cheerio.load(html);
    $('script, style, nav, header, footer').remove();
    const text = $('body').text();
    console.log(`   HTML extraído: ${html.length} chars, texto: ${text.length} chars`);

    // Coleta números encontrados
    const found = new Set<number>();
    let m: RegExpExecArray | null;
    cfg.pattern.lastIndex = 0;
    while ((m = cfg.pattern.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      // Filtra outliers (números > 200 são improváveis)
      if (n >= 1 && n <= 200) found.add(n);
    }

    const local = localBySource.get(cfg.source) ?? new Set();
    console.log(`   Encontrados na fonte: ${found.size} números únicos (range ${Math.min(...found)}–${Math.max(...found)})`);
    console.log(`   Local: ${local.size}`);

    const onlyLocal = [...local].filter((n) => !found.has(n)).sort((a, b) => a - b);
    const onlySource = [...found].filter((n) => !local.has(n)).sort((a, b) => a - b);

    if (onlySource.length === 0) {
      console.log(`   ✅ Todos os enunciados da fonte estão no banco`);
    } else {
      console.log(`   ⚠️  ${onlySource.length} enunciado(s) na fonte que NÃO estão no banco: ${onlySource.slice(0, 30).join(', ')}${onlySource.length > 30 ? `...` : ''}`);
    }
    if (onlyLocal.length > 0) {
      console.log(`   ⚠️  ${onlyLocal.length} enunciado(s) no banco que NÃO foram encontrados na fonte: ${onlyLocal.slice(0, 30).join(', ')}`);
      console.log(`     (pode ser que a página atual não inclua todas as edições/jornadas)`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
