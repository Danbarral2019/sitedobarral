/**
 * Renderer HTML compatível com o editor rich-text do SEI.
 *
 * Regras adotadas:
 *  - Tudo em <p>, <h1>, <h2>, <h3> e <ul> — o editor do SEI aceita essas tags
 *    confiavelmente e preserva estilos inline (font-family, color).
 *  - Estilos vão inline porque o SEI não aceita <style> nem classes.
 *  - Ausência de <table>, <img>, <script> (não-suportados ou riscosos).
 *  - Cores brand: #20364e (headings), #1f2937 (texto), #6b7280 (meta).
 */
import type { ASTDocument, ASTSection } from "../ast";

const BRAND = "#20364e";
const TEXT = "#1f2937";
const MUTED = "#6b7280";
const CHIP_BG = "#f3f4f6";

const FONT_HEADINGS =
  "Cinzel, Georgia, 'Times New Roman', serif";
const FONT_BODY = "Poppins, 'Segoe UI', Arial, sans-serif";

export function renderHtmlSei(doc: ASTDocument): string {
  const parts: string[] = [];

  parts.push(
    `<h1 style="${h1Style()}">${escape(doc.title)}</h1>`,
  );
  if (doc.subtitle) {
    parts.push(
      `<p style="${metaStyle()}"><strong>${escape(doc.kind)}</strong> · ${escape(doc.subtitle)}</p>`,
    );
  } else {
    parts.push(`<p style="${metaStyle()}">${escape(doc.kind)}</p>`);
  }

  if (doc.decision) {
    parts.push(
      `<h2 style="${h2Style()}">Modalidade e critério de julgamento</h2>`,
      `<p style="${bodyStyle()}"><strong>Modalidade:</strong> ${escape(doc.decision.modalidade)}. <strong>Critério:</strong> ${escape(doc.decision.criterio)}.</p>`,
      `<p style="${bodyStyle()}">${escape(doc.decision.rationale)}</p>`,
      `<p style="${metaStyle()}">Fundamento: ${doc.decision.citations.map((c) => escape(c)).join("; ")}.</p>`,
    );
  }

  for (const s of doc.sections) {
    parts.push(renderSection(s));
  }

  return parts.join("\n");
}

function renderSection(s: ASTSection): string {
  const out: string[] = [];
  out.push(
    `<h2 style="${h2Style()}">${s.ordem}. ${escape(s.title)}</h2>`,
  );
  if (s.anchors.length > 0) {
    out.push(
      `<p style="${metaStyle()}">${s.anchors.map((a) => chip(a)).join(" ")}</p>`,
    );
  }
  if (s.statusNote) {
    out.push(`<p style="${noteStyle()}">${escape(s.statusNote)}</p>`);
  }
  for (const b of s.blocks) {
    if (b.type === "paragraph") {
      out.push(`<p style="${bodyStyle()}">${escape(b.text)}</p>`);
    } else if (b.type === "citations-footer") {
      const items = b.items
        .map((i) =>
          i.url
            ? `<li style="${liStyle()}"><a href="${attr(i.url)}" style="color:${BRAND};">${escape(i.label)}</a></li>`
            : `<li style="${liStyle()}">${escape(i.label)}</li>`,
        )
        .join("");
      out.push(
        `<p style="${metaStyle()}"><em>${escape(b.label)}:</em></p>`,
        `<ul style="${ulStyle()}">${items}</ul>`,
      );
    }
  }
  return out.join("\n");
}

// ---------- styles ----------

function h1Style() {
  return [
    `font-family:${FONT_HEADINGS};`,
    `font-size:22pt;`,
    `color:${BRAND};`,
    `margin:0 0 4pt 0;`,
  ].join("");
}
function h2Style() {
  return [
    `font-family:${FONT_HEADINGS};`,
    `font-size:14pt;`,
    `color:${BRAND};`,
    `margin:18pt 0 4pt 0;`,
  ].join("");
}
function bodyStyle() {
  return [
    `font-family:${FONT_BODY};`,
    `font-size:11pt;`,
    `line-height:1.55;`,
    `color:${TEXT};`,
    `text-align:justify;`,
    `margin:0 0 8pt 0;`,
  ].join("");
}
function metaStyle() {
  return [
    `font-family:${FONT_BODY};`,
    `font-size:9pt;`,
    `color:${MUTED};`,
    `margin:0 0 4pt 0;`,
  ].join("");
}
function noteStyle() {
  return [
    `font-family:${FONT_BODY};`,
    `font-size:9pt;`,
    `color:${BRAND};`,
    `font-style:italic;`,
    `margin:0 0 6pt 0;`,
  ].join("");
}
function ulStyle() {
  return [`margin:0 0 8pt 18pt;`, `padding:0;`].join("");
}
function liStyle() {
  return [
    `font-family:${FONT_BODY};`,
    `font-size:10pt;`,
    `color:${TEXT};`,
    `margin:0 0 2pt 0;`,
  ].join("");
}

function chip(label: string) {
  return `<span style="display:inline-block;background:${CHIP_BG};color:${TEXT};padding:1pt 6pt;border-radius:8pt;font-size:8pt;margin-right:4pt;">${escape(label)}</span>`;
}

// ---------- safety ----------

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function attr(s: string): string {
  return escape(s).replace(/\n/g, " ");
}
