/**
 * Auditoria de FORMATAÇÃO dos atos normativos (LegislativeAct).
 *
 * Read-only. Não altera nada no banco.
 *
 * Diferente de `audit-legislative-acts.ts` (que audita metadados, URLs e
 * completude), esta auditoria olha o que o LEITOR vê: pega o `content` de cada
 * ato, roda o mesmo `formatLegalContent` da página pública e procura defeitos
 * de extração, de renderização, ruído de portal e problemas de encoding.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-atos-formatacao.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-atos-formatacao.ts --verbose
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-atos-formatacao.ts --check=B1
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { formatLegalContent } from '@/lib/format-legal-content';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const VERBOSE = process.argv.includes('--verbose');
const ONLY = process.argv.find(a => a.startsWith('--check='))?.split('=')[1];

type Sev = 'ALTA' | 'MÉDIA' | 'BAIXA';
interface Achado { id: string; check: string; sev: Sev; titulo: string; detalhe: string; amostra: string }

const ROMANO = /^([IVXLCDM]+|ÚNICO|ÚNICA)$/;
const ROTULO_ROMANO = /\b(CAPÍTULO|SEÇÃO|SECÇÃO|TÍTULO|SUBSEÇÃO)\s+([A-ZÀ-Ú]+)/g;

/** Trecho ao redor da primeira ocorrência, para o relatório. */
function redor(texto: string, re: RegExp, janela = 70): string {
  const m = texto.match(re);
  if (!m || m.index === undefined) return '';
  const i = Math.max(0, m.index - janela / 2);
  return JSON.stringify(texto.slice(i, i + janela).replace(/\n/g, '⏎'));
}

interface Check {
  id: string;
  sev: Sev;
  titulo: string;
  /** Recebe content bruto e markdown renderizado; devolve detalhe ou null. */
  run: (content: string, md: string) => { detalhe: string; amostra: string } | null;
}

const CHECKS: Check[] = [
  // ---------- A. Extração: blocos HTML fundidos ----------
  {
    id: 'A1', sev: 'ALTA', titulo: 'Blocos concatenados sem separador',
    run: (c) => {
      const sigs: [string, RegExp][] = [
        ['texto colado em "Art. N"', /[a-zà-úçãõáéíóúâêô0-9)]Art\.\s*\d/],
        ['";" colado em inciso', /;[IVXLC]+\s*[-–]\s/],
        ['texto colado em CAPÍTULO/SEÇÃO/TÍTULO/ANEXO', /[a-zà-ú0-9)](CAPÍTULO|SEÇÃO|TÍTULO|ANEXO)\s/],
        ['texto colado em "Parágrafo único"', /[a-zà-ú0-9)]Parágrafo único/],
      ];
      for (const [nome, re] of sigs) if (re.test(c)) return { detalhe: nome, amostra: redor(c, re) };
      ROTULO_ROMANO.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = ROTULO_ROMANO.exec(c)) !== null) {
        if (!ROMANO.test(m[2])) {
          return { detalhe: `${m[1]} colado ("${m[2].slice(0, 20)}")`, amostra: JSON.stringify(m[0]) };
        }
      }
      return null;
    },
  },

  // ---------- B. Renderização: o que o leitor vê ----------
  {
    id: 'B1', sev: 'ALTA', titulo: 'Título (heading) engolindo artigo',
    run: (_c, md) => {
      const re = /^#{1,4} .*\bArt\.\s*\d/m;
      return re.test(md) ? { detalhe: 'um heading contém "Art. N" — o artigo virou parte do título', amostra: redor(md, re, 110) } : null;
    },
  },
  {
    id: 'B2', sev: 'MÉDIA', titulo: 'Título anormalmente longo',
    run: (_c, md) => {
      const linhas = md.split('\n').filter(l => /^#{1,4} /.test(l));
      const longa = linhas.find(l => l.replace(/^#+\s*/, '').length > 130);
      return longa ? { detalhe: `heading com ${longa.replace(/^#+\s*/, '').length} chars — provável fusão de blocos`, amostra: JSON.stringify(longa.slice(0, 110)) } : null;
    },
  },
  {
    id: 'B3', sev: 'MÉDIA', titulo: 'Artigo no meio de parágrafo (não virou negrito)',
    run: (_c, md) => {
      // "Art. N" precedido de texto na MESMA linha, sem ser o início do parágrafo
      const re = /^(?!#)(?!\*\*Art)(?:.*\S)\s\bArt\.\s*\d+[ºo°]?\s/m;
      return re.test(md) ? { detalhe: 'início de artigo no meio de um parágrafo', amostra: redor(md, re, 120) } : null;
    },
  },
  {
    id: 'B4', sev: 'MÉDIA', titulo: 'Parágrafo gigante (sem quebras)',
    run: (_c, md) => {
      const maior = md.split(/\n\n+/).reduce((a, b) => (b.length > a.length ? b : a), '');
      return maior.length > 3500 ? { detalhe: `maior parágrafo tem ${maior.length} chars — estrutura provavelmente perdida`, amostra: JSON.stringify(maior.slice(0, 100)) } : null;
    },
  },

  // ---------- C. Ruído de portal ----------
  {
    id: 'C1', sev: 'ALTA', titulo: 'Ruído de interface do portal',
    run: (c) => {
      const sigs: [string, RegExp][] = [
        ['Compartilhe', /Compartilhe\s*(:|por)/i],
        ['Publicado em <data>', /Publicado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}/],
        ['Modificado/Atualizado em <data>', /(Modificado|Atualizado) em\s*\d{1,2}\/\d{1,2}\/\d{2,4}/],
        ['masthead DOU', /Brasão do Brasil|Diário Oficial da União\s*\n\s*Publicado/],
        ['rodapé DOU (layout)', /Borda do rodapé|Logo da Imprensa/],
        ['copiar p/ área de transferência', /Copiar para área de transferência/i],
        ['menu vazado (3+ bullets)', /(?:•[^\n•]*){3,}/],
      ];
      for (const [nome, re] of sigs) if (re.test(c)) return { detalhe: nome, amostra: redor(c, re) };
      return null;
    },
  },
  {
    id: 'C2', sev: 'MÉDIA', titulo: 'Placeholder de formulário-modelo',
    run: (c) => {
      const re = /<NOME DO [A-ZÇÃÉ ]+>|<CARGO>|<ÓRGÃO>/;
      return re.test(c) ? { detalhe: 'anexo de formulário vazou para o corpo', amostra: redor(c, re) } : null;
    },
  },

  // ---------- D. Encoding ----------
  {
    id: 'D1', sev: 'ALTA', titulo: 'Caractere de substituição (encoding quebrado)',
    run: (c) => {
      const re = /�/;
      return re.test(c) ? { detalhe: 'U+FFFD presente — charset mal detectado no scrape', amostra: redor(c, re) } : null;
    },
  },
  {
    id: 'D2', sev: 'ALTA', titulo: 'Mojibake (UTF-8 lido como Latin-1)',
    run: (c) => {
      const re = /Ã[£§©¡³­©ºâ]|â€[œ™“”]|Ã‡|Ãµ/;
      return re.test(c) ? { detalhe: 'sequência típica de dupla decodificação', amostra: redor(c, re) } : null;
    },
  },
  {
    id: 'D3', sev: 'MÉDIA', titulo: 'Caracteres de controle C1',
    run: (c) => {
      const re = /[\u0080-\u009F]/;
      return re.test(c) ? { detalhe: 'bytes de controle no texto', amostra: JSON.stringify(redor(c, re, 40)) } : null;
    },
  },
  {
    id: 'D4', sev: 'BAIXA', titulo: 'NBSP remanescente',
    run: (c) => {
      const n = (c.match(/ /g) || []).length;
      return n > 0 ? { detalhe: `${n} NBSP não normalizado(s)`, amostra: redor(c, / /, 50) } : null;
    },
  },

  // ---------- E. Completude ----------
  {
    id: 'E1', sev: 'ALTA', titulo: 'Conteúdo curto demais',
    run: (c) => (c.length < 400 ? { detalhe: `apenas ${c.length} chars — provável truncamento ou shell da página`, amostra: JSON.stringify(c.slice(0, 90)) } : null),
  },
  {
    id: 'E2', sev: 'ALTA', titulo: 'Sem articulação reconhecível',
    run: (c) => {
      const temArt = /(^|\n)\s*Art\.\s*\d/.test(c) || /(^|\n)\s*Parágrafo único/.test(c) || /(^|\n)\s*§\s*\d/.test(c);
      return temArt ? null : { detalhe: 'nenhum "Art. N", "§ N" ou "Parágrafo único" — pode não ser o texto da norma', amostra: JSON.stringify(c.slice(0, 90)) };
    },
  },
  {
    id: 'E3', sev: 'MÉDIA', titulo: 'Final abrupto',
    run: (c) => {
      // O asterisco solto e o whitespace final são resíduo conhecido do Planalto.
      const t = c.trimEnd().replace(/[\s*]+$/, '');
      // A frase do rodapé do DOU vem quebrada no meio ("Este texto não substitui o\npublicado
      // no DOU de ..."), então normalizamos o whitespace antes de procurá-la.
      const fim = t.slice(-260).replace(/\s+/g, ' ');
      const ultimaLinha = (t.split('\n').pop() ?? '').trim();
      const plausivel =
        /[.!?"')\]:;]$/.test(t) ||
        /não substitui/i.test(fim) ||
        /publicado no D\.?\s?O\.?\s?U/i.test(fim) ||
        // assinatura: linha em CAIXA ALTA, ou cargo em title case logo após um nome
        /^[A-ZÀ-Ú][A-ZÀ-Ú\s.'-]{4,}$/.test(ultimaLinha) ||
        /^(Secretári|Ministr|Diretor|President|Coordenador|Chefe|Superintendent|Procurador|Advogad)/i.test(ultimaLinha) ||
        // anexos que terminam em tabela de quantitativos (linhas de números / TOTAL)
        /(^|\s)(TOTAL|SUBTOTAL)\b/i.test(fim) ||
        /^[\d.,%\s]+$/.test(ultimaLinha) ||
        // campo de assinatura de minuta ("Nome do Representante Legal", "Cargo", "Órgão")
        /^(Nome|Cargo|Órgão|Local e data|Assinatura)\b/i.test(ultimaLinha);
      return plausivel ? null : { detalhe: 'termina sem pontuação, assinatura, tabela ou rodapé do DOU', amostra: JSON.stringify(t.slice(-80)) };
    },
  },
  {
    id: 'A2', sev: 'MÉDIA', titulo: 'Assinatura colada no cargo',
    run: (c) => {
      // "ANTONIO PAULO VOGEL DE MEDEIROSSecretário de Gestão" — nome em caixa alta
      // seguido imediatamente pelo cargo em title case, sem quebra. Exige 3+ letras
      // maiúsculas antes para não pegar sigla curta legítima (ex.: "CNPJn").
      const re = /[A-ZÀ-Ú]{3,}(Secretári|Ministr|Diretor|President|Coordenador|Chefe|Superintendent|Procurador|Advogad|Assessor)[aoe]/;
      return re.test(c) ? { detalhe: 'nome do signatário fundido com o cargo', amostra: redor(c, re, 60) } : null;
    },
  },
];

async function main() {
  const atos = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, issuer: true, officialUrl: true, content: true, scrapeStatus: true },
    orderBy: { fullNumber: 'asc' },
  });

  const comConteudo = atos.filter(a => (a.content ?? '').trim().length > 0);
  const semConteudo = atos.filter(a => !(a.content ?? '').trim().length);

  const achados: Achado[] = [];
  let erroRender = 0;

  for (const a of comConteudo) {
    const c = a.content!;
    let md = '';
    try {
      md = formatLegalContent(c);
    } catch (err) {
      erroRender++;
      achados.push({
        id: a.fullNumber, check: 'B0', sev: 'ALTA', titulo: 'formatLegalContent lançou exceção',
        detalhe: err instanceof Error ? err.message : String(err), amostra: '',
      });
      continue;
    }
    for (const chk of CHECKS) {
      if (ONLY && chk.id !== ONLY) continue;
      const r = chk.run(c, md);
      if (r) achados.push({ id: a.fullNumber, check: chk.id, sev: chk.sev, titulo: chk.titulo, detalhe: r.detalhe, amostra: r.amostra });
    }
  }

  // ---------- Relatório ----------
  console.log('='.repeat(78));
  console.log('AUDITORIA DE FORMATAÇÃO — ATOS NORMATIVOS');
  console.log('='.repeat(78));
  console.log(`atos no banco: ${atos.length}`);
  console.log(`  com texto integral: ${comConteudo.length}`);
  console.log(`  sem texto integral: ${semConteudo.length}${semConteudo.length ? '  (fora do escopo desta auditoria)' : ''}`);
  console.log(`checagens aplicadas: ${ONLY ? ONLY : CHECKS.length} por ato`);
  console.log(`exceções ao renderizar: ${erroRender}`);

  const porCheck = new Map<string, Achado[]>();
  for (const f of achados) {
    if (!porCheck.has(f.check)) porCheck.set(f.check, []);
    porCheck.get(f.check)!.push(f);
  }

  const atosComAchado = new Set(achados.map(f => f.id));
  console.log(`\nATOS COM ALGUM ACHADO: ${atosComAchado.size} de ${comConteudo.length}`);

  if (achados.length === 0) {
    console.log('\n✓ Nenhum defeito de formatação encontrado.');
  } else {
    console.log('\n--- por checagem ---');
    const ordem = ['ALTA', 'MÉDIA', 'BAIXA'];
    const lista = [...porCheck.entries()].sort((a, b) => {
      const sa = ordem.indexOf(a[1][0].sev), sb = ordem.indexOf(b[1][0].sev);
      return sa !== sb ? sa - sb : b[1].length - a[1].length;
    });
    for (const [id, fs] of lista) {
      console.log(`\n[${id}] ${fs[0].sev}  ${fs[0].titulo}  →  ${fs.length} ato(s)`);
      const mostrar = VERBOSE ? fs : fs.slice(0, 6);
      for (const f of mostrar) {
        console.log(`    ${f.id.padEnd(32)} ${f.detalhe}`);
        if (f.amostra) console.log(`        ${f.amostra.slice(0, 150)}`);
      }
      if (!VERBOSE && fs.length > mostrar.length) console.log(`    ... e mais ${fs.length - mostrar.length} (use --verbose)`);
    }
  }

  if (semConteudo.length) {
    console.log('\n--- atos SEM texto integral (não auditáveis) ---');
    for (const a of semConteudo.slice(0, 20)) {
      console.log(`    ${a.fullNumber.padEnd(32)} scrapeStatus=${a.scrapeStatus ?? 'null'}`);
    }
    if (semConteudo.length > 20) console.log(`    ... e mais ${semConteudo.length - 20}`);
  }

  console.log('\n' + '='.repeat(78));
}

main()
  .catch((err) => { console.error('ERRO:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
