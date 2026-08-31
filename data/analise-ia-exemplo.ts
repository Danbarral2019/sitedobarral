/**
 * Exemplo congelado da Análise IA, para a demonstração na busca pública.
 *
 * NÃO é texto de marketing nem prosa escrita à mão: é a saída real do
 * assistente, gerada em 31/08/2026 pelo mesmo pipeline da área logada
 * (lib/rag/answerContext + síntese), para a pergunta registrada abaixo em
 * "pergunta". Foi copiada literalmente, sem edição do texto.
 *
 * A única curadoria foi nas fontes exibidas: o pipeline devolveu 21 fontes
 * legais, com vários decretos e instruções normativas periféricos que a
 * resposta não chega a citar. O card mostra os 6 documentos que a resposta
 * de fato cita, mais o artigo central. É uma demonstração, e listar 21 chips
 * seria ruído — mas o texto segue verbatim.
 *
 * Para regenerar: rodar a mesma pergunta pelo assistente na área logada e
 * substituir a resposta e as fontes pela nova saída.
 */

export interface ExemploFonte {
  titulo: string;
  categoria: string;
  url: string;
  /** Id no acervo, para linkar a página do documento. */
  documentoId: string;
}

export const ANALISE_IA_EXEMPLO = {
  pergunta: 'Como se afere o limite da dispensa de licitação por valor?',
  geradoEm: '2026-08-31',
  artigoCentral: { rotulo: 'Art. 75 da Lei 14.133', href: '/lei-14133?artigo=75' },
  resposta: "Sob a égide da Lei nº 14.133/2021, a aferição dos limites para a dispensa de licitação em razão do valor (licitação dispensável) segue critérios específicos de somatório e temporalidade para evitar o fracionamento indevido de despesa.\n\nConforme o conjunto normativo e orientativo disponível, a aferição deve ser feita da seguinte forma:\n\n### 1. Limites Nominais e Natureza do Objeto\nDe acordo com o **Art. 75 da Lei nº 14.133/2021**, a licitação é dispensável para:\n*   **Inciso I:** Obras e serviços de engenharia ou serviços de manutenção de veículos automotores, para valores inferiores a **R$ 100.000,00**.\n*   **Inciso II:** Outros serviços e compras, para valores inferiores a **R$ 50.000,00**.\n*   *Nota: O próprio texto da lei indica que esses valores são atualizados periodicamente por Decretos (ex: Decreto nº 11.871/2023 e Decreto nº 12.343/2024).*\n\n### 2. Regra de Somatório e Período (Exercício Financeiro)\nSegundo o **Parecer nº 00044/2025/CONUNI/CGU/AGU** e a **Orientação Normativa AGU nº 105/2026**, o cálculo para verificar se o limite foi atingido deve considerar:\n*   O **somatório da despesa** realizada no **exercício financeiro** pela respectiva unidade gestora.\n*   Devem ser somadas as dispensas por baixo valor (Art. 75, I e II) e as aquisições por **suprimento de fundos**.\n*   O critério de agrupamento é o **mesmo ramo de atividade** (objetos de mesma natureza). O Parecer da AGU esclarece que a natureza do objeto deve observar o nível de classe de materiais ou grupo de serviços/obras conforme os sistemas de catalogação do Governo Federal.\n\n### 3. Exclusões do Cálculo\nA **Orientação Normativa AGU nº 105/2026** (item I) e o **Parecer nº 00044/2025/CONUNI/CGU/AGU** (item II) estabelecem que **não devem ser incluídos** no cálculo do limite:\n*   Contratações feitas por outras modalidades de contratação direta (como as demais hipóteses de dispensa ou as **inexigibilidades** de licitação).\n*   Contratações operacionalizadas por meio do procedimento auxiliar de credenciamento.\n\n### 4. Contratos de Execução Continuada (Vigência Plurianual)\nPara serviços continuados ou fornecimentos com vigência superior a um ano, o **Enunciado nº 30 do INCP** dispõe que deve ser considerado como valor da contratação o montante equivalente ao período de **1 (um) ano de vigência**, para fins de enquadramento nos limites dos incisos I e II do Art. 75.\n\n### 5. Situações Imprevistas e Planejamento\nA existência de uma licitação anterior para o mesmo objeto não impede, por si só, uma nova dispensa por valor em caso de situação imprevista, desde que não seja possível o aditivo contratual e que o limite anual do Art. 75, § 1º, seja respeitado (**Orientação Normativa AGU nº 105/2026**, item II).\n\n### 6. Estimativa de Preços\nO **Manual do TCU (item 5.10)** reforça que os valores devem ser calculados conforme o **Art. 23 da Lei nº 14.133/2021**. No caso das dispensas por valor, a IN SEGES/ME nº 65/2021 e a IN SEGES/ME nº 67/2021 permitem que a estimativa de preços seja realizada concomitantemente à seleção da proposta na dispensa eletrônica, simplificando o rito.\n\n⚠️ **Precedente anterior à Lei 14.133/2021 — verificar aplicabilidade:** O **Acórdão TCU 2957/2011-Plenário** (Informativo 85/2011) tratava de limites de R$ 80.000,00 para reserva de cotas a ME/EPP sob a égide da Lei Complementar 123/2006 e Decretos antigos, não devendo ser confundido com os novos limites de dispensa da Lei 14.133/2021.",
  fontes: [
      {
          "titulo": "Manual TCU - 5.10 Processo de contratação direta",
          "categoria": "manual-tcu",
          "url": "https://licitacoesecontratos.tcu.gov.br/5-10-processo-de-contratacao-direta/",
          "documentoId": "be9de479-e191-46b1-a874-00cffd7941c2"
      },
      {
          "titulo": "Inf. 85/2011 — Reservar licitações de até R$ 80 mil para microempresas e empresas de pequeno porte",
          "categoria": "informativo",
          "url": "https://contas.tcu.gov.br/egestao/ObterDocumentoSisdoc?codArqCatalogado=10650273",
          "documentoId": "46eaebed-869a-4ade-83b9-2895efbacf31"
      },
      {
          "titulo": "Enunciado do INCP nº 30",
          "categoria": "enunciados",
          "url": "https://incpbrasil.com.br/informativo-enunciados-2a-edicao/",
          "documentoId": "b2424a87-9b0b-4c73-8192-ee75588cb165"
      },
      {
          "titulo": "Orientação Normativa AGU nº 105/2026",
          "categoria": "orientacao-normativa",
          "url": "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu",
          "documentoId": "f7dd7f54-7a6e-4d58-ad1e-7e6595961a5c"
      },
      {
          "titulo": "PARECER Nº 00044/2025/CONUNI/CGU/AGU — Uniformização de entendimento quanto à interpretação do cálculo previsto no §1º do art. 75 da Lei nº 14.133/2021, a f...",
          "categoria": "parecer",
          "url": "https://sapiens.agu.gov.br/valida_publico?id=2944419576",
          "documentoId": "c2552b64-31ee-46c2-a340-e0fce22f04fa"
      },
      {
          "titulo": "Resposta a Consulta — Acórdão AC-2957/11-P",
          "categoria": "consulta_tcu",
          "url": "https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/2957/2011/Plen%C3%A1rio",
          "documentoId": "d1b2a2b8-d270-4df3-aecb-0e6137b0272b"
      }
  ] as ExemploFonte[],
} as const;
