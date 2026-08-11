/**
 * Bloco temático de um acórdão-alvo do grafo de precedentes.
 *
 * Por que existe: o limiar de citação no voto, sozinho, escolhe MATÉRIA
 * REPETITIVA. Uma tese de aposentadoria reincide em milhares de atos de
 * pessoal e sobe no ranking; uma tese de licitação é invocada bem menos vezes
 * pelo mesmo precedente. Medido em 11/08/2026: das 177 destilações vigentes, 95
 * eram de pessoal e 7 de licitação/obras. Sem filtro por matéria, a base do
 * site viraria um repositório de pessoal por construção do critério.
 *
 * A classificação vive por ALVO (não por destilação) porque serve para decidir
 * ANTES de gastar a destilação.
 */
import { prisma } from '../prisma';
import { generate } from '../ai';

export const TEMAS = {
  'licitacoes-contratos': 'Licitações e contratos administrativos',
  'obras-engenharia': 'Obras públicas e engenharia (BDI, sobrepreço, projeto, medição)',
  pessoal: 'Pessoal (admissão, aposentadoria, pensão, acumulação, vantagens)',
  responsabilizacao: 'Responsabilização, débito, multa e prescrição',
  'processo-controle': 'Processo de controle externo e competência do TCU',
  'convenios-transferencias': 'Convênios, transferências voluntárias e prestação de contas',
  'financas-orcamento': 'Finanças públicas, orçamento e renúncia de receita',
  'concessoes-estatais': 'Concessões, PPP, desestatização e estatais',
  outros: 'Outros',
} as const;
export type Tema = keyof typeof TEMAS;

export function ehTema(v: string): v is Tema {
  return v in TEMAS;
}

/**
 * Matérias que NÃO entram na base de pesquisa do site — decisão do Daniel em
 * 11/08/2026: pessoal é lateral ao trabalho dele e poluiria a ferramenta.
 *
 * "Fora da base" é só isto: não indexar, não destilar mais, não exibir. Nada é
 * apagado — as 95 destilações de pessoal seguem no banco e voltam mudando esta
 * lista, sem redestilar (custo zero para reverter).
 */
export const TEMAS_FORA_DA_BASE: readonly Tema[] = ['pessoal'];

export function naBase(tema: string | null | undefined): boolean {
  return !!tema && ehTema(tema) && !TEMAS_FORA_DA_BASE.includes(tema);
}

/** Áreas da jurisprudência selecionada do TCU → blocos daqui. */
const AREA_OFICIAL: Record<string, Tema> = {
  Licitação: 'licitacoes-contratos',
  'Contrato Administrativo': 'licitacoes-contratos',
  Pessoal: 'pessoal',
  Responsabilidade: 'responsabilizacao',
  'Direito Processual': 'processo-controle',
  'Competência do TCU': 'processo-controle',
  Convênio: 'convenios-transferencias',
  'Finanças Públicas': 'financas-orcamento',
  Desestatização: 'concessoes-estatais',
  'Gestão Administrativa': 'outros',
};

export interface Classificacao {
  chave: string;
  tema: Tema;
  subtema: string;
  fronteirico: boolean;
}

const SYSTEM = `Você classifica acórdãos do TCU por matéria, para montar uma base de pesquisa
sobre licitações e contratos.

BLOCOS (use exatamente estas chaves):
${Object.entries(TEMAS)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Regras de fronteira (as que mais confundem):
- Sobrepreço, superfaturamento, BDI, administração local, projeto básico, medição de obra
  => "obras-engenharia".
- Regra de licitação/contrato sem tecnicalidade de engenharia (habilitação, modalidade,
  aditivo, reequilíbrio, sanção a licitante) => "licitacoes-contratos".
- Erro grosseiro (art. 28 LINDB), culpa grave, débito, multa, inidoneidade, prescrição
  => "responsabilizacao", ainda que o fato de origem seja uma licitação.
- Competência do TCU, recurso, cautelar, contraditório, revelia => "processo-controle",
  ainda que o fato de origem seja uma licitação.
- Ato de admissão/aposentadoria/pensão, acumulação de cargos, parcela remuneratória,
  concurso público => "pessoal".

Classifique pelo que o acórdão DECIDE, não pelo cenário de fundo.
Se o texto for insuficiente para decidir, use "outros" com subtema "insumo insuficiente".

"subtema": rótulo curto (2 a 5 palavras), minúsculas.
"fronteirico": true quando caberia de forma defensável em outro bloco.

Responda APENAS com JSON:
{"itens":[{"chave":"N/AAAA","tema":"<chave>","subtema":"...","fronteirico":bool}]}`;

function extrairJson(text: string): string {
  const s = text.replace(/```(?:json)?/gi, '').trim();
  const i = s.indexOf('{');
  const f = s.lastIndexOf('}');
  if (i < 0 || f <= i) throw new Error('resposta sem JSON reconhecível');
  return s.slice(i, f + 1);
}

export interface AlvoParaClassificar {
  numero: number;
  ano: number;
  chave: string;
  /** Ementa, descrição ou recorte do inteiro teor — o que houver. */
  insumo: string;
}

/** Classifica um lote por LLM. Devolve só o que veio válido e pareado por chave. */
export async function classificarPorLLM(alvos: AlvoParaClassificar[]): Promise<Classificacao[]> {
  if (!alvos.length) return [];
  const userContent = alvos
    .map((a) => `### Acórdão ${a.chave}\n${a.insumo.slice(0, 1500)}`)
    .join('\n\n');

  const { text } = await generate('enhancement', {
    systemPrompt: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    jsonMode: true,
    maxTokens: 4096,
  });
  if (!text) throw new Error('classificarPorLLM: resposta vazia');

  const raw = JSON.parse(extrairJson(text)) as { itens?: Array<Partial<Classificacao>> };
  const porChave = new Map(alvos.map((a) => [a.chave, a]));
  return (raw.itens ?? [])
    .filter((i): i is Classificacao =>
      typeof i?.chave === 'string' && porChave.has(i.chave) && typeof i.tema === 'string' && ehTema(i.tema)
    )
    .map((i) => ({ ...i, subtema: String(i.subtema ?? '').slice(0, 80), fronteirico: !!i.fronteirico }));
}

/** Mapeia a área oficial do TCU, quando o alvo estiver na jurisprudência selecionada. */
export function temaDaAreaOficial(area: string | null | undefined): Tema | null {
  if (!area) return null;
  return AREA_OFICIAL[area.trim()] ?? null;
}

export async function gravarTema(
  alvo: { numero: number; ano: number; chave: string },
  c: Omit<Classificacao, 'chave'>,
  fonte: 'area-oficial' | 'llm',
  insumo: string | null
): Promise<void> {
  const dados = {
    chave: alvo.chave,
    tema: c.tema,
    subtema: c.subtema,
    fronteirico: c.fronteirico,
    fonte,
    insumo: insumo?.slice(0, 2000) ?? null,
  };
  await prisma.acordaoTema.upsert({
    where: { numeroAlvo_anoAlvo: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano } },
    create: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano, ...dados },
    update: dados,
  });
}

/**
 * Tema de um alvo, classificando na hora se ainda não houver — o insumo é a
 * ementa que o pipeline de destilação já busca no TCU, então a classificação
 * sai de graça em termos de rede e custa uma chamada curta de LLM.
 *
 * Devolve `null` quando não há tema nem insumo para produzir um. Quem chama
 * decide o que fazer com o desconhecido; aqui não se inventa tema, porque um
 * palpite silencioso é o que colocaria pessoal de volta na base.
 */
export async function garantirTemaDeAlvo(
  alvo: { numero: number; ano: number; chave: string },
  insumo: string | null
): Promise<Tema | null> {
  const existente = await prisma.acordaoTema.findUnique({
    where: { numeroAlvo_anoAlvo: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano } },
    select: { tema: true },
  });
  if (existente) return ehTema(existente.tema) ? existente.tema : null;

  const texto = (insumo ?? '').replace(/\s+/g, ' ').trim();
  if (texto.length < 60) return null;

  const [c] = await classificarPorLLM([{ ...alvo, insumo: texto }]);
  if (!c) return null;
  await gravarTema(alvo, c, 'llm', texto);
  return c.tema;
}

/** Chaves ("n/aaaa") cujo tema está fora da base — para filtrar seleção e folha. */
export async function chavesForaDaBase(): Promise<Set<string>> {
  const fora = await prisma.acordaoTema.findMany({
    where: { tema: { in: [...TEMAS_FORA_DA_BASE] } },
    select: { chave: true },
  });
  return new Set(fora.map((f) => f.chave));
}
