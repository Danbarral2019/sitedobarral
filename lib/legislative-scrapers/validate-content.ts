/**
 * Validador de conteúdo de ato normativo extraído.
 *
 * Detecta sinais clássicos de import problemático ANTES do conteúdo entrar
 * no banco — evita o ciclo "importa → usuário vê erro → debug manual" que
 * já aconteceu várias vezes (ex: IN 5/2017 com FAQ no lugar do texto).
 *
 * É uma função pura: recebe URL + content e retorna lista de errors + warnings.
 *
 * - **errors** bloqueiam o import (algo está claramente errado)
 * - **warnings** alertam mas permitem prosseguir (sinais suspeitos mas
 *   eventualmente legítimos)
 *
 * Uso:
 *   const { errors, warnings } = validateActContent({ url, content });
 *   if (errors.length) throw new Error(`Conteúdo inválido: ${errors.join('; ')}`);
 *   warnings.forEach((w) => console.warn(`⚠️ ${w}`));
 */

export interface ValidationInput {
  /** URL de origem do scrape (opcional). */
  url?: string | null;
  /** Texto extraído do scraper, idealmente após `normalizeScrapedText`. */
  content: string | null | undefined;
  /** Se for atualização, conteúdo anterior — usado pra comparações sanity. */
  previousContent?: string | null;
  /**
   * Ementa do ato. Quando presente, recebe checks dedicados (mojibake,
   * tamanho mínimo, padrões de fragmento de body que vazaram pra ementa).
   */
  ementa?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** URL parts que indicam página NÃO-oficial (FAQ, perguntas-frequentes etc.). */
const NON_OFFICIAL_URL_FRAGMENTS = [
  '/perguntas-frequentes/',
  '/faq/',
  '/duvidas-frequentes/',
];

/** Início típico de FAQ (numeração tipo "1 - ASPECTOS GERAIS / 1.1 - Quais..."). */
const FAQ_OPENING_PATTERNS = [
  /^\d+\s*-\s*[A-ZÀ-Ú]{4,}/m, // "1 - ASPECTOS GERAIS"
  /^\d+\.\d+\s*-\s*Quais/m, // "1.1 - Quais os motivadores..."
  /^\d+\.\d+\s+[A-ZÀ-Ú][a-zà-ú]+\?/m, // "1.1 Pergunta?"
];

/**
 * Início legítimo de ato normativo (preâmbulo formal). Esperamos que o
 * conteúdo de uma IN/Portaria/Decreto/Lei contenha um destes padrões dentro
 * dos primeiros 4KB.
 */
const PREAMBLE_PATTERNS = [
  /\bO\s+SECRETÁRIO\s+(?:DE|ESPECIAL|EXECUTIVO|GERAL|NACIONAL)\b/i,
  /\bA\s+SECRETÁRIA\s+(?:DE|ESPECIAL|EXECUTIVA|GERAL|NACIONAL)\b/i,
  /\bO\s+MINISTRO\s+DE\s+ESTADO\b/i,
  /\bA\s+MINISTRA\s+DE\s+ESTADO\b/i,
  /\bO\s+PRESIDENTE\s+DA\s+REPÚBLICA\b/i,
  /\bA\s+PRESIDENTE\s+DA\s+REPÚBLICA\b/i,
  /\bO\s+ADVOGADO\s+GERAL\s+DA\s+UNIÃO\b/i,
  /\bA\s+ADVOGADA\s+GERAL\s+DA\s+UNIÃO\b/i,
  /\bO\s+CONSELHO\s+(?:NACIONAL|FEDERAL)\b/i,
  /\bO\s+TRIBUNAL\b/i,
  /\bResolve\s*:/i,
  /\bDecreta\s*:/i,
  /\bArt\.\s*1[ºo°]?\b/, // pelo menos um Art. 1º deve aparecer cedo
];

/** Tamanhos abaixo desses limites são suspeitos pra um ato normativo formal. */
const MIN_CONTENT_CHARS = 500;
const MIN_CONTENT_CHARS_WARN = 1500;

export function validateActContent(input: ValidationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const content = (input.content || '').trim();
  const url = (input.url || '').trim();

  // 0. URL aponta pra página de FAQ — erro grave, ato real está em outro lugar.
  if (url) {
    const lowerUrl = url.toLowerCase();
    for (const fragment of NON_OFFICIAL_URL_FRAGMENTS) {
      if (lowerUrl.includes(fragment)) {
        errors.push(
          `URL "${url}" contém "${fragment}" — esta página é FAQ, não o texto oficial. ` +
            `Procure a versão em /legislacao/.`,
        );
      }
    }
  }

  // 1. Conteúdo vazio/curto demais
  if (!content) {
    errors.push('Conteúdo vazio.');
    return { ok: false, errors, warnings };
  }
  if (content.length < MIN_CONTENT_CHARS) {
    errors.push(
      `Conteúdo muito curto (${content.length} chars, mínimo ${MIN_CONTENT_CHARS}). ` +
        `Provável falha de scrape ou redirect.`,
    );
  } else if (content.length < MIN_CONTENT_CHARS_WARN) {
    warnings.push(
      `Conteúdo curto (${content.length} chars). Verificar se está completo.`,
    );
  }

  // 2. Início parece FAQ — checa nas primeiras ~10 linhas
  const earlyLines = content.split('\n').slice(0, 10).join('\n');
  const firstLine = content.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
  for (const pattern of FAQ_OPENING_PATTERNS) {
    if (pattern.test(earlyLines)) {
      errors.push(
        `Conteúdo começa em formato de FAQ ("${firstLine.slice(0, 60)}..."). ` +
          `Provável import da página de Perguntas Frequentes ao invés do texto oficial.`,
      );
      break;
    }
  }

  // 3. Sem preâmbulo legal nos primeiros 4KB — provável extração quebrada
  const probeWindow = content.slice(0, 4000);
  const hasPreamble = PREAMBLE_PATTERNS.some((p) => p.test(probeWindow));
  if (!hasPreamble) {
    warnings.push(
      'Não detectado preâmbulo legal típico (O SECRETÁRIO/MINISTRO/PRESIDENTE/Art. 1º) nos ' +
        'primeiros 4KB. Verificar se o ato está completo e bem formado.',
    );
  }

  // 4. Lista de anexos do gov.br vazada (3+ bullets `•` na mesma linha)
  if (/^.*?(?:•[^\n•]*){3,}.*$/m.test(content)) {
    warnings.push(
      'Detectada linha com 3+ bullets `•` — possível lista de anexos da sidebar do gov.br ' +
        'que vazou pro corpo. Rodar `normalizeScrapedText` antes de salvar.',
    );
  }

  // 5. Boilerplate residual
  if (/^Compartilhe\s*:/im.test(content)) {
    warnings.push('Bloco "Compartilhe:" não foi removido — rodar `normalizeScrapedText`.');
  }
  if (/Brasão do Brasil[\s\S]{0,200}Diário Oficial/i.test(content)) {
    warnings.push('Masthead DOU presente — rodar `stripDouBoilerplate`.');
  }
  if (/<NOME DO (?:FISCAL|GESTOR|PREPOSTO)/.test(content)) {
    warnings.push('Form annex (`<NOME DO ...>`) presente — rodar `stripFormAnnex`.');
  }

  // 6. Comparação com conteúdo anterior, se houver: regressão > 50%
  if (input.previousContent && input.previousContent.length > 1000) {
    const ratio = content.length / input.previousContent.length;
    if (ratio < 0.5) {
      warnings.push(
        `Conteúdo novo é ${Math.round(ratio * 100)}% do tamanho anterior ` +
          `(${input.previousContent.length} → ${content.length} chars). ` +
          `Possível regressão.`,
      );
    }
  }

  // ─── Checks de formatação (content) ──────────────────────────────────
  // Esses sinais indicam que o pipeline `normalizeScrapedText` ou o
  // charset detection falharam — bloqueiam o save (errors) ou avisam
  // (warnings) conforme severidade.

  // 7. Mojibake U+FFFD — perda irreversível de informação por charset
  // detection ausente. Bloqueia o save: a ementa/content vai virar `Disp�e
  // sobre a aliena��o` e poluir busca/IA. Resolução: refetch com
  // detectCharsetFromResponse.
  const fffdCount = (content.match(/�/g) ?? []).length;
  if (fffdCount > 0) {
    errors.push(
      `Conteúdo contém ${fffdCount}× U+FFFD (replacement char) — charset detection falhou. ` +
        `Refazer fetch com detectCharsetFromResponse antes de salvar.`,
    );
  }

  // 8. NBSP (U+00A0) residual no meio do texto. Não bloqueia (collapse no
  // próximo backfill cuida), mas avisa que o pipeline não foi aplicado.
  const nbspCount = (content.match(/ /g) ?? []).length;
  if (nbspCount > 0) {
    warnings.push(
      `${nbspCount}× NBSP (U+00A0) residual — collapseWhitespace deveria ter convertido pra espaço comum.`,
    );
  }

  // 9. Zero-width chars residuais
  const zwCount = (content.match(/[​‌‍﻿⁠]/g) ?? []).length;
  if (zwCount > 0) {
    warnings.push(
      `${zwCount}× zero-width char residual — stripZeroWidthChars deveria ter removido.`,
    );
  }

  // 10. "Este texto não substitui..." duplicado
  const naoSubstituiCount = (content.match(/Este texto não substitui/g) ?? []).length;
  if (naoSubstituiCount > 1) {
    warnings.push(
      `"Este texto não substitui" aparece ${naoSubstituiCount}× — dedupeBoilerplateFooter deveria deixar apenas 1.`,
    );
  }

  // 11. HTML entities não decodificados — sinal de que a extração não
  // passou por cheerio (ou usou .html() em vez de .text())
  if (/&(?:nbsp|amp|lt|gt|quot|#\d+);/.test(content)) {
    warnings.push(
      'Detectadas HTML entities (`&nbsp;`/`&amp;`/...) — a extração não decodificou. Refazer com cheerio `.text()` ou usar `he.decode()`.',
    );
  }

  // 12. Tags HTML cruas (não confundir com placeholders de template tipo
  // `<nº processo>` ou expressões `< 95%`). Procuramos APENAS tags HTML
  // canônicas (br, p, div, span, a, table, etc.) — palavras conhecidas.
  const htmlTagPattern = /<\/?(?:br|p|div|span|a|strong|em|b|i|u|table|tr|td|th|ul|ol|li|h[1-6]|font|hr)(?:\s[^>]*)?>/i;
  if (htmlTagPattern.test(content)) {
    warnings.push(
      'Detectadas tags HTML canônicas (br/p/div/span/etc) no texto — extração capturou markup. Limpar com cheerio.',
    );
  }

  // 13. Bloco gov.br/compras inline (Publicado em.../Modificado em.../Compartilhe:)
  // que escapou do stripGovbrUiNoise.
  if (
    /Publicado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}/.test(content) &&
    /Modificado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}/.test(content)
  ) {
    warnings.push(
      'Bloco "Publicado em.../Modificado em..." inline residual — stripGovbrUiNoise deveria ter removido.',
    );
  }

  // ─── Checks de formatação (ementa) ───────────────────────────────────
  if (input.ementa !== undefined && input.ementa !== null) {
    const ementa = input.ementa.trim();

    if (!ementa) {
      errors.push('Ementa vazia.');
    } else {
      // 14. Mojibake na ementa — bloqueia (mesma razão do content).
      const ementaFffd = (ementa.match(/�/g) ?? []).length;
      if (ementaFffd > 0) {
        errors.push(
          `Ementa contém ${ementaFffd}× U+FFFD — charset detection falhou. ` +
            `Re-extrair via fetch + detectCharsetFromResponse.`,
        );
      }

      // 15. Ementa muito curta — provavelmente fragmento incompleto.
      // Mínimo razoável: "Lei sobre X." ≈ 12 chars. Mas decretos costumam
      // ter ementas de 50+ chars. Aviso a partir de < 25.
      if (ementa.length < 25) {
        warnings.push(
          `Ementa muito curta (${ementa.length} chars): "${ementa}". Verificar se é fragmento.`,
        );
      }

      // 16. Ementa começa com "Art. X" — é fragmento do body, não ementa real.
      // Visto em prod (IN MP 10/2012): "Art. 14. Ao final de cada ano..."
      if (/^Art\.\s*\d/.test(ementa)) {
        errors.push(
          `Ementa começa com "Art. X" — é fragmento do corpo do ato, não a ementa oficial. ` +
            `Re-extrair com seletor correto (primeiro <p> com verbo "Dispõe/Altera/Regulamenta/...").`,
        );
      }

      // 17. Ementa = só uma palavra de header institucional
      // Visto em prod (Decreto 11.871/2023): ementa = "Presidência"
      if (/^(Presidência|Casa Civil|Subchefia|Brasão|Ministério|Vigência)$/i.test(ementa)) {
        errors.push(
          `Ementa contém apenas "${ementa}" — é header institucional, não ementa real.`,
        );
      }

      // 18. Ementa começa com cardinal ("8.660, de 29 de janeiro de 2016, ou de outro...")
      // Sinal clássico de fragmento mid-sentence pego pelo scraper.
      if (/^\d[\d.,]*,\s+de\s+\d/.test(ementa)) {
        errors.push(
          `Ementa começa em meio de frase ("${ementa.slice(0, 60)}...") — fragmento do corpo.`,
        );
      }

      // 19. NBSP/zero-width na ementa — warning (mesmo do content)
      if (/[ ​‌‍﻿⁠]/.test(ementa)) {
        warnings.push('Ementa contém NBSP/zero-width residuais — passar por normalizeScrapedText.');
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
