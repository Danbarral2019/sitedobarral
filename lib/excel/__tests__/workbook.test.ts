// @vitest-environment node
/**
 * Paridade do leitor/escritor em exceljs com o comportamento do SheetJS 0.18
 * (`xlsx`), removido por vulnerabilidades. Os valores esperados reproduzem o
 * que `XLSX.read` + `XLSX.utils.sheet_to_json` devolviam para as mesmas
 * planilhas (conferido lado a lado com o SheetJS na migração). As planilhas são
 * geradas aqui mesmo, sem fixtures binárias.
 */
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  decodeRange,
  encodeRange,
  jsonToAoa,
  readWorkbook,
  sheetToJson,
  writeWorkbook,
  XLS_NOT_SUPPORTED_MESSAGE,
} from '../workbook';

async function toBytes(workbook: ExcelJS.Workbook): Promise<Uint8Array> {
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** Planilha no formato da exportação de jurisprudência do TCU, com casos-limite. */
async function buildTcuLikeWorkbook(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Plan1');
  sheet.addRow(['Enunciado', ' Área ', 'Data', 'Num', null, 'Enunciado', 'Bool', 'Rich', 'Link', 'Form', 'Err', 'Texto data']);
  sheet.addRow([
    'texto 1',
    'Licitação',
    new Date(Date.UTC(2023, 4, 17)),
    42.5,
    null,
    'dup',
    true,
    { richText: [{ text: 'a' }, { font: { bold: true }, text: 'b' }] },
    { text: 'site', hyperlink: 'https://exemplo.gov.br' },
    { formula: '1+1', result: 2 },
    { error: '#N/A' },
    '17/05/2023',
  ]);
  sheet.addRow([]);
  sheet.addRow([
    'linha\ncom quebra',
    null,
    new Date(Date.UTC(2020, 0, 1, 13, 30)),
    0,
    null,
    null,
    false,
    null,
    null,
    { formula: 'A1', result: 'x' },
    { error: '#NULL!' },
    '',
  ]);
  sheet.getCell('C2').numFmt = 'dd/mm/yyyy';
  sheet.getCell('C4').numFmt = 'dd/mm/yyyy hh:mm';
  sheet.mergeCells('A6:B6');
  sheet.getCell('A6').value = 'mesclado';
  workbook.addWorksheet('Segunda').addRow(['x']);
  return toBytes(workbook);
}

describe('readWorkbook', () => {
  it('lista as abas na ordem e calcula o intervalo ocupado', async () => {
    const workbook = await readWorkbook(await buildTcuLikeWorkbook());

    expect(workbook.SheetNames).toEqual(['Plan1', 'Segunda']);
    expect(workbook.Sheets.Plan1['!ref']).toBe('A1:L6');
    expect(workbook.Sheets.Segunda['!ref']).toBe('A1');
  });

  it('recusa .xls (BIFF) com mensagem clara', async () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    await expect(readWorkbook(xls)).rejects.toThrow(XLS_NOT_SUPPORTED_MESSAGE);
  });

  it('recusa conteúdo que não é .xlsx (ex.: CSV renomeado)', async () => {
    const csv = new TextEncoder().encode('Titulo;Descricao\nA;B\n');
    await expect(readWorkbook(csv)).rejects.toThrow('O arquivo não é uma planilha .xlsx válida.');
  });

  it('aba sem células não tem intervalo e gera lista vazia', async () => {
    const source = new ExcelJS.Workbook();
    source.addWorksheet('Vazia');
    const workbook = await readWorkbook(await toBytes(source));

    expect(workbook.Sheets.Vazia['!ref']).toBeUndefined();
    expect(sheetToJson(workbook.Sheets.Vazia)).toEqual([]);
  });
});

describe('sheetToJson (paridade com XLSX.utils.sheet_to_json)', () => {
  it('cabeçalho da primeira linha, datas como Date (cellDates) e tipos preservados', async () => {
    const workbook = await readWorkbook(await buildTcuLikeWorkbook(), { cellDates: true });
    const rows = sheetToJson(workbook.Sheets.Plan1);

    // Linha vazia (3) descartada; célula mesclada escrava (B6) fica vazia.
    expect(rows).toHaveLength(3);
    const [first, second, third] = rows;

    // Cabeçalho sem trim (" Área "), vazio vira __EMPTY, repetido ganha _1.
    expect(Object.keys(first)).toEqual([
      'Enunciado', ' Área ', 'Data', 'Num', 'Enunciado_1', 'Bool', 'Rich', 'Link', 'Form', 'Texto data',
    ]);
    expect(first).toMatchObject({
      Enunciado: 'texto 1',
      ' Área ': 'Licitação',
      Num: 42.5,
      Enunciado_1: 'dup',
      Bool: true,
      Rich: 'ab',
      Link: 'site',
      Form: 2,
      'Texto data': '17/05/2023',
    });
    // #N/A é ignorado (sem chave), como no SheetJS.
    expect(first).not.toHaveProperty('Err');

    // Data: mesmo horário de parede da planilha, no fuso local.
    const data = first.Data as Date;
    expect(data).toBeInstanceOf(Date);
    expect([data.getFullYear(), data.getMonth(), data.getDate(), data.getHours()]).toEqual([2023, 4, 17, 0]);
    const dataHora = second.Data as Date;
    expect([dataHora.getFullYear(), dataHora.getMonth(), dataHora.getDate(), dataHora.getHours(), dataHora.getMinutes()])
      .toEqual([2020, 0, 1, 13, 30]);

    expect(second).toMatchObject({
      Enunciado: 'linha\ncom quebra',
      Num: 0,
      Bool: false,
      Form: 'x',
      Err: null, // #NULL! vira null
      'Texto data': '',
    });
    expect(second).not.toHaveProperty(' Área ');

    expect(third).toEqual({ Enunciado: 'mesclado' });
  });

  it('sem cellDates, data vira o número serial do Excel', async () => {
    const workbook = await readWorkbook(await buildTcuLikeWorkbook());
    const [first, second] = sheetToJson(workbook.Sheets.Plan1);

    expect(first.Data).toBe(45063);
    expect(second.Data as number).toBeCloseTo(43831.5625, 8);
  });

  it('cabeçalho fixo com range: 1 mapeia por posição e pula a primeira linha', async () => {
    const workbook = await readWorkbook(await buildTcuLikeWorkbook());
    const rows = sheetToJson(workbook.Sheets.Plan1, { header: ['titulo', 'descricao', 'categoria'], range: 1 });

    expect(rows).toEqual([
      { titulo: 'texto 1', descricao: 'Licitação', categoria: 45063 },
      { titulo: 'linha\ncom quebra', categoria: 43831.5625 },
      { titulo: 'mesclado' },
    ]);
  });

  it('mantém o número da linha em __rowNum__ (não enumerável)', async () => {
    const workbook = await readWorkbook(await buildTcuLikeWorkbook());
    const rows = sheetToJson(workbook.Sheets.Plan1);

    expect((rows[0] as { __rowNum__?: number }).__rowNum__).toBe(1);
    expect(Object.keys(rows[0])).not.toContain('__rowNum__');
  });

  it('aceita aba inexistente devolvendo lista vazia', () => {
    expect(sheetToJson(undefined)).toEqual([]);
  });
});

describe('jsonToAoa + writeWorkbook (paridade com json_to_sheet/aoa_to_sheet)', () => {
  it('cabeçalho na ordem das chaves, null como vazio e tipos preservados', async () => {
    const rows = [
      { Titulo: 'A', Data: new Date(2024, 1, 3), N: 3, Vazio: '', Nulo: null },
      { Titulo: 'B', Extra: true },
    ];
    const aoa = jsonToAoa(rows);
    expect(aoa[0]).toEqual(['Titulo', 'Data', 'N', 'Vazio', 'Nulo', 'Extra']);

    const bytes = await writeWorkbook([
      { name: 'Dados', rows: aoa, columnWidths: [50, 12] },
      { name: 'Stats', rows: [['Total:', 2], [''], ['x']] },
    ]);

    const check = new ExcelJS.Workbook();
    await check.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    expect(check.worksheets.map((ws) => ws.name)).toEqual(['Dados', 'Stats']);

    const dados = check.getWorksheet('Dados')!;
    expect(dados.getCell('A2').value).toBe('A');
    expect(dados.getCell('C2').value).toBe(3);
    expect(dados.getCell('D2').value).toBe('');
    expect(dados.getCell('E2').value).toBeNull();
    expect(dados.getCell('F3').value).toBe(true);
    expect(dados.getCell('B2').numFmt).toBe('m/d/yy');
    expect(dados.getColumn(1).width).toBe(50);
    expect(dados.getColumn(2).width).toBe(12);

    // A data gravada volta como o mesmo dia ao ser lida.
    const reread = await readWorkbook(bytes, { cellDates: true });
    const [linha] = sheetToJson(reread.Sheets.Dados);
    const data = linha.Data as Date;
    expect([data.getFullYear(), data.getMonth(), data.getDate()]).toEqual([2024, 1, 3]);
    const serial = sheetToJson((await readWorkbook(bytes)).Sheets.Dados)[0].Data;
    expect(serial).toBe(45325);

    const stats = sheetToJson(reread.Sheets.Stats, { header: ['a', 'b'] });
    expect(stats).toEqual([{ a: 'Total:', b: 2 }, { a: '' }, { a: 'x' }]);
  });

  it('header explícito vem antes das demais chaves', () => {
    expect(jsonToAoa([{ b: 1, z: 2 }], ['a', 'b'])).toEqual([['a', 'b', 'z'], [undefined, 1, 2]]);
  });
});

describe('decodeRange/encodeRange', () => {
  it('converte nos dois sentidos', () => {
    expect(decodeRange('A1:CV1000')).toEqual({ s: { r: 0, c: 0 }, e: { r: 999, c: 99 } });
    expect(decodeRange('B3')).toEqual({ s: { r: 2, c: 1 }, e: { r: 2, c: 1 } });
    expect(encodeRange({ s: { r: 0, c: 0 }, e: { r: 5, c: 27 } })).toBe('A1:AB6');
  });

  it('lança erro para intervalo inválido', () => {
    expect(() => decodeRange('1A')).toThrow();
    expect(() => decodeRange('A0')).toThrow();
  });
});
