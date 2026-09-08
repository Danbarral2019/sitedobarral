/**
 * Gera o Markdown de um acórdão-líder e suas teses, para o acervo de RAG do
 * ELIC (spec §8.2).
 *
 * Um arquivo por acórdão-líder, não por tese: um enunciado isolado é uma frase
 * de súmula sem contexto, e a recuperação melhora quando as teses do mesmo
 * precedente, sua evidência e o relator chegam juntos.
 *
 * O frontmatter varia com o NÍVEL DE PROCEDÊNCIA (spec §4.3). Exigir
 * `acordaoKey` em todos deixaria 109 das 265 destilações inválidas — só 156
 * têm identidade oficial.
 */
import { sanitizeFilename, yamlStr } from './export';

export interface TrechoParaExport {
  ordem: number;
  trecho: string;
  origemNumero: number;
  origemAno: number;
  origemColegiado: string | null;
  origemUrl: string | null;
  origemLinkPDF: string | null;
  noVoto: boolean;
}

export interface EnunciadoParaExport {
  id: string;
  enunciado: string;
  inovacao: string;
  veredito: string | null;
  publicado: boolean;
  trechos: TrechoParaExport[];
}

export interface DestilacaoParaExport {
  id: string;
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  relatorAlvo: string | null;
  acordaoKey: string | null;
  urlAlvo: string | null;
  origemIdentidade: string | null;
  citantesConcordantes: number | null;
  assunto: string;
  confianca: string;
  dossieNoVoto: number;
  atualizadoEm: Date;
  enunciados: EnunciadoParaExport[];
}

/**
 * Colapsa espaço em branco para uma linha só.
 *
 * `assunto`, `enunciado` e `inovacao` vêm crus do JSON do modelo
 * (`lib/tcu/destilar-tese.ts`), sem normalização. Um `\n` em `assunto` quebra o
 * YAML do frontmatter — `yamlStr` escapa `\` e `"`, não newline — e derruba a
 * ingestão daquele arquivo no RAG; um `\n` em `enunciado` quebra o `##`. Os
 * trechos já chegam seguros, porque `aparar()` normaliza na captura
 * (`lib/tcu/trechos-de-citacao.ts`).
 */
function umaLinha(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Slug do colegiado para nome de arquivo: "Segunda Câmara" -> "segunda-camara". */
function slugColegiado(colegiado: string): string {
  return sanitizeFilename(
    colegiado.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-'),
  );
}

export function caminhoTese(d: DestilacaoParaExport): string {
  const partes = ['acordao', String(d.numeroAlvo), String(d.anoAlvo)];
  // O colegiado entra no nome APENAS quando conhecido: nomear
  // "acordao-2298-2025-plenario.md" sem saber afirmaria no caminho do arquivo
  // o que a tese não afirma no corpo.
  if (d.colegiadoAlvo) partes.push(slugColegiado(d.colegiadoAlvo));
  return `teses/${partes.join('-')}.md`;
}

export function gerarTeseMd(d: DestilacaoParaExport): string {
  const publicada = d.enunciados.some(e => e.publicado);
  const fm: string[] = [
    '---',
    'tipo: tese-tcu',
    `acordao: ${yamlStr(`${d.numeroAlvo}/${d.anoAlvo}`)}`,
    `numero: ${d.numeroAlvo}`,
    `ano: ${d.anoAlvo}`,
  ];
  if (d.relatorAlvo) fm.push(`relator: ${yamlStr(d.relatorAlvo)}`);
  fm.push(`assunto: ${yamlStr(umaLinha(d.assunto))}`);
  fm.push(`teses: ${d.enunciados.length}`);
  fm.push(`citacoesNoVoto: ${d.dossieNoVoto}`);
  fm.push(`confianca: ${d.confianca}`);
  fm.push(`vereditos: [${d.enunciados.map(e => e.veredito ?? 'null').join(', ')}]`);
  fm.push(`destilacaoId: ${yamlStr(d.id)}`);
  fm.push(`atualizadoEm: ${d.atualizadoEm.toISOString()}`);

  if (d.origemIdentidade) fm.push(`origemIdentidade: ${d.origemIdentidade}`);
  if (d.colegiadoAlvo) fm.push(`colegiado: ${yamlStr(d.colegiadoAlvo)}`);
  if (d.acordaoKey) fm.push(`acordaoKey: ${d.acordaoKey}`);
  if (d.urlAlvo) fm.push(`fonteOficial: ${d.urlAlvo}`);
  if (d.citantesConcordantes !== null) fm.push(`citantesConcordantes: ${d.citantesConcordantes}`);
  if (publicada) {
    const slug = [d.numeroAlvo, d.anoAlvo].join('-');
    const comColegiado = d.colegiadoAlvo ? `${slug}-${slugColegiado(d.colegiadoAlvo)}` : slug;
    fm.push(`fonteSite: https://profbarral.com.br/teses/${comColegiado}`);
  }
  fm.push('---', '', '');

  const corpo: string[] = [
    `# Acórdão ${d.numeroAlvo}/${d.anoAlvo}${d.colegiadoAlvo ? ` — ${d.colegiadoAlvo}` : ''}`,
    '',
    umaLinha(d.assunto),
    '',
  ];

  if (d.origemIdentidade === 'convergencia-citantes') {
    corpo.push(
      `> Colegiado segundo os ${d.citantesConcordantes ?? 0} votos citantes que o informam, ` +
        `todos concordantes. Sem confirmação no registro oficial do TCU.`,
      '',
    );
  } else if (!d.colegiadoAlvo) {
    corpo.push('> Colegiado não identificado: o TCU registra mais de um acórdão com este número e ano, e os votos citantes não convergem.', '');
  }

  for (const e of d.enunciados) {
    corpo.push(`## ${umaLinha(e.enunciado)}`, '');
    if (e.inovacao) corpo.push(`**Inovação:** ${umaLinha(e.inovacao)}`, '');
    corpo.push('**Trechos que sustentam a tese:**', '');
    for (const t of e.trechos) {
      const origem = `Acórdão ${t.origemNumero}/${t.origemAno}${t.origemColegiado ? ` — ${t.origemColegiado}` : ''}`;
      const link = t.origemUrl ?? t.origemLinkPDF;
      corpo.push(`- ${origem}${t.noVoto ? ' (voto)' : ''}${link ? ` — ${link}` : ''}`);
      corpo.push(`  > ${t.trecho}`, '');
    }
  }

  return fm.join('\n') + corpo.join('\n') + '\n';
}
