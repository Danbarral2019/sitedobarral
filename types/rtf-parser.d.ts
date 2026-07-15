declare module 'rtf-parser' {
  /** Span de texto dentro de um parágrafo. */
  interface RtfSpan {
    value?: string;
  }
  /** Parágrafo do documento. */
  interface RtfParagraph {
    content?: RtfSpan[];
  }
  interface RtfDoc {
    content: RtfParagraph[];
  }
  /** Parseia RTF a partir de string (a lib é callback-based). */
  export function string(
    rtf: string,
    cb: (err: Error | null, doc: RtfDoc) => void
  ): void;
}
