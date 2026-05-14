/**
 * Converts scraped legal text content into well-formatted markdown.
 * Handles texts from planalto.gov.br (with extra whitespace) and
 * SEGES/MGI portals (cleaner format).
 */
export function formatLegalContent(rawContent: string): string {
  const lines = rawContent.split('\n').map(l => l.trim());

  // Step 1: Smart paragraph building
  const rawParagraphs: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line === '') {
      if (current.length > 0) {
        rawParagraphs.push(current.join(' '));
        current = [];
      }
      continue;
    }

    // Force break when a line starts with a structural marker
    if (current.length > 0 && isStructuralStart(line)) {
      rawParagraphs.push(current.join(' '));
      current = [line];
      continue;
    }

    // Force break for subtitle-like lines that come right after a HEADING
    // (not after articles/items — those are continuations, not subtitles)
    if (
      current.length === 1 &&
      isHeading(current[0]) &&
      !isStructuralStart(line) &&
      !isAllCapsShort(line) &&
      line.length < 100
    ) {
      rawParagraphs.push(current[0]);
      current = [line];
      continue;
    }

    current.push(line);
  }
  if (current.length > 0) {
    rawParagraphs.push(current.join(' '));
  }

  // Step 2: Remove institutional header block BEFORE merging
  const headerPatterns = [
    /^Presidência da República(\s|$)/i,
    /^Brasão das Armas/i,
    /^Casa Civil(\s|$)/i,
    /^Secretaria (Especial|Geral|-)/i,
    /^Subchefia/i,
  ];
  let startIdx = 0;
  while (startIdx < rawParagraphs.length && headerPatterns.some(p => p.test(rawParagraphs[startIdx]))) {
    startIdx++;
  }

  let officialTitle: string | null = null;
  if (startIdx < rawParagraphs.length) {
    if (/^(DECRETO|LEI|PORTARIA|INSTRUÇÃO NORMATIVA|MEDIDA PROVISÓRIA|RESOLUÇÃO|ORDEM DE SERVIÇO)\s+N[ºo°]\s/i.test(rawParagraphs[startIdx])) {
      officialTitle = rawParagraphs[startIdx];
      startIdx++;
    }
  }

  let filtered = rawParagraphs.slice(startIdx);
  filtered = filtered.filter(p => !/^Vigência$/i.test(p));

  while (
    filtered.length > 0 &&
    /^(Perguntas e Respostas|Modelo de check ?list|Documento de Formalização)/i.test(filtered[0]) &&
    filtered[0].length < 80
  ) {
    filtered.shift();
  }

  // Step 3: Merge broken sentences (reforçado)
  const merged: string[] = [];
  for (const p of filtered) {
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      const prevTrim = prev.trim();
      const prevEndsClean = /[.;:!?)"']$/.test(prevTrim);
      const prevIsHeading = isHeading(prev);
      const curIsHeading = isHeading(p);
      // Não mergear quando o atual começa com algum marcador estrutural
      // (artigo, parágrafo, inciso romano ou alínea) — caso contrário
      // "II - ... ; e III - ..." ficam grudados num único parágrafo.
      // Nota: Art\. é case-sensitive para não bloquear "art. 8º" em continuações.
      const curIsStructural =
        /^(Art\.\s|§\s*\d|Parágrafo único|[IVXLCDM]+\s*[-–—]\s|[a-z]\)\s)/.test(p) ||
        /^parágrafo único/i.test(p);

      // Sinais adicionais de continuação:
      const prevEndsWithStopWord = /\b(no|na|do|da|dos|das|o|a|os|as|em|de|com|por|para|sob|que)$/i.test(prevTrim);
      const prevEndsWithSingleLetter = /\s[A-Za-z]$/.test(prevTrim);
      const prevEndsWithArtAbbrev = /\bart\.?$/i.test(prevTrim);
      const curStartsLowercase = /^[a-záàâãéêíóôõúç]/.test(p);
      const curStartsWithNumber = /^\d/.test(p);
      const curStartsWithCrossRef = /^(art\.|inciso|Lei|Decreto|caput)/i.test(p);

      const shouldMerge =
        // regra antiga
        (!prevEndsClean && !prevIsHeading && !curIsHeading && !curIsStructural) ||
        // novas regras
        prevEndsWithStopWord ||
        prevEndsWithSingleLetter ||
        prevEndsWithArtAbbrev ||
        (curStartsLowercase && !prevEndsClean) ||
        (curStartsWithNumber && prevEndsWithArtAbbrev) ||
        (curStartsWithCrossRef && !prevEndsClean && !prevIsHeading);

      if (shouldMerge && !curIsStructural) {
        merged[merged.length - 1] = prev + ' ' + p;
        continue;
      }
    }
    merged.push(p);
  }

  // Step 3.5 — Detectar blocos de alteração entre aspas curvas "…"
  // Faz balanceamento de contador. Se não fechar até o fim, devolve original (fail-safe).
  const withAlteracaoBlocks = wrapAlteracaoBlocks(merged);

  // Step 4: Format each paragraph into markdown
  const result: string[] = [];
  let prevWasHeader = false;
  let inSignatureZone = false;

  for (let p of withAlteracaoBlocks) {
    // E — caput em itálico (word boundary)
    p = p.replace(/\bcaput\b/g, '*caput*');
    // C — [...] (com ou sem espaços) vira :omitido
    p = p.replace(/\[\s*\.{3,}\s*\]/g, ':omitido');
    // D — (NR) no fim do parágrafo vira diretiva inline
    p = p.replace(/\s\(NR\)\s*$/, ' :nr[(NR)]');
    p = p.replace(/\s{2,}/g, ' ').trim();
    if (!p) continue;

    // --- Structural headers ---

    if (/^CAPÍTULO\s+/i.test(p)) {
      result.push('## ' + p);
      prevWasHeader = true;
      continue;
    }

    if (/^TÍTULO\s+/i.test(p) && p.length < 80) {
      result.push('## ' + p);
      prevWasHeader = true;
      continue;
    }

    if (/^SEÇÃO\s+/i.test(p)) {
      result.push('### ' + p);
      prevWasHeader = true;
      continue;
    }

    if (/^SUBSEÇÃO\s+/i.test(p)) {
      result.push('#### ' + p);
      prevWasHeader = true;
      continue;
    }

    // ANEXO header (case-sensitive: "ANEXO" not "Anexo.")
    if (/^ANEXO(\s|$)/.test(p) && p.length < 80) {
      result.push('## ' + p);
      prevWasHeader = true;
      continue;
    }

    // All-caps section names (DAS DISPOSIÇÕES PRELIMINARES, etc.)
    if (/^(DAS?\s|DOS?\s|DISPOSIÇÕES)/i.test(p) && p === p.toUpperCase() && p.length < 120) {
      result.push('### ' + toTitleCase(p));
      prevWasHeader = true;
      continue;
    }

    // Short mixed-case subtitle right after a header
    if (prevWasHeader && p.length < 100 && !/^Art\.\s/.test(p) && !p.startsWith('§') && !/^\d/.test(p) && !p.startsWith('O ') && !p.startsWith('A ')) {
      result.push('#### ' + p);
      prevWasHeader = false;
      continue;
    }

    prevWasHeader = false;

    // G — Preâmbulo: "O <SUJEITO EM CAIXA ALTA>" vira bold parcial
    p = p.replace(
      /^(O\s+(?:PRESIDENTE\s+DA\s+REPÚBLICA|CONGRESSO\s+NACIONAL|MINISTRO\s+DE\s+ESTADO[^,]+|GOVERNADOR[^,]+|PREFEITO[^,]+))(,|\s)/i,
      '**$1**$2'
    );

    // --- Separator markers ---

    if (/^(DECRETA|RESOLVE|PROMULGA)\s*:?\s*$/i.test(p)) {
      const verb = p.replace(/[:\s]/g, '').toUpperCase();
      result.push(`**${verb}:**`);
      continue;
    }

    // --- Articles and paragraphs (case-sensitive: "Art." not "art.") ---

    p = p.replace(/^(Art\.\s*\d+[ºo°]?(?:-[A-Z])?\.?)(\s*)/, '**$1** ');
    p = p.replace(/^(§\s*\d+[ºo°]?\.?)(\s*)/, '**$1** ');
    p = p.replace(/^(Parágrafo único\.?)(\s*)/i, '**$1** ');
    p = p.replace(/\*\*\s{2,}/g, '** ');

    // --- Signature zone detection ---
    if (/^Brasília,\s+\d+/i.test(p)) {
      inSignatureZone = true;
    }

    if (/^Este texto não substitui/i.test(p)) {
      result.push('> *' + p + '*');
      continue;
    }

    // All-caps short text within body (table headers, labels)
    // Skip inside signature zone — signatories must remain as-is for wrapSignature
    if (!inSignatureZone && p === p.toUpperCase() && p.length > 10 && p.length < 200 && /[A-Z]/.test(p)) {
      result.push('**' + toTitleCase(p) + '**');
      continue;
    }

    result.push(p);
  }

  // H — Envolver assinatura final (Brasília + assinantes) em :::signature
  const withSignature = wrapSignature(result);
  const body = withSignature.join('\n\n');
  return officialTitle ? `# ${officialTitle}\n\n${body}` : body;
}

/**
 * Envolve sequências de parágrafos delimitadas por aspas curvas "…" em
 * marcadores :::alteracao ... ::: para destaque visual no Planalto-like CSS.
 * Tolera aspas aninhadas via contador. Se não fechar, devolve original.
 */
function wrapAlteracaoBlocks(paragraphs: string[]): string[] {
  // Detecta se há aspas curvas no texto. Se não houver, retorna sem modificação.
  const hasCurlyQuotes = paragraphs.some(p => /[“”]/.test(p));
  if (!hasCurlyQuotes) return paragraphs;

  // Verifica balanceamento total: número de " deve ser igual a número de ".
  let opens = 0;
  let closes = 0;
  for (const p of paragraphs) {
    opens += (p.match(/“/g) || []).length;
    closes += (p.match(/”/g) || []).length;
  }
  if (opens !== closes || opens === 0) {
    return paragraphs; // fail-safe
  }

  const result: string[] = [];
  let buffer: string[] = [];
  let depth = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const localOpens = (p.match(/“/g) || []).length;
    const localCloses = (p.match(/”/g) || []).length;
    const wasZero = depth === 0;

    // Apply opens first (before checking entry)
    depth += localOpens;

    if (wasZero && localOpens > 0) {
      // Abriu bloco neste parágrafo
      result.push(':::alteracao');
    }

    // Remove as aspas curvas do texto agora dentro do bloco (visualmente o
    // CSS já delimita o bloco; manter as aspas seria redundante).
    const stripped = p.replace(/[“”]/g, '').trim();
    if (stripped) {
      if (depth > 0) {
        buffer.push(stripped);
      } else {
        result.push(stripped);
      }
    }

    // Apply closes after content (to detect exit)
    depth -= localCloses;

    if (depth === 0 && buffer.length > 0) {
      // Fechou bloco neste parágrafo
      result.push(...buffer);
      result.push(':::');
      buffer = [];
    }
  }

  // Defesa final: se algo sobrou no buffer (não deveria, já validamos), devolve original.
  if (buffer.length > 0) return paragraphs;
  return result;
}

/** Checks if a line starts a new structural element in legal text */
function isStructuralStart(line: string): boolean {
  const patterns = [
    /^CAPÍTULO\s/i,
    /^SEÇÃO\s/i,
    /^SUBSEÇÃO\s/i,
    /^TÍTULO\s/i,
    /^Art\.\s/,             // Case-sensitive
    /^§\s*\d/,              // §1º, §2º, §10 (com ou sem espaço entre § e dígito)
    /^Parágrafo único/i,
    /^[IVXLCDM]+\s*[-–]/,  // Roman numeral items
    /^[a-z]\)\s/,           // Alphabetical items
    /^(DECRETA|RESOLVE)\s*:?\s*$/i,
    /^ANEXO(\s|$)/,         // Case-sensitive
    /^Brasília,\s/i,
    /^Este texto não substitui/i,
  ];

  if (patterns.some(p => p.test(line))) return true;
  if (isAllCapsShort(line)) return true;

  return false;
}

/**
 * Checks if text is a standalone heading (CAPÍTULO, SEÇÃO, all-caps section names).
 * Used for merge prevention and subtitle detection.
 * Excludes Art/§/items/notes which are content paragraphs.
 */
function isHeading(text: string): boolean {
  const patterns = [
    /^CAPÍTULO\s/i,
    /^SEÇÃO\s/i,
    /^SUBSEÇÃO\s/i,
    /^TÍTULO\s/i,
    /^(DECRETA|RESOLVE)\s*:?\s*$/i,
    /^ANEXO(\s|$)/,
    /^Brasília,\s/i,
  ];
  return patterns.some(p => p.test(text)) || isAllCapsShort(text);
}

function isAllCapsShort(text: string): boolean {
  // Exclude roman numeral items (I -, II -, etc.)
  if (/^[IVXLCDM]+\s*[-–]/.test(text)) return false;
  return text === text.toUpperCase() && text.length > 3 && text.length < 120 && /[A-Z]/.test(text);
}

/**
 * Localiza o parágrafo "Brasília, <data>..." e envolve dele até o final
 * (incluindo assinantes em CAIXA ALTA ou Title Case) em :::signature.
 */
function wrapSignature(paragraphs: string[]): string[] {
  const idx = paragraphs.findIndex(p => /^Brasília,\s+\d/i.test(p));
  if (idx === -1) return paragraphs;

  const before = paragraphs.slice(0, idx);
  const sigBlock = paragraphs.slice(idx);

  return [...before, ':::signature', ...sigBlock, ':::'];
}

function toTitleCase(text: string): string {
  const lowercase = ['da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'ou', 'para', 'por', 'com', 'a', 'o', 'à', 'ao'];
  return text
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i === 0 || !lowercase.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}
