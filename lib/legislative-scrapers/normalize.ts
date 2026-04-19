/**
 * Normalização pós-extração para scrapers de legislação.
 *
 * Funções puras, sem I/O, sem state global.
 * Cada função aceita string e retorna string transformada.
 */

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
    // Múltiplos espaços internos → 1
    .replace(/[ \t]+/g, ' ')
    // Runs de 3+ \n → 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim geral
    .trim();
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

  // Masthead: se começar com "Brasão do Brasil" (tolerando whitespace),
  // cortar tudo até o início do texto normativo.
  if (/^\s*Brasão do Brasil/.test(result)) {
    const orgaoIdx = result.indexOf('Órgão:');
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
