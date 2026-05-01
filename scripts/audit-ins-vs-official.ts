/**
 * Audit completo: cruza INs do banco com lista oficial gov.br/compras.
 *
 * Saída em docs/audits/<data>-ins-audit-completo.md.
 */
import { prisma } from '../lib/prisma';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { writeFileSync } from 'fs';
import { join } from 'path';

// ─── Lista oficial (extraída do índice gov.br/compras em 2026-05-01) ───
// Total: 79 INs em 3 páginas
const OFFICIAL_INS: { number: string; year: number; title: string; url: string }[] = [
  // Página 1 (2026-2022)
  { number: '148', year: 2026, title: 'Altera IN nº 190/2024 para incluir novos serviços contínuos com redução de jornada', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-148-de-13-de-abril-de-2026' },
  { number: '147', year: 2026, title: 'Reembolso-creche para terceirizados', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-147-de-13-de-abril-de-2026' },
  { number: '129', year: 2026, title: 'Altera IN 512/2025 sobre diálogo competitivo', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-129-de-30-de-marco-de-2026' },
  { number: '512', year: 2025, title: 'Regulamenta diálogo competitivo (Lei 14.133/2021)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-512-de-3-de-dezembro-de-2025' },
  { number: '460', year: 2025, title: 'Altera IN 52/2025 sobre Contrata+Brasil', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-460-de-31-de-outubro-de-2025' },
  { number: '412', year: 2025, title: 'Diretrizes para serviço de transporte terrestre administrativo', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-412-de-1o-de-outubro-de-2025' },
  { number: '382', year: 2025, title: 'Equidade entre mulheres e homens em licitações', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-382-de-17-de-setembro-de-2025' },
  { number: '381', year: 2025, title: 'Altera IN 190/2024 — redução de jornada', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-381-de-17-de-setembro-de-2025' },
  { number: '213', year: 2025, title: 'Previsibilidade de férias para terceirizados', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-213-de-29-de-maio-de-2025' },
  { number: '82', year: 2025, title: 'Operações de crédito e portal AntecipaGov', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-82-de-21-de-fevereiro-de-2025' },
  { number: '52', year: 2025, title: 'Cria plataforma Contrata+Brasil', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-52-de-10-de-fevereiro-de-2025-1' },
  { number: '190', year: 2024, title: 'Serviços contínuos aptos a redução de jornada', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-190-de-5-de-dezembro-de-2024' },
  { number: '176', year: 2024, title: 'Custos mínimos e garantias trabalhistas em terceirizados', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-176-de-25-de-novembro-de-2024' },
  { number: '79', year: 2024, title: 'Altera IN 73/2022 — sorteio e margens de preferência', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-79-de-12-de-setembro-de-2024' },
  { number: '81', year: 2024, title: 'Compensação de jornada em terceirizados', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-81-de-12-de-setembro-de-2024' },
  { number: '53', year: 2023, title: 'Sicaf para empresas estrangeiras', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-53-de-28-de-dezembro-de-2023' },
  { number: '12', year: 2023, title: 'Licitação por melhor técnica eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-12-de-31-de-marco-de-2023' },
  { number: '11', year: 2023, title: 'Pagamento de despesas e regime de adiantamento', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-11-de-29-de-marco-de-2023ss' },
  { number: '8', year: 2023, title: 'Altera IN 67/2021 — dispensa eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-8-de-23-de-marco-de-2023' },
  { number: '2', year: 2023, title: 'Licitação técnica e preço eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-2-de-7-de-fevereiro-de-2023' },
  { number: '4', year: 2023, title: 'Decreto 10.818/2021', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-4-de-2-de-fevereiro-de-2023' },
  { number: '103', year: 2022, title: 'Seleção de imóveis para locação', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normtaiva-seges-me-no-103-de-30-de-dezembro-de-2022' },
  { number: '98', year: 2022, title: 'Contratação de serviços sob execução indireta', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-98-de-26-de-dezembro-de-2022' },
  { number: '96', year: 2022, title: 'Maior retorno econômico eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-96-de-23-de-dezembro-de-2022' },
  { number: '91', year: 2022, title: 'Valor estimado em licitações de engenharia', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-91-de-16-de-dezembro-de-2022' },
  { number: '90', year: 2022, title: 'Revogação da IN 75/2021', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-90-de-16-de-dezembro-de-2022' },
  { number: '81', year: 2022, title: 'Termo de Referência', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-81-de-25-de-novembro-de-2022' },
  { number: '77', year: 2022, title: 'Ordem cronológica de pagamento', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-77-de-4-de-novembro-de-2022' },
  { number: '73', year: 2022, title: 'Menor preço/maior desconto eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-73-de-30-de-setembro-de-2022' },
  { number: '58', year: 2022, title: 'Estudos Técnicos Preliminares', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-no-58-de-8-de-agosto-de-2022' },
  // Página 2 (2022-2018)
  { number: '26', year: 2022, title: 'Dispensa, parcelamento, compensação de débito de multa', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-26-de-13-de-abril-de-2022' },
  { number: '20', year: 2022, title: 'Revogação de Instruções Normativas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-20-de-04-de-abril-de-2022' },
  { number: '5', year: 2022, title: 'Altera IN 3/2015 — passagens aéreas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-5-de-7-de-fevereiro-de-2022' },
  { number: '116', year: 2021, title: 'Pessoa física em contratações públicas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-116-de-21-de-dezembro-de-2021' },
  { number: '67', year: 2021, title: 'Dispensa de licitação eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-67-de-8-de-julho-de-2021' },
  { number: '65', year: 2021, title: 'Pesquisa de preços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-65-de-7-de-julho-de-2021' },
  { number: '62', year: 2021, title: 'Altera IN 53/2020 — operação de crédito', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-autor-me-no-62-de-28-de-junho-de-2021' },
  { number: '51', year: 2021, title: 'Almoxarifado Virtual Nacional', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-51-de-13-de-maio-de-2021' },
  { number: '42', year: 2021, title: 'Altera IN 53 — cessão fiduciária', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-42-de-19-de-abril-de-2021' },
  { number: '107', year: 2020, title: 'Altera IN 3/2018 — Sicaf', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-107-de-28-de-outubro-de-2020' },
  { number: '102', year: 2020, title: 'Revoga INs e ONs', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-no-102-de-16-de-outubro-de-2020' },
  { number: '96', year: 2020, title: 'Altera IN 6/2019 — recebimento de doações', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-96-de-02-de-outubro-de-2020' },
  { number: '76', year: 2020, title: 'Altera IN 53/2020 — operação de crédito', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-76-de-11-de-agosto-de-2020' },
  { number: '73', year: 2020, title: 'Pesquisa de preços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-73-de-5-de-agosto-de-2020' },
  { number: '64', year: 2020, title: 'Altera IN 10/2020', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-64-de-29-de-julho-de-2020' },
  { number: '50', year: 2020, title: 'Altera IN 13/2020', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-50-de-02-de-julho-de-2020' },
  { number: '49', year: 2020, title: 'Altera IN 5/2017 — contratação de serviços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-49-de-30-de-junho-de-2020' },
  { number: '40', year: 2020, title: 'Estudos Técnicos Preliminares e ETP digital', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-40-de-22-de-maio-de-2020' },
  { number: '16', year: 2020, title: 'Revoga INs', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-16-de-04-de-marco-de-2020' },
  { number: '13', year: 2020, title: 'Cadastramento de unidades protocolizadoras', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-13-de-27-de-fevereiro-de-2020-atualizada' },
  { number: '12', year: 2020, title: 'Revoga INs', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-12-de-20-de-fevereiro-de-2020' },
  { number: '10', year: 2020, title: 'Altera IN 3/2018 — Sicaf', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-10-de-10-de-fevereiro-de-2020-atualizada' },
  { number: '210', year: 2019, title: 'Revoga IN 3/2011 — pregão eletrônico', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-210-de-20-de-novembro-de-2019' },
  { number: '206', year: 2019, title: 'Prazo obrigatório de pregão e dispensa eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-206-de-18-de-outubro-de-2019' },
  { number: '6', year: 2019, title: 'Decreto 9.764 — recebimento de doações', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-6-de-12-de-agosto-de-2019' },
  { number: '3', year: 2019, title: 'Altera IN 2/2018 — Compra Institucional', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-3-de-27-de-maio-de-2019' },
  { number: '11', year: 2018, title: 'Bens móveis inservíveis', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-11-de-29-de-novembro-de-2018' },
  { number: '7', year: 2018, title: 'Altera IN 5/2017 — contratação de serviços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-07-de-20-de-setembro-de-2018' },
  { number: '6', year: 2018, title: 'Cláusulas trabalhistas em obras públicas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-6-de-6-de-julho-de-2018' },
  { number: '5', year: 2018, title: 'Altera IN 3/2015 — art. 18', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-05-de-julho-de-2018' },
  // Página 3 (2018-1983)
  { number: '4', year: 2018, title: 'Diretrizes para elaboração de atos normativos do MP', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-mp-no-4-de-24-de-julho-de-2018' },
  { number: '3', year: 2018, title: 'Sicaf no Poder Executivo Federal', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-3-de-26-de-abril-de-2018' },
  { number: '2', year: 2018, title: 'Compra Institucional de alimentos', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-2-de-29-de-marco-de-2018' },
  { number: '4', year: 2017, title: 'Ressarcimento de bagagens em viagens', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-4-de-11-de-julho-de-2017' },
  { number: '5', year: 2017, title: 'Contratação de serviços sob execução indireta', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada' },
  { number: '2', year: 2016, title: 'Ordem cronológica de pagamento', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-2-de-6-de-dezembro-de-2016' },
  { number: '3', year: 2015, title: 'Aquisição de passagens aéreas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-3-de-11-de-fevereiro-de-2015' },
  { number: '6', year: 2014, title: 'Remanejamento em Atas de Registro de Preços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-6-de-25-de-julho-de-2014' },
  { number: '2', year: 2014, title: 'Aquisição/locação de máquinas — ENCE', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-2-de-04-de-junho-de-2014' },
  { number: '5', year: 2013, title: 'RDC eletrônico (Lei 12.462)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-ndeg-5-de-7-de-novembro-de-2013' },
  { number: '10', year: 2012, title: 'Planos de Gestão de Logística Sustentável', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-10-de-12-de-novembro-de-2012' },
  { number: '9', year: 2012, title: 'Contenção de despesas (Decreto 99.188)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-9-de-3-de-outubro-de-2012' },
  { number: '2', year: 2011, title: 'SIASG — módulos e subsistemas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-ndeg-2-de-16-de-agosto-de-2011' },
  { number: '1', year: 2010, title: 'Sustentabilidade ambiental em aquisições', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-01-de-19-de-janeiro-de-2010' },
  { number: '3', year: 2008, title: 'Veículos oficiais', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-3-de-15-de-maio-de-2008' },
  { number: '12', year: 1997, title: 'Telefonia fixa e celular', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-ndeg-12-de-05-de-setembro-de-1997' },
  { number: '6', year: 1995, title: 'Reciclagem de papel', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-06-de-03-de-novembro-de-1995' },
  { number: '205', year: 1988, title: 'Minimização de custos no SISG', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-205-de-08-de-abril-de-1988' },
  { number: '183', year: 1986, title: 'Acidentes com veículos oficiais', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-ndeg-183-de-8-de-setembro-de-1986' },
  { number: '142', year: 1983, title: 'IN 142/1983', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-n-o-142-de-05-de-agosto-de-1983' },
];

interface AuditEntry {
  fullNumber: string;
  number: string;
  year: number;
  contentLength: number;
  officialUrl: string | null;
  validation: { errors: string[]; warnings: string[]; ok: boolean };
  inOfficialList: boolean;
  urlMatches: boolean | null;
}

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    where: { OR: [{ type: 'in' }, { fullNumber: { startsWith: 'IN ' } }] },
    orderBy: [{ year: 'desc' }, { number: 'desc' }],
  });

  const dbEntries: AuditEntry[] = acts.map((act) => {
    const validation = validateActContent({ url: act.officialUrl, content: act.content });
    const officialMatch = OFFICIAL_INS.find(
      (o) => o.number === act.number && o.year === act.year,
    );
    const urlMatches = officialMatch
      ? act.officialUrl === officialMatch.url
      : null;
    return {
      fullNumber: act.fullNumber,
      number: act.number,
      year: act.year,
      contentLength: act.content?.length ?? 0,
      officialUrl: act.officialUrl,
      validation,
      inOfficialList: !!officialMatch,
      urlMatches,
    };
  });

  // INs do oficial que não estão no DB
  const dbKeys = new Set(acts.map((a) => `${a.number}/${a.year}`));
  const missingFromDb = OFFICIAL_INS.filter(
    (o) => !dbKeys.has(`${o.number}/${o.year}`),
  );

  // Stats
  const okCount = dbEntries.filter((e) => e.validation.ok && e.validation.warnings.length === 0).length;
  const errorCount = dbEntries.filter((e) => !e.validation.ok).length;
  const warningCount = dbEntries.filter((e) => e.validation.ok && e.validation.warnings.length > 0).length;
  const urlMismatchCount = dbEntries.filter((e) => e.urlMatches === false).length;
  const notInOfficial = dbEntries.filter((e) => !e.inOfficialList);

  // Markdown
  const today = new Date().toISOString().slice(0, 10);
  let md = `# Auditoria Completa — Instruções Normativas\n\n`;
  md += `**Gerado em:** ${today}\n\n`;
  md += `**Fonte oficial:** [gov.br/compras — Instruções Normativas](https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas)\n\n`;
  md += `## Resumo\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| INs no banco | **${acts.length}** |\n`;
  md += `| INs no índice oficial gov.br | **${OFFICIAL_INS.length}** |\n`;
  md += `| INs no banco que estão também no oficial | ${dbEntries.filter((e) => e.inOfficialList).length} |\n`;
  md += `| INs no banco que NÃO estão no oficial atual | ${notInOfficial.length} (revogadas/diferentes/históricas) |\n`;
  md += `| INs no oficial que NÃO estão no banco | ${missingFromDb.length} |\n`;
  md += `| URL no banco DIVERGE do oficial | ${urlMismatchCount} |\n`;
  md += `| Validação OK (sem erro/warning) | ${okCount} |\n`;
  md += `| Com errors | ${errorCount} |\n`;
  md += `| Com warnings | ${warningCount} |\n\n`;

  md += `## INs com errors de validação\n\n`;
  const errored = dbEntries.filter((e) => !e.validation.ok);
  if (errored.length === 0) {
    md += `_Nenhum._\n\n`;
  } else {
    for (const e of errored) {
      md += `### ${e.fullNumber} (${e.contentLength} chars)\n`;
      md += `URL: ${e.officialUrl}\n\n`;
      for (const err of e.validation.errors) md += `- ❌ ${err}\n`;
      for (const w of e.validation.warnings) md += `- ⚠️ ${w}\n`;
      md += `\n`;
    }
  }

  md += `## INs com URL divergente do oficial\n\n`;
  const urlDiff = dbEntries.filter((e) => e.urlMatches === false);
  if (urlDiff.length === 0) {
    md += `_Nenhum._\n\n`;
  } else {
    md += `| Ato | URL no banco | URL oficial |\n|---|---|---|\n`;
    for (const e of urlDiff) {
      const off = OFFICIAL_INS.find((o) => o.number === e.number && o.year === e.year);
      md += `| ${e.fullNumber} | ${e.officialUrl} | ${off?.url} |\n`;
    }
    md += `\n`;
  }

  md += `## INs no banco fora da lista oficial atual\n\n`;
  md += `Estes atos podem ter sido revogados, ter número/ano diferente, ou ser históricos.\n\n`;
  if (notInOfficial.length === 0) {
    md += `_Nenhum._\n\n`;
  } else {
    md += `| Ato | content (chars) | URL |\n|---|---|---|\n`;
    for (const e of notInOfficial) {
      md += `| ${e.fullNumber} | ${e.contentLength} | ${e.officialUrl ?? '—'} |\n`;
    }
    md += `\n`;
  }

  md += `## INs no oficial não cadastradas no banco\n\n`;
  md += `Lista de INs ainda vigentes no gov.br que poderiam ser importadas.\n\n`;
  if (missingFromDb.length === 0) {
    md += `_Nenhum._\n\n`;
  } else {
    md += `| Número/Ano | Título | URL |\n|---|---|---|\n`;
    for (const o of missingFromDb) {
      md += `| ${o.number}/${o.year} | ${o.title.slice(0, 80)}... | ${o.url} |\n`;
    }
    md += `\n`;
  }

  md += `## INs com warnings (não-bloqueantes)\n\n`;
  const warned = dbEntries.filter((e) => e.validation.ok && e.validation.warnings.length > 0);
  if (warned.length === 0) {
    md += `_Nenhum._\n\n`;
  } else {
    for (const e of warned) {
      md += `- **${e.fullNumber}** (${e.contentLength} chars): ${e.validation.warnings.join('; ')}\n`;
    }
    md += `\n`;
  }

  md += `## Detalhe — todas INs no banco\n\n`;
  md += `| Ato | chars | OK? | URL bate? | warnings |\n|---|---|---|---|---|\n`;
  for (const e of dbEntries) {
    const ok = e.validation.ok && e.validation.warnings.length === 0 ? '✅' : !e.validation.ok ? '❌' : '⚠️';
    const urlOk = e.urlMatches === null ? 'n/a' : e.urlMatches ? '✅' : '❌';
    const wlen = e.validation.warnings.length;
    md += `| ${e.fullNumber} | ${e.contentLength} | ${ok} | ${urlOk} | ${wlen > 0 ? `${wlen}` : '—'} |\n`;
  }

  const outFile = join(process.cwd(), 'docs', 'audits', `${today}-ins-audit-completo.md`);
  writeFileSync(outFile, md);
  console.log(`📄 Relatório salvo em: ${outFile}`);
  console.log();
  console.log(`📊 Resumo:`);
  console.log(`   INs no banco:          ${acts.length}`);
  console.log(`   INs no oficial:        ${OFFICIAL_INS.length}`);
  console.log(`   ✅ OK:                  ${okCount}`);
  console.log(`   ❌ Errors:              ${errorCount}`);
  console.log(`   ⚠️  Warnings:           ${warningCount}`);
  console.log(`   📍 URL divergente:      ${urlMismatchCount}`);
  console.log(`   🚫 No banco / fora oficial: ${notInOfficial.length}`);
  console.log(`   📥 No oficial / fora banco: ${missingFromDb.length}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
