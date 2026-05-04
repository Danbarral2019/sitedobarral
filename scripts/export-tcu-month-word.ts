/**
 * Exporta acórdãos TCU julgados em determinado mês para um arquivo Word (.docx).
 *
 * Uso:
 *   npx tsx scripts/export-tcu-month-word.ts                  # mês anterior
 *   npx tsx scripts/export-tcu-month-word.ts 2026-04          # mês específico
 *
 * Output: tcu-acordaos-YYYY-MM.docx na raiz do projeto.
 */

import { prisma } from '../lib/prisma';
import {
  Document as DocxDoc,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
  ExternalHyperlink,
  PageBreak,
  TableOfContents,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

const MES_NOMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function parseMonth(arg: string | undefined): { ano: number; mes: number } {
  if (arg && /^\d{4}-\d{2}$/.test(arg)) {
    const [ano, mes] = arg.split('-').map(Number);
    return { ano, mes };
  }
  // default: mês anterior
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { ano: prev.getFullYear(), mes: prev.getMonth() + 1 };
}

function fmtDate(d: Date | null): string {
  if (!d) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

async function main() {
  const { ano, mes } = parseMonth(process.argv[2]);
  const start = new Date(Date.UTC(ano, mes - 1, 1));
  const end = new Date(Date.UTC(ano, mes, 1));
  const mesNome = MES_NOMES[mes - 1];

  console.log(`Buscando acórdãos julgados em ${mesNome}/${ano}...`);

  const docs = await prisma.document.findMany({
    where: {
      category: 'acordao',
      tcuNumeroAcordao: { not: null },
      tcuDataJulgamento: { gte: start, lt: end },
    },
    select: {
      tcuNumeroAcordao: true,
      tcuDataJulgamento: true,
      tcuRelator: true,
      tcuOrgaoJulgador: true,
      tcuArea: true,
      tcuTema: true,
      tcuSubtema: true,
      tcuEmentaCompleta: true,
      tcuLinkPDF: true,
      summary: true,
      description: true,
      title: true,
      url: true,
    },
    orderBy: [
      { tcuArea: 'asc' },
      { tcuTema: 'asc' },
      { tcuDataJulgamento: 'asc' },
    ],
  });

  console.log(`${docs.length} acórdãos encontrados`);

  // Agrupar: area -> tema -> [docs]
  const grupos = new Map<string, Map<string, typeof docs>>();
  const semClassificacao: typeof docs = [];

  for (const d of docs) {
    if (!d.tcuArea) {
      semClassificacao.push(d);
      continue;
    }
    const tema = d.tcuTema || '(sem tema)';
    if (!grupos.has(d.tcuArea)) grupos.set(d.tcuArea, new Map());
    const temasMap = grupos.get(d.tcuArea)!;
    if (!temasMap.has(tema)) temasMap.set(tema, []);
    temasMap.get(tema)!.push(d);
  }

  const areas = Array.from(grupos.keys()).sort();

  // Stats órgão julgador
  const porOrgao = new Map<string, number>();
  for (const d of docs) {
    const o = d.tcuOrgaoJulgador || 'Não informado';
    porOrgao.set(o, (porOrgao.get(o) || 0) + 1);
  }

  // === MONTAGEM DOCUMENTO ===
  const children: Paragraph[] = [];

  // CAPA
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 400 },
      children: [new TextRun({ text: 'Acórdãos do TCU', bold: true, size: 48 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: `${mesNome[0].toUpperCase()}${mesNome.slice(1)} de ${ano}`, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `${docs.length} decisões publicadas`, italics: true, size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 4800 },
      children: [new TextRun({ text: 'Site do Barral', size: 22, color: '666666' })],
    }),
  );

  // SUMÁRIO EXECUTIVO
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: 'Sumário executivo' })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: 'Total de acórdãos julgados: ', bold: true }),
        new TextRun({ text: `${docs.length}` }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: 'Distribuição por órgão julgador:', bold: true })],
    }),
  );
  for (const [o, n] of Array.from(porOrgao.entries()).sort((a, b) => b[1] - a[1])) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: `${o}: ${n} (${Math.round(n / docs.length * 100)}%)` })],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 300, after: 120 },
      children: [new TextRun({ text: 'Distribuição por área temática:', bold: true })],
    }),
  );
  for (const area of areas) {
    const total = Array.from(grupos.get(area)!.values()).reduce((s, ds) => s + ds.length, 0);
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun({ text: `${area}: `, bold: true }),
          new TextRun({ text: `${total} acórdão${total > 1 ? 's' : ''}` }),
        ],
      }),
    );
  }

  if (semClassificacao.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 200 },
        children: [
          new TextRun({ text: `${semClassificacao.length} acórdão(s) sem classificação editorial`, italics: true, color: '999999' }),
        ],
      }),
    );
  }

  // SEÇÕES POR ÁREA > TEMA
  for (const area of areas) {
    const temasMap = grupos.get(area)!;
    const totalArea = Array.from(temasMap.values()).reduce((s, ds) => s + ds.length, 0);

    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: `${area} (${totalArea})` })],
      }),
    );

    const temas = Array.from(temasMap.keys()).sort();
    for (const tema of temas) {
      const temaDocs = temasMap.get(tema)!;
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: [new TextRun({ text: `${tema} (${temaDocs.length})` })],
        }),
      );

      for (const d of temaDocs) {
        // Cabeçalho do acórdão
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 240, after: 80 },
            children: [
              new TextRun({ text: `Acórdão TCU nº ${d.tcuNumeroAcordao}`, bold: true }),
            ],
          }),
        );

        // Metadados
        const metaParts: string[] = [];
        if (d.tcuDataJulgamento) metaParts.push(`Data: ${fmtDate(d.tcuDataJulgamento)}`);
        if (d.tcuRelator) metaParts.push(`Relator: ${d.tcuRelator}`);
        if (d.tcuOrgaoJulgador) metaParts.push(`Órgão: ${d.tcuOrgaoJulgador}`);
        if (d.tcuSubtema) metaParts.push(`Subtema: ${d.tcuSubtema}`);

        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: metaParts.join(' | '), italics: true, size: 18, color: '555555' })],
          }),
        );

        // Resumo executivo (Gemini) ou ementa
        const texto = d.summary || d.tcuEmentaCompleta || d.description || '(sem resumo)';
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 100, line: 320 },
            children: [new TextRun({ text: texto })],
          }),
        );

        // Link
        const linkUrl = d.tcuLinkPDF || d.url;
        if (linkUrl && linkUrl !== '#') {
          children.push(
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Acórdão completo: ', size: 18, color: '555555' }),
                new ExternalHyperlink({
                  link: linkUrl,
                  children: [new TextRun({ text: linkUrl, size: 18, color: '0066CC', underline: {} })],
                }),
              ],
            }),
          );
        }
      }
    }
  }

  // Sem classificação (se houver)
  if (semClassificacao.length > 0) {
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: 'Sem classificação editorial' })],
      }),
    );
    for (const d of semClassificacao) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 80 },
          children: [new TextRun({ text: `Acórdão TCU nº ${d.tcuNumeroAcordao}`, bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100 },
          children: [new TextRun({ text: d.summary || d.tcuEmentaCompleta || d.description || '' })],
        }),
      );
    }
  }

  const doc = new DocxDoc({
    creator: 'Site do Barral',
    title: `Acórdãos TCU - ${mesNome}/${ano}`,
    description: `Decisões do Tribunal de Contas da União julgadas em ${mesNome} de ${ano}`,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
          paragraph: { spacing: { line: 280 } },
        },
      },
    },
    sections: [{
      properties: {},
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outName = `tcu-acordaos-${ano}-${String(mes).padStart(2, '0')}.docx`;
  const outPath = path.join(process.cwd(), outName);
  fs.writeFileSync(outPath, buffer);

  console.log(`\n✅ Arquivo gerado: ${outPath}`);
  console.log(`   ${docs.length} acórdãos | ${areas.length} áreas | ${(buffer.length / 1024).toFixed(1)} KB`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
