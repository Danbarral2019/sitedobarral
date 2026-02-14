/**
 * Funções utilitárias compartilhadas
 * Centraliza código comum para evitar duplicação
 */

/**
 * Parse seguro de tags/leiArticles que pode estar em formato JSON ou CSV
 *
 * Aceita múltiplos formatos:
 * - JSON válido: '["tag1","tag2"]' → ["tag1","tag2"]
 * - CSV: 'tag1,tag2' → ["tag1","tag2"]
 * - Array já parseado: ["tag1","tag2"] → ["tag1","tag2"]
 * - null/undefined → []
 *
 * @param value - Valor a ser parseado (string JSON, CSV, array ou null)
 * @returns Array de strings sempre válido (nunca null)
 *
 * @example
 * ```typescript
 * safeParseArray('["a","b"]')     // → ["a","b"]
 * safeParseArray('a,b,c')         // → ["a","b","c"]
 * safeParseArray(['x','y'])       // → ["x","y"]
 * safeParseArray(null)            // → []
 * ```
 */
export function safeParseArray(value: string | null | undefined | unknown): string[] {
  if (!value) return [];

  // Se já é um array, retorna direto
  if (Array.isArray(value)) return value;

  // Se não é string, retorna vazio com warning
  if (typeof value !== 'string') {
    console.warn('[safeParseArray] Received non-string value:', typeof value, value);
    return [];
  }

  // Tenta parse como JSON primeiro
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Se falhar, trata como CSV
    return value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
}

/**
 * Formata um número para exibição com separadores de milhar
 *
 * @param value - Número a ser formatado
 * @returns String formatada (ex: 1000 → "1.000")
 *
 * @example
 * ```typescript
 * formatNumber(1234567)  // → "1.234.567"
 * formatNumber(100)      // → "100"
 * ```
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

/**
 * Formata bytes para tamanho legível
 *
 * @param bytes - Número de bytes
 * @returns String formatada (ex: 1024 → "1 KB")
 *
 * @example
 * ```typescript
 * formatBytes(1024)       // → "1 KB"
 * formatBytes(1048576)    // → "1 MB"
 * formatBytes(500)        // → "500 B"
 * ```
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Trunca texto com reticências
 *
 * @param text - Texto a ser truncado
 * @param maxLength - Tamanho máximo (padrão: 100)
 * @returns Texto truncado com "..." se necessário
 *
 * @example
 * ```typescript
 * truncate('Lorem ipsum dolor sit amet', 10)  // → "Lorem ipsu..."
 * truncate('Curto', 10)                       // → "Curto"
 * ```
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Normaliza string para slug URL-friendly
 *
 * @param text - Texto a ser normalizado
 * @returns Slug normalizado (minúsculas, sem acentos, hifenizado)
 *
 * @example
 * ```typescript
 * slugify('Lei de Licitações 14.133/2021')  // → "lei-de-licitacoes-14-133-2021"
 * slugify('Direito Administrativo')        // → "direito-administrativo"
 * ```
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s-]/g, '')        // Remove caracteres especiais
    .replace(/\s+/g, '-')            // Espaços → hífens
    .replace(/-+/g, '-')             // Remove hífens duplicados
    .trim();
}

/**
 * Debounce function - atrasa execução até que paradas de chamadas
 *
 * @param func - Função a ser executada
 * @param wait - Tempo de espera em ms (padrão: 300)
 * @returns Função debounced
 *
 * @example
 * ```typescript
 * const searchDebounced = debounce((query) => fetchResults(query), 500);
 * searchDebounced('termo'); // Só executa se não houver novas chamadas em 500ms
 * ```
 */
/**
 * Normaliza texto scrapeado para exibição em parágrafos.
 *
 * Junta linhas que fazem parte do mesmo parágrafo (separadas por apenas
 * 1 newline — artefatos de scraping HTML) e preserva parágrafos reais
 * (separados por 2+ newlines ou linha em branco).
 *
 * @param text - Texto bruto (possivelmente scrapeado com quebras artificiais)
 * @returns Array de parágrafos prontos para renderizar em <p> tags
 *
 * @example
 * ```typescript
 * normalizeTextContent("Linha 1\nLinha 2\n\nParagrafo 2")
 * // → ["Linha 1 Linha 2", "Paragrafo 2"]
 * ```
 */
export function normalizeTextContent(text: string): string[] {
  const lines = text.split('\n').map(line => line.trim());
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line === '') {
      if (current.length > 0) {
        paragraphs.push(current.join(' '));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }

  return paragraphs;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number = 300
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
