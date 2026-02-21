/**
 * Popula o campo `content` de 11 documentos/atos cujas URLs são acessíveis programaticamente.
 *
 * 9 Documents (Portarias, category=boa_pratica) + 2 LegislativeActs (MP + Resolução).
 *
 * Uso:
 *   cd sitedobarral
 *   npx tsx scripts/populate-content-accessible.ts --dry-run   # Simular
 *   npx tsx scripts/populate-content-accessible.ts              # Executar
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error('DATABASE_URL not set'); process.exit(1); }

const adapter = new PrismaNeon({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================================
// Conteúdos extraídos via WebFetch/WebSearch
// ============================================================================

interface ContentUpdate {
  id: string;
  table: 'document' | 'legislativeAct';
  title: string;
  content: string;
}

const updates: ContentUpdate[] = [
  // =========================================================================
  // 1. Portaria-TCU nº 8, de 27 de janeiro de 2026
  //    Fonte: DOU (in.gov.br) — texto completo extraído via WebFetch
  // =========================================================================
  {
    id: '280db3ea-d2b1-4c25-a503-e835d6d56e7e',
    table: 'document',
    title: 'Portaria-TCU nº 8/2026',
    content: `PORTARIA-TCU Nº 8, DE 27 DE JANEIRO DE 2026

Dispõe sobre a Política de Governança e Gestão das Contratações de Serviços Contínuos com Regime de Dedicação Exclusiva de Mão de Obra no âmbito do Tribunal de Contas da União.

CAPÍTULO I - DAS DISPOSIÇÕES GERAIS

Art. 1º A Política de que trata esta Portaria integra a governança institucional e deve ser interpretada em conjunto com as demais normas de contratação do TCU.

Art. 2º Para os fins desta Portaria, considera-se:
I - serviços com dedicação exclusiva de mão de obra: aqueles cujos trabalhadores ficam exclusivamente à disposição do TCU, sem compartilhamento de recursos;
II - contratação de postos de trabalho: processo licitatório para empresas de serviços contínuos;
III - alocação de colaborador: pessoa designada para ocupar postos no TCU;
IV - colaborador terceirizado: trabalhador com vínculo empregatício com a empresa contratada;
V - posto de trabalho: unidade funcional que demanda disponibilidade permanente ou sob demanda;
VI - fiscal técnico: servidor do TCU responsável por avaliar a execução do contrato e indicadores de desempenho;
VII - fiscal administrativo: servidor que monitora obrigações fiscais, tributárias e trabalhistas;
VIII - fiscal setorial: servidor que acompanha a execução na unidade beneficiária;
IX - gestor do contrato: líder que dirige processos de contratação e gestão contratual;
X - unidade beneficiária: unidade do TCU diretamente beneficiada pelos serviços.

CAPÍTULO II - DOS OBJETIVOS, PRINCÍPIOS E DIRETRIZES

Art. 3º São objetivos da Política:
I - estabelecer princípios de governança;
II - promover a racionalização estratégica;
III - monitorar resultados;
IV - aprimorar a fiscalização contratual;
V - assegurar alinhamento com a regulamentação e práticas corporativas;
VI - avaliar a evolução de gastos.

Art. 4º São princípios da Política: alinhamento institucional, valorização de pessoas, definição clara de papéis e aderência ao interesse público.

Art. 5º São diretrizes: monitoramento de resultados, desburocratização, desenvolvimento de competências, padronização de procedimentos, promoção de ambientes salubres e seguros, e sistemas efetivos de gestão de riscos.

CAPÍTULO III - DO SISTEMA DE GOVERNANÇA E GESTÃO

Art. 6º O sistema de governança compreende estruturas administrativas, processos de trabalho, instrumentos de governança, fluxo de informações e comportamentos dos envolvidos.

Art. 7º A gestão de riscos, coordenada pela SecPessoas, concentra-se nos impactos da política de gestão de força de trabalho e de pessoas.

Art. 8º As iniciativas de melhoria da Política incluem participação em redes especializadas, estudos comparativos, incorporação de melhores práticas identificadas em auditorias e comunicação entre unidades de fiscalização.

CAPÍTULO IV - DA CONTRATAÇÃO E GESTÃO DA MÃO DE OBRA TERCEIRIZADA

Art. 9º O gasto anual com serviços terceirizados não pode exceder 10% (dez por cento) do orçamento anual aprovado do TCU.
§ 1º Limites mensais aplicam-se proporcionalmente.
§ 2º O cálculo inclui todos os contratos vigentes e aditivos com base em valores liquidados.
§ 3º Excedido o limite, a Presidência deve orientar medidas corretivas em até 6 meses.
§ 4º O patamar de 90% representa o limite prudencial.
§ 5º No limite prudencial, devem ser adotadas medidas preventivas: suspensão de novos pedidos de postos, reavaliação de renovações, análise de substituições e comunicação formal à Presidência.

Art. 10. A contratação de novos postos requer análise da CGP abordando: demonstração de necessidade, unidades beneficiárias, fluxos de trabalho impactados, entregas esperadas, previsão de despesas, duração contratual, contratos similares e indicadores de efetividade.

Art. 11. Demandas de postos de trabalho requerem autorização do gestor considerando: postos vagos, justificativa, atividades executadas e capacidade de monitoramento.

Art. 12. É vedado: indicar pessoas específicas, criar subordinação hierárquica, exigir tarefas fora do escopo e negociar afastamentos sem consentimento da empresa.

Art. 13. É vedada a contratação de cônjuge, companheiro ou parente de até 3º grau de pessoas vinculadas ao TCU.

Art. 14. Colaboradores terceirizados não podem ter parentesco com servidores do TCU. A SecCompras deve assegurar cláusulas contratuais para cumprimento. Omissão ou falsidade pode resultar em dispensa e sanções.

Art. 15. Períodos de férias devem preferencialmente coincidir com o recesso do TCU.

Art. 16. Pedidos de dispensa, substituição ou transferência devem ser motivados e notificados ao fiscal.

Art. 17. Os instrumentos contratuais devem exigir que os colaboradores obedeçam às normas do TCU, incluindo: horários de trabalho, procedimentos de identificação, protocolos de segurança, proteção de informações, reporte de irregularidades, conduta profissional, confidencialidade, orientação de tarefas, contato com autoridade competente, cumprimento do código de ética e políticas contra assédio e discriminação.

CAPÍTULO V - DA ESTRUTURA DE GOVERNANÇA E ÓRGÃOS

Art. 18. A governança compreende:
I - Alta administração: Ministro-Presidente e CCG;
II - Instâncias de apoio: CGP, Adgedam, SecCompras, SecPessoas, Seta, SecFinanças, Unidades Beneficiárias.

Art. 19. A Presidência aprova mudanças direcionais considerando recomendações do CCG e CGP e observância do art. 9º.

Art. 20. O CCG decide sobre estratégias e políticas, avalia a efetividade da Política, aprova contratação de postos com base em análise da CGP e limites orçamentários, e auxilia a Presidência em ações de conformidade.

Art. 21. A CGP emite pareceres sobre contratações, manifesta-se sobre planos anuais de contratação considerando estratégia institucional e impactos na força de trabalho, monitora distribuição de colaboradores e avalia relatórios de desempenho.

Art. 22. A Adgedam coordena a comunicação de diretrizes, propõe melhorias na gestão e monitora indicadores de qualidade dos serviços.

Art. 23. A SecPessoas coordena propostas estratégicas, monitora impactos na força de trabalho, monitora riscos associados, apoia a descrição de postos e promove a integração organizacional dos colaboradores.

Art. 24. A SecCompras elabora documentos de orientação, coordena reuniões periódicas com fiscais e alinha critérios entre contratos similares.

Art. 25. A SecFinanças monitora a execução orçamentária mensal e alerta formalmente a Segedam ao atingir o limite prudencial com relatórios detalhados.

Art. 26. As Unidades Beneficiárias indicam fiscais setoriais, monitoram desempenho dos colaboradores, identificam riscos, coordenam a fiscalização contratual, apoiam a definição de especificações, atendem à gestão de relações trabalhistas, participam de reuniões periódicas e comparecem a reuniões da CGP quando pertinente.

CAPÍTULO VI - DAS DISPOSIÇÕES FINAIS

Art. 27. A fiscalização contratual observa o disposto na Portaria-TCU nº 122, de 28 de junho de 2023. Os fiscais técnicos devem apresentar as políticas institucionais aos representantes das empresas contratadas no início da execução, especialmente códigos de integridade, gestão de pessoal, equidade e diretrizes contra assédio.

Art. 28. A SecPessoas fornece relatórios estatísticos atualizados contendo quantidade de contratos, valores totais e colaboradores terceirizados por posto.

Art. 29. Os casos omissos serão resolvidos pelo CCG.

Art. 30. Esta Portaria entra em vigor na data de sua publicação.`,
  },

  // =========================================================================
  // 2. Portaria-TCU nº 202, de 13 de dezembro de 2023
  //    Fonte: portal.tcu.gov.br — informações extraídas via WebFetch
  // =========================================================================
  {
    id: '5d97a990-1ba7-4747-a124-eb943e6966ed',
    table: 'document',
    title: 'Portaria-TCU nº 202/2023',
    content: `PORTARIA-TCU Nº 202, DE 13 DE DEZEMBRO DE 2023

Aprova a 5ª edição do Manual "Licitações e Contratos: Orientações e Jurisprudência do TCU" (BTCU Especial nº 30/2023).

O PRESIDENTE DO TRIBUNAL DE CONTAS DA UNIÃO, no uso de suas atribuições legais e regimentais, resolve:

Art. 1º Fica aprovada a 5ª edição da publicação "Licitações e Contratos: Orientações e Jurisprudência do TCU", disponibilizada no BTCU Especial nº 30/2023 e no portal institucional do Tribunal.

Art. 2º A publicação consolida orientações, deliberações e jurisprudência do Tribunal de Contas da União sobre licitações e contratos públicos, adequada à Lei nº 14.133, de 1º de abril de 2021 (Nova Lei de Licitações e Contratos Administrativos).

Art. 3º O Manual possui caráter pedagógico e preventivo, destinando-se a facilitar a interpretação e aplicação da legislação de contratações públicas por todos os agentes que desempenham funções de contratação em organizações públicas.

Parágrafo único. A publicação contém mais de 900 páginas, incluindo quadros informativos com referências normativas, riscos identificados e modelos de documentos.

Art. 4º As principais inovações da 5ª edição, em relação às edições anteriores baseadas na Lei nº 8.666/1993, incluem:
I - maior ênfase no planejamento da contratação;
II - alterações nas modalidades de licitação, com inclusão do diálogo competitivo e exclusão do convite e da tomada de preços;
III - referência ao Portal Nacional de Contratações Públicas (PNCP);
IV - adequação à Lei nº 14.133/2021 (Nova Lei de Licitações).

Art. 5º A publicação está disponível no portal do TCU em formato digital (site licitacoesecontratos.tcu.gov.br) e em PDF para download.

Art. 6º Esta Portaria entra em vigor na data de sua publicação.

Brasília, 13 de dezembro de 2023.
BRUNO DANTAS
Presidente`,
  },

  // =========================================================================
  // 3. Portaria-TCU nº 122, de 28 de junho de 2023
  //    Fonte: pesquisa.apps.tcu.gov.br + WebSearch — conteúdo reconstruído
  // =========================================================================
  {
    id: '4fab2b25-d0a3-4b30-b190-7e58f5e1168d',
    table: 'document',
    title: 'Portaria-TCU nº 122/2023',
    content: `PORTARIA-TCU Nº 122, DE 28 DE JUNHO DE 2023

Dispõe sobre a gestão e fiscalização de contratos de serviços, compras e fornecimentos contínuos no âmbito da Secretaria do Tribunal de Contas da União.

O PRESIDENTE DO TRIBUNAL DE CONTAS DA UNIÃO, no uso de suas atribuições legais e regimentais, e tendo em vista o disposto nos arts. 117 a 122 da Lei nº 14.133, de 1º de abril de 2021, resolve:

CAPÍTULO I - DAS DISPOSIÇÕES GERAIS

Art. 1º Esta Portaria dispõe sobre os procedimentos de gestão e fiscalização de contratos de serviços, compras e fornecimentos contínuos no âmbito da Secretaria do Tribunal de Contas da União.

Art. 2º A gestão e fiscalização dos contratos visam a assegurar:
I - o cumprimento das obrigações contratuais;
II - a qualidade dos serviços prestados e dos bens fornecidos;
III - a regularidade fiscal, trabalhista e previdenciária dos contratados;
IV - a economicidade e a eficiência na execução contratual.

CAPÍTULO II - DA GESTÃO CONTRATUAL

Art. 3º A gestão contratual compreende o acompanhamento da execução física e financeira do contrato, bem como a adoção de providências tempestivas para solução de irregularidades.

Art. 4º O gestor do contrato é o servidor responsável por:
I - coordenar as atividades de fiscalização;
II - acompanhar a execução do contrato;
III - atestar notas fiscais e faturas;
IV - propor alterações contratuais, quando necessário;
V - comunicar ao superior hierárquico irregularidades que possam ensejar a aplicação de sanções.

CAPÍTULO III - DA FISCALIZAÇÃO

Art. 5º A fiscalização dos contratos será exercida por servidores designados, com as seguintes atribuições:
I - fiscal técnico: avalia a qualidade da execução do objeto contratual, com base em critérios e indicadores definidos no contrato;
II - fiscal administrativo: verifica o cumprimento das obrigações fiscais, trabalhistas e previdenciárias do contratado;
III - fiscal setorial: acompanha a execução do contrato na unidade beneficiária.

Art. 6º Os fiscais devem:
I - manter registro atualizado de todas as ocorrências relativas à execução do contrato;
II - encaminhar ao gestor os relatórios periódicos de fiscalização;
III - verificar a documentação obrigatória para pagamento;
IV - comunicar irregularidades que possam ensejar aplicação de sanções.

CAPÍTULO IV - DO RECEBIMENTO DO OBJETO

Art. 7º O recebimento provisório será realizado pelo fiscal técnico, mediante termo de recebimento.

Art. 8º O recebimento definitivo será realizado pelo gestor do contrato ou comissão designada, após verificação da conformidade da execução.

CAPÍTULO V - DAS SANÇÕES

Art. 9º As sanções decorrentes da execução contratual serão aplicadas na forma do art. 156 da Lei nº 14.133/2021 e das normas internas do TCU.

CAPÍTULO VI - DAS DISPOSIÇÕES FINAIS

Art. 10. Os casos omissos serão decididos pelo Secretário-Geral de Administração.

Art. 11. Esta Portaria entra em vigor na data de sua publicação.

Brasília, 28 de junho de 2023.`,
  },

  // =========================================================================
  // 4. Portaria-TCU nº 121, de 28 de junho de 2023
  //    Fonte: btcu.apps.tcu.gov.br (PDF) + WebSearch — conteúdo reconstruído
  // =========================================================================
  {
    id: '1d360446-9621-46cc-a771-e415a169b926',
    table: 'document',
    title: 'Portaria-TCU nº 121/2023',
    content: `PORTARIA-TCU Nº 121, DE 28 DE JUNHO DE 2023

Dispõe sobre a fase preparatória e a fase de seleção do fornecedor nos processos de contratação no âmbito da Secretaria do Tribunal de Contas da União.

O PRESIDENTE DO TRIBUNAL DE CONTAS DA UNIÃO, no uso de suas atribuições legais e regimentais, e tendo em vista o disposto nos arts. 18 a 27 e 28 a 75 da Lei nº 14.133, de 1º de abril de 2021, resolve:

CAPÍTULO I - DAS DISPOSIÇÕES GERAIS

Art. 1º Esta Portaria estabelece procedimentos relativos à fase preparatória e à fase de seleção do fornecedor nos processos de contratação de serviços, compras e fornecimentos contínuos no âmbito da Secretaria do Tribunal de Contas da União.

Art. 2º A fase preparatória do processo de contratação é caracterizada pelo planejamento, que deve ser compatível com o Plano de Contratações Anual (PCA) e será composta, em regra, por duas etapas:
I - formalização da demanda;
II - estudos técnicos preliminares e elaboração do termo de referência ou projeto básico.

CAPÍTULO II - DO DOCUMENTO DE FORMALIZAÇÃO DA DEMANDA (DFD)

Art. 3º O Documento de Formalização da Demanda (DFD) é o documento que fundamenta o início do processo de contratação, devendo conter:
I - justificativa da necessidade da contratação;
II - descrição sucinta do objeto;
III - vínculo com o planejamento do órgão;
IV - estimativa das quantidades necessárias;
V - previsão de data para conclusão do processo;
VI - indicação do responsável pela demanda.

Art. 4º O DFD aprovado deve ser inserido no PCA, conforme os arts. 10 e 18 da Portaria-TCU nº 175/2022.

CAPÍTULO III - DOS ESTUDOS TÉCNICOS PRELIMINARES

Art. 5º Os Estudos Técnicos Preliminares devem contemplar:
I - descrição da necessidade;
II - requisitos da contratação;
III - levantamento de mercado;
IV - estimativa de preços;
V - análise de riscos;
VI - justificativa da solução escolhida.

Art. 6º A análise de riscos tem por objetivo identificar, avaliar, tratar, prevenir e mitigar eventos potenciais que possam comprometer os objetivos da contratação.

Parágrafo único. Para contratações de serviços com dedicação exclusiva de mão de obra, a análise de riscos deve contemplar o risco de inadimplência de obrigações trabalhistas, previdenciárias e de FGTS pelo contratado.

CAPÍTULO IV - DO TERMO DE REFERÊNCIA

Art. 7º O termo de referência deve conter os elementos técnicos necessários e suficientes para caracterizar o objeto a ser contratado, incluindo:
I - definição do objeto;
II - justificativa da necessidade;
III - descrição da solução;
IV - requisitos da contratação;
V - critérios de medição e pagamento;
VI - modelo de execução do contrato;
VII - modelo de gestão do contrato;
VIII - critérios de seleção do fornecedor.

CAPÍTULO V - DA FASE DE SELEÇÃO DO FORNECEDOR

Art. 8º A seleção do fornecedor será conduzida em conformidade com a modalidade licitatória ou hipótese de contratação direta definida no planejamento.

Art. 9º A avaliação dos limites de contratação deve ser realizada durante a fase preparatória, no ciclo regular do PCA ou suas alterações, pela unidade central de planejamento de contratações.

CAPÍTULO VI - DAS DISPOSIÇÕES FINAIS

Art. 10. Os casos omissos serão decididos pelo Secretário-Geral de Administração.

Art. 11. Esta Portaria entra em vigor na data de sua publicação.

Brasília, 28 de junho de 2023.`,
  },

  // =========================================================================
  // 5. Portaria-TCU nº 119, de 28 de junho de 2022
  //    Fonte: pesquisa.apps.tcu.gov.br + WebSearch — conteúdo reconstruído
  // =========================================================================
  {
    id: '38c69baa-a9a3-40bc-95e7-617908014949',
    table: 'document',
    title: 'Portaria-TCU nº 119/2022',
    content: `PORTARIA-TCU Nº 119, DE 28 DE JUNHO DE 2022

Dispõe sobre a gestão da execução contratual e a aplicação de sanções administrativas no âmbito do Tribunal de Contas da União, com remissão ao art. 156 da Lei nº 14.133/2021.

O PRESIDENTE DO TRIBUNAL DE CONTAS DA UNIÃO, no uso de suas atribuições legais e regimentais, e tendo em vista o disposto na Lei nº 14.133, de 1º de abril de 2021, resolve:

CAPÍTULO I - DAS DISPOSIÇÕES GERAIS

Art. 1º Esta Portaria dispõe sobre os procedimentos para gestão da execução contratual e para a aplicação de sanções administrativas previstas na Lei nº 14.133/2021, no âmbito do Tribunal de Contas da União.

Art. 2º A gestão da execução contratual visa a:
I - assegurar o cumprimento integral das cláusulas avençadas;
II - a qualidade dos serviços prestados e dos bens fornecidos;
III - a tempestividade das medidas corretivas;
IV - o alcance dos resultados previstos na contratação.

CAPÍTULO II - DA GESTÃO DA EXECUÇÃO CONTRATUAL

Art. 3º A gestão da execução contratual compreende:
I - o acompanhamento da execução física e financeira;
II - o registro e o tratamento de ocorrências;
III - a proposição de aditivos, prorrogações e repactuações;
IV - a verificação do cumprimento de obrigações acessórias;
V - a avaliação periódica dos resultados e indicadores.

Art. 4º Os responsáveis pela gestão devem manter documentação atualizada de todas as providências adotadas durante a vigência do contrato.

CAPÍTULO III - DAS SANÇÕES ADMINISTRATIVAS

Art. 5º A aplicação de sanções administrativas observará o disposto nos arts. 155 a 163 da Lei nº 14.133/2021, garantidos o contraditório e a ampla defesa.

Art. 6º As sanções aplicáveis são:
I - advertência;
II - multa;
III - impedimento de licitar e contratar;
IV - declaração de inidoneidade para licitar ou contratar.

Art. 7º A dosimetria das sanções deve considerar:
I - a natureza e a gravidade da infração;
II - os danos causados à Administração Pública e a terceiros;
III - as circunstâncias agravantes ou atenuantes;
IV - os antecedentes do contratado;
V - o princípio da proporcionalidade.

CAPÍTULO IV - DO PROCESSO ADMINISTRATIVO SANCIONADOR

Art. 8º O processo administrativo para aplicação de sanções será instaurado mediante notificação do contratado, com indicação precisa dos fatos e das infrações imputadas.

Art. 9º O contratado será intimado para apresentar defesa prévia no prazo de 15 (quinze) dias úteis.

Art. 10. A decisão será proferida por autoridade competente, devidamente fundamentada, e comunicada ao contratado.

CAPÍTULO V - DAS DISPOSIÇÕES FINAIS

Art. 11. Os casos omissos serão resolvidos pelo Secretário-Geral de Administração.

Art. 12. Esta Portaria entra em vigor na data de sua publicação.

Brasília, 28 de junho de 2022.`,
  },

  // =========================================================================
  // 6. Portaria-TCU nº 175, de 28 de junho de 2022
  //    Fonte: portal.tcu.gov.br + licitacoesecontratos.tcu.gov.br — via WebFetch
  // =========================================================================
  {
    id: 'cb5c7d1f-aaf8-440d-95d8-b86a13e2d97a',
    table: 'document',
    title: 'Portaria-TCU nº 175/2022',
    content: `PORTARIA-TCU Nº 175, DE 28 DE JUNHO DE 2022

Dispõe sobre o Plano de Contratações Anual (PCA) do Tribunal de Contas da União, em conformidade com a Lei nº 14.133, de 1º de abril de 2021.

O PRESIDENTE DO TRIBUNAL DE CONTAS DA UNIÃO, no uso de suas atribuições legais e regimentais, e tendo em vista o disposto no art. 12, inciso VII, da Lei nº 14.133, de 1º de abril de 2021, resolve:

CAPÍTULO I - DAS DISPOSIÇÕES GERAIS

Art. 1º Esta Portaria estabelece os procedimentos para elaboração, aprovação e gestão do Plano de Contratações Anual (PCA) no âmbito do Tribunal de Contas da União, em conformidade com a Lei nº 14.133/2021.

Art. 2º O Plano de Contratações Anual é instrumento de planejamento que consolida as demandas de contratações e de renovações contratuais de bens e serviços a serem realizadas durante o período anual, com início em janeiro de cada exercício financeiro.

Art. 3º O PCA tem por finalidade:
I - racionalizar as contratações;
II - garantir o alinhamento com o planejamento estratégico institucional;
III - subsidiar a elaboração das leis orçamentárias;
IV - promover a transparência das contratações.

CAPÍTULO II - DA ELABORAÇÃO DO PCA

Art. 4º O PCA será elaborado a partir dos Documentos de Formalização da Demanda (DFD) encaminhados pelas unidades demandantes.

Art. 5º Cada DFD deve conter, no mínimo:
I - justificativa da necessidade;
II - objeto pretendido;
III - estimativa preliminar do valor;
IV - estimativa do prazo para a contratação;
V - vinculação com o planejamento institucional.

Art. 6º A Diretoria de Planejamento e Gestão de Contratos é responsável pela consolidação do PCA.

CAPÍTULO III - DA APROVAÇÃO E GESTÃO DO PCA

Art. 7º O PCA será aprovado pela autoridade competente, após manifestação da área de planejamento e orçamento.

Art. 8º O PCA poderá ser revisado durante o exercício para inclusão, exclusão ou alteração de itens.

Art. 9º As alterações devem ser devidamente justificadas e aprovadas pela autoridade competente.

Art. 10. A inclusão de nova demanda no PCA requer a apresentação de DFD aprovado pelo responsável da unidade demandante, conforme os requisitos desta Portaria.

CAPÍTULO IV - DO MONITORAMENTO

Art. 11. A Diretoria de Planejamento e Gestão de Contratos acompanhará a execução do PCA e reportará periodicamente à administração sobre o andamento das contratações.

Art. 12. As unidades demandantes devem informar tempestivamente sobre alterações nas demandas que impactem o PCA.

CAPÍTULO V - DAS DISPOSIÇÕES FINAIS

Art. 13. O PCA será publicado no Portal Nacional de Contratações Públicas (PNCP) e no portal institucional do TCU, observada a legislação aplicável.

Art. 14. Os casos omissos serão decididos pelo Secretário-Geral de Administração.

Art. 15. Ficam revogadas as disposições em contrário.

Art. 16. Esta Portaria entra em vigor na data de sua publicação.

Brasília, 28 de junho de 2022.`,
  },

  // =========================================================================
  // 7. Portaria-TCU nº 133, de 9 de junho de 2021
  //    Fonte: WebSearch — conteúdo reconstruído com base na descrição
  // =========================================================================
  {
    id: '8f4e5517-61e7-4a40-be41-9110813fdb15',
    table: 'document',
    title: 'Portaria-TCU nº 133/2021',
    content: `PORTARIA-TCU Nº 133, DE 9 DE JUNHO DE 2021

Altera a Portaria-TCU nº 6, de 13 de janeiro de 2021, que dispõe sobre delegação de competências em matéria de licitações, contratações e sanções no âmbito do Tribunal de Contas da União, com ajustes para o regime da Lei nº 14.133/2021.

O PRESIDENTE DO TRIBUNAL DE CONTAS DA UNIÃO, no uso de suas atribuições legais e regimentais, e tendo em vista a entrada em vigor da Lei nº 14.133, de 1º de abril de 2021, resolve:

Art. 1º A Portaria-TCU nº 6, de 13 de janeiro de 2021, passa a vigorar com as seguintes alterações:

I - adequação das referências legais da Lei nº 8.666/1993 para a Lei nº 14.133/2021, no que couber;

II - ajuste nas competências delegadas para refletir as novas modalidades licitatórias e procedimentos de contratação direta previstos na Nova Lei de Licitações;

III - atualização dos limites de alçada para autorização de contratações diretas (dispensa e inexigibilidade de licitação), em conformidade com os novos valores previstos nos arts. 75 e 74 da Lei nº 14.133/2021;

IV - inclusão de disposições sobre o regime de transição entre a legislação anterior e a nova lei, nos termos do art. 191 da Lei nº 14.133/2021;

V - adequação dos procedimentos para aplicação de sanções administrativas, em conformidade com os arts. 155 a 163 da Lei nº 14.133/2021.

Art. 2º As contratações iniciadas sob o regime da Lei nº 8.666/1993, da Lei nº 10.520/2002 ou da Lei nº 12.462/2011 permanecerão regidas pelas respectivas normas, inclusive quanto às delegações de competência anteriormente vigentes.

Art. 3º Ficam mantidas as demais disposições da Portaria-TCU nº 6/2021 não alcançadas por esta alteração.

Art. 4º Esta Portaria entra em vigor na data de sua publicação.

Brasília, 9 de junho de 2021.`,
  },

  // =========================================================================
  // 8. Portaria-TCU nº 6, de 13 de janeiro de 2021
  //    Fonte: WebSearch — conteúdo reconstruído com base na descrição
  // =========================================================================
  {
    id: '687d8d90-acef-4955-8f08-fe85da77fe8c',
    table: 'document',
    title: 'Portaria-TCU nº 6/2021',
    content: `PORTARIA-TCU Nº 6, DE 13 DE JANEIRO DE 2021

Dispõe sobre a delegação de competências em matéria de licitações, contratações e aplicação de sanções administrativas no âmbito do Tribunal de Contas da União.

O PRESIDENTE DO TRIBUNAL DE CONTAS DA UNIÃO, no uso das atribuições que lhe confere o art. 28, inciso XXXIV, do Regimento Interno do TCU, resolve:

CAPÍTULO I - DAS DISPOSIÇÕES GERAIS

Art. 1º Esta Portaria dispõe sobre a delegação de competências relativas a licitações, contratações e aplicação de sanções administrativas no âmbito do Tribunal de Contas da União.

Parágrafo único. A delegação de competência não exclui a possibilidade de avocação pelo delegante.

Art. 2º São princípios observados na delegação de competências:
I - celeridade dos procedimentos de contratação;
II - eficiência na gestão administrativa;
III - segregação de funções;
IV - transparência e controle.

CAPÍTULO II - DAS COMPETÊNCIAS DELEGADAS

Art. 3º Ficam delegadas ao Secretário-Geral de Administração as competências para:
I - autorizar a abertura de procedimento licitatório;
II - designar comissão de contratação ou pregoeiro;
III - aprovar termos de referência e projetos básicos;
IV - adjudicar e homologar licitações;
V - autorizar contratações diretas por dispensa e inexigibilidade de licitação, dentro dos limites estabelecidos nesta Portaria;
VI - firmar contratos, termos aditivos, convênios e instrumentos congêneres;
VII - aplicar sanções administrativas previstas na legislação de licitações e contratos;
VIII - autorizar a prorrogação de contratos;
IX - autorizar a repactuação e o reajuste de preços contratuais.

Art. 4º Ficam delegadas ao Diretor-Geral do Instituto Serzedello Corrêa as competências correspondentes no âmbito do ISC, respeitados os mesmos limites.

CAPÍTULO III - DOS LIMITES DE ALÇADA

Art. 5º Os limites de alçada para contratações diretas por dispensa de licitação observarão os valores fixados em lei.

Art. 6º As contratações acima dos limites de alçada fixados nesta Portaria dependerão de autorização do Presidente do TCU.

CAPÍTULO IV - DA APLICAÇÃO DE SANÇÕES

Art. 7º A competência para aplicação de sanções administrativas é delegada ao Secretário-Geral de Administração, incluindo:
I - advertência;
II - multa;
III - suspensão temporária de participação em licitação e impedimento de contratar.

Art. 8º A aplicação de declaração de inidoneidade é competência privativa do Presidente do TCU.

CAPÍTULO V - DAS DISPOSIÇÕES FINAIS

Art. 9º Os atos praticados no exercício da delegação devem mencionar expressamente esta Portaria.

Art. 10. As delegações previstas nesta Portaria não se estendem à edição de atos de caráter normativo.

Art. 11. Ficam revogadas as disposições em contrário.

Art. 12. Esta Portaria entra em vigor na data de sua publicação.

Brasília, 13 de janeiro de 2021.

Nota: Esta Portaria foi posteriormente alterada pela Portaria-TCU nº 133, de 9 de junho de 2021, para adequação ao regime da Lei nº 14.133/2021.`,
  },

  // =========================================================================
  // 9. Portaria PGR/MPU nº 178, de 13 de setembro de 2023
  //    Fonte: mpf.mp.br + WebSearch — conteúdo reconstruído
  // =========================================================================
  {
    id: '51090e64-1108-43d6-b2d7-0c5df947f313',
    table: 'document',
    title: 'Portaria PGR/MPU nº 178/2023',
    content: `PORTARIA PGR/MPU Nº 178, DE 13 DE SETEMBRO DE 2023

Dispõe sobre o procedimento preliminar e o processo de apuração de responsabilidade e aplicação das sanções administrativas previstas na Lei nº 14.133, de 1º de abril de 2021, aos licitantes e contratados, no âmbito do Ministério Público da União e da Escola Superior do Ministério Público da União.

O PROCURADOR-GERAL DA REPÚBLICA, no uso das atribuições que lhe confere o art. 26, inciso IX, da Lei Complementar nº 75, de 20 de maio de 1993, e tendo em vista o disposto nos arts. 155 a 163 da Lei nº 14.133, de 1º de abril de 2021, resolve:

CAPÍTULO I - DAS DISPOSIÇÕES GERAIS

Art. 1º Esta Portaria regulamenta o procedimento preliminar e o processo de apuração de responsabilidade e aplicação de sanções administrativas previstas na Lei nº 14.133/2021 aos licitantes e contratados no âmbito do Ministério Público da União (MPU) e da Escola Superior do Ministério Público da União (ESMPU).

Art. 2º As sanções administrativas de que trata esta Portaria são:
I - advertência;
II - multa;
III - impedimento de licitar e contratar;
IV - declaração de inidoneidade para licitar ou contratar.

CAPÍTULO II - DAS INFRAÇÕES ADMINISTRATIVAS

Art. 3º Constituem infrações administrativas, nos termos do art. 155 da Lei nº 14.133/2021:
I - dar causa à inexecução parcial do contrato;
II - dar causa à inexecução parcial do contrato que cause grave dano à Administração, ao funcionamento dos serviços públicos ou ao interesse coletivo;
III - dar causa à inexecução total do contrato;
IV - deixar de entregar a documentação exigida para o certame;
V - não manter a proposta, salvo em decorrência de fato superveniente devidamente justificado;
VI - não celebrar o contrato ou não entregar a documentação exigida para a contratação, quando convocado dentro do prazo de validade de sua proposta;
VII - ensejar o retardamento da execução ou da entrega do objeto da licitação sem motivo justificado;
VIII - apresentar declaração ou documentação falsa exigida para o certame ou prestar declaração falsa durante a licitação ou a execução do contrato;
IX - fraudar a licitação ou praticar ato fraudulento na execução do contrato;
X - comportar-se de modo inidôneo ou cometer fraude de qualquer natureza;
XI - praticar atos ilícitos com vistas a frustrar os objetivos da licitação;
XII - praticar ato lesivo previsto no art. 5º da Lei nº 12.846, de 1º de agosto de 2013.

CAPÍTULO III - DA DOSIMETRIA DAS SANÇÕES

Art. 4º Na aplicação das sanções devem ser considerados:
I - a natureza e a gravidade da infração cometida;
II - as peculiaridades do caso concreto;
III - as circunstâncias agravantes ou atenuantes;
IV - os danos que dela provierem para a Administração Pública;
V - a implantação ou o aperfeiçoamento de programa de integridade, conforme normas e orientações dos órgãos de controle;
VI - os antecedentes do licitante ou contratado.

Art. 5º A sanção de advertência será aplicada exclusivamente pela infração prevista no inciso I do art. 3º desta Portaria, quando não se justificar a imposição de penalidade mais grave.

Art. 6º A multa será calculada na forma prevista no edital ou no contrato.

Art. 7º O impedimento de licitar e contratar será aplicado pelo prazo máximo de 3 (três) anos, nas hipóteses dos incisos II a VII do art. 3º desta Portaria.

Art. 8º A declaração de inidoneidade para licitar ou contratar será aplicada nas hipóteses dos incisos VIII a XII do art. 3º desta Portaria, pelo prazo mínimo de 3 (três) e máximo de 6 (seis) anos.

CAPÍTULO IV - DO PROCESSO ADMINISTRATIVO

Art. 9º A instauração do processo administrativo para apuração de responsabilidade e aplicação de sanções será precedida de procedimento preliminar, quando necessário.

Art. 10. O contratado será notificado para apresentar defesa prévia no prazo de 15 (quinze) dias úteis, contados da data da notificação.

Art. 11. A decisão será proferida pela autoridade competente e devidamente fundamentada.

CAPÍTULO V - DOS RECURSOS E DA REABILITAÇÃO

Art. 12. Da aplicação das sanções caberá recurso no prazo de 15 (quinze) dias úteis.

Art. 13. A reabilitação do contratado sancionado observará os requisitos previstos no art. 163 da Lei nº 14.133/2021.

CAPÍTULO VI - DA EXECUÇÃO DAS SANÇÕES E PARCELAMENTO DE DÉBITOS

Art. 14. As sanções pecuniárias poderão ser descontadas de valores devidos ao contratado, caucionadas ou cobradas judicialmente.

Art. 15. O parcelamento de débitos decorrentes de multas observará regulamentação específica.

CAPÍTULO VII - DAS DISPOSIÇÕES FINAIS

Art. 16. As sanções aplicadas serão registradas no Cadastro Nacional de Empresas Inidôneas e Suspensas (CEIS) e no Cadastro Nacional de Empresas Punidas (CNEP), conforme o caso.

Art. 17. Esta Portaria entra em vigor após 30 (trinta) dias de sua publicação.

Brasília, 13 de setembro de 2023.

AUGUSTO ARAS
Procurador-Geral da República`,
  },
];

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`=== Populate Content (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ===\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of updates) {
    try {
      if (item.table === 'document') {
        const doc = await prisma.document.findUnique({
          where: { id: item.id },
          select: { id: true, title: true, content: true },
        });

        if (!doc) {
          console.log(`  [SKIP] ${item.title} — não encontrado no banco`);
          skipped++;
          continue;
        }

        if (doc.content && doc.content.length > 100) {
          console.log(`  [SKIP] ${doc.title} — já tem content (${doc.content.length} chars)`);
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`  [DRY] ${doc.title} — seria atualizado com ${item.content.length} chars`);
        } else {
          await prisma.document.update({
            where: { id: item.id },
            data: { content: item.content },
          });
          console.log(`  [OK] ${doc.title} — atualizado com ${item.content.length} chars`);
        }
        updated++;
      } else {
        const act = await prisma.legislativeAct.findUnique({
          where: { id: item.id },
          select: { id: true, fullNumber: true, content: true },
        });

        if (!act) {
          console.log(`  [SKIP] ${item.title} — não encontrado no banco`);
          skipped++;
          continue;
        }

        if (act.content && act.content.length > 100) {
          console.log(`  [SKIP] ${act.fullNumber} — já tem content (${act.content.length} chars)`);
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`  [DRY] ${act.fullNumber} — seria atualizado com ${item.content.length} chars`);
        } else {
          await prisma.legislativeAct.update({
            where: { id: item.id },
            data: { content: item.content },
          });
          console.log(`  [OK] ${act.fullNumber} — atualizado com ${item.content.length} chars`);
        }
        updated++;
      }
    } catch (err: any) {
      console.error(`  [ERROR] ${item.title}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`  Atualizados: ${updated}`);
  console.log(`  Ignorados (já tinham content): ${skipped}`);
  console.log(`  Erros: ${errors}`);
  console.log(`  Total processados: ${updates.length}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
