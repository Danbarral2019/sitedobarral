/**
 * Pré-filtro de escopo do DOU Clipping (antes da IA editorial).
 *
 * Descarta famílias de atos que o editor rejeitou em bloco na triagem de
 * 26/09/2026 (gabarito em eval/dou-triagem-2026-09.json): reconhecimentos e
 * repasses da Defesa Civil, execução orçamentária, consultas tributárias,
 * decisões pontuais de agências sobre concessões e atos concretos.
 *
 * Cada regra foi calibrada no gabarito: nenhuma atinge os atos aprovados.
 * Mudou uma regra? Rode `npx tsx scripts/eval-dou-prefiltro.ts`.
 */

export interface AtoDou {
  title: string;
  abstract?: string | null;
  hierarchyStr?: string | null;
}

export type MotivoForaDeEscopo =
  | 'defesa-civil'
  | 'orcamento'
  | 'tributario'
  | 'concessao-especifica'
  | 'ato-concreto'
  | 'patrimonio-imovel';

interface Regra {
  motivo: MotivoForaDeEscopo;
  aplica: (titulo: string, texto: string, orgao: string) => boolean;
}

const REGRAS: Regra[] = [
  {
    // Reconhecimento de emergência, repasse a município, uso de marca em obra.
    motivo: 'defesa-civil',
    aplica: (_t, _x, orgao) => orgao.includes('proteção e defesa civil'),
  },
  {
    motivo: 'orcamento',
    aplica: (t, x) =>
      /cr[ée]dito (suplementar|especial|extraordin[áa]rio)/.test(`${t} ${x}`) ||
      /limites? de (movimenta[çc][ãa]o|pagamento)/.test(x) ||
      /cronograma (mensal )?de (execu[çc][ãa]o mensal de )?desembolso/.test(x) ||
      /grupos? de natureza de despesa/.test(x) ||
      /programa[çc][ãa]o or[çc]ament[áa]ria e financeira/.test(x),
  },
  {
    // A IN da Receita pode ser pertinente (retenção em pagamentos a
    // contratados); só a consulta individual e o ICMS de combustível saem.
    motivo: 'tributario',
    aplica: (t, _x, orgao) =>
      /^solu[çc][ãa]o de consulta/.test(t) ||
      /^ato cotepe/.test(t) ||
      orgao.includes('conselho nacional de política fazendária'),
  },
  {
    // Decisões de superintendências da ANTT, deliberações e acórdãos de
    // agências sobre um contrato de concessão determinado.
    motivo: 'concessao-especifica',
    aplica: (t) =>
      /^decis[ãa]o (surod|sufer|suinf|supas)\b/.test(t) ||
      /^delibera[çc][ãa]o antt\b/.test(t) ||
      /^ac[óo]rd[ãa]o n[ºo°]? ?[\d./-]+\s*[-/]?\s*antaq/.test(t) ||
      /^comunicado relevante/.test(t),
  },
  {
    motivo: 'ato-concreto',
    aplica: (t) =>
      /^decis(?:[ãa]o|[õo]es)\b/.test(t) ||
      /^resultados? d[eo]s? /.test(t) ||
      /^(contrato|termo aditivo|edital|edtial)\b/.test(t) ||
      /^atas? d[aeo]/.test(t) ||
      /^comunicado n[ºo°]/.test(t) ||
      /^recomenda[çc][ãa]o n[ºo°]/.test(t),
  },
  {
    // Alienação, doação ou entrega de imóvel determinado da União.
    motivo: 'patrimonio-imovel',
    aplica: (_t, x, orgao) =>
      orgao.includes('patrimônio da união') &&
      /(im[óo]ve(l|is)|aliena[çc][ãa]o|alienabilidade|doa[çc][ãa]o|destina[çc][ãa]o)/.test(x),
  },
];

/**
 * Devolve o motivo pelo qual o ato está fora do escopo editorial, ou `null`
 * se ele deve seguir para a classificação por IA.
 */
export function motivoForaDeEscopo(ato: AtoDou): MotivoForaDeEscopo | null {
  const titulo = ato.title.replace(/<[^>]*>/g, '').trim().toLowerCase();
  const texto = `${titulo} ${(ato.abstract || '').toLowerCase()}`;
  const orgao = (ato.hierarchyStr || '').toLowerCase();
  for (const regra of REGRAS) {
    if (regra.aplica(titulo, texto, orgao)) return regra.motivo;
  }
  return null;
}
