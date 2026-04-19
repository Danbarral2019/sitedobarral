/**
 * Renderer .docx a partir da AST. Usa a biblioteca `docx@^9`.
 * Estilo segue identidade brand: headings em azul petróleo Cinzel, corpo
 * Poppins (quando o Word tiver instalado; senão, a fonte padrão preserva o
 * tamanho e cor).
 */
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  ExternalHyperlink,
} from "docx";
import type { ASTDocument, ASTSection } from "../ast";

const BRAND_HEX = "20364E";
const TEXT_HEX = "1F2937";
const MUTED_HEX = "6B7280";

export async function renderDocx(doc: ASTDocument): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: doc.title,
          bold: true,
          font: "Cinzel",
          size: 44, // half-points → 22pt
          color: BRAND_HEX,
        }),
      ],
    }),
  );
  if (doc.subtitle) {
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `${doc.kind} · ${doc.subtitle}`,
            font: "Poppins",
            size: 18,
            color: MUTED_HEX,
            italics: true,
          }),
        ],
      }),
    );
  }

  if (doc.decision) {
    children.push(heading2("Modalidade e critério de julgamento"));
    children.push(
      body(
        [
          { text: "Modalidade: ", bold: true },
          { text: `${doc.decision.modalidade}. ` },
          { text: "Critério: ", bold: true },
          { text: `${doc.decision.criterio}.` },
        ],
      ),
    );
    children.push(body([{ text: doc.decision.rationale }]));
    children.push(
      meta(`Fundamento: ${doc.decision.citations.join("; ")}.`),
    );
  }

  for (const s of doc.sections) {
    renderSection(children, s);
  }

  const document = new Document({
    creator: "Sistema Planejamento — Prof. Daniel Barral",
    title: doc.title,
    description: doc.subtitle ?? "",
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

function renderSection(children: Paragraph[], s: ASTSection) {
  children.push(heading2(`${s.ordem}. ${s.title}`));
  if (s.anchors.length > 0) {
    children.push(meta(s.anchors.join(" · ")));
  }
  if (s.statusNote) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: s.statusNote,
            italics: true,
            font: "Poppins",
            size: 18,
            color: BRAND_HEX,
          }),
        ],
      }),
    );
  }
  for (const b of s.blocks) {
    if (b.type === "paragraph") {
      children.push(body([{ text: b.text }]));
    } else if (b.type === "citations-footer") {
      children.push(meta(`${b.label}:`));
      for (const item of b.items) {
        if (item.url) {
          children.push(
            new Paragraph({
              spacing: { after: 60 },
              indent: { left: 360 },
              children: [
                new ExternalHyperlink({
                  link: item.url,
                  children: [
                    new TextRun({
                      text: `• ${item.label}`,
                      font: "Poppins",
                      size: 20,
                      color: BRAND_HEX,
                      underline: {},
                    }),
                  ],
                }),
              ],
            }),
          );
        } else {
          children.push(
            new Paragraph({
              spacing: { after: 60 },
              indent: { left: 360 },
              children: [
                new TextRun({
                  text: `• ${item.label}`,
                  font: "Poppins",
                  size: 20,
                  color: TEXT_HEX,
                }),
              ],
            }),
          );
        }
      }
    }
  }
}

function heading2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 120 },
    children: [
      new TextRun({
        text,
        font: "Cinzel",
        bold: true,
        size: 28,
        color: BRAND_HEX,
      }),
    ],
  });
}
function body(runs: Array<{ text: string; bold?: boolean }>) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 340 },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold,
          font: "Poppins",
          size: 22,
          color: TEXT_HEX,
        }),
    ),
  });
}
function meta(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        font: "Poppins",
        size: 18,
        color: MUTED_HEX,
      }),
    ],
  });
}
