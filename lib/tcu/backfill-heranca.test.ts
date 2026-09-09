// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { planejarBackfill } from './backfill-heranca';

const em = new Date('2026-08-13T00:00:00Z');
const antecessorJulgado = {
  id: 'ant-1', enunciado: 'Antiga.', veredito: 'fiel',
  julgadoEm: em, julgadoPor: 'daniel',
  publicado: true, vitrinePublica: true, retiradoEm: null, retiradoMotivo: null,
};
const antecessorDeLote = { ...antecessorJulgado, id: 'ant-2', julgadoPor: 'danbarral:lote-confianca-alta' };

describe('planejarBackfill', () => {
  // Primeiro movimento: os 3 acórdãos que sumiram (spec §7).
  it('herda para enunciado vigente SEM veredito', () => {
    const r = planejarBackfill([{
      vigentes: [{ id: 'novo-1', enunciado: 'Nova.', veredito: null }],
      anteriores: [antecessorJulgado],
    }]);
    expect(r.herdar).toEqual([
      { enunciadoId: 'novo-1', veredito: 'fiel', publicado: true, herdadoDe: 'ant-1' },
    ]);
    expect(r.marcar).toEqual([]);
  });

  // Segundo movimento: os 6 carimbados pelo lote (spec §7). Nada sai do ar —
  // o veredito de lote fica, e a pendencia torna visivel o que estava oculto.
  it('apenas marca quando o vigente ja tem veredito e o antecessor foi conferido', () => {
    const r = planejarBackfill([{
      vigentes: [{ id: 'novo-2', enunciado: 'Nova.', veredito: 'fiel' }],
      anteriores: [antecessorJulgado],
    }]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual(['novo-2']);
  });

  // Antecessor de lote nao e conferencia individual: marcar seria ruido.
  it('nao marca quando o antecessor tambem era de lote', () => {
    const r = planejarBackfill([{
      vigentes: [{ id: 'novo-3', enunciado: 'Nova.', veredito: 'fiel' }],
      anteriores: [antecessorDeLote],
    }]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual([]);
  });

  // O backfill nao pode inventar onde a regra da Task 1 se recusa a decidir.
  it('nao herda quando a versao anterior tem vereditos divergentes', () => {
    const r = planejarBackfill([{
      vigentes: [{ id: 'novo-4', enunciado: 'Nova.', veredito: null }],
      anteriores: [antecessorJulgado, { ...antecessorJulgado, id: 'ant-3', veredito: 'errada' }],
    }]);
    expect(r.herdar).toEqual([]);
  });

  // Texto identico ja e tratado pela redestilacao (nivel 1); o backfill nao
  // tem o que fazer, e marcar seria pendencia falsa.
  it('ignora enunciado cujo texto e identico ao do antecessor', () => {
    const r = planejarBackfill([{
      vigentes: [{ id: 'novo-5', enunciado: 'Antiga.', veredito: 'fiel' }],
      anteriores: [antecessorJulgado],
    }]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual([]);
  });
});
