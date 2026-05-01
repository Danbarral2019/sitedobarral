/**
 * Normalização pós-extração para scrapers de legislação.
 *
 * Funções puras, sem I/O, sem state global.
 * Cada função aceita string e retorna string transformada.
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
  result = collapseWhitespace(result);
  result = stripDouBoilerplate(result);
  result = stripGovbrUiNoise(result);
  result = stripFormAnnex(result);
  result = dedupeBoilerplateFooter(result);
  return collapseWhitespace(result);
}
