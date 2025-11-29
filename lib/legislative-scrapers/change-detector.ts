/**
 * Módulo de Detecção de Mudanças
 *
 * Compara versões de textos legais usando hash MD5 para detectar alterações.
 */

import { createHash } from 'crypto';

/**
 * Computa o hash MD5 de um texto
 * @param content - Texto para computar hash
 * @returns Hash MD5 em hexadecimal
 */
export function computeHash(content: string): string {
  // Normalizar o conteúdo antes de computar o hash
  const normalized = normalizeContent(content);
  return createHash('md5').update(normalized, 'utf8').digest('hex');
}

/**
 * Normaliza o conteúdo para comparação consistente
 * Remove variações que não representam mudanças reais no texto legal
 */
export function normalizeContent(content: string): string {
  return content
    // Converter para minúsculas para comparação case-insensitive
    // (comentado porque pode ser importante preservar)
    // .toLowerCase()

    // Normalizar espaços em branco
    .replace(/\s+/g, ' ')

    // Remover espaços no início e fim
    .trim()

    // Normalizar quebras de linha
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

    // Normalizar caracteres especiais de formatação
    .replace(/[\u00A0\u2003\u2002\u2009]/g, ' ') // Non-breaking spaces
    .replace(/[\u2013\u2014]/g, '-') // Dashes
    .replace(/[\u201C\u201D]/g, '"') // Smart quotes
    .replace(/[\u2018\u2019]/g, "'"); // Smart apostrophes
}

/**
 * Resultado da comparação de versões
 */
export interface ChangeDetectionResult {
  hasChanged: boolean;
  oldHash: string | null;
  newHash: string;
  similarity?: number; // 0-100 percentual de similaridade
}

/**
 * Detecta se houve mudança entre duas versões de conteúdo
 * @param oldContent - Conteúdo anterior (ou null se não existir)
 * @param newContent - Novo conteúdo
 * @returns Resultado da detecção
 */
export function detectChanges(
  oldContent: string | null,
  newContent: string
): ChangeDetectionResult {
  const newHash = computeHash(newContent);

  if (!oldContent) {
    return {
      hasChanged: true,
      oldHash: null,
      newHash,
    };
  }

  const oldHash = computeHash(oldContent);
  const hasChanged = oldHash !== newHash;

  // Calcular similaridade básica se houve mudança
  let similarity: number | undefined;
  if (hasChanged) {
    similarity = calculateSimilarity(oldContent, newContent);
  }

  return {
    hasChanged,
    oldHash,
    newHash,
    similarity,
  };
}

/**
 * Compara dois hashes para detectar mudança
 * @param oldHash - Hash anterior (ou null)
 * @param newHash - Novo hash
 * @returns true se houve mudança
 */
export function hasHashChanged(
  oldHash: string | null | undefined,
  newHash: string
): boolean {
  if (!oldHash) return true;
  return oldHash !== newHash;
}

/**
 * Calcula a similaridade entre dois textos usando Jaccard similarity
 * @param text1 - Primeiro texto
 * @param text2 - Segundo texto
 * @returns Percentual de similaridade (0-100)
 */
function calculateSimilarity(text1: string, text2: string): number {
  // Tokenizar em palavras
  const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
  const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);

  // Calcular interseção
  const intersection = new Set([...words1].filter(x => words2.has(x)));

  // Calcular união
  const union = new Set([...words1, ...words2]);

  // Jaccard similarity
  if (union.size === 0) return 100;
  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Gera um resumo das diferenças entre dois textos
 * @param oldContent - Conteúdo anterior
 * @param newContent - Novo conteúdo
 * @returns Resumo das diferenças
 */
export function generateChangeSummary(
  oldContent: string,
  newContent: string
): string {
  const oldLength = oldContent.length;
  const newLength = newContent.length;
  const lengthDiff = newLength - oldLength;

  const similarity = calculateSimilarity(oldContent, newContent);

  const parts: string[] = [];

  if (lengthDiff > 0) {
    parts.push(`+${lengthDiff} caracteres adicionados`);
  } else if (lengthDiff < 0) {
    parts.push(`${lengthDiff} caracteres removidos`);
  }

  parts.push(`${similarity}% de similaridade`);

  if (similarity < 50) {
    parts.push('(alteração significativa)');
  } else if (similarity < 80) {
    parts.push('(alteração moderada)');
  } else {
    parts.push('(alteração menor)');
  }

  return parts.join(' - ');
}
