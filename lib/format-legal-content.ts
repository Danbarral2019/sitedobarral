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
    /^Presidência da República$/i,
    /^Brasão das Armas/i,
    /^Casa Civil$/i,
    /^Secretaria (Especial|Geral|-)/i,
    /^Subchefia/i,
  ];
  let startIdx = 0;
  while (startIdx < rawParagraphs.length && headerPatterns.some(p => p.test(rawParagraphs[startIdx]))) {
    startIdx++;
  }

  if (startIdx < rawParagraphs.length) {
    if (/^(DECRETO|LEI|PORTARIA|INSTRUÇÃO NORMATIVA|MEDIDA PROVISÓRIA)\s+N[ºo°]\s/i.test(rawParagraphs[startIdx])) {
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

  // Step 3: Merge broken sentences
  // Merge when prev doesn't end with terminal punctuation AND neither side is
  // a heading AND the current paragraph doesn't start with Art/§/Parágrafo.
  const merged: string[] = [];
  for (const p of filtered) {
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      const prevEndsClean = /[.;:!?)"']$/.test(prev.trim());
      const prevIsHeading = isHeading(prev);
      const curIsHeading = isHeading(p);
      // Não mergear quando o atual começa com algum marcador estrutural
      // (artigo, parágrafo, inciso romano ou alínea) — caso contrário
      // "II - ... ; e III - ..." ficam grudados num único parágrafo.
      const curIsStructural =
        /^(Art\.\s|§\s*\d|Parágrafo único|[IVXLCDM]+\s*[-–—]\s|[a-z]\)\s)/i.test(p);

      if (!prevEndsClean && !prevIsHeading && !curIsHeading && !curIsStructural) {
        merged[merged.length - 1] = prev + ' ' + p;
        continue;
      }
    }
    merged.push(p);
  }

  // Step 4: Format each paragraph into markdown
  const result: string[] = [];
  let prevWasHeader = false;

  for (let p of merged) {
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

    // --- Separator markers ---

    if (/^(DECRETA|RESOLVE)\s*:?\s*$/i.test(p)) {
      result.push('---');
      continue;
    }

    if (/,\s*resolve\s*:\s*$/i.test(p)) {
      result.push(p);
      result.push('---');
      continue;
    }

    // --- Articles and paragraphs (case-sensitive: "Art." not "art.") ---

    p = p.replace(/^(Art\.\s*\d+[ºo°]?(?:-[A-Z])?\.?)(\s*)/, '**$1** ');
    p = p.replace(/^(§\s*\d+[ºo°]?\.?)(\s*)/, '**$1** ');
    p = p.replace(/^(Parágrafo único\.?)(\s*)/i, '**$1** ');
    p = p.replace(/\*\*\s{2,}/g, '** ');

    // --- Signature and closing ---

    if (/^Brasília,\s+\d+/i.test(p)) {
      result.push('---');
      result.push('*' + p + '*');
      continue;
    }

    if (result.length > 0 && isAfterSignature(result) && p === p.toUpperCase() && p.length < 80) {
      result.push('*' + p + '*');
      continue;
    }

    if (/^Este texto não substitui/i.test(p)) {
      result.push('> *' + p + '*');
      continue;
    }

    // All-caps short text within body (table headers, labels)
    if (p === p.toUpperCase() && p.length > 10 && p.length < 200 && /[A-Z]/.test(p)) {
      result.push('**' + toTitleCase(p) + '**');
      continue;
    }

    result.push(p);
  }

  return result.join('\n\n');
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

function isAfterSignature(result: string[]): boolean {
  for (let i = result.length - 1; i >= Math.max(0, result.length - 5); i--) {
    if (/\*Brasília/.test(result[i])) return true;
  }
  return false;
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
