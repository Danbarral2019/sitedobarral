/**
 * Checagens puras de saúde de dados do acervo. Sem I/O — testáveis isoladamente.
 * Consumidas pelo cron /api/cron/data-health, que adiciona as queries.
 *
 * Cobrem as classes de erro reais achadas em 12/07/2026:
 * - formato "Art. N" reaparecendo em leiArticlesArr (regressão do classifier);
 * - falso positivo de revogação (ato "revogado" que foi só alterado).
 */

/** true se o valor NÃO é número puro canônico ("75", "166-A"). */
export function isArtigoMalFormatado(value: string): boolean {
  return !/^\d{1,3}(-[A-Z])?$/.test(value.trim());
}

/** "Revogado pelo Decreto nº 12.218, de 2024" → "12.218" (ou null). */
export function revokerFromNote(note: string | null): string | null {
  if (!note) return null;
  const m = note.match(
    /Revogad[oa]\s+pel[oa]\s+(?:Decreto|Lei|Medida\s+Provis[óo]ria|Portaria|Instru[çc][ãa]o\s+Normativa|Resolu[çc][ãa]o)[^\d]*([\d.]+)/i,
  );
  return m ? m[1].replace(/\.$/, '') : null;
}

/**
 * true se o texto do ato revogado contém "Redação dada/Incluído/Vigência pel<o/a>
 * <revogador>" — prova de que o revogador apenas ALTEROU (revogação total é falso
 * positivo). Ver o caso do Decreto 11.890 alterado pelo 12.218.
 */
export function contentMostraAlteracao(content: string | null, revokerNumero: string): boolean {
  if (!content) return false;
  const esc = revokerNumero.replace(/[.]/g, '\\.');
  return new RegExp(`(Reda[çc][ãa]o dada|Inclu[íi]d[oa]|Vig[êe]ncia)\\s+pel[oa][^\\d]*${esc}`, 'i').test(content);
}
