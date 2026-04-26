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

  // 2. Footer "Compartilhe:" — corta tudo a partir do bloco final.
  // ATENÇÃO: gov.br/compras renderiza "Compartilhe:" mais de uma vez na página
  // (uma no header/sidebar, outra no rodapé do artigo). Se cortássemos da
  // PRIMEIRA ocorrência, perderíamos o corpo inteiro do ato. Usamos a ÚLTIMA
  // ocorrência (rodapé real) como marker de corte.
  const re = /\n\s*Compartilhe\s*:/gi;
  let lastShareIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(result)) !== null) {
    lastShareIdx = m.index;
  }
  if (lastShareIdx >= 0) {
    // Heurística de segurança: se o corte removeria mais de 90% do texto
    // (sinal que estamos cortando no início, não no fim), pular o corte
    // pra evitar perder o conteúdo. Acontece em páginas onde "Compartilhe:"
    // só aparece no header e a heurística de last falha.
    const remaining = lastShareIdx;
    if (remaining >= text.length * 0.1) {
      result = result.slice(0, lastShareIdx).trimEnd();
    }
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
