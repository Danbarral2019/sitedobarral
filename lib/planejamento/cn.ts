/**
 * Mini helper de concatenação de classes, sem dependências externas.
 * Aceita strings, undefined/false/null (ignorados) e objetos {classe: bool}.
 */
type ClassInput =
  | string
  | number
  | false
  | null
  | undefined
  | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassInput[]): string {
  const out: string[] = [];
  for (const it of inputs) {
    if (!it) continue;
    if (typeof it === "string" || typeof it === "number") {
      out.push(String(it));
    } else if (typeof it === "object") {
      for (const [key, val] of Object.entries(it)) {
        if (val) out.push(key);
      }
    }
  }
  return out.join(" ");
}
