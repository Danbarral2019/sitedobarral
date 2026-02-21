/**
 * Script para popular o campo `content` de LegislativeActs que foram importados
 * sem conteúdo (URLs gov.br/compras, planalto.gov.br, in.gov.br).
 *
 * Textos obtidos via WebFetch em 2026-02-21.
 *
 * Uso: npx tsx scripts/populate-content-govbr-acts.ts
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

interface ActContent {
  id: string;
  fullNumber: string;
  content: string;
}

const actsContent: ActContent[] = [
  // 1. Portaria SEGES/MGI 4.932/2023
  {
    id: '1c16baeb-6bda-4702-a6fa-9f40b144e861',
    fullNumber: 'Portaria SEGES/MGI 4.932/2023',
    content: `PORTARIA SEGES/MGI Nº 4.932, DE 30 DE AGOSTO DE 2023

O SECRETÁRIO DE GESTÃO E INOVAÇÃO DO MINISTÉRIO DA GESTÃO E DA INOVAÇÃO EM SERVIÇOS PÚBLICOS, utilizando-se das atribuições conferidas pelo Decreto nº 11.437, de 17 de março de 2023, e pelo Decreto nº 1.094, de 23 de março de 1994, resolve:

Art. 1º O preâmbulo da Portaria SEGES/MGI nº 1769, de 25 de abril de 2023, passa a vigorar com a seguinte redação:

"O Secretário de Gestão e Inovação do Ministério da Gestão e da Inovação em Serviços Públicos, no uso das atribuições que lhe conferem o Decreto nº 11.437, de 17 de março de 2023, e o Decreto nº 1.094, de 23 de março de 1994, e tendo em vista o disposto no art. 193, inciso II, da Lei nº 14.133, de 1º de abril de 2021, resolve:"

Art. 2º A presente Portaria entra em vigor na data de sua publicação.

ROBERTO POJO`,
  },

  // 2. Portaria SEGES/MGI 1.769/2023
  {
    id: '5150eee6-0e15-42de-8e72-d401c04b782c',
    fullNumber: 'Portaria SEGES/MGI 1.769/2023',
    content: `PORTARIA SEGES/MGI Nº 1.769, DE 25 DE ABRIL DE 2023

Dispõe sobre o regime de transição de que trata o art. 191 da Lei nº 14.133, de 1º de abril de 2021, no âmbito da Administração Pública federal direta, autárquica e fundacional.

O SECRETÁRIO DE GESTÃO E INOVAÇÃO DO MINISTÉRIO DA GESTÃO E DA INOVAÇÃO EM SERVIÇOS PÚBLICOS, no uso das atribuições que lhe conferem o Decreto nº 11.437, de 17 de março de 2023, e o Decreto nº 1.094, de 23 de março de 1994, e tendo em vista o disposto no art. 193, inciso II, da Lei nº 14.133, de 1º de abril de 2021, resolve:

Art. 1º Esta Portaria dispõe sobre o regime de transição referente ao art. 191 da Lei nº 14.133, de 1º de abril de 2021, aplicável à Administração Pública federal direta, autárquica e fundacional.

Art. 2º Processos licitatórios e contratações autuados e instruídos com opção expressa pela Lei nº 8.666, de 21 de junho de 1993, Lei nº 10.520, de 17 de julho de 2002, ou Lei nº 12.462, de 4 de agosto de 2011, além do Decreto nº 7.892, de 23 de janeiro de 2013, serão por eles regidos, desde que:

I - a publicação do edital ou ato autorizativo da contratação direta ocorra até 29 de dezembro de 2023, conforme cronograma constante do Anexo;

II - a opção escolhida seja expressamente indicada no edital ou ato autorizativo da contratação direta.

Parágrafo único. Contratos, instrumentos equivalentes e atas de registro de preços firmados em decorrência desta disposição serão regidos, durante toda a vigência, pela norma que fundamentou a contratação, inclusive quanto às alterações e prorrogações contratuais.

Art. 3º O disposto no art. 2º aplica-se às publicações de avisos, atos de autorização ou ratificação de contratação direta, por dispensa ou inexigibilidade de licitação.

Art. 4º Atas de registro de preços regidas pelo Decreto nº 7.892, de 23 de janeiro de 2013, durante suas vigências, podem ser utilizadas por qualquer órgão ou entidade da Administração Pública federal, municipal, distrital ou estadual que não tenha participado do certame licitatório, mediante anuência do órgão gerenciador, observados os limites previstos no referido Decreto.

Art. 5º Contratos celebrados com vigência por prazo indeterminado, como serviços públicos essenciais de água e esgoto, conforme dispõe a Orientação Normativa AGU nº 36, de 13 de dezembro de 2011, deverão ser extintos até 31 de dezembro de 2024, e providenciadas novas contratações de acordo com a Lei nº 14.133, de 1º de abril de 2021.

Parágrafo único. Contratos de fornecimento de energia elétrica celebrados com vigência por prazo indeterminado deverão ser extintos até 31 de dezembro de 2026.

Art. 6º Credenciamentos realizados nos termos do caput do art. 25 da Lei nº 8.666, de 1993, deverão ser extintos até 31 de dezembro de 2024.

Parágrafo único. A vigência dos contratos decorrentes dos procedimentos de credenciamento observará o disposto no art. 57 da Lei nº 8.666, de 1993.

Art. 7º Órgãos e entidades não integrantes da Administração Pública federal direta, autárquica e fundacional que utilizam o Sistema de Compras do Governo Federal devem observar o disposto no Anexo.

Art. 8º Casos omissos decorrentes da aplicação desta Portaria serão dirimidos pela Secretaria de Gestão e Inovação do Ministério da Gestão e da Inovação em Serviços Públicos, que poderá expedir normas complementares e disponibilizar informações adicionais em meio eletrônico.

Art. 9º Fica revogada a Portaria SEGES/MGI nº 720, de 15 de março de 2023.

Art. 10. Esta Portaria entra em vigor na data de sua publicação.

ROBERTO POJO

ANEXO - CRONOGRAMA PARA PUBLICAÇÃO DO EDITAL

(1) Licitação - Todas as modalidades de licitação previstas nas Leis nº 8.666/93, 10.520/02 e 12.462/11, inclusive licitações para registro de preços - Edital - Prazo para inserção no sistema: Até 28 de dezembro de 2023, às 16h - Prazo para publicação no DOU: Até 29 de dezembro de 2023.

(2) Contratação direta por valor - Abrange todas as dispensas e inexigibilidades de licitação cujos valores não ultrapassem os previstos nos incisos I e II do art. 24 da Lei nº 8.666/93 - Aviso ou ato de autorização/ratificação - Prazo para inserção no sistema: Até 29 de dezembro de 2023 - Prazo para publicação no DOU: Não se aplica.

(3) Outras dispensas - Todas as dispensas de licitação não abrangidas no item (2) - Ato de autorização/ratificação - Prazo para inserção no sistema: Até 28 de dezembro de 2023, às 16h - Prazo para publicação no DOU: Até 29 de dezembro de 2023.

(4) Inexigibilidade - Todas as inexigibilidades não abrangidas no item (2) - Ato de autorização/ratificação - Prazo para inserção no sistema: Até 28 de dezembro de 2023, às 16h - Prazo para publicação no DOU: Até 29 de dezembro de 2023.`,
  },

  // 3. Resolução CICS/MGI 7/2024
  {
    id: '19490c99-39f5-44e1-bb5c-760d3cce2d46',
    fullNumber: 'Resolução CICS/MGI 7/2024',
    content: `RESOLUÇÃO CICS/MGI Nº 7, DE 23 DE DEZEMBRO DE 2024

Altera a Resolução SEGES/CICS-MGI nº 4, de 18 de outubro de 2024, que especifica os produtos manufaturados nacionais que serão objeto de margens de preferência normal e adicional nas licitações realizadas no âmbito da administração pública federal direta, autárquica e fundacional.

A COMISSÃO INTERMINISTERIAL DE CONTRATAÇÕES PÚBLICAS PARA O DESENVOLVIMENTO SUSTENTÁVEL - CICS, no uso das atribuições que lhe conferem o art. 2º e o art. 8º do Decreto nº 11.890, de 22 de janeiro de 2024, resolve:

Art. 1º A Resolução SEGES/CICS-MGI nº 4, de 18 de outubro de 2024, passa a vigorar com a seguinte redação:

"Art. 2º .......................................................

V - código CFI-A: código válido do Credenciamento no Finame do Banco Nacional de Desenvolvimento Econômico e Social - BNDES do tipo A;

VI - PPB: Processo Produtivo Básico, conforme certificado em portaria interministerial MDIC/MCTI;

VII - Portaria DesIn: produto resultante de desenvolvimento e inovação no país, habilitado nos termos da Portaria MCT nº 950, de 12 de dezembro de 2006; da Portaria MCTI nº 1.309, de 19 de dezembro de 2013; da Portaria MCTI nº 4.514, de 2 de março de 2021; da Portaria MCTIC nº 356, de 19 de janeiro de 2018; ou da Portaria MCTIC nº 3.303, de 25 de junho de 2018;

VIII - fabricação: todas as operações envolvidas no preparo de determinado medicamento, incluindo a aquisição de materiais, produção, controle de qualidade, liberação, armazenamento, expedição de produtos acabados e os controles relacionados;

IX - IFA: insumo farmacêutico ativo, definido como qualquer substância incluída na formulação de uma forma farmacêutica que, ao ser administrada a um paciente, desempenha o papel de ingrediente ativo, exercendo atividade farmacológica ou outro efeito direto no diagnóstico, cura, tratamento ou prevenção de doenças, além de poder influenciar a estrutura e o funcionamento do organismo humano;

X - material de partida: substância química normalmente incorporada como importante fragmento estrutural, com sua estrutura química, propriedades e características físicas e químicas e perfil de impurezas obrigatoriamente bem definidos;

XI - MedNac: medicamento registrado na Agência Nacional de Vigilância Sanitária - Anvisa, fabricado em unidade produtiva situada em território nacional; e

XII - MedIFANac: medicamento registrado na Anvisa, fabricado em unidade produtiva situada em território nacional, utilizando exclusivamente IFA cujas etapas produtivas foram integralmente realizadas em território nacional a partir do material de partida." (NR)

"Art. 3º Fica estabelecida, nas licitações realizadas no âmbito da administração pública federal direta, autárquica e fundacional, a aplicação de margem de preferência normal para a aquisição dos produtos manufaturados nacionais enquadrados nos códigos NCM, listados no Anexo I desta Resolução, com os percentuais nele indicados e que atendam à respectiva regra de origem." (NR)

"Art. 4º Fica estabelecida, nas licitações realizadas no âmbito da administração pública federal direta, autárquica e fundacional, a aplicação de margem de preferência adicional para a aquisição dos produtos manufaturados nacionais resultantes de desenvolvimento e inovação tecnológica realizados no País, enquadrados nos códigos NCM listados no Anexo I desta Resolução, com os percentuais nele indicados e que atendam à respectiva regra de qualificação." (NR)

"Art. 7º O licitante fica responsável por apresentar, no momento da habilitação, um dos seguintes documentos, conforme o caso, que comprove o atendimento das regras de origem e das regras de qualificação:

I - impressão da tela da página da consulta CFI / Credenciamento FINAME do Banco Nacional de Desenvolvimento Econômico e Social - BNDES, disponível em https://ws.bndes.gov.br/cfi_catalogo/, em que conste a marca ou o fabricante e o modelo ou a versão do item ofertado, bem como o código CFI do produto;

II - impressão da tela da página da consulta CFI / Credenciamento FINAME do BNDES, disponível em https://ws.bndes.gov.br/cfi_catalogo/, em que conste a marca ou o fabricante e o modelo ou a versão do item ofertado, e a expressão 'TIPO A', bem como o código CFI do produto;

III - impressão da tela da página da consulta de empresas habilitadas, produtos e modelos aprovados do Ministério da Ciência, Tecnologia e Inovação, disponível em https://inovacaodigital.mcti.gov.br/leiDeInformatica/empresasHabilitadas, em que conste o produto e o modelo do item ofertado;

IV - impressão da tela da página da consulta de empresas com reconhecimento de produtos desenvolvidos no país do MCTI, disponível em https://inovacaodigital.mcti.gov.br/leiDeInformatica/empresasProdutosModelosTecnac, em que conste o produto e o modelo do item ofertado;

V - formulário, preenchido e assinado, de Autodeclaração de Medicamento Nacional, constante do Anexo II.a;

VI - formulário, preenchido e assinado, de Autodeclaração do Insumo Farmacêutico Ativo Nacional, constante do Anexo II.b." (NR)

Art. 2º O Anexo da Resolução SEGES/CICS-MGI nº 4, de 18 de outubro de 2024, passa a vigorar conforme o Anexo I desta Resolução.

Art. 3º Ficam incluídos na Resolução SEGES/CICS-MGI nº 4, de 18 de outubro de 2024, os Anexos II.a e II.b, conforme o Anexo II desta Resolução.

Art. 4º Esta Resolução entra em vigor na data de sua publicação.

ROBERTO POJO
Presidente da Comissão`,
  },

  // 4. Resolução SEGES-CICS/MGI 6/2024
  {
    id: '50fb3214-2988-4cb6-94eb-ae8bb9af49bc',
    fullNumber: 'Resolução SEGES-CICS/MGI 6/2024',
    content: `RESOLUÇÃO SEGES-CICS/MGI Nº 6, DE 25 DE NOVEMBRO DE 2024

Suspende a aplicação de margens de preferência em licitações que tenham por critério de julgamento o menor preço por grupo de itens.

A COMISSÃO INTERMINISTERIAL DE CONTRATAÇÕES PÚBLICAS PARA O DESENVOLVIMENTO SUSTENTÁVEL - CICS, no uso das atribuições que lhe conferem os arts. 3º, 5º e 8º do Decreto nº 11.890, de 22 de janeiro de 2024, resolve:

Art. 1º Fica suspensa a aplicação das margens de preferência referentes aos arts. 3º e 4º da Resolução SEGES/CICS-MGI nº 4, de 18 de outubro de 2024, publicada no DOU de 22 de outubro de 2024, exclusivamente nas licitações que atendam simultaneamente aos seguintes requisitos:

I - apresentem como critério de julgamento o menor preço por grupo de itens; e

II - o grupo seja composto por ao menos um produto manufaturado nacional enquadrado nos códigos NCM listados no Anexo da referida Resolução, conjuntamente com pelo menos um item diversamente caracterizado.

Art. 2º Esta Resolução entra em vigor na data de sua publicação.

ROBERTO SEARA MACHADO POJO
Presidente da Comissão Interministerial de Contratações Públicas para o Desenvolvimento Sustentável - CICS`,
  },

  // 5. Resolução SEGES-CICS/MGI 5/2024
  {
    id: 'd3810ae7-7f1b-424a-9410-bfca009fa451',
    fullNumber: 'Resolução SEGES-CICS/MGI 5/2024',
    content: `RESOLUÇÃO SEGES-CICS/MGI Nº 5, DE 18 DE OUTUBRO DE 2024

Altera a Resolução SEGES/CICS-MGI nº 2, de 2 de julho de 2024, que aprovou o Regimento Interno da Comissão Interministerial de Contratações Públicas para o Desenvolvimento Sustentável - CICS.

A COMISSÃO INTERMINISTERIAL DE CONTRATAÇÕES PÚBLICAS PARA O DESENVOLVIMENTO SUSTENTÁVEL - CICS, no uso das atribuições que lhe confere o inciso XII do art. 8º do Decreto nº 11.890, de 22 de janeiro de 2024, resolve:

Art. 1º O Anexo I da Resolução SEGES/CICS-MGI nº 2, de 2 de julho de 2024, publicada no Diário Oficial da União em 03 de julho de 2024, passa a vigorar conforme o Anexo I desta Resolução.

Art. 2º Esta Resolução entra em vigor na data de sua publicação.

ROBERTO POJO
Presidente da Comissão

ANEXO I - REGIMENTO INTERNO DA CICS (alterações)

Art. 5º (alteração)

Inciso II: Compete ao Presidente constituir grupos de apoio técnico, comitês e subcomitês e designar seus membros para tratar de assuntos específicos.

Art. 7º (alteração)

Parágrafo único. Compete ao Ministério do Desenvolvimento, Indústria, Comércio e Serviços, mediante provocação da Secretaria-Executiva da CICS, manifestar-se por meio de correio eletrônico sobre a proposição das regras usadas para a aplicação das margens de preferência normais e adicionais.

Art. 20 (inclusão)

Art. 20. As deliberações dos colegiados, por decisão de seus presidentes, poderão ser estabelecidas por meio de circuito deliberativo virtual, a partir da manifestação eletrônica dos seus membros.`,
  },

  // 6. Resolução SEGES-CICS/MGI 4/2024
  {
    id: 'c3c02d1c-70e0-431f-a610-8d1f0ce2607d',
    fullNumber: 'Resolução SEGES-CICS/MGI 4/2024',
    content: `RESOLUÇÃO SEGES-CICS/MGI Nº 4, DE 18 DE OUTUBRO DE 2024

Especifica os produtos manufaturados nacionais que serão objeto de margens de preferência normal e adicional nas licitações realizadas no âmbito da administração pública federal direta, autárquica e fundacional.

A COMISSÃO INTERMINISTERIAL DE CONTRATAÇÕES PÚBLICAS PARA O DESENVOLVIMENTO SUSTENTÁVEL - CICS, no uso das atribuições que lhe conferem o art. 2º e o art. 8º do Decreto nº 11.890, de 22 de janeiro de 2024, resolve:

Art. 1º Esta Resolução especifica os produtos manufaturados nacionais que serão objeto de margens de preferência normal e adicional nas licitações realizadas no âmbito da administração pública federal direta, autárquica e fundacional.

Art. 2º Para os fins desta Resolução, considera-se:

I - regra de origem: regra de fabricação ou processamento que caracteriza o produto como nacional;

II - regra de qualificação: características do produto manufaturado resultante de desenvolvimento e inovação tecnológica realizados no País;

III - código NCM: código da Nomenclatura Comum do Mercosul;

IV - código CFI: código válido do Credenciamento no Finame do Banco Nacional de Desenvolvimento Econômico e Social - BNDES;

V - código CFI-A: código válido do Credenciamento no Finame do BNDES do tipo A;

VI - PPB: Processo Produtivo Básico, conforme certificado em portaria interministerial MDIC/MCTI;

VII - Portaria DesIn: produto resultante de desenvolvimento e inovação no país, habilitado nos termos da Portaria MCT nº 950, de 12 de dezembro de 2006; da Portaria MCTI nº 1.309, de 19 de dezembro de 2013; da Portaria MCTI nº 4.514, de 2 de março de 2021; da Portaria MCTIC nº 356, de 19 de janeiro de 2018; ou da Portaria MCTIC nº 3.303, de 25 de junho de 2018;

VIII - fabricação: todas as operações envolvidas no preparo de determinado medicamento, incluindo a aquisição de materiais, produção, controle de qualidade, liberação, armazenamento, expedição de produtos acabados e os controles relacionados;

IX - IFA: insumo farmacêutico ativo, definido como qualquer substância incluída na formulação de uma forma farmacêutica que, ao ser administrada a um paciente, desempenha o papel de ingrediente ativo, exercendo atividade farmacológica ou outro efeito direto no diagnóstico, cura, tratamento ou prevenção de doenças, além de poder influenciar a estrutura e o funcionamento do organismo humano;

X - material de partida: substância química normalmente incorporada como importante fragmento estrutural, com sua estrutura química, propriedades e características físicas e químicas e perfil de impurezas obrigatoriamente bem definidos;

XI - MedNac: medicamento registrado na Agência Nacional de Vigilância Sanitária - Anvisa, fabricado em unidade produtiva situada em território nacional; e

XII - MedIFANac: medicamento registrado na Anvisa, fabricado em unidade produtiva situada em território nacional, utilizando exclusivamente IFA cujas etapas produtivas foram integralmente realizadas em território nacional a partir do material de partida.

Art. 3º Fica estabelecida, nas licitações realizadas no âmbito da administração pública federal direta, autárquica e fundacional, a aplicação de margem de preferência normal para a aquisição dos produtos manufaturados nacionais enquadrados nos códigos NCM, listados no Anexo I desta Resolução, com os percentuais nele indicados e que atendam à respectiva regra de origem.

Art. 4º Fica estabelecida, nas licitações realizadas no âmbito da administração pública federal direta, autárquica e fundacional, a aplicação de margem de preferência adicional para a aquisição dos produtos manufaturados nacionais resultantes de desenvolvimento e inovação tecnológica realizados no País, enquadrados nos códigos NCM listados no Anexo I desta Resolução, com os percentuais nele indicados e que atendam à respectiva regra de qualificação.

Art. 5º Os editais para aquisição dos produtos descritos no Anexo I deverão prever a aplicação das margens de preferência referidas nos arts. 3º e 4º desta Resolução.

Art. 6º Os convênios, contratos de repasse, editais de licitação e contratos com consórcios públicos e administrações estadual, distrital e municipal deverão aplicar as margens de preferência referidas nos arts. 3º e 4º desta Resolução.

Art. 7º O licitante fica responsável por apresentar, no momento da habilitação, um dos seguintes documentos, conforme o caso, que comprove o atendimento das regras de origem e das regras de qualificação:

I - impressão da tela da página da consulta CFI / Credenciamento FINAME do Banco Nacional de Desenvolvimento Econômico e Social - BNDES, disponível em https://ws.bndes.gov.br/cfi_catalogo/, em que conste a marca ou o fabricante e o modelo ou a versão do item ofertado, bem como o código CFI do produto;

II - impressão da tela da página da consulta CFI / Credenciamento FINAME do BNDES, disponível em https://ws.bndes.gov.br/cfi_catalogo/, em que conste a marca ou o fabricante e o modelo ou a versão do item ofertado, e a expressão "TIPO A", bem como o código CFI do produto;

III - impressão da tela da página da consulta de empresas habilitadas, produtos e modelos aprovados do Ministério da Ciência, Tecnologia e Inovação, disponível em https://inovacaodigital.mcti.gov.br/leiDeInformatica/empresasHabilitadas, em que conste o produto e o modelo do item ofertado;

IV - impressão da tela da página da consulta de empresas com reconhecimento de produtos desenvolvidos no país do MCTI, disponível em https://inovacaodigital.mcti.gov.br/leiDeInformatica/empresasProdutosModelosTecnac, em que conste o produto e o modelo do item ofertado;

V - formulário, preenchido e assinado, de Autodeclaração de Medicamento Nacional, constante do Anexo II.a;

VI - formulário, preenchido e assinado, de Autodeclaração do Insumo Farmacêutico Ativo Nacional, constante do Anexo II.b.

Art. 8º Ficam revogadas as Resoluções SEGES-CICS/MGI nº 1, de 2 de julho de 2024, e nº 3, de 9 de outubro de 2024.

Art. 9º Esta Resolução entra em vigor após 20 (vinte) dias de sua publicação.

ROBERTO POJO
Presidente da Comissão`,
  },

  // 7. Resolução SEGES-CICS/MGI 2/2024
  {
    id: 'c40492b2-3ff7-4b23-9dff-ab7e33c44e06',
    fullNumber: 'Resolução SEGES-CICS/MGI 2/2024',
    content: `RESOLUÇÃO SEGES-CICS/MGI Nº 2, DE 2 DE JULHO DE 2024

Aprova o Regimento Interno da Comissão Interministerial de Contratações Públicas para Sustentabilidade - CICS.

A COMISSÃO INTERMINISTERIAL DE CONTRATAÇÕES PÚBLICAS PARA O DESENVOLVIMENTO SUSTENTÁVEL - CICS, instituída pelo Decreto nº 11.890, de 22 de janeiro de 2024, mediante deliberação colegiada de 23 de maio de 2024, resolve:

Art. 1º Fica aprovado o Regimento Interno da Comissão Interministerial de Contratações Públicas para o Desenvolvimento Sustentável - CICS, na forma do Anexo I.

Art. 2º Esta Resolução entra em vigor na data de sua publicação.

ROBERTO POJO
Presidente da Comissão

ANEXO I - REGIMENTO INTERNO DA COMISSÃO INTERMINISTERIAL DE CONTRATAÇÕES PÚBLICAS PARA O DESENVOLVIMENTO SUSTENTÁVEL - CICS

CAPÍTULO I - FINALIDADES E COMPETÊNCIAS

Seção I - Da Finalidade

Art. 1º A CICS possui caráter permanente com atribuições relativas ao emprego da demanda estatal para promoção do desenvolvimento nacional sustentável.

§ 1º As ações da CICS serão alinhadas com as políticas industriais do Conselho Nacional de Desenvolvimento Industrial - CNDI, do Plano de Transformação Ecológica e dos programas prioritários federais.

§ 2º Os objetivos incluem mobilizar e articular a demanda estatal para apoiar os objetivos de políticas públicas e melhorar a qualidade das contratações públicas.

§ 3º A Comissão funciona como unidade de governança discutindo margens de preferência, compensação comercial, diálogo competitivo, concursos inovativos e critérios de desempate.

Seção II - Das Competências

Art. 2º À CICS compete:

I - estabelecer critérios para aplicação de margens de preferência normais e adicionais, medidas de compensação comercial, industrial ou tecnológica, e instrumentos de fomento à inovação;

II - receber propostas de órgãos da administração federal sobre margens de preferência e políticas de fomento;

III - requerer elaboração de estudos setoriais para subsidiar decisões sobre produtos, serviços ou grupos de empresas;

IV - analisar propostas e deliberar sobre aplicação de margens, compensações ou instrumentos de fomento;

V - estabelecer condicionantes e metas para aplicação dessas medidas;

VI - avaliar conveniência e viabilidade operacional;

VII - monitorar aplicação, cumprimento de condicionalidades, custos resultantes e benefícios alcançados;

VIII - indicar conjunto de normas técnicas brasileiras aplicáveis por produto, serviço, grupo de produtos e grupo de serviços;

IX - garantir transparência sobre decisões, estudos e resultados alcançados;

X - avaliar demanda futura de compras públicas para setores específicos;

XI - propor medidas promovendo integração entre contratações públicas e execução de políticas públicas, melhorando contratações e eficiência;

XII - aprovar e alterar seu regimento interno.

CAPÍTULO II - ORGANIZAÇÃO E FUNCIONAMENTO

Seção I - Da Composição

Art. 3º A CICS compõe-se de um representante de cada um dos seguintes órgãos:

I - Ministério da Gestão e da Inovação em Serviços Públicos, que a presidirá;
II - Casa Civil da Presidência da República;
III - Ministério da Ciência, Tecnologia e Inovação;
IV - Ministério do Desenvolvimento, Indústria, Comércio e Serviços;
V - Ministério da Fazenda;
VI - Ministério das Relações Exteriores;
VII - Ministério do Trabalho e Emprego;
VIII - Banco Nacional de Desenvolvimento Econômico e Social - BNDES;
IX - Financiadora de Estudos e Projetos - Finep.

§ 1º Cada membro possui suplente para substituição em ausências e impedimentos.

§ 2º Membros e suplentes são indicados pelos titulares dos órgãos e designados pelo Ministro da Gestão e Inovação em Serviços Públicos.

§ 3º Membros ocupam Cargo Comissionado Executivo nível 17 ou superior; suplentes ocupam nível 15 ou superior.

§ 4º A Advocacia-Geral da União participa de reuniões que discutam atos normativos de competência presidencial.

§ 5º A Secretaria-Executiva é exercida pela Secretaria de Gestão e Inovação do Ministério da Gestão e Inovação em Serviços Públicos.

Art. 4º A CICS possui grupo de apoio técnico composto por técnicos indicados pelos órgãos integrantes.

Seção II - Da Organização e do Funcionamento

Art. 5º Compete ao Presidente:

I - solicitar informações e requerer estudos ou pareceres sobre matérias de interesse;

II - constituir grupos de apoio técnico, comitês e subcomitês e designar seus membros para tratar de assuntos específicos;

III - convidar especialistas e representantes de outros órgãos para analisar assuntos específicos;

IV - acompanhar e avaliar atos normativos sobre compras públicas;

V - deliberar ad referendum em matérias inadiáveis, mediante justificativa quanto à relevância, urgência e inviabilidade de reunião colegiada oportuna;

VI - elaborar e expedir atos normativos necessários ao funcionamento;

VII - expedir resoluções aprovadas em reunião, conforme registrado em ata;

VIII - publicar resoluções no Diário Oficial da União.

Parágrafo único. Decisões ad referendum submetem-se à aprovação na reunião subsequente.

Art. 6º À Secretaria-Executiva compete:

I - elaborar e encaminhar documentos aos membros;

II - manter arquivo de atas, estudos técnicos e documentos;

III - apoiar na elaboração de minutas de atas, resoluções e atos normativos;

IV - convocar e presidir reuniões de grupos técnicos, comitês e subcomitês;

V - realizar análises preliminares e coordenar pareceres técnicos;

VI - propor itens de pauta das reuniões;

VII - agendar reuniões em coordenação com membros.

Art. 7º Compete aos integrantes:

I - participar de reuniões;

II - acompanhar, discutir e votar nas deliberações;

III - zelar pelo cumprimento de determinações legais e regulamentares;

IV - fornecer informações e dados pertinentes disponíveis;

V - propor matérias à Secretaria-Executiva e itens de pauta.

Parágrafo único. Compete ao Ministério do Desenvolvimento, Indústria, Comércio e Serviços, mediante provocação da Secretaria-Executiva da CICS, manifestar-se por meio de correio eletrônico sobre a proposição das regras usadas para a aplicação das margens de preferência normais e adicionais.

Art. 8º As reuniões serão convocadas com antecedência mínima de dez dias corridos, informando data, horário, local, pauta e documentos.

§ 1º Reuniões extraordinárias serão convocadas com antecedência mínima de dois dias corridos em casos de excepcional urgência.

§ 2º A pauta poderá ser atualizada posteriormente à convocação, divulgando-se definitivamente até a véspera da reunião.

Art. 9º O quórum mínimo para deliberação é a maioria absoluta dos membros; aprovação requer maioria simples dos votos.

Parágrafo único. Em caso de empate, o Presidente possui voto de qualidade além do ordinário.

Seção III - Do Fluxo das Reuniões

Art. 10. Qualquer membro apresenta à Secretaria-Executiva propostas de matéria à deliberação, acompanhadas de justificativa.

Art. 11. A Secretaria-Executiva analisa conveniência e viabilidade, identificando órgãos com interesse direto e solicitando:

I - manifestação preliminar sobre aplicação de margens, compensações ou instrumentos de fomento;

II - informações sobre produtos, serviços ou grupos analisados;

III - modalidades de contratação disponíveis;

IV - cronograma de contratações.

Art. 12. Após reunião das informações, a Secretaria-Executiva solicita documentos para fundamentação.

§ 1º Pareceres produzidos serão comunicados aos órgãos indicados no artigo anterior.

§ 2º A Secretaria-Executiva elaborará caderno de documentação para encaminhamento aos membros.

CAPÍTULO III - DISPOSIÇÕES FINAIS

Art. 13. As atividades da CICS e dos grupos de apoio técnico são consideradas serviço público relevante, sem remuneração.

Art. 14. Casos omissos e dúvidas serão resolvidos pelo Presidente.

Art. 15. A alteração deste Regimento requer aprovação de maioria absoluta dos integrantes.

Art. 16. As atas serão assinadas pelos membros presentes e representante da Secretaria-Executiva, digitalmente ou excepcionalmente de forma física.

Art. 17. A CICS contará com apoio institucional, técnico e administrativo dos órgãos integrantes, respeitadas suas atribuições, conforme Lei nº 14.600, de 19 de junho de 2023.

Art. 18. Membros no Distrito Federal reunir-se-ão presencialmente ou por videoconferência; membros em outros entes federativos participarão por videoconferência.

Art. 19. No exercício de suas atividades, os membros observarão os preceitos da Lei nº 12.813, de 16 de maio de 2013, e do Código de Ética Profissional do Servidor Público Civil, disciplinado pelo Decreto nº 1.171, de 22 de junho de 1994.

Art. 20. As deliberações dos colegiados, por decisão de seus presidentes, poderão ser estabelecidas por meio de circuito deliberativo virtual, a partir da manifestação eletrônica dos seus membros.`,
  },

  // 8. MP 1.167/2023
  {
    id: 'b3242d4f-9ead-4951-b864-46c607e622ef',
    fullNumber: 'MP 1.167/2023',
    content: `MEDIDA PROVISÓRIA Nº 1.167, DE 31 DE MARÇO DE 2023

Altera a Lei nº 14.133, de 1º de abril de 2021, para prorrogar a possibilidade de uso da Lei nº 8.666, de 21 de junho de 1993, da Lei nº 10.520, de 17 de julho de 2002, e dos arts. 1º a 47-A da Lei nº 12.462, de 4 de agosto de 2011.

O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere o art. 62 da Constituição, adota a seguinte Medida Provisória, com força de lei:

Art. 1º A Lei nº 14.133, de 1º de abril de 2021, passa a vigorar com as seguintes alterações:

"Art. 191. Até o decurso do prazo de que trata o inciso II do caput do art. 193, a Administração poderá optar por licitar ou contratar diretamente conforme esta Lei ou conforme as leis citadas no referido inciso, desde que:

I - a publicação do edital ou do ato autorizativo da contratação direta ocorra até 29 de dezembro de 2023; e

II - a opção escolhida seja expressamente indicada no edital ou no ato autorizativo da contratação direta.

§ 1º Na hipótese do caput, se a Administração optar por licitar de acordo com as leis citadas no inciso II do caput do art. 193, o respectivo contrato será regido pelas regras nelas previstas durante toda a sua vigência.

§ 2º É vedada a aplicação combinada desta Lei com as citadas no inciso II do caput do art. 193." (NR)

"Art. 193. .......................................................................

II - em 30 de dezembro de 2023:

a) a Lei nº 8.666, de 1993;
b) a Lei nº 10.520, de 2002; e
c) os arts. 1º a 47-A da Lei nº 12.462, de 2011." (NR)

Art. 2º Fica revogado o parágrafo único do art. 191 da Lei nº 14.133, de 2021.

Art. 3º Esta Medida Provisória entra em vigor na data de sua publicação.

Brasília, 31 de março de 2023; 202º da Independência e 135º da República.

LUIZ INÁCIO LULA DA SILVA
Esther Dweck`,
  },

  // 9. Resolução CIIA-PAC/CC 3/2025
  {
    id: '266b5df7-0f6b-49f3-a307-110d04c4bec8',
    fullNumber: 'Resolução CIIA-PAC/CC 3/2025',
    content: `RESOLUÇÃO CIIA-PAC/CC Nº 3, DE 28 DE JULHO DE 2025

Define os produtos manufaturados que ficarão sujeitos à aplicação de margem de preferência nas contratações do Programa de Aceleração do Crescimento - Novo PAC, acompanhados dos critérios para caracterização de origem nacional.

A COMISSÃO INTERMINISTERIAL DE INOVAÇÕES E AQUISIÇÕES DO PROGRAMA DE ACELERAÇÃO DO CRESCIMENTO, no uso das atribuições que lhe conferem o art. 2º, inciso I, alíneas "a" e "c", do Decreto nº 11.630, de 11 de agosto de 2023, e considerando o art. 3º-A da Lei nº 11.578, de 26 de novembro de 2007, o art. 26 da Lei nº 14.133, de 1º de abril de 2021, e o art. 3º, parágrafo único, do Decreto nº 11.889, de 22 de janeiro de 2024, resolve:

Art. 1º Esta Resolução define os produtos manufaturados sujeitos a margens de preferência nas ações do Novo PAC, acompanhados dos critérios para caracterização de origem nacional, nos termos do art. 3º, parágrafo único, do Decreto nº 11.889, de 22 de janeiro de 2024, e do Anexo I.

Art. 2º Para os fins desta Resolução, considera-se:

I - caracterização de origem: regra de fabricação que caracteriza um produto como nacional;

II - código NCM: código da Nomenclatura Comum do Mercosul;

III - código CFI: código válido do Credenciamento no Finame do BNDES;

IV - PPB: Processo Produtivo Básico, conforme certificado em portaria interministerial;

V - TECNAC: produto de Tecnologia da Informação desenvolvido no Brasil, com concepção e investimentos em P&D realizados no território nacional.

Art. 3º Os produtos manufaturados classificados nos códigos NCM listados no Anexo I - adquiridos em ações do Novo PAC no eixo Saúde, subeixo Atenção Primária - e no Anexo II - para o subeixo Atenção Especializada - estarão sujeitos à aplicação de margens de preferência quando as especificações dos editais forem atendidas.

§ 1º A margem de preferência será de 10% (dez por cento) para produtos manufaturados nacionais que atendam, alternativa ou cumulativamente, aos critérios CFI ou PPB.

§ 2º Uma margem de preferência adicional de 10% (dez por cento) - totalizando 20% (vinte por cento) - será aplicada quando os produtos atenderem cumulativamente ao menos um critério do § 1º mais o critério TECNAC.

Art. 4º Nos termos do art. 3º-A da Lei nº 11.578, de 2007, esta Resolução da CIIA-PAC aplica-se às ações do Novo PAC executadas diretamente ou descentralizadamente.

Parágrafo único. Considerando o objetivo do Novo PAC de fomentar a integração de investimentos público-privados, nos termos do art. 1º, inciso III, do Decreto nº 11.632, esta Resolução poderá servir como diretriz orientadora para ações do Novo PAC não executadas nas modalidades indicadas no caput.

Art. 5º Aplicam-se a esta Resolução as disposições do art. 7º do Decreto nº 11.889, de 2024.

Art. 6º O licitante é responsável por apresentar documentos comprobatórios do atendimento dos critérios CFI, PPB e TECNAC, quando aplicáveis.

Art. 7º Quando a proposta vencedora aplicar margem de preferência, essa informação deverá ser reportada ao Portal Nacional de Contratações Públicas, nos termos do art. 27 da Lei nº 14.133, de 2021.

Art. 8º Esta Resolução entra em vigor na data de sua publicação.

ANEXO I - PRODUTOS SUJEITOS A MARGEM DE PREFERÊNCIA - ATENÇÃO PRIMÁRIA

NCM 84184000 - Câmara fria para armazenamento de vacinas
NCM 90185090 - Retinógrafo digital
NCM 90181980 - Espirômetro digital
NCM 90189099 - Dermatoscópio digital
NCM 90181100 - Eletrocardiógrafo digital
NCM 90189021 - Eletrocautério (bisturi elétrico)
NCM 90189096 - Desfibrilador externo automático
NCM 90181290 - Doppler vascular
NCM 90182090 - Laser terapêutico de baixa potência
NCM 90189099 - Ultrassom para fisioterapia
NCM 84231000 - Balança digital portátil
NCM 90189099 - TENS e FES
NCM 90318011 - Dinamômetro digital
NCM 87131000 - Cadeira de rodas
NCM 90189099 - Fonte de luz frontal
NCM 90191000 - Prancha de propriocepção
NCM 90181980 - Otoscópio digital
NCM 90181290 - Ultrassom de bolso

ANEXO II - PRODUTOS SUJEITOS A MARGEM DE PREFERÊNCIA - ATENÇÃO ESPECIALIZADA

NCM 90221419 - Arco cirúrgico
NCM 90189099 - Aparelho de anestesia
NCM 90181980 - Monitor multiparamétrico
NCM 94029010 - Mesa cirúrgica elétrica radiotransparente
NCM 90181290 - Ultrassom portátil
NCM 90185090 - Vitrectomo com facoemulsificador
NCM 90185010 - Microscópio cirúrgico oftalmológico
NCM 90185090 - Laser oftalmológico (YAG/DIODO)
NCM 90185090 - Fotocoagulador a laser
NCM 90185090 - Biômetro de coerência óptica
NCM 90189099 - Sistema de videoendoscopia rígida`,
  },
];

async function main() {
  console.log(`Atualizando ${actsContent.length} atos legislativos...`);
  console.log('='.repeat(60));

  let success = 0;
  let failed = 0;

  for (const act of actsContent) {
    try {
      const result = await prisma.legislativeAct.update({
        where: { id: act.id },
        data: { content: act.content },
        select: { id: true, fullNumber: true },
      });
      console.log(`[OK] ${result.fullNumber} (${result.id}) — ${act.content.length} chars`);
      success++;
    } catch (error) {
      console.error(`[ERRO] ${act.fullNumber} (${act.id}):`, error);
      failed++;
    }
  }

  console.log('='.repeat(60));
  console.log(`Resultado: ${success} sucesso, ${failed} falha(s), total: ${actsContent.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
