/**
 * Checagens puras de saúde de dados do acervo. Sem I/O — testáveis isoladamente.
 * Consumidas pelo cron /api/cron/data-health, que adiciona as queries.
 *
 * Cobrem as classes de erro reais achadas em 12/07/2026:
 * - formato "Art. N" reaparecendo em leiArticlesArr (regressão do classifier);
 * - falso positivo de revogação (ato "revogado" que foi só alterado);
 * - artigo bem formatado que a Lei 14.133 não tem (30/08/2026).
 */
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

/** true se o valor NÃO é número puro canônico ("75", "166-A"). */
export function isArtigoMalFormatado(value: string): boolean {
  return !/^\d{1,3}(-[A-Z])?$/.test(value.trim());
}

/**
 * Números que a Lei 14.133 realmente tem, incluindo os arts. 337-E a 337-P,
 * crimes que ela inseriu no Código Penal e que o índice do projeto carrega.
 */
const ARTIGOS_DA_LEI = new Set(Object.keys(LEI_14133_ARTIGOS));

/**
 * true se o número é bem formatado mas não corresponde a artigo nenhum da lei.
 *
 * Formato correto não é o mesmo que artigo real: "199", "966" e "132-D" passam
 * em `isArtigoMalFormatado` e são, respectivamente, nada, ação rescisória do
 * CPC e Lei Orgânica do TCE-PE. Medido em 30/08/2026, **114 amarrações** do
 * acervo apontavam para artigo inexistente — 109 do TCE-PE —, e o único check
 * que havia não as via. A causa era `detectLeiArticles` casar qualquer
 * "art. N" do texto sem saber de qual lei; corrigido na origem, este check
 * existe para que a regressão não volte a passar batida.
 */
export function isArtigoInexistente(value: string): boolean {
  return !ARTIGOS_DA_LEI.has(value.trim());
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
