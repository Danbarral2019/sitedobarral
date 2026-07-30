/**
 * Normalização pós-extração para scrapers de legislação.
 *
 * Funções puras, sem I/O, sem state global.
 * Cada função aceita string e retorna string transformada.
 * (Exceção: `blockAwareText` recebe um nó Cheerio — é a fronteira entre o HTML
 * e o texto, e opera sobre um clone, sem mutar o documento de entrada.)
 */

/**
 * Detecta o charset declarado pelo servidor + meta tags do HTML, com fallback
 * via sniffing: se a decodificação UTF-8 produz bytes inválidos, assume
 * ISO-8859-1.
 *
 * Muitas páginas do planalto.gov.br não declaram charset (nem header nem
 * <meta>) e servem ISO-8859-1. Sem o sniff, fetch().text() decodifica como
 * UTF-8 e chars acentuados viram U+FFFD ("Bras�lia").
 *
 * Estratégia:
 *   1. Content-Type header (ex: "text/html; charset=ISO-8859-1")
 *   2. <meta charset> ou <meta http-equiv="Content-Type"> nos primeiros 2KB
 *   3. Sniff: tenta UTF-8 com fatal=true. Se falha (= bytes inválidos),
 *      assume ISO-8859-1 (cobertura prática para sites .gov.br legados).
 */
export function detectCharsetFromResponse(
  contentTypeHeader: string | null,
  buffer: ArrayBuffer,
): string {
  if (contentTypeHeader) {
    const m = contentTypeHeader.match(/charset=([^\s;]+)/i);
    if (m) return normalizeCharsetName(m[1]);
  }
  const head = new TextDecoder('latin1').decode(buffer.slice(0, 2048));
  const m1 = head.match(/<meta[^>]+charset=["']?([^"'>;\s]+)/i);
  if (m1) return normalizeCharsetName(m1[1]);
  const m2 = head.match(/<meta[^>]+http-equiv=["']?content-type["']?[^>]+charset=([^"'>;\s]+)/i);
  if (m2) return normalizeCharsetName(m2[1]);

  // Sniff: tenta UTF-8 estrito; se falha, é provavelmente ISO-8859-1.
  // Limitamos o sniff aos primeiros 64KB para não pagar custo em páginas grandes.
  const sample = buffer.slice(0, Math.min(buffer.byteLength, 64 * 1024));
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return 'utf-8';
  } catch {
    return 'iso-8859-1';
  }
}

function normalizeCharsetName(c: string): string {
  const lower = c.toLowerCase().trim();
  if (lower === 'iso-8859-1' || lower === 'latin1' || lower === 'latin-1') return 'iso-8859-1';
  if (lower === 'windows-1252' || lower === 'cp1252' || lower === 'win1252') return 'windows-1252';
  if (lower === 'utf-8' || lower === 'utf8') return 'utf-8';
  return lower;
}

/**
 * Elementos que representam quebra de bloco no HTML. O texto de dois destes,
 * lado a lado, NUNCA pode sair concatenado.
 */
const BLOCK_LEVEL_SELECTOR =
  'p,div,br,li,tr,section,article,blockquote,h1,h2,h3,h4,h5,h6,dt,dd,pre,figcaption';

/**
 * Extrai o texto de um elemento preservando as fronteiras de bloco.
 *
 * `Cheerio.text()` concatena o textContent de todos os descendentes SEM
 * separador nenhum, de modo que `<p>CAPÍTULO I</p><p>DISPOSIÇÕES</p>` vira
 * "CAPÍTULO IDISPOSIÇÕES". Em texto normativo isso é destrutivo: funde o
 * título do capítulo com o subtítulo, o subtítulo com o `Art. 1º`, e um inciso
 * com o seguinte — e o texto fundido ainda contamina o chunking dos embeddings.
 *
 * Aqui, cada elemento de bloco recebe uma quebra antes e depois, num CLONE
 * desanexado (o documento original não é mutado, então chamadas repetidas
 * sobre o mesmo `$` são idempotentes). Elementos inline (`<em>`, `<strong>`,
 * `<a>`) continuam sem quebra — não são fronteira de parágrafo.
 *
 * O `collapseWhitespace` a jusante reduz os runs de `\n` resultantes.
 */
export function blockAwareText(el: cheerio.Cheerio): string {
  const clone = el.clone();
  clone.find(BLOCK_LEVEL_SELECTOR).before('\n').after('\n');
  return clone.text();
}

/**
 * Colapsa espaços em branco em excesso.
 *
 * - Remove espaços/NBSP no início e fim de cada linha.
 * - Linhas com apenas whitespace (incluindo NBSP \u00A0) viram linhas vazias.
 * - Runs de 2+ linhas vazias colapsam para exatamente uma linha em branco (\n\n).
 * - Runs de espaços múltiplos dentro de uma linha colapsam para 1 espaço.
 * - Trim final.
 */
export function collapseWhitespace(text: string): string {
  return text
    // Normalizar EOL
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Linhas "vazias" com apenas whitespace/NBSP → string vazia
    .replace(/^[\s\u00A0]+$/gm, '')
    // Trim por linha
    .replace(/^[ \t\u00A0]+|[ \t\u00A0]+$/gm, '')
    // Múltiplos espaços/tabs/NBSP internos → 1 espaço comum
    // (NBSP   inline raramente é intencional em texto scraped — poluí
    // busca full-text e quebra wrap natural no CSS)
    .replace(/[ \t ]+/g, ' ')
    // Runs de 3+ \n → 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim geral
    .trim();
}

/**
 * Remove caracteres invisíveis que sobrevivem a collapseWhitespace mas poluem
 * busca, quebram word-break do CSS e atrapalham diff entre versões.
 *
 * Cobre:
 * - U+200B ZERO WIDTH SPACE — comum em copy-paste de PDF/Word
 * - U+200C ZERO WIDTH NON-JOINER
 * - U+200D ZERO WIDTH JOINER
 * - U+FEFF ZERO WIDTH NO-BREAK SPACE / BOM
 * - U+2060 WORD JOINER
 *
 * Visto em prod: "contratados;​b)" (ZWSP entre `;` e `b)` em IN SEGES/MP 5/2017),
 * "Dimensionamento​​​​" em Portaria SGD/MGI 5.950/2023.
 */
export function stripZeroWidthChars(text: string): string {
  return text.replace(/[​‌‍﻿⁠]/g, '');
}

/**
 * Junta quebras de linha "soft" — `\n` solo (não `\n\n`) que aparece no meio
 * de frases por causa do HTML do Planalto servir `<br>` em qualquer ponto do
 * texto. Sem tratamento, o texto fica cheio de quebras estranhas como:
 *
 *   "I –\n0,5% (cinco décimos por cento)..."
 *   "§ 1º\nA penalidade será..."
 *   "Art. 86.\nO auxílio-acidente..."
 *   "texto\nimportante"  (wrap genérico de parágrafo)
 *
 * Estratégia (apenas `\n` SOLO; `\n\n` parágrafo preservado):
 *
 *  1. Junta linha que termina em en/em-dash com próxima ("I –\n0,5%").
 *  2. Junta linha que termina em "Art. Nº" / "§ Nº" sozinho com próxima
 *     (autoridade do enumerador, mas o texto continua).
 *  3. Junta linha que termina em enumerador romano (I, II, III...) com
 *     próxima que começa com dash ("III\n– texto").
 *  4. WRAP GENÉRICO: linha termina em letra/dígito (não pontuação final)
 *     E próxima começa em letra minúscula → wrap quebrado, junta.
 *     Excluímos casos onde a próxima linha começa com marker de lista
 *     ("a)", "b)", "1.", "1)") pra não fundir items de listas.
 *
 * Audit em 2026-05-13 (Daniel reportou): 44.698 wrap-meio-frase + ~2000
 * outros padrões em 138 atos. Lei 14.973/2024 é caso canônico.
 */
export function joinSoftLineBreaks(text: string): string {
  // 1) Linha termina em dash → unir com próxima (e remove espaços extras)
  let result = text.replace(/([–—])\s*\n(?!\n)\s*/g, '$1 ');

  // 2) "Art. Nº" / "Art. N." órfão antes de texto que começa maiúscula
  result = result.replace(
    /(\bArt\.\s*\d+(?:[ºo°])?\.?\s*)\n(?!\n)\s*(?=[A-ZÀ-ÝÂÊÎÔÛ"“])/g,
    '$1 ',
  );

  // 3) "§ Nº" órfão antes de texto que começa maiúscula
  result = result.replace(
    /(§\s*\d+(?:[ºo°])?\s*)\n(?!\n)\s*(?=[A-ZÀ-ÝÂÊÎÔÛ"“])/g,
    '$1 ',
  );

  // 4) Romano sozinho ("III") seguido de dash na próxima linha
  result = result.replace(/(\b[IVX]+)\s*\n(?!\n)\s*(?=[–—])/g, '$1 ');

  // 5) WRAP GENÉRICO: junta linha terminada em letra/dígito com próxima
  //    que começa minúscula. Excluímos markers de lista pra não fundir items.
  //    Approach line-by-line: mais robusto que regex pra excluir contexto.
  const LIST_MARKER = /^\s*(?:[a-z]\)|\d+[.)])/i;
  const ENDS_SOFT = /[a-záéíóúâêîôûãõç0-9]$/;
  const STARTS_LOWER = /^[a-záéíóúâêîôûãõç]/;
  const lines = result.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i];
    const next = lines[i + 1];
    // condição: curr não-vazia, next existe e não-vazia, e (curr+next) parece wrap
    if (
      curr !== '' &&
      next !== undefined &&
      next !== '' &&
      ENDS_SOFT.test(curr) &&
      STARTS_LOWER.test(next) &&
      !LIST_MARKER.test(next)
    ) {
      out.push(curr + ' ' + next.trimStart());
      i++; // consome a próxima
    } else {
      out.push(curr);
    }
  }
  return out.join('\n');
}

/**
 * Mapeia chars de controle C1 (U+0080–U+009F) que aparecem por causa de
 * páginas Windows-1252 mal decodificadas. Em Unicode esses codepoints são
 * "reserved" e funcionam como caracteres invisíveis/inválidos. No cp1252
 * o mesmo range é populado por punctuation comum (aspas curvas, dashes,
 * apóstrofes, bullet, reticências).
 *
 * Estratégia: substituir pelo equivalente Unicode adequado da cp1252.
 * Os 4 slots reservados em cp1252 (0x81, 0x8D, 0x8F, 0x90, 0x9D) caem em
 * espaço — não temos como saber o que era.
 *
 * Visto em prod (audit 2026-05-13): 68 atos afetados, ~1500 ocorrências.
 * Top offenders: U+0094/U+0093 (aspas curvas — 535/530x), U+0096 (en dash
 * — 411x), U+0092/U+0091 (apóstrofes — 22/14x), U+0085 (reticências — 10x).
 * Lei 14.973/2024 sozinha tinha 338 (Daniel reportou em 2026-05-13).
 */
export function mapCp1252Punctuation(text: string): string {
  // Map cp1252 byte → unicode codepoint correto
  const map: Record<string, string> = {
    '': '€', '': '‚', '': 'ƒ', '': '„', '': '…',
    '': '†', '': '‡', '': 'ˆ', '': '‰', '': 'Š',
    '': '‹', '': 'Œ', '': 'Ž',
    '': '‘', '': '’', // ‘ ’
    '': '“', '': '”', // “ ”
    '': '•', '': '–', '': '—', // – —
    '': '˜', '': '™', '': 'š',
    '': '›', '': 'œ', '': 'ž', '': 'Ÿ',
  };
  // Slots reservados em cp1252 (0x81, 0x8D, 0x8F, 0x90, 0x9D) — viram espaço
  return text.replace(/[-]/g, (ch) => map[ch] ?? ' ');
}

/**
 * Deduplica o rodapé "Este texto não substitui o publicado no DOU..." quando
 * aparece mais de uma vez no mesmo ato.
 *
 * Visto em prod: Lei 14.611/2023, Lei 14.973/2024 e Lei 14.230/2021 têm a
 * frase 2-3× — uma como rodapé do texto principal e outra(s) repetidas após
 * publicação de erratas/anexos. Mantemos apenas a ÚLTIMA (referencia a
 * publicação mais recente do DOU).
 *
 * Match captura a frase + o texto até a próxima quebra de parágrafo (incluindo
 * variações que continuam na linha de baixo, ex: "DOU de\n16.9.2024").
 *
 * É no-op quando há 0 ou 1 ocorrência.
 */
export function dedupeBoilerplateFooter(text: string): string {
  const pattern = /Este texto não substitui[^\n]*(?:\n[^\n]{0,80}?\d{4}[^\n]{0,80})?/g;
  const matches: { index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
  }
  if (matches.length <= 1) return text;
  let result = text;
  for (let i = matches.length - 2; i >= 0; i--) {
    const { index, length } = matches[i];
    let cutStart = index;
    while (cutStart > 0 && /[\n\s]/.test(result[cutStart - 1])) cutStart--;
    let cutEnd = index + length;
    while (cutEnd < result.length && /[\n\s]/.test(result[cutEnd])) cutEnd++;
    result = result.slice(0, cutStart) + '\n\n' + result.slice(cutEnd);
  }
  return result;
}

/**
 * Remove boilerplate DOU (in.gov.br).
 *
 * Aplicar APÓS extração + collapseWhitespace.
 *
 * Remove:
 * - Masthead: "Brasão do Brasil" + "Diário Oficial da União" + metadados
 *   ("Publicado em", "Edição", "Seção", "Página", "Órgão"), até o início
 *   do texto normativo (detectado por pattern "Instrução Normativa" ou
 *   "Portaria" ou "Decreto" ou "Resolução" ou "Lei").
 * - Footer: "Borda do rodapé" e "Logo da Imprensa" até o fim do texto.
 *
 * Preserva:
 * - "Este conteúdo não substitui..." (footer DOU legítimo)
 * - Todo o texto normativo entre masthead e footer.
 *
 * É no-op quando o texto não contém os markers.
 */
export function stripDouBoilerplate(text: string): string {
  let result = text;

  // Masthead: se contiver "Brasão do Brasil" (com ou sem chrome de wrapper
  // antes, como "Publicador de Conteúdos"/"Voltar"/"Compartilhe"), cortar
  // tudo desde o início até o começo do texto normativo (logo após "Órgão:").
  const brasaoIdx = result.indexOf('Brasão do Brasil');
  if (brasaoIdx >= 0) {
    const orgaoIdx = result.indexOf('Órgão:', brasaoIdx);
    if (orgaoIdx >= 0) {
      const afterOrgao = result.slice(orgaoIdx);
      const match = afterOrgao.match(/(?:Instrução Normativa|Portaria|Decreto|Resolução|Lei)[\s\S]*/);
      if (match) {
        result = match[0];
      }
    }
  }

  // Footer: cortar de "Borda do rodapé" em diante.
  const bordaIdx = result.indexOf('Borda do rodapé');
  if (bordaIdx >= 0) {
    result = result.slice(0, bordaIdx).trimEnd();
  }

  return result;
}

/**
 * Remove ruído de UI específico de gov.br/compras (Plone) do início e fim
 * do texto extraído.
 *
 * Início:
 * - Remove a linha "Info" solta no topo (breadcrumb visual do Plone).
 *
 * Fim:
 * - Corta do "Compartilhe:" em diante (botões de social share renderizados
 *   após o corpo do ato): "Compartilhe por Facebook / Twitter / LinkedIn /
 *   WhatsApp / link para Copiar...".
 *
 * Preserva "Este conteúdo não substitui o publicado no Diário Oficial..."
 * que é o footer DOU legítimo (geralmente vem ANTES do "Compartilhe:").
 *
 * É no-op quando os marcadores não estão presentes.
 */
export function stripGovbrUiNoise(text: string): string {
  let result = text;

  // 1. Header "Info" solto no topo (com possíveis whitespace antes)
  result = result.replace(/^\s*Info\s*\n+/i, '');

  // 2. Bloco "Compartilhe:" + lista de botões (Facebook/Twitter/LinkedIn/WhatsApp).
  // ATENÇÃO: gov.br/compras renderiza esse bloco MAIS DE UMA VEZ na página
  // (uma no header/sidebar, outra no rodapé do artigo). Estratégia:
  //   a) Encontrar todos os "Compartilhe:" e cortar do ÚLTIMO em diante (footer real)
  //   b) Iterar: depois do corte, se ainda houver "Compartilhe por X" sem o
  //      prefix "Compartilhe:" (resíduo do header), remover essas linhas isoladas
  // A heurística de segurança (não cortar se removeria >90%) protege contra
  // páginas onde "Compartilhe:" só aparece no header.
  const re = /\n\s*Compartilhe\s*:/gi;
  let lastShareIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(result)) !== null) {
    lastShareIdx = m.index;
  }
  if (lastShareIdx >= 0 && lastShareIdx >= text.length * 0.1) {
    result = result.slice(0, lastShareIdx).trimEnd();
  }

  // Resíduo do header (linhas isoladas tipo "Compartilhe por Facebook" sem
  // o prefix "Compartilhe:" — caso do header da fixture govbr-portaria-4932).
  // Remove cada linha que comece com "Compartilhe por " ou exatamente "Compartilhe:".
  result = result.replace(/^\s*Compartilhe(?:\s*:|\s+por\s+\w+).*$/gim, '');

  // Boilerplate da página de detalhe MGI/in.gov.br ("link para Copiar para área
  // de transferência\nPublicado em 13/09/2024 14h32\nAtualizado em ...\nPerguntas e respostas - IN ...").
  // Esses meta-blocos aparecem entre a ementa e "O SECRETÁRIO" — precisamos
  // remover linha-a-linha sem comer o corpo do ato.
  result = result
    .replace(/^\s*link para Copiar para área de transferência.*$/gim, '')
    .replace(/^\s*Copiar para área de transferência.*$/gim, '')
    .replace(/^\s*Publicado em\s*$/gim, '')
    .replace(/^\s*Publicado em\s+\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}h\d{1,2})?\s*$/gim, '')
    .replace(/^\s*Atualizado em\s*$/gim, '')
    .replace(/^\s*Atualizado em\s+\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}h\d{1,2})?\s*$/gim, '')
    .replace(/^\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}h\d{1,2}\s*$/gim, '') // só a data/hora solta
    .replace(/^\s*Perguntas e respostas\s*-\s*[^\n]{0,80}$/gim, '');

  // Lista de anexos/links da sidebar do gov.br vazada como linha de texto:
  // "• IN nº 5/2017 - hiperlink• Perguntas e Respostas• ENAP• ..." — sempre
  // colada num único parágrafo, com 3+ bullets `•` separando os itens.
  // Linhas legítimas com 1-2 bullets (raras em texto jurídico) são preservadas.
  result = result.replace(/^.*?(?:•[^\n•]*){3,}.*$/gm, '');

  // Bloco de metadados gov.br/compras vazado INLINE (sem quebras de linha)
  // entre a ementa e o início do ato. Padrão real visto em prod (IN SEGES/MGI
  // 52/2025, IN SEGES 460/2025, Portaria SEGES 15.496/2021):
  //   "...e dá outras providências.Publicado em 05/11/2025 09:54Modificado em 12/11/2025 16:48Compartilhe:O SECRETÁRIO..."
  // Substituímos a sequência por uma quebra de parágrafo, preservando o
  // ponto final do parágrafo anterior e o início do parágrafo seguinte.
  result = result.replace(
    /(?:Publicado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*\d{1,2}:\d{2}|\s*\d{1,2}h\d{2})?)?(?:Modificado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*\d{1,2}:\d{2}|\s*\d{1,2}h\d{2})?)?Compartilhe:/g,
    '\n\n',
  );
  // Caso o bloco "Publicado em.../Modificado em..." apareça SEM o "Compartilhe:"
  // no final (raro mas possível), também removemos:
  result = result.replace(
    /(?:Publicado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*\d{1,2}:\d{2}|\s*\d{1,2}h\d{2}))(?:Modificado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*\d{1,2}:\d{2}|\s*\d{1,2}h\d{2}))?(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g,
    '\n\n',
  );

  // Colapsa quebras de linha duplas excessivas geradas pelas remoções acima.
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Remove formulários-modelo anexados ao fim do texto normativo.
 *
 * Detecta o PRIMEIRO placeholder de formulário (`<NOME DO FISCAL TECNICO>`,
 * `<NOME DO GESTOR>`, `<NOME DO PREPOSTO>`) e corta do início da linha que
 * o contém em diante. Preserva tudo ANTES (incluindo "Este texto não substitui...").
 *
 * Também recua sobre linhas imediatamente anteriores do tipo
 * "Documento assinado eletronicamente" (contexto do form annex).
 *
 * É no-op quando não há placeholder.
 */
export function stripFormAnnex(text: string): string {
  const placeholder = /<NOME DO (?:FISCAL TECNICO|GESTOR|PREPOSTO)>/;
  const match = placeholder.exec(text);
  if (!match) return text;

  const idx = match.index;
  const lineStart = text.lastIndexOf('\n', idx - 1);
  const cutAt = lineStart >= 0 ? lineStart : 0;

  let result = text.slice(0, cutAt);
  const sigPattern = /\n\s*Documento assinado eletronicamente\s*$/;
  while (sigPattern.test(result)) {
    result = result.replace(sigPattern, '');
  }

  return result.trimEnd();
}

/**
 * Pipeline de normalização full-stack para texto bruto extraído de scrapers.
 *
 * Aplica os cleaners em ordem segura — cada um é no-op quando seu marker
 * específico não aparece, então rodar todos não tem efeito colateral em
 * texto que não os contém:
 *
 *   stripZeroWidthChars → collapseWhitespace
 *   → stripDouBoilerplate (in.gov.br)
 *   → stripGovbrUiNoise (gov.br/*)
 *   → stripFormAnnex (Plone forms)
 *   → dedupeBoilerplateFooter ("Este texto não substitui" duplicado)
 *   → collapseWhitespace (limpa whitespace que sobrou dos cortes)
 *
 * Use nos pontos do pipeline onde texto bruto entra no banco:
 * - cron import-dou ao salvar DOUStagingDocument.fullContent
 * - sync-dou-atos-normativos ao salvar LegislativeAct.ementa do abstract
 * - import-legislative-acts-batch ao receber `content` do JSON
 * - dou-scraper.scrapeContent() pós-extração
 *
 * É idempotente: rodar 2× produz o mesmo resultado de rodar 1×.
 * É no-op em string vazia/null/undefined (retorna a entrada).
 */
export function normalizeScrapedText(text: string | null | undefined): string {
  if (!text) return text ?? '';
  let result = stripZeroWidthChars(text);
  result = mapCp1252Punctuation(result);
  result = collapseWhitespace(result);
  result = stripDouBoilerplate(result);
  result = stripGovbrUiNoise(result);
  result = stripFormAnnex(result);
  result = dedupeBoilerplateFooter(result);
  // joinSoftLineBreaks por último: precisa do texto já limpo de boilerplate
  // (senão pode fundir lixo com conteúdo legítimo). Roda APÓS collapseWhitespace
  // final implicitamente porque preserva \n\n (paragráfos) e só toca \n solo.
  result = joinSoftLineBreaks(result);
  return collapseWhitespace(result);
}
