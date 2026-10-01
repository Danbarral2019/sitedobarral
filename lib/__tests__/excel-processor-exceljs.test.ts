// @vitest-environment node
/**
 * Importação de documentos por planilha (lib/excel-processor.ts) depois da
 * troca do SheetJS pelo exceljs: template gerado com as mesmas aba, cabeçalhos
 * e tipos, e leitura com o mesmo mapeamento posicional de colunas.
 */
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { generateExcelTemplate, processExcelFile } from '../excel-processor';
import { XLS_NOT_SUPPORTED_MESSAGE } from '../excel/workbook';

const TEMPLATE_HEADERS = ['Titulo', 'Descricao', 'Categoria', 'Curso', 'Publico', 'Tags', 'Artigos', 'URL', 'Arquivo'];

async function buildWorkbook(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Planilha1');
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('generateExcelTemplate', () => {
  it('gera a aba "Documentos" com os 9 cabeçalhos e 4 exemplos em texto', async () => {
    const bytes = await generateExcelTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);

    expect(workbook.worksheets.map((ws) => ws.name)).toEqual(['Documentos']);
    const sheet = workbook.getWorksheet('Documentos')!;
    expect(sheet.rowCount).toBe(5);
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual(TEMPLATE_HEADERS);
    expect(sheet.getCell('A2').value).toBe('Acórdão 1234/2023 - Dispensa de Licitação');
    // Artigos e Publico continuam texto, como no json_to_sheet do SheetJS.
    expect(sheet.getCell('G2').value).toBe('72, 74, 75');
    expect(sheet.getCell('E3').value).toBe('Sim');
    expect(sheet.getCell('D5').value).toBe('gestao-fiscalizacao-contratos, planejamento-contratacoes');
    expect(sheet.getColumn(1).width).toBe(50);
    expect(sheet.getColumn(9).width).toBe(30);
  });

  it('o template preenchido volta pela importação com 4 documentos válidos', async () => {
    const result = await processExcelFile(Buffer.from(await generateExcelTemplate()));

    expect(result.isValid).toBe(true);
    expect(result.totalRows).toBe(4);
    const [primeiro, segundo, terceiro, quarto] = result.documents;
    expect(primeiro).toMatchObject({
      title: 'Acórdão 1234/2023 - Dispensa de Licitação',
      category: 'acordao',
      courseId: '10',
      isPublic: false,
      leiArticles: ['72', '74', '75'],
      fileName: 'acordao_1234_2023.pdf',
      url: undefined,
    });
    expect(segundo).toMatchObject({ isPublic: true, url: 'https://exemplo.com/parecer.pdf', courseId: '2' });
    expect(terceiro).toMatchObject({ isAllCourses: true, isMultipleCourses: true });
    expect(quarto.courseIds).toEqual(['3', '2']);
  });
});

describe('processExcelFile', () => {
  it('mapeia as colunas por posição, ignora linha vazia e mantém números como número', async () => {
    const buffer = await buildWorkbook([
      ['Título', 'Descrição', 'Categoria', 'Curso', 'Público', 'Tags', 'Artigos'],
      ['Parecer X', 'Descrição longa', 'parecer', 'contratacao-direta', 'sim', 'AGU; dispensa', '75'],
      [],
      ['', 'sem título'],
    ]);

    const result = await processExcelFile(buffer);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(1);
    expect(result.errors).toEqual(['Linha 3: Título é obrigatório']);
    expect(result.documents[0]).toMatchObject({
      title: 'Parecer X',
      category: 'parecer',
      courseId: '10',
      isPublic: true,
      tags: ['AGU', 'dispensa'],
      leiArticles: ['75'],
    });
  });

  it('exige a coluna Titulo no cabeçalho', async () => {
    const result = await processExcelFile(await buildWorkbook([['Nome', 'Descricao'], ['a', 'b']]));
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(['Coluna "Titulo" é obrigatória']);
  });

  it('planilha só com cabeçalho não tem dados', async () => {
    const result = await processExcelFile(await buildWorkbook([TEMPLATE_HEADERS]));
    expect(result.errors).toEqual(['Planilha não contém dados']);
  });

  it('arquivo .xls renomeado devolve erro de leitura claro', async () => {
    const result = await processExcelFile(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([`Erro ao processar arquivo: ${XLS_NOT_SUPPORTED_MESSAGE}`]);
  });
});
