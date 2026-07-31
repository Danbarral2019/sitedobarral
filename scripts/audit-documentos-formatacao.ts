/**
 * Auditoria de FORMATAÇÃO dos documentos (Document).
 *
 * Read-only. Não altera nada no banco.
 *
 * Irmã de `audit-atos-formatacao.ts`, mas as checagens são OUTRAS porque a
 * renderização é outra: `app/documento/[id]/page.tsx` faz
 *
 *     displayContent.split('\n').map(p => <p>{p}</p>)
 *
 * ou seja, cada LINHA vira um parágrafo — sem markdown, sem detecção de
 * artigo/capítulo, sem sanitização de HTML. Consequências que guiam os checks:
 *   · texto sem '\n' vira UM parágrafo gigante ilegível;
 *   · markdown no content aparece LITERAL na tela ("**Art. 1º**");
 *   · tag HTML no content aparece como texto;
 *   · linha vazia vira <p></p>, empilhando espaço morto.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-documentos-formatacao.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-documentos-formatacao.ts --verbose
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-documentos-formatacao.ts --categoria=parecer
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const VERBOSE = process.argv.includes('--verbose');
const CATEGORIA = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1];
const SO_PUBLICOS = process.argv.includes('--so-publicos');

type Sev = 'ALTA' | 'MÉDIA' | 'BAIXA';

interface Doc { id: string; title: string; category: string | null; content: string | null; description: string | null; isPublic: boolean }
interface Achado { doc: string; cat: string; check: string; sev: Sev; titulo: string; detalhe: string; amostra: string }

function redor(texto: string, re: RegExp, janela = 70): string {
  const m = texto.match(re);
  if (!m || m.index === undefined) return '';
  const i = Math.max(0, m.index - janela / 2);
  return JSON.stringify(texto.slice(i, i + janela).replace(/\n/g, '⏎'));
}

interface Check { id: string; sev: Sev; titulo: string; run: (texto: string, d: Doc) => { detalhe: string; amostra: string } | null }

const CHECKS: Check[] = [
  // ---------- Renderização (específico desta página) ----------
  {
    id: 'R1', sev: 'ALTA', titulo: 'Parágrafo único gigante (texto sem quebras)',
    run: (t) => {
      const maior = t.split('\n').reduce((a, b) => (b.length > a.length ? b : a), '');
      // a página quebra em '\n'; uma linha muito longa vira um bloco maciço
      return maior.length > 2500
        ? { detalhe: `maior linha tem ${maior.length} chars — vira um único <p> maciço`, amostra: JSON.stringify(maior.slice(0, 90)) }
        : null;
    },
  },
  {
    id: 'R2', sev: 'ALTA', titulo: 'Markdown literal (aparece como texto na tela)',
    run: (t) => {
      const sigs: [string, RegExp][] = [
        ['negrito **', /\*\*[^\s*][^*]{0,80}\*\*/],
        ['heading ##', /(^|\n)#{1,6}\s+\S/],
        ['itálico _x_', /(^|\s)_[^\s_][^_]{0,60}_(\s|$)/],
        // exige URL/caminho no destino: "[…](Grifo nosso)" é notação de citação
        // usada nos manuais do TCU, não link markdown.
        ['link [x](url)', /\[[^\]]{1,60}\]\((https?:\/\/|\/|www\.)[^)]{1,120}\)/],
      ];
      for (const [n, re] of sigs) if (re.test(t)) return { detalhe: `${n} — a página não interpreta markdown`, amostra: redor(t, re) };
      return null;
    },
  },
  {
    id: 'R3', sev: 'ALTA', titulo: 'HTML cru no texto',
    run: (t) => {
      const re = /<\/?(p|div|span|br|table|tr|td|ul|ol|li|strong|em|a|h[1-6])\b[^>]*>|&nbsp;|&amp;|&lt;|&gt;|&#\d+;/i;
      return re.test(t) ? { detalhe: 'tag/entidade HTML aparece como texto na tela', amostra: redor(t, re) } : null;
    },
  },
  {
    id: 'R4', sev: 'BAIXA', titulo: 'Excesso de linhas vazias',
    run: (t) => {
      const vazias = t.split('\n').filter(l => l.trim() === '').length;
      const total = t.split('\n').length;
      return total > 10 && vazias / total > 0.5
        ? { detalhe: `${vazias} de ${total} linhas vazias — empilha <p> vazios`, amostra: '' }
        : null;
    },
  },

  // ---------- Extração ----------
  {
    id: 'A1', sev: 'ALTA', titulo: 'Blocos concatenados sem separador',
    run: (t) => {
      const sigs: [string, RegExp][] = [
        ['texto colado em "Art. N"', /[a-zà-úçãõáéíóúâêô0-9)]Art\s*\.\s*\d/],
        ['";" colado em inciso', /;[IVXLC]+\s*[-–]\s/],
        ['assinatura colada no cargo', /[A-ZÀ-Ú]{3,}(Secretári|Ministr|Diretor|President|Coordenador|Chefe|Procurador|Advogad)[aoe]/],
        ['minúscula colada em CAPÍTULO/SEÇÃO', /[a-zà-ú0-9)](CAPÍTULO|SEÇÃO|TÍTULO)\s/],
      ];
      for (const [n, re] of sigs) if (re.test(t)) return { detalhe: n, amostra: redor(t, re) };
      return null;
    },
  },

  // ---------- Ruído ----------
  {
    id: 'C1', sev: 'ALTA', titulo: 'Ruído de interface do portal',
    run: (t) => {
      const sigs: [string, RegExp][] = [
        ['Compartilhe', /Compartilhe\s*(:|por)/i],
        ['Publicado/Modificado em <data>', /(Publicado|Modificado|Atualizado) em\s*\d{1,2}\/\d{1,2}\/\d{2,4}/],
        ['masthead/rodapé DOU', /Brasão do Brasil|Borda do rodapé|Logo da Imprensa/],
        ['copiar p/ área de transferência', /Copiar para área de transferência/i],
        ['menu vazado (3+ bullets)', /(?:•[^\n•]*){3,}/],
        ['navegação', /Pular para o conteúdo|Ir para o menu|Acessibilidade\s*$/im],
      ];
      for (const [n, re] of sigs) if (re.test(t)) return { detalhe: n, amostra: redor(t, re) };
      return null;
    },
  },
  {
    id: 'C2', sev: 'MÉDIA', titulo: 'Marcador de OCR/PDF vazado',
    run: (t) => {
      const re = /Página\s+\d+\s+de\s+\d+|^\s*\d+\s*\/\s*\d+\s*$|Documento assinado digitalmente|Este documento pode ser verificado/im;
      return re.test(t) ? { detalhe: 'cabeçalho/rodapé de PDF no corpo', amostra: redor(t, re) } : null;
    },
  },

  // ---------- Encoding ----------
  {
    id: 'D1', sev: 'ALTA', titulo: 'Encoding quebrado',
    run: (t) => {
      const sigs: [string, RegExp][] = [
        ['U+FFFD (charset errado)', /�/],
        ['mojibake (UTF-8 lido como Latin-1)', /Ã[£§©¡³­ºâ]|â€[œ™“”]|Ã‡|Ãµ/],
        ['controles C1', /[\u0080-\u009F]/],
      ];
      for (const [n, re] of sigs) if (re.test(t)) return { detalhe: n, amostra: redor(t, re, 44) };
      return null;
    },
  },

  // ---------- Conteúdo ----------
  {
    id: 'E1', sev: 'MÉDIA', titulo: 'Conteúdo duplicado',
    run: (t) => {
      const s = t.replace(/\s+/g, ' ').trim();
      if (s.length < 400) return null;
      const meio = Math.floor(s.length / 2);
      const prim = s.slice(0, meio).trim();
      if (prim.length > 150 && s.slice(meio).trim().startsWith(prim.slice(0, Math.min(300, prim.length - 1)))) {
        return { detalhe: 'texto repetido 2x', amostra: JSON.stringify(s.slice(0, 80)) };
      }
      return null;
    },
  },
  {
    id: 'E2', sev: 'BAIXA', titulo: 'content idêntico à description',
    run: (t, d) => {
      if (!d.content || !d.description) return null;
      const norm = (x: string) => x.replace(/\s+/g, ' ').trim();
      return norm(d.content) === norm(d.description)
        ? { detalhe: 'content apenas repete a ementa — não há texto integral', amostra: '' }
        : null;
    },
  },
];

async function main() {
  const where: Record<string, unknown> = { OR: [{ content: { not: null } }, { description: { not: null } }] };
  if (CATEGORIA) where.category = CATEGORIA;
  if (SO_PUBLICOS) where.isPublic = true;

  const docs = (await prisma.document.findMany({
    where,
    select: { id: true, title: true, category: true, content: true, description: true, isPublic: true },
  })) as Doc[];

  const achados: Achado[] = [];
  let comTexto = 0;

  for (const d of docs) {
    // é o que a página mostra: content, com fallback para description
    const texto = (d.content || d.description || '').trim();
    if (!texto) continue;
    comTexto++;
    for (const chk of CHECKS) {
      const r = chk.run(texto, d);
      if (r) achados.push({ doc: d.title.slice(0, 46), cat: d.category ?? '—', check: chk.id, sev: chk.sev, titulo: chk.titulo, detalhe: r.detalhe, amostra: r.amostra });
    }
  }

  console.log('='.repeat(78));
  console.log('AUDITORIA DE FORMATAÇÃO — DOCUMENTOS');
  console.log('='.repeat(78));
  console.log(`documentos avaliados: ${comTexto}${CATEGORIA ? ` (categoria=${CATEGORIA})` : ''}${SO_PUBLICOS ? ' (só públicos)' : ''}`);
  console.log(`checagens por documento: ${CHECKS.length}`);

  const porCheck = new Map<string, Achado[]>();
  for (const f of achados) {
    if (!porCheck.has(f.check)) porCheck.set(f.check, []);
    porCheck.get(f.check)!.push(f);
  }
  const docsComAchado = new Set(achados.map(f => f.doc));
  console.log(`\nDOCUMENTOS COM ALGUM ACHADO: ${docsComAchado.size} de ${comTexto}`);

  if (!achados.length) {
    console.log('\n✓ Nenhum defeito de formatação encontrado.');
  } else {
    const ordem = ['ALTA', 'MÉDIA', 'BAIXA'];
    const lista = [...porCheck.entries()].sort((a, b) => {
      const sa = ordem.indexOf(a[1][0].sev), sb = ordem.indexOf(b[1][0].sev);
      return sa !== sb ? sa - sb : b[1].length - a[1].length;
    });
    for (const [id, fs] of lista) {
      console.log(`\n[${id}] ${fs[0].sev}  ${fs[0].titulo}  →  ${fs.length} doc(s)`);
      // distribuição por categoria ajuda a achar a FONTE do defeito
      const cats = new Map<string, number>();
      for (const f of fs) cats.set(f.cat, (cats.get(f.cat) ?? 0) + 1);
      const top = [...cats].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c}=${n}`).join('  ');
      console.log(`     por categoria: ${top}`);
      for (const f of (VERBOSE ? fs : fs.slice(0, 4))) {
        console.log(`     ${f.doc.padEnd(48)} ${f.detalhe}`);
        if (f.amostra) console.log(`         ${f.amostra.slice(0, 140)}`);
      }
      if (!VERBOSE && fs.length > 4) console.log(`     ... e mais ${fs.length - 4} (use --verbose)`);
    }
  }
  console.log('\n' + '='.repeat(78));
}

main()
  .catch((err) => { console.error('ERRO:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
