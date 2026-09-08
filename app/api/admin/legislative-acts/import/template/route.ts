import { NextResponse } from 'next/server';
import { apiLogger } from "@/lib/logger";
import { withAdminApi } from '@/lib/api/handler';

/**
 * GET /api/admin/legislative-acts/import/template
 * Gera template Excel para importação em massa de atos normativos
 */
export const GET = withAdminApi(async () => {
  try {
    // Criar CSV (mais simples que Excel e suportado nativamente)
    const headers = [
      'Tipo',
      'Número',
      'Ano',
      'Título',
      'Ementa',
      'Resumo (Opcional)',
      'Órgão Emissor',
      'Data de Publicação (YYYY-MM-DD)',
      'Data de Vigência (YYYY-MM-DD, Opcional)',
      'Artigos da Lei 14.133 (separados por vírgula)',
      'URL Oficial',
      'URL PDF'
    ];

    // Linhas de exemplo
    const examples = [
      [
        'decreto',
        '10.947',
        '2022',
        'Regulamenta a Lei nº 14.133, de 1º de abril de 2021',
        'Decreto regulamentador geral da Lei 14.133/2021, estabelecendo normas sobre licitações e contratos administrativos.',
        'Este decreto traz as regras gerais de aplicação da Lei de Licitações.',
        'Presidência',
        '2022-01-25',
        '2022-04-01',
        '8, 18, 26, 29, 72, 75',
        'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d10947.htm',
        ''
      ],
      [
        'in',
        '65',
        '2021',
        'Dispõe sobre a pesquisa de preços para a aquisição de bens e contratação de serviços',
        'Estabelece procedimentos para pesquisa de preços na fase de planejamento da contratação.',
        '',
        'SEGES',
        '2021-07-07',
        '',
        '23',
        '',
        ''
      ],
      [
        'portaria',
        '11.380',
        '2021',
        'Institui o Painel de Compras do Governo Federal',
        'Cria painel de transparência e acompanhamento das contratações federais.',
        '',
        'SEGES',
        '2021-10-29',
        '',
        '174',
        '',
        ''
      ]
    ];

    // Montar CSV
    const csvRows = [];
    csvRows.push(headers.join(','));

    examples.forEach(row => {
      // Escapar valores que contêm vírgula ou aspas
      const escapedRow = row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      });
      csvRows.push(escapedRow.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Adicionar BOM UTF-8 para Excel abrir corretamente
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="template-atos-normativos.csv"'
      }
    });

  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao gerar template:');
    return NextResponse.json(
      { error: 'Erro ao gerar template' },
      { status: 500 }
    );
  }
});
