/**
 * fix-and-diff-ons.ts
 *
 * Pós-processa o JSON do scrape (scrape-ons-oficial.ts) e gera relatório
 * de diff vs DB.
 *
 * 1. Limpa cada `descricao` (remove arrasto de bloco seguinte e prefixo de número)
 * 2. Valida `douUrl` (descarta se número não bate com o da ON)
 * 3. Compara com DB (read-only)
 * 4. Salva docs/audits/2026-04-30-ons-diff-report.md + .json
 *
 * Sem `--apply` — totalmente read-only. A aplicação fica em script separado.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-and-diff-ons.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

interface ScrapedDoc {
  numero?: string;
  numeroInt?: number;
  ano?: number;
  titulo: string;
  descricao: string;
  url: string;
  urlPDF?: string;
  douUrl?: string;
  douData?: string;
}

interface CleanedDoc extends ScrapedDoc {
  descricaoLimpa: string;
  douUrlValido: string | null;
  douUrlMotivoDescarte?: string;
}

/**
 * Limpa a descricao removendo arrasto do bloco seguinte e prefixo do número.
 *
 * Exemplo entrada:
 *   "Orientação Normativa 102/2025 É juridicamente possível, desde que ... administrativa
 *    deste último. Fundamentação Orientações Normativas da extinta CNU ..."
 *
 * Esperado saída:
 *   "É juridicamente possível, desde que ... administrativa deste último."
 */
function limparDescricao(rawDesc: string, numeroInt?: number, ano?: number): string {
  let desc = rawDesc;

  // 1. Remove prefixo "Orientação Normativa N/YYYY " se aparecer no começo
  if (numeroInt && ano) {
    const prefixPattern = new RegExp(
      `^Orientação Normativa\\s+0?${numeroInt}\\/${ano}\\s+`,
      'i'
    );
    desc = desc.replace(prefixPattern, '');
  }

  // 2. Corta no primeiro marcador de fim de bloco (case-insensitive)
  const cutoffMarkers = [
    /\bFundamentação\b/i,
    /\bPublicação no DOU\b/i,
    /\bRedação original\b/i,
    /\bRedação dada por\b/i,
    /\bORIENTAÇÃO NORMATIVA CNU\/CGU\/AGU/i,
    /\bOrientações Normativas da extinta CNU\b/i,
    // Se aparecer "Orientação Normativa X/YYYY" depois do início, é arrasto
    /\bOrientação Normativa\s+\d+\/\d{4}\b/i,
  ];

  let cutAt = desc.length;
  for (const marker of cutoffMarkers) {
    const m = desc.match(marker);
    // Ignora se ocorrer logo no início (ex.: prefixo "Orientação Normativa 102/2025" que já tratamos)
    if (m && typeof m.index === 'number' && m.index > 5 && m.index < cutAt) {
      cutAt = m.index;
    }
  }
  desc = desc.slice(0, cutAt).trim();

  // 3. Normaliza espaços
  desc = desc.replace(/\s+/g, ' ').trim();

  return desc;
}

/**
 * Valida o douUrl extraído contra o número da ON.
 * Se o número embutido na URL ≠ número da ON, descarta (provável arrasto do bloco seguinte).
 */
function validarDouUrl(
  douUrl: string | undefined,
  numeroInt: number | undefined
): { valido: string | null; motivo?: string } {
  if (!douUrl) return { valido: null, motivo: 'ausente no scrape' };
  if (!numeroInt) return { valido: null, motivo: 'ON sem número' };

  // Padrão típico: orientacao-normativa-n-X-de-... (ou -agu-n-X-)
  const m = douUrl.match(/orientacao-normativa(?:-agu)?-n-(\d+)/i);
  if (!m) {
    // Não tem número embutido — aceitamos com aviso
    return { valido: douUrl };
  }

  const douNum = parseInt(m[1], 10);
  if (douNum !== numeroInt) {
    return {
      valido: null,
      motivo: `douUrl aponta pra ON ${douNum}, mas é ON ${numeroInt} (provável arrasto)`,
    };
  }

  return { valido: douUrl };
}

interface DbDoc {
  id: string;
  title: string;
  description: string | null;
  url: string;
  onNumber: number | null;
  onYear: number | null;
  reviewed: boolean;
  isPublic: boolean;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const inputPath = path.join(process.cwd(), 'docs', 'audits', `${today}-ons-scraped.json`);
  const reportMdPath = path.join(process.cwd(), 'docs', 'audits', `${today}-ons-diff-report.md`);
  const reportJsonPath = path.join(process.cwd(), 'docs', 'audits', `${today}-ons-diff.json`);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input não encontrado: ${inputPath}`);
    console.error('Rode primeiro: npx tsx scripts/scrape-ons-oficial.ts');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const docs: ScrapedDoc[] = raw.documentos;
  console.log(`Carregadas ${docs.length} ONs do scrape.\n`);

  // 1. Pós-processa
  const cleaned: CleanedDoc[] = docs.map((d) => {
    const descricaoLimpa = limparDescricao(d.descricao, d.numeroInt, d.ano);
    const { valido, motivo } = validarDouUrl(d.douUrl, d.numeroInt);
    return {
      ...d,
      descricaoLimpa,
      douUrlValido: valido,
      douUrlMotivoDescarte: motivo,
    };
  });

  // 2. Busca DB
  console.log('Buscando ONs no DB...');
  const dbOns: DbDoc[] = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    select: {
      id: true,
      title: true,
      description: true,
      url: true,
      onNumber: true,
      onYear: true,
      reviewed: true,
      isPublic: true,
    },
  });
  console.log(`DB tem ${dbOns.length} ONs\n`);

  // Map DB por chave numero/ano
  const dbByKey = new Map<string, DbDoc>();
  for (const d of dbOns) {
    if (d.onNumber && d.onYear) {
      dbByKey.set(`${d.onNumber}/${d.onYear}`, d);
    }
  }

  // 3. Construir diff
  type DiffRow = {
    numero: number;
    ano: number;
    status: 'match-melhora' | 'match-igual' | 'so-no-scrape' | 'so-no-db';
    dbId?: string;
    descricaoAntiga?: string | null;
    descricaoNova?: string;
    descMudou?: boolean;
    urlAntiga?: string;
    urlNovaPDF?: string;
    urlNovaDOU?: string | null;
    urlMudou?: boolean;
    motivoDescarteDOU?: string;
    reviewedAntes?: boolean;
  };

  const diffs: DiffRow[] = [];
  const cleanedKeys = new Set<string>();

  for (const c of cleaned) {
    if (!c.numeroInt || !c.ano) continue;
    const key = `${c.numeroInt}/${c.ano}`;
    cleanedKeys.add(key);
    const dbDoc = dbByKey.get(key);

    if (!dbDoc) {
      diffs.push({
        numero: c.numeroInt,
        ano: c.ano,
        status: 'so-no-scrape',
        descricaoNova: c.descricaoLimpa,
        urlNovaPDF: c.url,
        urlNovaDOU: c.douUrlValido,
        motivoDescarteDOU: c.douUrlMotivoDescarte,
      });
      continue;
    }

    const descMudou = (dbDoc.description || '').trim() !== c.descricaoLimpa.trim();
    // Só considera "url mudou" se a nova URL DOU é diferente E é específica
    const urlMudou =
      (c.douUrlValido && c.douUrlValido !== dbDoc.url) ||
      (!!c.url && c.url !== dbDoc.url && !c.url.endsWith('/onsagu'));

    diffs.push({
      numero: c.numeroInt,
      ano: c.ano,
      status: descMudou || urlMudou ? 'match-melhora' : 'match-igual',
      dbId: dbDoc.id,
      descricaoAntiga: dbDoc.description,
      descricaoNova: c.descricaoLimpa,
      descMudou,
      urlAntiga: dbDoc.url,
      urlNovaPDF: c.url,
      urlNovaDOU: c.douUrlValido,
      urlMudou: !!urlMudou,
      motivoDescarteDOU: c.douUrlMotivoDescarte,
      reviewedAntes: dbDoc.reviewed,
    });
  }

  // ONs no DB mas não no scrape (provavelmente ONs antigas que a página não lista mais)
  for (const dbDoc of dbOns) {
    if (!dbDoc.onNumber || !dbDoc.onYear) continue;
    const key = `${dbDoc.onNumber}/${dbDoc.onYear}`;
    if (!cleanedKeys.has(key)) {
      diffs.push({
        numero: dbDoc.onNumber,
        ano: dbDoc.onYear,
        status: 'so-no-db',
        dbId: dbDoc.id,
        urlAntiga: dbDoc.url,
        descricaoAntiga: dbDoc.description,
        reviewedAntes: dbDoc.reviewed,
      });
    }
  }

  // Ordena por (status, ano desc, numero desc)
  diffs.sort((a, b) => {
    const order = { 'match-melhora': 0, 'match-igual': 1, 'so-no-scrape': 2, 'so-no-db': 3 };
    const so = order[a.status] - order[b.status];
    if (so !== 0) return so;
    if (a.ano !== b.ano) return b.ano - a.ano;
    return b.numero - a.numero;
  });

  // 4. Stats
  const stats = {
    total: diffs.length,
    matchMelhora: diffs.filter((d) => d.status === 'match-melhora').length,
    matchIgual: diffs.filter((d) => d.status === 'match-igual').length,
    soNoScrape: diffs.filter((d) => d.status === 'so-no-scrape').length,
    soNoDb: diffs.filter((d) => d.status === 'so-no-db').length,
    descMudou: diffs.filter((d) => d.descMudou).length,
    urlMudou: diffs.filter((d) => d.urlMudou).length,
    douDescartado: diffs.filter((d) => d.motivoDescarteDOU).length,
  };

  console.log('='.repeat(60));
  console.log('RESUMO DO DIFF');
  console.log('='.repeat(60));
  console.log(`Total ONs no diff: ${stats.total}`);
  console.log(`  match com melhora a aplicar: ${stats.matchMelhora}`);
  console.log(`  match sem mudança: ${stats.matchIgual}`);
  console.log(`  só no scrape (DB não tem): ${stats.soNoScrape}`);
  console.log(`  só no DB (scrape não pegou): ${stats.soNoDb}`);
  console.log('');
  console.log(`Descrições que vão mudar: ${stats.descMudou}`);
  console.log(`URLs que vão mudar: ${stats.urlMudou}`);
  console.log(`douUrls descartados (arrasto/inválido): ${stats.douDescartado}`);

  // 5. Salva relatório
  const md: string[] = [];
  md.push(`# Diff ONs — scrape vs DB (${today})`);
  md.push('');
  md.push(`Source: \`docs/audits/${today}-ons-scraped.json\``);
  md.push(`DB: \`category='orientacao-normativa'\``);
  md.push('');
  md.push('## Resumo');
  md.push('');
  md.push(`| Métrica | Valor |`);
  md.push(`|---|---|`);
  md.push(`| Total ONs no diff | ${stats.total} |`);
  md.push(`| Match com melhora a aplicar | ${stats.matchMelhora} |`);
  md.push(`| Match sem mudança | ${stats.matchIgual} |`);
  md.push(`| Só no scrape (DB não tem) | ${stats.soNoScrape} |`);
  md.push(`| Só no DB (scrape não pegou) | ${stats.soNoDb} |`);
  md.push(`| Descrições que mudariam | ${stats.descMudou} |`);
  md.push(`| URLs que mudariam | ${stats.urlMudou} |`);
  md.push(`| douUrls descartados por arrasto | ${stats.douDescartado} |`);
  md.push('');

  // Amostra das melhorias (top 10)
  md.push('## Amostra de mudanças propostas (10 primeiras)');
  md.push('');
  const amostra = diffs.filter((d) => d.status === 'match-melhora').slice(0, 10);
  for (const d of amostra) {
    md.push(`### ON ${d.numero}/${d.ano}`);
    md.push('');
    if (d.descMudou) {
      md.push('**Descrição (DB atual → proposta):**');
      md.push('');
      md.push('Atual (paráfrase IA):');
      md.push('> ' + (d.descricaoAntiga?.slice(0, 400) || '(vazia)'));
      md.push('');
      md.push('Proposta (texto oficial limpo):');
      md.push('> ' + (d.descricaoNova?.slice(0, 400) || '(vazia)'));
      md.push('');
    }
    if (d.urlMudou) {
      md.push('**URL:**');
      md.push(`- Atual: \`${d.urlAntiga || '(vazia)'}\``);
      if (d.urlNovaDOU) md.push(`- Proposta DOU: \`${d.urlNovaDOU}\``);
      if (d.urlNovaPDF && d.urlNovaPDF !== d.urlAntiga) {
        md.push(`- Proposta PDF: \`${d.urlNovaPDF}\``);
      }
      md.push('');
    }
    if (d.motivoDescarteDOU) {
      md.push(`> ⚠ douUrl descartado: ${d.motivoDescarteDOU}`);
      md.push('');
    }
    md.push('---');
    md.push('');
  }

  // ONs com douUrl descartado por arrasto
  md.push('## ONs com douUrl descartado por arrasto (parser bug)');
  md.push('');
  const descarted = diffs.filter((d) => d.motivoDescarteDOU?.startsWith('douUrl'));
  if (descarted.length === 0) {
    md.push('_Nenhuma_');
  } else {
    md.push(`Total: ${descarted.length}`);
    md.push('');
    md.push('| ON | Motivo |');
    md.push('|---|---|');
    for (const d of descarted.slice(0, 30)) {
      md.push(`| ON ${d.numero}/${d.ano} | ${d.motivoDescarteDOU} |`);
    }
    md.push('');
  }

  md.push('## Próximos passos');
  md.push('');
  md.push('1. Revisar amostra acima.');
  md.push('2. Se OK, aplicar com:');
  md.push('   ```bash');
  md.push('   npx dotenv -e .env.local -- npx tsx scripts/apply-ons-update.ts --apply');
  md.push('   ```');
  md.push('3. Validar amostra na UI (`/base-conhecimento/orientacoes-normativas`).');
  md.push('4. Quando todas as ONs forem revisadas humanamente, reativar `showDescription: true` na rota.');
  md.push('5. Para ONs com `douUrl` descartado: em sessão futura, lookup manual ou via in.gov.br search.');

  fs.writeFileSync(reportMdPath, md.join('\n'), 'utf-8');
  fs.writeFileSync(reportJsonPath, JSON.stringify({ stats, diffs }, null, 2), 'utf-8');

  console.log('');
  console.log(`📄 Relatório markdown: ${reportMdPath}`);
  console.log(`📄 JSON estruturado:   ${reportJsonPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
