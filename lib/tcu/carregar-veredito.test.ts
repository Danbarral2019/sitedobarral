import { describe, it, expect } from 'vitest';
import { carregarVeredito } from './carregar-veredito';

const em = new Date('2026-07-20T12:00:00Z');
const anterior = (enunciado: string, veredito: string | null, id = 'a1') => ({
  id, enunciado, veredito, julgadoEm: veredito ? em : null, julgadoPor: veredito ? 'daniel' : null,
});

describe('carregarVeredito', () => {
  it('herda o veredito quando o texto e IDENTICO', () => {
    const r = carregarVeredito('A prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    // Shape completo de propósito: o fixture `anterior` não traz estado editorial,
    // então herdar o veredito também herda os defaults (publicado/vitrinePublica
    // false, sem retirada) — não só o veredito em si.
    expect(r).toEqual({
      veredito: 'fiel', herdadoDe: 'a1', julgadoEm: em, julgadoPor: 'daniel',
      publicado: false, vitrinePublica: false, retiradoEm: null, retiradoMotivo: null,
      reconferenciaPendente: false,
    });
  });

  it('NAO herda quando muda a pontuacao — redacao diferente e julgamento novo', () => {
    const r = carregarVeredito('A prescricao e de dez anos', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
    expect(r.herdadoDe).toBeNull();
  });

  it('NAO herda quando muda so o espacamento', () => {
    const r = carregarVeredito('A  prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
  });

  it('NAO herda quando muda so a caixa', () => {
    const r = carregarVeredito('a prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
  });

  it('herda veredito negativo tambem', () => {
    const r = carregarVeredito('Tese ruim.', [anterior('Tese ruim.', 'errada')]);
    expect(r.veredito).toBe('errada');
  });

  it('nao herda de um anterior que nunca foi julgado', () => {
    const r = carregarVeredito('Tese X.', [anterior('Tese X.', null)]);
    // Shape completo de propósito: sem par, o retorno é exatamente SEM_VEREDITO
    // — inclusive os quatro campos editoriais, todos em seu estado neutro.
    expect(r).toEqual({
      veredito: null, herdadoDe: null, julgadoEm: null, julgadoPor: null,
      publicado: false, vitrinePublica: false, retiradoEm: null, retiradoMotivo: null,
      reconferenciaPendente: false,
    });
  });

  it('acha o par correto entre varios anteriores', () => {
    const r = carregarVeredito('Segunda tese.', [
      anterior('Primeira tese.', 'fiel', 'a1'),
      anterior('Segunda tese.', 'imprecisa', 'a2'),
    ]);
    expect(r).toMatchObject({ veredito: 'imprecisa', herdadoDe: 'a2' });
  });

  it('sem anteriores, nasce sem veredito', () => {
    expect(carregarVeredito('Tese nova.', []).veredito).toBeNull();
  });

  it('com anteriores duplicados julgados, usa o primeiro', () => {
    const r = carregarVeredito('Tese.', [anterior('Tese.', 'fiel', 'a1'), anterior('Tese.', 'errada', 'a2')]);
    expect(r.herdadoDe).toBe('a1');
  });

  it('com duplicatas em que só o segundo foi julgado, herda o veredito dele', () => {
    // Se os dois `find` fossem colapsados num só (procurar por texto e parar
    // no primeiro match), este caso quebraria em silêncio: o primeiro
    // anterior (não julgado) venceria e o veredito do segundo se perderia.
    const r = carregarVeredito('Tese Y.', [
      anterior('Tese Y.', null, 'a1'),
      anterior('Tese Y.', 'fiel', 'a2'),
    ]);
    expect(r.veredito).toBe('fiel');
    expect(r.herdadoDe).toBe('a2');
  });

  it('com duplicatas em que só o segundo foi julgado, o estado editorial vem do primeiro', () => {
    // Companheiro do teste acima: mostra que o veredito e o estado editorial
    // podem vir de anteriores DIFERENTES no mesmo cenário — o veredito segue
    // o julgado (a2), mas publicado/vitrinePublica seguem o primeiro que
    // casar por texto (a1), julgado ou não.
    const r = carregarVeredito('Tese Y.', [
      { ...anterior('Tese Y.', null, 'a1'), publicado: true, vitrinePublica: true },
      { ...anterior('Tese Y.', 'fiel', 'a2'), publicado: false, vitrinePublica: false },
    ]);
    expect(r.publicado).toBe(true);
    expect(r.vitrinePublica).toBe(true);
    expect(r.veredito).toBe('fiel');
    expect(r.herdadoDe).toBe('a2');
  });

  it('enunciado retirado SEM veredito não ressuscita na redestilacao', () => {
    // `retirar-teses.ts` retira todos os enunciados da chave, tenham veredito
    // ou não. Se a herança editorial dependesse do veredito, o par não seria
    // encontrado, `retiradoEm` seria zerado e a tese voltaria ao ar (spec §5).
    const retiradoEm = new Date('2026-09-01T10:00:00Z');
    const r = carregarVeredito('Tese fora de escopo.', [
      {
        ...anterior('Tese fora de escopo.', null, 'a1'),
        retiradoEm,
        retiradoMotivo: 'materia estranha ao escopo do site',
      },
    ]);
    expect(r.retiradoEm).toEqual(retiradoEm);
    expect(r.retiradoMotivo).toBe('materia estranha ao escopo do site');
    // O veredito continua exigindo anterior julgado — só o estado editorial vem.
    expect(r.veredito).toBeNull();
    expect(r.herdadoDe).toBeNull();
  });

  it('estado editorial de enunciado publicado sem veredito também é herdado', () => {
    const r = carregarVeredito('Tese X.', [
      { ...anterior('Tese X.', null, 'a1'), publicado: true, vitrinePublica: true },
    ]);
    expect(r).toMatchObject({ publicado: true, vitrinePublica: true, veredito: null });
  });

  it('texto diferente não herda retirada — enunciado novo volta a fila', () => {
    const r = carregarVeredito('Tese reescrita.', [
      {
        ...anterior('Tese fora de escopo.', null, 'a1'),
        retiradoEm: new Date('2026-09-01T10:00:00Z'),
        retiradoMotivo: 'materia estranha',
      },
    ]);
    expect(r.retiradoEm).toBeNull();
    expect(r.retiradoMotivo).toBeNull();
  });
});

describe('carregarVeredito — nivel 2, texto diferente (spec §4.1)', () => {
  const julgado = {
    id: 'a9',
    enunciado: 'A prescricao e de dez anos.',
    veredito: 'fiel',
    julgadoEm: em,
    julgadoPor: 'daniel',
    publicado: true,
    vitrinePublica: true,
    retiradoEm: null,
    retiradoMotivo: null,
  };

  it('sem a opcao ligada, texto diferente continua NAO herdando nada', () => {
    const r = carregarVeredito('Redacao completamente outra.', [julgado]);
    expect(r.veredito).toBeNull();
    expect(r.reconferenciaPendente).toBe(false);
  });

  // O nivel 1 nao pode regredir: com texto identico, a vitrine CONTINUA
  // migrando. E a diferenca entre os dois niveis, e o fixture principal do
  // arquivo nao cobre isso porque nao traz estado editorial.
  it('com texto IDENTICO a vitrine continua migrando', () => {
    const r = carregarVeredito(julgado.enunciado, [julgado], { herdarComTextoDiferente: true });
    expect(r.vitrinePublica).toBe(true);
    expect(r.julgadoPor).toBe('daniel');
    expect(r.reconferenciaPendente).toBe(false);
  });

  it('com a opcao ligada, herda veredito e acervo mas NAO a vitrine', () => {
    const r = carregarVeredito('Redacao completamente outra.', [julgado], {
      herdarComTextoDiferente: true,
    });
    expect(r.veredito).toBe('fiel');
    expect(r.publicado).toBe(true);
    expect(r.vitrinePublica).toBe(false);
    expect(r.reconferenciaPendente).toBe(true);
  });

  // §4.3: dizer que o Daniel julgou um texto que ele nunca leu e a mesma
  // mentira que a etiqueta de lote conta hoje. O rastro fica em `herdadoDe`.
  it('nao atribui autoria a quem nao leu o texto novo', () => {
    const r = carregarVeredito('Redacao completamente outra.', [julgado], {
      herdarComTextoDiferente: true,
    });
    expect(r.julgadoPor).toBeNull();
    expect(r.julgadoEm).toBeNull();
    expect(r.herdadoDe).toBe('a9');
  });

  it('sem antecessor julgado, nao ha heranca nem pendencia', () => {
    const naoJulgado = { ...julgado, veredito: null, julgadoEm: null, julgadoPor: null };
    const r = carregarVeredito('Redacao completamente outra.', [naoJulgado], {
      herdarComTextoDiferente: true,
    });
    expect(r.veredito).toBeNull();
    expect(r.reconferenciaPendente).toBe(false);
  });

  // Sem pareamento por texto, a versao anterior fala com uma voz so. Se ela
  // tem vereditos divergentes, nao ha o que herdar sem adivinhar (spec §4.2).
  it('nao adivinha quando a versao anterior tem vereditos divergentes', () => {
    const outro = { ...julgado, id: 'a10', veredito: 'errada' };
    const r = carregarVeredito('Redacao completamente outra.', [julgado, outro], {
      herdarComTextoDiferente: true,
    });
    expect(r.veredito).toBeNull();
    expect(r.reconferenciaPendente).toBe(false);
  });

  // A §5 da spec anterior declara impossivel ressuscitar tese retirada. Sem
  // isto, mudar o texto a traria de volta — o mesmo buraco que a versao
  // anterior fechou para texto identico, aberto para texto diferente.
  it('a retirada sobrevive ao texto novo', () => {
    const retirado = {
      ...julgado,
      veredito: null,
      julgadoEm: null,
      julgadoPor: null,
      retiradoEm: em,
      retiradoMotivo: 'materia estranha',
    };
    const r = carregarVeredito('Redacao completamente outra.', [retirado], {
      herdarComTextoDiferente: true,
    });
    expect(r.retiradoEm).toEqual(em);
    expect(r.retiradoMotivo).toBe('materia estranha');
  });
});
