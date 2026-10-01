/**
 * Descarta, byte a byte, os grupos RTF que só carregam dado binário (imagens,
 * objetos OLE, temas do Word) antes de o RTF chegar ao `rtf-parser`.
 *
 * Por quê: medido em 30/09/2026 nos acórdãos do TCU que falhavam, `\pict`
 * ocupava de 78% a 97% do arquivo (um RTF de 25 MB do Plenário tinha 24,9 MB
 * de imagem). Eram esses grupos que estouravam o teto de 20 MB do download e,
 * nos menores, a pilha do parser. O texto do acórdão fica todo fora deles.
 *
 * Funciona em fluxo (`push` por pedaço, `end` no fim), para o download não
 * precisar guardar o arquivo bruto inteiro: só o que sobra depois do filtro.
 * Respeita `\{`, `\}`, `\\` e `\binN` (N bytes crus, que podem conter chaves).
 */

/** Destinos cujo grupo inteiro é descartado. `*` marca o destino ignorável `\*\nome`. */
const DESTINOS_DESCARTADOS = new Set([
  'pict',
  '*shppict',
  'nonshppict',
  '*objdata',
  '*datastore',
  '*themedata',
  '*colorschememapping',
  '*blipuid',
]);

const BARRA = 0x5c;
const ABRE = 0x7b;
const FECHA = 0x7d;
const ASTERISCO = 0x2a;

const ehLetra = (c: number) => (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a);
const ehDigito = (c: number) => c >= 0x30 && c <= 0x39;

type Estado =
  | 'texto'
  | 'barra' // logo depois de `\`
  | 'palavra' // lendo as letras de uma control word
  | 'param' // lendo o parâmetro numérico de uma control word
  | 'bin'; // pulando os N bytes crus de `\binN`

export class FiltroGruposBinarios {
  private saida: Buffer[] = [];
  private bloco = Buffer.alloc(64 * 1024);
  private usado = 0;

  private estado: Estado = 'texto';
  private palavra = '';
  private param = '';
  private binRestante = 0;

  /** Profundidade de chaves no ponto atual. */
  private profundidade = 0;
  /** Profundidade do grupo que está sendo descartado; 0 = não está descartando. */
  private descartandoAte = 0;

  /**
   * Bytes de um `{` recém-aberto, retidos até saber se o grupo é descartável:
   * a decisão depende da primeira control word (`{\pict` ou `{\*\shppict`).
   */
  private pendente: number[] | null = null;
  /** Dentro do pendente: já viu `\*`. */
  private pendenteIgnoravel = false;

  /** Bytes brutos recebidos e bytes mantidos, para relatório. */
  bytesEntrada = 0;
  get bytesSaida(): number {
    return this.saida.reduce((s, b) => s + b.length, 0) + this.usado;
  }

  push(chunk: Buffer): void {
    this.bytesEntrada += chunk.length;
    for (let i = 0; i < chunk.length; i++) this.byte(chunk[i]);
  }

  end(): Buffer {
    if (this.pendente) this.soltarPendente();
    if (this.estado === 'palavra' || this.estado === 'param') this.fecharControlWord(-1);
    this.saida.push(this.bloco.subarray(0, this.usado));
    const r = Buffer.concat(this.saida);
    this.saida = [];
    this.usado = 0;
    return r;
  }

  private emitir(c: number): void {
    if (this.descartandoAte) return;
    if (this.pendente) {
      this.pendente.push(c);
      return;
    }
    if (this.usado === this.bloco.length) {
      this.saida.push(this.bloco);
      this.bloco = Buffer.alloc(this.bloco.length);
      this.usado = 0;
    }
    this.bloco[this.usado++] = c;
  }

  /** O grupo pendente não é descartável: devolve os bytes retidos à saída. */
  private soltarPendente(): void {
    const p = this.pendente!;
    this.pendente = null;
    this.pendenteIgnoravel = false;
    for (const c of p) this.emitir(c);
  }

  private byte(c: number): void {
    switch (this.estado) {
      case 'bin':
        this.emitir(c);
        if (--this.binRestante <= 0) this.estado = 'texto';
        return;

      case 'barra':
        if (ehLetra(c)) {
          this.palavra = String.fromCharCode(c);
          this.estado = 'palavra';
          this.emitir(c);
          return;
        }
        // Control symbol (`\{`, `\}`, `\\`, `\'`, `\*`...): não mexe na profundidade.
        this.emitir(c);
        this.estado = 'texto';
        // Pendente `{`, `\`, `*`: é o destino ignorável `{\*`.
        if (c === ASTERISCO && this.pendente && this.pendente.length === 3) {
          this.pendenteIgnoravel = true; // `{\*`
        } else if (this.pendente) {
          this.soltarPendente(); // `{\'e3...`: grupo de texto, não é destino
        }
        return;

      case 'palavra':
        if (ehLetra(c)) {
          this.palavra += String.fromCharCode(c);
          this.emitir(c);
          return;
        }
        if (ehDigito(c) || c === 0x2d /* - */) {
          this.param = String.fromCharCode(c);
          this.estado = 'param';
          this.emitir(c);
          return;
        }
        this.fecharControlWord(c);
        return;

      case 'param':
        if (ehDigito(c)) {
          this.param += String.fromCharCode(c);
          this.emitir(c);
          return;
        }
        this.fecharControlWord(c);
        return;

      case 'texto':
        this.texto(c);
        return;
    }
  }

  /** Terminou uma control word; `c` é o byte que a encerrou (-1 no fim do arquivo). */
  private fecharControlWord(c: number): void {
    const nome = this.palavra;
    const n = this.param ? parseInt(this.param, 10) : NaN;
    this.palavra = '';
    this.param = '';
    this.estado = 'texto';

    if (this.pendente) {
      const destino = (this.pendenteIgnoravel ? '*' : '') + nome;
      if (DESTINOS_DESCARTADOS.has(destino)) {
        // Descarta o grupo inteiro: o `{` e o que já foi retido somem.
        this.pendente = null;
        this.pendenteIgnoravel = false;
        this.descartandoAte = this.profundidade;
      } else {
        this.soltarPendente();
      }
    }

    const binario = nome === 'bin' && n > 0;
    // O espaço logo depois de uma control word é delimitador e pertence a ela.
    if (c === 0x20) {
      this.emitir(c);
      if (binario) this.iniciarBin(n);
      return;
    }
    if (binario) {
      this.iniciarBin(n);
      if (c >= 0) this.byte(c); // já é o primeiro byte cru
      return;
    }
    if (c >= 0) this.texto(c);
  }

  private iniciarBin(n: number): void {
    this.estado = 'bin';
    this.binRestante = n;
  }

  private texto(c: number): void {
    if (c === BARRA) {
      this.emitir(c);
      this.estado = 'barra';
      return;
    }
    if (c === ABRE) {
      if (this.pendente) this.soltarPendente(); // `{{`: o de fora não é destino
      this.profundidade++;
      if (!this.descartandoAte) {
        this.pendente = [c];
        this.pendenteIgnoravel = false;
      }
      return;
    }
    if (c === FECHA) {
      if (this.pendente) this.soltarPendente(); // `{}` vazio
      const fechando = this.profundidade;
      this.profundidade--;
      if (this.descartandoAte) {
        if (fechando === this.descartandoAte) this.descartandoAte = 0;
        return;
      }
      this.emitir(c);
      return;
    }
    // Quebra de linha logo após `{` ou `{\*` não decide nada: fica retida.
    if (this.pendente && (c === 0x0d || c === 0x0a)) {
      this.pendente.push(c);
      return;
    }
    if (this.pendente) this.soltarPendente();
    this.emitir(c);
  }
}

/** Atalho para um buffer já inteiro na memória. */
export function descartarGruposBinarios(buf: Buffer): Buffer {
  const f = new FiltroGruposBinarios();
  f.push(buf);
  return f.end();
}
