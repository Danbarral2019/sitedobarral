/**
 * Importa as Orientações Normativas AGU novas de 2026 (ON 103 a 107)
 * a partir do texto OFICIAL publicado no DOU (Imprensa Nacional / in.gov.br).
 *
 * Motivo: a página oficial onsagu (gov.br/agu) está desatualizada (não lista pós-77/2023).
 * Fonte primária = DOU. Cada ON é buscada em runtime na URL oficial e o texto é
 * extraído verbatim de `.texto-dou` (sem transcrição manual).
 *
 * As ONs são gravadas como Document (category='orientacao-normativa') seguindo o padrão
 * canônico das ONs recentes (ON 100/101: type='link', isPublic=true, isCommon=true,
 * courseId=null, description=enunciado, content=texto integral), via versionamento.
 *
 * Uso:
 *   npx tsx scripts/import-ons-2026.ts            # dry-run (não grava)
 *   npx tsx scripts/import-ons-2026.ts --apply    # grava no banco + invalida cache
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { findOrCreateWithVersioning } from '../lib/agu-modules/versioning';
import { CacheInvalidation } from '../lib/cache/redis-client';

const APPLY = process.argv.includes('--apply');

interface OnConfig {
  numero: number;
  ano: number;
  dataAto: string;       // data do ato (para conferência/log)
  url: string;           // URL oficial no DOU
  douData: Date;         // data de publicação no DOU
  douEdicao: string;
  douSecao: string;
  douPagina: string;
  tagsTema: string[];    // temas para tags
}

const ONS: OnConfig[] = [
  {
    numero: 103, ano: 2026, dataAto: '9 de junho de 2026',
    url: 'https://www.in.gov.br/web/dou/-/orientacao-normativa-agu-n-103-de-9-de-junho-de-2026-711407180',
    douData: new Date(Date.UTC(2026, 5, 10)), douEdicao: '106', douSecao: '1', douPagina: '32',
    tagsTema: ['Assessoramento Jurídico', 'Força Vinculante', 'Manifestações Jurídicas'],
  },
  {
    numero: 104, ano: 2026, dataAto: '11 de junho de 2026',
    url: 'https://www.in.gov.br/web/dou/-/orientacao-normativa-n-104-de-11-de-junho-de-2026-711711738',
    douData: new Date(Date.UTC(2026, 5, 12)), douEdicao: '108', douSecao: '1', douPagina: '4',
    tagsTema: ['Servidores Públicos', 'Estágio Probatório'],
  },
  {
    numero: 105, ano: 2026, dataAto: '11 de junho de 2026',
    url: 'https://www.in.gov.br/web/dou/-/orientacao-normativa-agu-n-105-de-11-de-junho-de-2026-711715521',
    douData: new Date(Date.UTC(2026, 5, 12)), douEdicao: '108', douSecao: '1', douPagina: '5',
    tagsTema: ['Contratação Direta', 'Dispensa de Licitação', 'Lei 14.133'],
  },
  {
    numero: 106, ano: 2026, dataAto: '11 de junho de 2026',
    url: 'https://www.in.gov.br/web/dou/-/orientacao-normativa-agu-n-106-de-11-de-junho-de-2026-711728381',
    douData: new Date(Date.UTC(2026, 5, 12)), douEdicao: '108', douSecao: '1', douPagina: '5',
    tagsTema: ['Servidores Públicos', 'Readaptação'],
  },
  {
    numero: 107, ano: 2026, dataAto: '11 de junho de 2026',
    url: 'https://www.in.gov.br/web/dou/-/orientacao-normativa-agu-n-107-de-11-de-junho-de-2026-711737832',
    douData: new Date(Date.UTC(2026, 5, 12)), douEdicao: '108', douSecao: '1', douPagina: '5',
    tagsTema: ['Licitações', 'Engenharia Consultiva', 'Técnica e Preço', 'Lei 14.133'],
  },
];

function normalize(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/ /g, ' ')          // NBSP
    .replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchOnTexts(url: string): Promise<{ content: string; enunciado: string }> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  let raw = $('.texto-dou').text();
  if (!raw || raw.trim().length < 200) raw = $('article').text();
  raw = normalize(raw);

  // Remove a primeira linha (título "ORIENTAÇÃO NORMATIVA ...") -> content começa no preâmbulo
  let content = raw.replace(/^ORIENTA[ÇC][ÃA]O NORMATIVA[^\n]*\n+/i, '').trim();

  // Enunciado: do "Enunciado:" (ou primeiro "I -") até "Referência"/"Esta Orientação ... entra em vigor"
  let enunciado = '';
  const startMatch = content.match(/Enunciado:\s*/i);
  const startIdx = startMatch ? (startMatch.index! + startMatch[0].length) : content.search(/(^|\n)\s*I\s*-/);
  if (startIdx >= 0) {
    let tail = content.slice(startIdx);
    const endIdx = tail.search(/\n\s*(Refer[êe]ncia|Fonte\s*:|Esta Orienta[çc][ãa]o Normativa entra em vigor)/i);
    enunciado = (endIdx > 0 ? tail.slice(0, endIdx) : tail).trim();
  }
  if (!enunciado || enunciado.length < 40) enunciado = content; // fallback

  return { content, enunciado };
}

function validate(numero: number, content: string, enunciado: string, url: string): string[] {
  const errs: string[] = [];
  if (content.length < 500) errs.push(`content curto (${content.length} chars)`);
  if (/�/.test(content) || /�/.test(enunciado)) errs.push('mojibake U+FFFD detectado');
  if (!enunciado.trim()) errs.push('enunciado vazio');
  if (!/\/web\/dou\/-\//.test(url)) errs.push('URL não é do DOU oficial');
  if (!/O ADVOGADO-GERAL DA UNI[ÃA]O/i.test(content)) errs.push('preâmbulo da AGU ausente (extração suspeita)');
  return errs;
}

async function main() {
  console.log(`\n=== Import ONs AGU 2026 (103–107) — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===\n`);

  let novos = 0, atualizados = 0, semMudancas = 0, erros = 0;

  for (const on of ONS) {
    const label = `ON ${on.numero}/${on.ano}`;
    try {
      const { content, enunciado } = await fetchOnTexts(on.url);
      const errs = validate(on.numero, content, enunciado, on.url);
      if (errs.length) {
        erros++;
        console.log(`❌ ${label}: VALIDAÇÃO FALHOU -> ${errs.join('; ')}`);
        continue;
      }

      const title = `Orientação Normativa AGU nº ${on.numero}/${on.ano}`;
      const tags = JSON.stringify(['AGU', `ON ${on.numero}/${on.ano}`, ...on.tagsTema]);

      const newData = {
        title,
        description: enunciado,
        type: 'link' as const,
        url: on.url,
        category: 'orientacao-normativa',
        isPublic: true,
        isCommon: true,
        onNumber: on.numero,
        onYear: on.ano,
        tags,
        content,
        douUrl: on.url,
        douData: on.douData,
        douSecao: on.douSecao,
        douPagina: on.douPagina,
        douEdicao: on.douEdicao,
      };

      console.log('─'.repeat(64));
      console.log(`${label}  (${on.dataAto}) — DOU ${on.douData.toISOString().slice(0,10)} Ed.${on.douEdicao} Seç.${on.douSecao} Pág.${on.douPagina}`);
      console.log(`  title:   ${title}`);
      console.log(`  tags:    ${tags}`);
      console.log(`  content: ${content.length} chars | description: ${enunciado.length} chars`);
      console.log(`  preview: ${enunciado.slice(0, 140).replace(/\n/g, ' ')}...`);

      if (!APPLY) continue;

      const r = await findOrCreateWithVersioning(
        { onNumber: on.numero, onYear: on.ano },
        newData,
        'scraper-ons-agu-dou-2026'
      );
      if (r.isNew) { novos++; console.log(`  ✅ CRIADO (id=${r.document.id})`); }
      else if (r.hasChanges) { atualizados++; console.log(`  🔄 ATUALIZADO (id=${r.document.id})`); }
      else { semMudancas++; console.log(`  ⏭️  sem mudanças`); }
    } catch (e) {
      erros++;
      console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log('\n' + '='.repeat(64));
  if (APPLY) {
    console.log(`Resumo: ${novos} criados | ${atualizados} atualizados | ${semMudancas} sem mudanças | ${erros} erros`);
    if (novos + atualizados > 0) {
      try {
        const a = await CacheInvalidation.courseDocuments();
        const b = await CacheInvalidation.vectorSearch();
        const c = await CacheInvalidation.synthesizedAnswers();
        await CacheInvalidation.douStats();
        console.log(`🗑️  Cache invalidado: docs=${a}, vector=${b}, synth=${c}, douStats=ok`);
      } catch (e) {
        console.log(`⚠️  Falha ao invalidar cache (Redis): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } else {
    console.log(`DRY-RUN concluído. ${erros} erros de validação. Rode com --apply para gravar.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
