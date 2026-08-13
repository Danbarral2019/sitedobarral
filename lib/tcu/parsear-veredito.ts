/**
 * Lê o texto que a folha de calibração exporta e devolve os julgamentos que
 * podem ser gravados.
 *
 * O tipo da linha é decidido pelo FORMATO dela, não pela seção em que aparece:
 * a seção é um cabeçalho que o julgador pode ter cortado ao copiar, enquanto
 * "/ divergência N" está na própria linha. Uma linha cujo veredito não pertence
 * ao seu tipo (um "fiel" numa divergência) não é corrigida por adivinhação —
 * volta em `invalidas` para o operador olhar, porque gravar julgamento errado
 * em nome do Daniel é pior que não gravar nada.
 */

export const VEREDITOS_CASO = ['fiel', 'imprecisa', 'errada'] as const;
export const VEREDITOS_DIVERGENCIA = ['procede', 'naoprocede'] as const;

export type VeredictoCaso = (typeof VEREDITOS_CASO)[number];
export type VeredictoDivergencia = (typeof VEREDITOS_DIVERGENCIA)[number];

export interface CasoJulgado {
  chave: string;
  veredito: VeredictoCaso;
}

export interface DivergenciaJulgada {
  chave: string;
  /** Índice no array de divergências (0-based); a folha exibe 1-based. */
  indice: number;
  veredito: VeredictoDivergencia;
}

export interface VereditoParseado {
  casos: CasoJulgado[];
  divergencias: DivergenciaJulgada[];
  pendentes: number;
  invalidas: string[];
}

const PENDENTE = '(pendente)';
const LINHA_DIVERGENCIA = /^\s*Acórdão\s+(\S+)\s*\/\s*divergência\s+(\d+)\s*:\s*(.+?)\s*$/;
const LINHA_CASO = /^\s*Acórdão\s+(\S+)\s*:\s*(.+?)\s*$/;

export function parsearVeredito(texto: string): VereditoParseado {
  const out: VereditoParseado = { casos: [], divergencias: [], pendentes: 0, invalidas: [] };

  for (const linha of texto.split(/\r?\n/)) {
    const div = LINHA_DIVERGENCIA.exec(linha);
    if (div) {
      const [, chave, indice, veredito] = div;
      if (veredito === PENDENTE) {
        out.pendentes++;
      } else if ((VEREDITOS_DIVERGENCIA as readonly string[]).includes(veredito)) {
        out.divergencias.push({
          chave,
          indice: Number(indice) - 1,
          veredito: veredito as VeredictoDivergencia,
        });
      } else {
        out.invalidas.push(linha);
      }
      continue;
    }

    const caso = LINHA_CASO.exec(linha);
    if (!caso) continue; // cabeçalho, linha em branco, título de seção
    const [, chave, veredito] = caso;
    if (veredito === PENDENTE) {
      out.pendentes++;
    } else if ((VEREDITOS_CASO as readonly string[]).includes(veredito)) {
      out.casos.push({ chave, veredito: veredito as VeredictoCaso });
    } else {
      out.invalidas.push(linha);
    }
  }

  return out;
}
