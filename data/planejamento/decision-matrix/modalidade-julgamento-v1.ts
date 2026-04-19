/**
 * Matriz de decisão — modalidade e critério de julgamento (v1).
 *
 * Fundamento: Lei 14.133/2021 — art. 6º, XXXVIII a XLIII; arts. 28 a 33;
 * arts. 36 a 38. A ordem das regras importa: a primeira cujo predicado
 * case com os inputs vence (short-circuit).
 *
 * Vocabulário das saídas:
 *   modalidade: "pregao" | "concorrencia" | "concurso" | "leilao" |
 *               "dialogo_competitivo"
 *   criterio:   "menor_preco" | "maior_desconto" | "melhor_tecnica" |
 *               "tecnica_e_preco" | "maior_lance" | "maior_retorno_economico"
 */
import type { DecisionMatrixDefinition } from "../types";

export const modalidadeJulgamentoV1: DecisionMatrixDefinition = {
  slug: "modalidade-julgamento",
  version: 1,
  title: "Modalidade e critério de julgamento",
  inputs: [
    {
      id: "objeto",
      label: "Objeto da contratação",
      type: "enum",
      required: true,
      help: "Classificação funcional do objeto a contratar.",
      options: [
        { value: "aquisicao_bem", label: "Aquisição de bem" },
        { value: "prestacao_servico", label: "Prestação de serviço" },
        { value: "obra", label: "Obra" },
        { value: "servico_engenharia", label: "Serviço de engenharia" },
        { value: "alienacao", label: "Alienação de bem" },
        {
          value: "trabalho_tecnico",
          label: "Trabalho técnico, científico ou artístico",
        },
      ],
    },
    {
      id: "comum_especial",
      label: "Natureza do objeto (quando bem ou serviço)",
      type: "enum",
      required: false,
      help:
        "Bem/serviço comum é aquele cujos padrões podem ser objetivamente definidos em edital (art. 6º, XIII).",
      options: [
        { value: "comum", label: "Comum" },
        { value: "especial", label: "Especial" },
        { value: "nao_se_aplica", label: "Não se aplica" },
      ],
    },
    {
      id: "natureza_intelectual",
      label: "O objeto tem natureza predominantemente intelectual",
      type: "bool",
      help:
        "Serviços de natureza intelectual devem usar técnica e preço (art. 36, I).",
    },
    {
      id: "objeto_definivel",
      label: "O objeto pode ser especificado de forma objetiva em edital",
      type: "bool",
      help:
        "Se negativo e houver complexidade técnica, cabe diálogo competitivo (art. 32).",
    },
    {
      id: "solucao_inovadora",
      label:
        "Demanda solução inovadora sem modelo disponível no mercado ou fornecedor pré-qualificado",
      type: "bool",
      help:
        "Requisito do diálogo competitivo quando inviável a contratação convencional.",
    },
    {
      id: "regime_srp",
      label: "A contratação será por Sistema de Registro de Preços",
      type: "bool",
      help: "Inputa se há necessidade futura e eventual do objeto.",
    },
    {
      id: "maior_desconto_aplicavel",
      label:
        "Há tabela oficial de referência que torne aplicável o maior desconto",
      type: "bool",
      help:
        "Maior desconto exige tabela de preços divulgada pelo ente contratante (art. 34, §1º).",
    },
    {
      id: "valor_estimado",
      label: "Valor estimado total da contratação (R$)",
      type: "number",
      required: false,
      help:
        "Não define modalidade diretamente; é informativo para o texto de justificativa.",
    },
  ],
  rules: [
    // -------- Alienação → leilão + maior lance --------
    {
      id: "leilao-alienacao",
      when: { op: "eq", input: "objeto", value: "alienacao" },
      then: { modalidade: "leilao", criterio: "maior_lance" },
      rationaleMd:
        "Tratando-se de alienação de bem, aplica-se a modalidade leilão (art. 28, IV) com critério de maior lance (art. 33, V), inadmissível em outras modalidades (art. 33, §1º).",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 28, IV", articleNumber: "28" },
        { kind: "lei", label: "Lei 14.133/2021, art. 33, V", articleNumber: "33" },
      ],
    },

    // -------- Concurso --------
    {
      id: "concurso-trabalho-tecnico",
      when: { op: "eq", input: "objeto", value: "trabalho_tecnico" },
      then: { modalidade: "concurso", criterio: "melhor_tecnica" },
      rationaleMd:
        "Como o objeto consiste em trabalho técnico, científico ou artístico, aplica-se o concurso (art. 28, III), com critério de melhor técnica ou conteúdo artístico (art. 33, III), mediante prêmio ou remuneração ao vencedor.",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 28, III", articleNumber: "28" },
        { kind: "lei", label: "Lei 14.133/2021, art. 30", articleNumber: "30" },
        { kind: "lei", label: "Lei 14.133/2021, art. 33, III", articleNumber: "33" },
      ],
    },

    // -------- Diálogo competitivo --------
    {
      id: "dialogo-solucao-inovadora",
      when: {
        op: "and",
        items: [
          { op: "eq", input: "solucao_inovadora", value: true },
          { op: "eq", input: "objeto_definivel", value: false },
          {
            op: "in",
            input: "objeto",
            values: ["prestacao_servico", "aquisicao_bem", "servico_engenharia", "obra"],
          },
        ],
      },
      then: { modalidade: "dialogo_competitivo", criterio: "tecnica_e_preco" },
      rationaleMd:
        "Dada a necessidade de solução inovadora cuja especificação técnica não pode ser previamente definida de forma objetiva, cabe o diálogo competitivo (art. 32, I), com critério de técnica e preço (art. 33, IV) que permite ponderar qualidade técnica e economicidade.",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 28, V", articleNumber: "28" },
        { kind: "lei", label: "Lei 14.133/2021, art. 32", articleNumber: "32" },
        { kind: "lei", label: "Lei 14.133/2021, art. 33, IV", articleNumber: "33" },
      ],
    },

    // -------- Obras e serviços de engenharia --------
    {
      id: "engenharia-intelectual",
      when: {
        op: "and",
        items: [
          {
            op: "in",
            input: "objeto",
            values: ["obra", "servico_engenharia"],
          },
          { op: "eq", input: "natureza_intelectual", value: true },
        ],
      },
      then: { modalidade: "concorrencia", criterio: "tecnica_e_preco" },
      rationaleMd:
        "Tratando-se de obra ou serviço de engenharia com natureza predominantemente intelectual, aplica-se a concorrência (art. 28, II) com critério de técnica e preço (art. 36, I), de modo a ponderar a qualidade da proposta técnica e a economicidade.",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 28, II", articleNumber: "28" },
        { kind: "lei", label: "Lei 14.133/2021, art. 36, I", articleNumber: "36" },
      ],
    },
    {
      id: "engenharia-geral",
      when: {
        op: "in",
        input: "objeto",
        values: ["obra", "servico_engenharia"],
      },
      then: { modalidade: "concorrencia", criterio: "menor_preco" },
      rationaleMd:
        "Em se tratando de obra ou serviço de engenharia, adota-se a concorrência (art. 28, II) com julgamento pelo menor preço (art. 33, I), regra geral quando o objeto é suficientemente definível e dispensa ponderação técnica.",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 28, II", articleNumber: "28" },
        { kind: "lei", label: "Lei 14.133/2021, art. 33, I", articleNumber: "33" },
      ],
    },

    // -------- Bens/Serviços especiais → concorrência --------
    {
      id: "especial-intelectual",
      when: {
        op: "and",
        items: [
          { op: "eq", input: "comum_especial", value: "especial" },
          { op: "eq", input: "natureza_intelectual", value: true },
        ],
      },
      then: { modalidade: "concorrencia", criterio: "tecnica_e_preco" },
      rationaleMd:
        "Como o objeto é especial, vedado o pregão (art. 29, parágrafo único), e, sendo de natureza predominantemente intelectual, aplica-se a concorrência (art. 28, II) com técnica e preço (art. 36, I).",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 29, p. único", articleNumber: "29" },
        { kind: "lei", label: "Lei 14.133/2021, art. 36, I", articleNumber: "36" },
      ],
    },
    {
      id: "especial-tecnica",
      when: { op: "eq", input: "comum_especial", value: "especial" },
      then: { modalidade: "concorrencia", criterio: "melhor_tecnica" },
      rationaleMd:
        "Sendo o objeto especial, é vedado o pregão (art. 29, parágrafo único). Adota-se a concorrência (art. 28, II) com julgamento pelo melhor conteúdo técnico (art. 33, III), mais adequado aos casos em que a ponderação qualitativa é preponderante.",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 29, p. único", articleNumber: "29" },
        { kind: "lei", label: "Lei 14.133/2021, art. 33, III", articleNumber: "33" },
      ],
    },

    // -------- Bens/serviços comuns → pregão --------
    {
      id: "pregao-maior-desconto",
      when: {
        op: "and",
        items: [
          { op: "eq", input: "comum_especial", value: "comum" },
          {
            op: "in",
            input: "objeto",
            values: ["aquisicao_bem", "prestacao_servico"],
          },
          { op: "eq", input: "maior_desconto_aplicavel", value: true },
        ],
      },
      then: { modalidade: "pregao", criterio: "maior_desconto" },
      rationaleMd:
        "Por se tratar de bem ou serviço comum com tabela de preços oficial de referência, aplica-se o pregão (art. 29) com julgamento por maior desconto (art. 34), critério que incide sobre o preço global ou sobre preços unitários da tabela divulgada pela Administração.",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 29", articleNumber: "29" },
        { kind: "lei", label: "Lei 14.133/2021, art. 34", articleNumber: "34" },
      ],
    },
    {
      id: "pregao-comum",
      when: {
        op: "and",
        items: [
          { op: "eq", input: "comum_especial", value: "comum" },
          {
            op: "in",
            input: "objeto",
            values: ["aquisicao_bem", "prestacao_servico"],
          },
        ],
      },
      then: { modalidade: "pregao", criterio: "menor_preco" },
      rationaleMd:
        "Tratando-se de bem ou serviço comum, aplica-se o pregão (arts. 6º, XLI e 29) com critério de menor preço (art. 33, I), modalidade obrigatória sempre que os padrões de qualidade possam ser objetivamente definidos em edital.",
      citations: [
        { kind: "lei", label: "Lei 14.133/2021, art. 6º, XLI", articleNumber: "6" },
        { kind: "lei", label: "Lei 14.133/2021, art. 29", articleNumber: "29" },
        { kind: "lei", label: "Lei 14.133/2021, art. 33, I", articleNumber: "33" },
      ],
    },
  ],
  fallback: {
    modalidade: "concorrencia",
    criterio: "menor_preco",
    rationaleMd:
      "Não sendo possível enquadrar o objeto em hipótese específica, adota-se a regra geral da concorrência (art. 28, II) com julgamento pelo menor preço (art. 33, I), reservando-se revisão manual da classificação do objeto.",
    citations: [
      { kind: "lei", label: "Lei 14.133/2021, art. 28, II", articleNumber: "28" },
      { kind: "lei", label: "Lei 14.133/2021, art. 33, I", articleNumber: "33" },
    ],
  },
};

export const DECISION_MATRICES = [modalidadeJulgamentoV1];

export const DECISION_MATRICES_BY_SLUG: Record<
  string,
  (typeof DECISION_MATRICES)[number]
> = Object.fromEntries(DECISION_MATRICES.map((m) => [m.slug, m]));

export function getDecisionMatrixBySlug(slug: string) {
  return DECISION_MATRICES_BY_SLUG[slug];
}
