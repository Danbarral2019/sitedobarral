/**
 * Detecção de domínio da pergunta do assistente (RAG) — jurisprudência de TCEs
 * estaduais e Justiça do Trabalho (TST: Súmulas, OJs, PNs), boost strong-labor,
 * consciência de precedentes canônicos cancelados/revistos, e scope override
 * pelos chips do chat.
 *
 * Extraído VERBATIM da etapa 5a de `app/api/documents/query/route.ts` (Fase 1
 * do plano de retomada — `docs/PLANO_FASE1_ANSWERSERVICE.md`) para permitir
 * reuso pela rota de produção e pelo harness de avaliação, e testes isolados
 * das ~110 regexes. Lógica pura, sem I/O — o logging permanece na rota.
 */

export type QueryScope = 'all' | 'tst-only' | 'no-tst';

export interface TribunalBoost {
  code: string;
  factor: number;
}

/** Opções de busca derivadas do scope, prontas para o hybridSearch. */
export interface ScopedSearchOptions {
  includeTribunalDecisions: boolean;
  excludeInactiveSumulas: boolean;
  tribunalBoost: TribunalBoost | undefined;
  skipDocumentBranch: boolean | undefined;
  skipLegislativeActBranch: boolean | undefined;
  tribunalCodeFilter: string | undefined;
  skipFts: boolean;
}

export interface QueryDomain {
  includeTribunalDecisions: boolean;
  tribunalMatchCount: number;
  hasInstitutionalLaborSignal: boolean;
  hasTier2LaborSignal: boolean;
  isStronglyLabor: boolean;
  tribunalBoost: TribunalBoost | undefined;
  citesSpecificCanonical: boolean;
  isHistoricalQuery: boolean;
  excludeInactiveSumulas: boolean;
  scopedOptions: ScopedSearchOptions;
}

// Detecta se a pergunta envolve jurisprudência de TCEs ou TST (Súmulas,
// OJs, PNs). Usamos regex com RADICAIS em vez de `string.includes(kw)` —
// a versão antiga só ativava com palavras-chave literais e perdia
// variações comuns ("terceirizar" não casava "terceirização", "tomador"
// sozinho não casava "tomador de serviço"). Auditoria via simulação RAG
// em 2026-05-24 mostrou que 5 de 7 perguntas trabalhistas não ativavam.
//
// Regex em ordem temática para legibilidade. Use \b nas extremidades e
// alternativas explícitas onde o radical pode ambiguar com outras palavras.
const tribunalPatterns: RegExp[] = [
  // ── Tribunais de Contas Estaduais ──
  /\btce\b/i,
  /\btribuna(?:l|is)\s+de\s+contas\s+estadua(?:l|is)\b/i,
  /\btce-(?:sp|mg|pr|sc|rj|rs|pe)\b/i,
  /\btribunal\s+estadual\b/i,
  /\bdecis(?:ão|ões)\s+estadua(?:l|is)\b/i,
  /\bjurisprud[êe]ncia\s+estadual\b/i,
  /\bcorte\s+de\s+contas\s+estadual\b/i,

  // ── TST / Justiça do Trabalho — termos-chave de instituição ──
  /\btst\b/i,
  /\btribunal\s+superior\s+do\s+trabalho\b/i,
  /\bjustiça\s+do\s+trabalho\b/i,
  /\bjurisprud[êe]ncia\s+trabalhista\b/i,
  /\bclt\b/i,
  /\bconsolida[çc][ãa]o\s+das\s+leis\s+do\s+trabalho\b/i,
  /\breforma\s+trabalhista\b/i,
  /\blei\s+13\.?467(?:\/2017)?\b/i,

  // ── Temas trabalhistas (radicais) ──
  /\bterceiriz/i,                    // terceirizar, terceirização, terceirizado
  /\btomador\b/i,                    // tomador de serviço (e variações)
  /\bempresa\s+interposta\b/i,
  /\bv[íi]nculo(?:\s+(?:de\s+emprego|empregat[íi]cio))?\b/i,
  /\bsubsidi[áa]ri/i,                // responsabilidade subsidiária
  /\bsolidari[ea]/i,                 // responsabilidade solidária
  /\baviso[\s-]+pr[ée]vio\b/i,
  /\bequipara[çc][ãa]o\s+salarial\b/i,
  /\bpericulosidade\b/i,
  /\binsalubridade\b/i,
  /\badicional\s+(?:de\s+)?(?:periculosidade|insalubridade|noturno)\b/i,
  /\bhoras?\s+extras?\b/i,
  /\bintervalo\s+intrajornada\b/i,
  /\bjornada\s+de\s+trabalho\b/i,
  /\brepactua[çc][ãa]o\b/i,
  /\bplanilha\s+de\s+custos\b/i,
  /\bverbas?\s+trabalhista/i,
  /\bf[ée]rias\s+(?:proporcionais|vencidas|indenizadas)\b/i,
  /\bestabilidade\s+(?:provis[óo]ria|de\s+emprego|gestante|cipeiro|acidentado)\b/i,
  /\b13[ºo]?\s+sal[áa]rio\b/i,
  /\bgratifica[çc][ãa]o\s+natalina\b/i,
  /\bfgts\b/i,

  // ── Rodada 2 (expansão pós-validação 2026-05-24, Q2 falhou) ──
  // Estas perguntas trabalhistas não usavam termos-gatilho institucionais
  // (TST/CLT) nem temas específicos da lista anterior. Adicionamos
  // radicais conservadores que só casam contextos inequivocamente
  // trabalhistas — evitando falsos positivos em queries Lei 14.133/AGU.

  // Relações do contrato de trabalho
  /\bempregad(?:o|or|a|ora)\b/i,              // empregado/empregador
  /\bempregat[íi]cio\b/i,
  /\bcontrato\s+de\s+trabalho\b/i,
  /\brela[çc][ãa]o\s+de\s+emprego\b/i,
  /\bcarteira\s+(?:de\s+trabalho|profissional|assinada)\b/i,
  /\bctps\b/i,                                // CTPS (Carteira de Trabalho)

  // Salário / remuneração / descontos
  /\bdesconto(?:s)?\s+(?:no|do|em)\s+sal[áa]rio\b/i,
  /\bdano(?:s)?\s+causad[oa]s?\s+(?:pelo\s+)?empregad/i,
  /\bsal[áa]ri[oa](?:l|s)?\b(?=.*(?:trabalh|empregad|patron|sindical|categoria|m[íi]nimo|piso))/i,
  /\bremunera[çc][ãa]o\s+(?:do\s+empregado|do\s+trabalhador)\b/i,
  /\bpiso\s+salarial\b/i,
  /\bsal[áa]rio\s+m[íi]nimo\b/i,
  /\bsal[áa]rio[\s-]+(?:fam[íi]lia|maternidade)\b/i,

  // Rescisão e demissão
  /\brescis[ãa]o(?:\s+(?:contratual|indireta|do\s+contrato))?\b/i,
  /\bjusta\s+causa\b/i,
  /\bdemiss[ãa]o\b/i,
  /\bdispensa\s+(?:imotivada|sem\s+justa\s+causa|por\s+justa\s+causa|discrimin)/i,
  /\bjusti[çc]a\s+do\s+trabalho\b/i,
  /\breclama[çc][ãa]o\s+trabalhista\b/i,
  /\binqu[ée]rito\s+judicial\b/i,

  // Saúde, segurança e benefícios
  /\bacidente\s+(?:de\s+|do\s+)?trabalho\b/i,
  /\bdoen[çc]a\s+(?:ocupacional|profissional|do\s+trabalho)\b/i,
  /\baux[íi]lio[\s-]+doen[çc]a\b/i,
  /\baposentadoria\s+por\s+invalidez\b/i,
  /\bvale[\s-]?(?:transporte|refei[çc][ãa]o|alimenta[çc][ãa]o)\b/i,
  /\bsobreaviso\b/i,
  /\bbanco\s+de\s+horas\b/i,
  /\bcompensa[çc][ãa]o\s+de\s+jornada\b/i,
  /\bperiodo\s+noturno\b/i,

  // Categorias e organização sindical
  /\bsindicato\b/i,
  /\bsindical\b/i,
  /\bcategoria\s+profissional\b/i,
  /\bbanc[áa]ri[ao]s?\b/i,
  /\bferrovi[áa]ri[ao]s?\b/i,
  /\bmotorista(?:s)?\s+(?:profissional|de\s+caminh|de\s+carga)/i,

  // ── OJs do TST (Orientações Jurisprudenciais) ──
  /\borienta[çc](?:[ãa]o|[õo]es)\s+jurisprudencia(?:l|is)\b/i,
  /\boj[-\s]?sbdi[-\s]?[i12]+t?\b/i,  // OJ-SBDI-I, OJ-SBDI-II, OJ-SBDI-1T
  /\boj[-\s]?sdc\b/i,
  /\bsbdi[-\s]?[i12]+\b/i,            // SBDI-I, SBDI-II
  /\bsubse[çc][ãa]o\b/i,
  /\btribunal\s+pleno\b/i,
  /\b[óo]rg[ãa]o\s+especial\b/i,

  // ── Precedentes Normativos (PN) — SDC ──
  /\bprecedente(?:s)?\s+normativo(?:s)?\b/i,
  /\bdiss[íi]dio(?:s)?\s+coletivo(?:s)?\b/i,
  /\bnegocia[çc][ãa]o\s+coletiva\b/i,
  /\bcl[áa]usula\s+normativa\b/i,
  /\bconven[çc][ãa]o\s+coletiva\b/i,
  /\bacordo\s+coletivo\b/i,
];

// Strong-labor: ativa boost de similarity no ramo TST (factor 1.20). Ver
// documentação completa do critério na etapa 5a original da rota.
const strongInstitutionalLaborPatterns: RegExp[] = [
  /\btst\b/i,
  /\btribunal\s+superior\s+do\s+trabalho\b/i,
  /\bjustiça\s+do\s+trabalho\b/i,
  /\bclt\b/i,
  /\bconsolida[çc][ãa]o\s+das\s+leis\s+do\s+trabalho\b/i,
  /\breforma\s+trabalhista\b/i,
  /\bjurisprud[êe]ncia\s+trabalhista\b/i,
  /\breclama[çc][ãa]o\s+trabalhista\b/i,
];
// Tier-2 forte: padrões cuja presença isolada já fixa domínio trabalhista
// (não têm leitura em Lei 14.133/AGU/TCU). Ativam strong-labor sozinhos.
// Mantemos enxuto e auditável — adicionar com critério, não automaticamente.
const tier2StrongLaborPatterns: RegExp[] = [
  /\brescis[ãa]o\s+indireta\b/i,
  /\bjusta\s+causa\b/i,
  /\bdispensa\s+(?:imotivada|sem\s+justa\s+causa|por\s+justa\s+causa|discrimin)/i,
  /\baviso[\s-]+pr[ée]vio\b/i,
  /\bfgts\b/i,
  /\b13[ºo]?\s+sal[áa]rio\b/i,
  /\bgratifica[çc][ãa]o\s+natalina\b/i,
  /\bintervalo\s+intrajornada\b/i,
  /\bjornada\s+de\s+trabalho\b/i,
  /\bhoras?\s+extras?\b/i,
  /\badicional\s+(?:de\s+)?(?:periculosidade|insalubridade|noturno)\b/i,
  /\bpericulosidade\b/i,
  /\binsalubridade\b/i,
  /\bequipara[çc][ãa]o\s+salarial\b/i,
  /\bv[íi]nculo\s+(?:de\s+emprego|empregat[íi]cio)\b/i,
  /\bcarteira\s+(?:de\s+trabalho|profissional|assinada)\b/i,
  /\bctps\b/i,
  /\bdiss[íi]dio(?:s)?\s+coletivo(?:s)?\b/i,
  /\bnorma\s+coletiva\b/i,
  /\bconven[çc][ãa]o\s+coletiva\b/i,
  /\bacordo\s+coletivo\b/i,
  /\bnegocia[çc][ãa]o\s+coletiva\b/i,
  /\bcl[áa]usula\s+normativa\b/i,
  /\bprecedente(?:s)?\s+normativo(?:s)?\b/i,
  /\borienta[çc](?:[ãa]o|[õo]es)\s+jurisprudencia(?:l|is)\b/i,
  /\bestabilidade\s+(?:provis[óo]ria|gestante|cipeiro|acidentado)\b/i,
  /\bf[ée]rias\s+(?:proporcionais|vencidas|indenizadas)\b/i,
  /\bverbas?\s+trabalhista/i,
  /\bacidente\s+(?:de\s+|do\s+)?trabalho\b/i,
  /\bdoen[çc]a\s+(?:ocupacional|profissional|do\s+trabalho)\b/i,
  /\bsobreaviso\b/i,
  /\bbanco\s+de\s+horas\b/i,
  /\bempresa\s+interposta\b/i,
  /\bequipara[çc][ãa]o\s+salarial\b/i,
];

// Súmulas TST canceladas/revistas: por padrão ficam fora do contexto IA
// (precedente superado induz erro). Aparecem só quando a pergunta
// explicitamente indicar interesse histórico ou por súmula específica.
const historicalKeywords = [
  'histórico', 'historico', 'cancelada', 'cancelado', 'cancelamento',
  'revista', 'revisão', 'revisao', 'revogada', 'revogado',
  'antes da reforma', 'reforma trabalhista', 'lei 13.467', '13.467/2017',
  'entendimento anterior', 'redação anterior', 'redacao anterior',
  'precedente revogado', 'antiga redação', 'antiga redacao',
];

/**
 * Analisa a pergunta e o scope escolhido pelo aluno, retornando as flags de
 * domínio e as opções de busca (`scopedOptions`) que alimentam o hybridSearch.
 * O caller é responsável por qualquer logging derivado das flags.
 */
export function detectQueryDomain(query: string, scope: QueryScope): QueryDomain {
  const queryLowerForTribunal = query.toLowerCase();
  const tribunalMatchCount = tribunalPatterns.reduce(
    (n, re) => (re.test(query) ? n + 1 : n),
    0,
  );
  // INCONDICIONAL desde 18/08/2026. Era `tribunalMatchCount > 0`, e o
  // condicional disparava em 1 de 10 perguntas de jurisprudencia -- gente
  // pergunta pelo ASSUNTO ("credenciamento substitui licitacao?"), nao pelo
  // nome do tribunal. Medido contra o golden set com 10 queries de
  // jurisprudencia anotadas (recall@5, 103 queries):
  //
  //   condicional            60,9% nas antigas ·  0,0% nas novas · 51,5% total
  //   INCONDICIONAL          57,1% nas antigas · 70,0% nas novas · 59,1% total
  //   incondicional + boost   4,2% nas antigas · 86,7% nas novas · 16,9% total
  //
  // O custo nas perguntas antigas e real (-3,8pp) e foi aceito: o ganho nas
  // que hoje nao tem resposta e de outra ordem de grandeza. O boost por
  // tribunal foi medido e DESCARTADO -- e o melhor para o STF e destroi todo
  // o resto, porque multiplica a similaridade em qualquer pergunta.
  //
  // `tribunalMatchCount` continua vivo: alimenta o sinal trabalhista abaixo.
  const includeTribunalDecisions = true;

  const hasInstitutionalLaborSignal = strongInstitutionalLaborPatterns.some((re) => re.test(query));
  const hasTier2LaborSignal = tier2StrongLaborPatterns.some((re) => re.test(query));
  const isStronglyLabor =
    hasInstitutionalLaborSignal || hasTier2LaborSignal || tribunalMatchCount >= 2;
  const tribunalBoost: TribunalBoost | undefined = isStronglyLabor ? { code: 'TST', factor: 1.2 } : undefined;

  // Também ativa quando a pergunta cita o número de uma súmula específica
  // (ex.: "súmula 437", "OJ-SBDI-1 123", "PN 5"), pois nesse caso o usuário
  // sabe exatamente o que quer ver — não faz sentido esconder cancelados.
  const citesSpecificCanonical = /(?:s[uú]mula|enunciado|oj[\s-]*(?:sbdi|sdc|tp\/?oe)?|orienta[çc][ãa]o\s+jurisprudencial|precedente\s+normativo|pn)\s*(?:tst)?\s*(?:n[º°]?\s*)?\d+/i.test(query);
  const isHistoricalQuery =
    historicalKeywords.some(kw => queryLowerForTribunal.includes(kw)) || citesSpecificCanonical;
  const excludeInactiveSumulas = !isHistoricalQuery;

  const scopedOptions: ScopedSearchOptions =
    scope === 'tst-only'
      ? {
          includeTribunalDecisions: true,
          excludeInactiveSumulas,
          tribunalBoost: undefined,
          skipDocumentBranch: true,
          skipLegislativeActBranch: true,
          tribunalCodeFilter: 'TST',
          skipFts: true,
        }
      : scope === 'no-tst'
        ? {
            includeTribunalDecisions: false,
            excludeInactiveSumulas,
            tribunalBoost: undefined,
            skipDocumentBranch: undefined,
            skipLegislativeActBranch: undefined,
            tribunalCodeFilter: undefined,
            skipFts: false,
          }
        : {
            includeTribunalDecisions,
            excludeInactiveSumulas,
            tribunalBoost,
            skipDocumentBranch: undefined,
            skipLegislativeActBranch: undefined,
            tribunalCodeFilter: undefined,
            skipFts: false,
          };

  return {
    includeTribunalDecisions,
    tribunalMatchCount,
    hasInstitutionalLaborSignal,
    hasTier2LaborSignal,
    isStronglyLabor,
    tribunalBoost,
    citesSpecificCanonical,
    isHistoricalQuery,
    excludeInactiveSumulas,
    scopedOptions,
  };
}
