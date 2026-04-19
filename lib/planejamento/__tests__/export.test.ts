import { describe, it, expect } from "vitest";
import { buildAST } from "../export/from-document";
import { renderHtmlSei } from "../export/renderers/html-sei";
import { renderPncpMetadata } from "../export/renderers/pncp-metadata";
import { servicoComumContinuadoEtp } from "@/data/planejamento/trails/servico-comum-continuado/etp";

describe("export/from-document.buildAST", () => {
  const session = {
    id: "sess-1",
    titulo: "Limpeza - Edifício Central",
    natureza: "SERVICO_CONTINUADO",
  };
  const sectionsFixture = [
    {
      sectionKey: "descricao-necessidade",
      ordem: 1,
      status: "CONFIRMED",
      contentMd:
        "A contratação visa suprir demanda recorrente de limpeza e conservação.\n\nOs quantitativos refletem série histórica de 2024-2026.",
      justificationSkipped: null,
      sourcesJson: JSON.stringify([
        { title: "Art. 18 - Lei 14.133", url: "/x" },
      ]),
    },
    {
      sectionKey: "contratacoes-correlatas",
      ordem: 8,
      status: "SKIPPED_WITH_JUSTIFICATION",
      contentMd: "",
      justificationSkipped: "Não há contratações correlatas no órgão.",
      sourcesJson: null,
    },
  ];

  it("converte seções confirmadas em blocos de parágrafo + citações", () => {
    const ast = buildAST({
      session,
      document: { type: "ETP", sections: sectionsFixture },
      trail: servicoComumContinuadoEtp,
    });

    expect(ast.kind).toBe("ETP");
    expect(ast.title).toBe(session.titulo);
    const s1 = ast.sections.find((s) => s.ordem === 1)!;
    const paragraphs = s1.blocks.filter((b) => b.type === "paragraph");
    expect(paragraphs.length).toBe(2);
    const footer = s1.blocks.find((b) => b.type === "citations-footer");
    expect(footer).toBeDefined();
    if (footer && footer.type === "citations-footer") {
      expect(footer.items[0].label).toBe("Art. 18 - Lei 14.133");
    }
  });

  it("propaga dispensa com justificativa como paragraph + skipped", () => {
    const ast = buildAST({
      session,
      document: { type: "ETP", sections: sectionsFixture },
      trail: servicoComumContinuadoEtp,
    });
    const s8 = ast.sections.find((s) => s.ordem === 8)!;
    expect(s8.skipped?.justification).toContain("Não há contratações");
    const first = s8.blocks[0];
    expect(first.type).toBe("paragraph");
  });

  it("AST sem decisão quando a sessão não executou a matriz", () => {
    const ast = buildAST({
      session,
      document: { type: "ETP", sections: sectionsFixture },
      trail: servicoComumContinuadoEtp,
    });
    expect(ast.decision).toBeUndefined();
  });
});

describe("export/renderers", () => {
  const session = {
    id: "sess-1",
    titulo: "Limpeza",
    natureza: "SERVICO_CONTINUADO",
  };
  const ast = buildAST({
    session,
    document: {
      type: "ETP",
      sections: [
        {
          sectionKey: "descricao-necessidade",
          ordem: 1,
          status: "CONFIRMED",
          contentMd: "Parágrafo de teste com <script> tag maliciosa.",
          justificationSkipped: null,
          sourcesJson: null,
        },
      ],
    },
    trail: servicoComumContinuadoEtp,
    decisionRun: null,
  });

  it("html-sei escapa HTML e inclui estilos inline", () => {
    const html = renderHtmlSei(ast);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("font-family:");
    expect(html).toContain("#20364e");
    expect(html).toMatch(/<h1 style=/);
    expect(html).toMatch(/<h2 style=/);
  });

  it("pncp-metadata gera JSON com schema e seções", () => {
    const buf = renderPncpMetadata(ast);
    const parsed = JSON.parse(buf.toString("utf8"));
    expect(parsed.schema).toBe("barral-planejamento-pncp/v1");
    expect(parsed.documento.tipo).toBe("ETP");
    expect(parsed.secoes[0].ordem).toBe(1);
    expect(parsed.secoes[0].fundamentos.length).toBeGreaterThan(0);
  });
});
