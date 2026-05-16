/**
 * Detector de Alterações em Leis e Atos Normativos Existentes
 *
 * Analisa título/ementa de novos atos para identificar se eles
 * modificam a Lei 14.133/2021 ou INs/Portarias/Decretos já cadastrados.
 *
 * Retorna informações sobre o que foi alterado para que o cron
 * possa criar notas de alteração (LeiArticleNote) e sinalizar ao admin.
 */

export type ChangeType = 'altera' | 'revoga' | 'regulamenta' | 'complementa';

export interface ExistingActRef {
  type: string;       // 'in' | 'portaria' | 'decreto' | 'lei' | 'resolucao'
  number: string;
  year?: number;
  fullNumber?: string; // "IN SEGES/MGI 58/2022"
}

export interface ModificationDetection {
  modifiesLei14133: boolean;
  affectedArticles: string[];       // ["75", "76", "184-A"]
  modifiesExistingAct: boolean;
  existingActRef: ExistingActRef | null;
  changeType: ChangeType;
  confidence: number;               // 0-100
}

/**
 * Detecta se um novo ato modifica legislação existente
 */
export function detectModifications(title: string, abstract: string): ModificationDetection | null {
  const text = `${title} ${abstract}`.toLowerCase();

  let modifiesLei14133 = false;
  const affectedArticles: string[] = [];
  let modifiesExistingAct = false;
  let existingActRef: ExistingActRef | null = null;
  let changeType: ChangeType = 'complementa';
  let confidence = 0;

  // --- Detectar alterações na Lei 14.133 ---

  // Altera artigo(s) específico(s) da Lei 14.133
  const artLei14133 = text.matchAll(
    /(?:altera|alt\.|modifica)\s+(?:o\s+|os?\s+)?art(?:igo|\.)?\.?\s*([\d]+[\w-]*(?:\s*,\s*[\d]+[\w-]*)*)\s+(?:da\s+)?lei\s+(?:n[ºo°]?\s*)?14\.?133/gi
  );
  for (const match of artLei14133) {
    modifiesLei14133 = true;
    changeType = 'altera';
    confidence = Math.max(confidence, 90);
    // Pode ter múltiplos artigos separados por vírgula
    const arts = match[1].split(/\s*,\s*/);
    for (const art of arts) {
      const cleaned = art.trim();
      if (cleaned && !affectedArticles.includes(cleaned)) {
        affectedArticles.push(cleaned);
      }
    }
  }

  // Altera a Lei 14.133 (sem artigo específico)
  if (!modifiesLei14133 && /altera\s+(?:a\s+)?lei\s+(?:n[ºo°]?\s*)?14\.?133/i.test(text)) {
    modifiesLei14133 = true;
    changeType = 'altera';
    confidence = Math.max(confidence, 75);
  }

  // Regulamenta artigo(s) da Lei 14.133
  const regulamentaLei = text.matchAll(
    /regulamenta\s+(?:o\s+|os?\s+)?art(?:igo|\.)?\.?\s*([\d]+[\w-]*(?:\s*,\s*[\d]+[\w-]*)*)\s+(?:da\s+)?lei\s+(?:n[ºo°]?\s*)?14\.?133/gi
  );
  for (const match of regulamentaLei) {
    modifiesLei14133 = true;
    if (changeType !== 'altera') changeType = 'regulamenta';
    confidence = Math.max(confidence, 85);
    const arts = match[1].split(/\s*,\s*/);
    for (const art of arts) {
      const cleaned = art.trim();
      if (cleaned && !affectedArticles.includes(cleaned)) {
        affectedArticles.push(cleaned);
      }
    }
  }

  // Acresce/inclui/insere artigo(s) na Lei 14.133
  // Forma muito comum em decretos/leis novas: "Acresce o art. 184-A à Lei nº 14.133/2021"
  // Aceita plural ("arts.", "artigos") e separadores "," ou " e " ("195 e 196")
  const acresceArt = text.matchAll(
    /(?:acresce|acrescenta|inclui|insere)\s+(?:o\s+|os?\s+|as?\s+)?art(?:igo|igos|s|\.)?\.?\s*([\d]+[\w-]*(?:\s*(?:,|e)\s*[\d]+[\w-]*)*)\s+(?:[àa]\s+|na\s+|[àa]o\s+|no\s+|da\s+)?lei\s+(?:n[ºo°]?\s*)?14\.?133/gi
  );
  for (const match of acresceArt) {
    modifiesLei14133 = true;
    if (changeType !== 'altera') changeType = 'altera'; // acréscimo = alteração
    confidence = Math.max(confidence, 88);
    const arts = match[1].split(/\s*(?:,|\be\b)\s*/);
    for (const art of arts) {
      const cleaned = art.trim();
      if (cleaned && !affectedArticles.includes(cleaned)) {
        affectedArticles.push(cleaned);
      }
    }
  }

  // Revoga artigo(s) específico(s) da Lei 14.133
  // Bug histórico: regex anterior identificava "revoga" mas não extraía o número
  // do artigo, fazendo affectedArticles=[] → route.ts:410 (`if (… && length > 0)`)
  // pulava o create de LeiArticleNote. Resultado: tabela com 0 registros.
  const revogaArt = text.matchAll(
    /revoga(?:m|-se)?\s+(?:o\s+|os?\s+|as?\s+)?art(?:igo|\.)?\.?\s*([\d]+[\w-]*(?:\s*,\s*[\d]+[\w-]*)*)\s+(?:da\s+)?lei\s+(?:n[ºo°]?\s*)?14\.?133/gi
  );
  for (const match of revogaArt) {
    modifiesLei14133 = true;
    changeType = 'revoga';
    confidence = Math.max(confidence, 90);
    const arts = match[1].split(/\s*,\s*/);
    for (const art of arts) {
      const cleaned = art.trim();
      if (cleaned && !affectedArticles.includes(cleaned)) {
        affectedArticles.push(cleaned);
      }
    }
  }

  // Revoga a Lei 14.133 (ou dispositivo dela sem artigo nominal — fallback)
  if (
    !modifiesLei14133 &&
    /revoga\s+(?:o\s+|a\s+)?(?:dispositivo[s]?\s+(?:da\s+)?)?lei\s+(?:n[ºo°]?\s*)?14\.?133/i.test(text)
  ) {
    modifiesLei14133 = true;
    changeType = 'revoga';
    confidence = Math.max(confidence, 75);
  }

  // --- Detectar alterações em IN/Portaria/Decreto existente ---

  // Altera IN
  const alteraIN = text.match(
    /altera\s+(?:a\s+)?(?:instrução\s+normativa|instrucao\s+normativa|in)\s+(?:[\w/]+\s+)?n[ºo°]?\s*([\d.]+)(?:.*?(\d{4}))?/i
  );
  if (alteraIN) {
    modifiesExistingAct = true;
    existingActRef = {
      type: 'in',
      number: alteraIN[1],
      year: alteraIN[2] ? parseInt(alteraIN[2]) : undefined,
    };
    changeType = 'altera';
    confidence = Math.max(confidence, 80);
  }

  // Altera Portaria
  if (!existingActRef) {
    const alteraPortaria = text.match(
      /altera\s+(?:a\s+)?portaria\s+(?:[\w/]+\s+)?n[ºo°]?\s*([\d.]+)(?:.*?(\d{4}))?/i
    );
    if (alteraPortaria) {
      modifiesExistingAct = true;
      existingActRef = {
        type: 'portaria',
        number: alteraPortaria[1],
        year: alteraPortaria[2] ? parseInt(alteraPortaria[2]) : undefined,
      };
      changeType = 'altera';
      confidence = Math.max(confidence, 80);
    }
  }

  // Altera Decreto
  if (!existingActRef) {
    const alteraDecreto = text.match(
      /altera\s+(?:o\s+)?decreto\s+n[ºo°]?\s*([\d.]+)(?:.*?(\d{4}))?/i
    );
    if (alteraDecreto) {
      modifiesExistingAct = true;
      existingActRef = {
        type: 'decreto',
        number: alteraDecreto[1],
        year: alteraDecreto[2] ? parseInt(alteraDecreto[2]) : undefined,
      };
      changeType = 'altera';
      confidence = Math.max(confidence, 80);
    }
  }

  // Revoga IN/Portaria/Decreto (genérico)
  if (!existingActRef) {
    const revogaAto = text.match(
      /revoga\s+(?:a\s+|o\s+)?(?:(instrução\s+normativa|instrucao\s+normativa|in|portaria|decreto|lei))\s+(?:[\w/]+\s+)?n[ºo°]?\s*([\d.]+)(?:.*?(\d{4}))?/i
    );
    if (revogaAto) {
      modifiesExistingAct = true;
      let type = revogaAto[1].toLowerCase();
      if (type.includes('instrução') || type.includes('instrucao') || type === 'in') type = 'in';
      existingActRef = {
        type,
        number: revogaAto[2],
        year: revogaAto[3] ? parseInt(revogaAto[3]) : undefined,
      };
      changeType = 'revoga';
      confidence = Math.max(confidence, 80);
    }
  }

  // Se nenhuma modificação detectada, retornar null
  if (!modifiesLei14133 && !modifiesExistingAct) {
    return null;
  }

  return {
    modifiesLei14133,
    affectedArticles,
    modifiesExistingAct,
    existingActRef,
    changeType,
    confidence,
  };
}
