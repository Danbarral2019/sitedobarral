import { describe, it, expect } from 'vitest';
import { parseVerdict } from '../judge';

describe('parseVerdict', () => {
  it('parseia JSON puro', () => {
    const v = parseVerdict('{"faithfulness":1,"citationAccuracy":1,"completeness":1,"issues":[],"rationale":"ok"}');
    expect(v.faithfulness).toBe(1);
    expect(v.overall).toBe(1);
    expect(v.rationale).toBe('ok');
  });

  it('tolera cercas ```json', () => {
    const text = '```json\n{"faithfulness":0.8,"citationAccuracy":0.6,"completeness":0.4,"issues":["x"],"rationale":"y"}\n```';
    const v = parseVerdict(text);
    expect(v.faithfulness).toBe(0.8);
    expect(v.issues).toEqual(['x']);
  });

  it('extrai o objeto quando há texto ao redor', () => {
    const text = 'Aqui está: {"faithfulness":0.5,"citationAccuracy":0.5,"completeness":0.5} fim';
    const v = parseVerdict(text);
    expect(v.faithfulness).toBe(0.5);
    expect(v.issues).toEqual([]);
    expect(v.rationale).toBe('');
  });

  it('faz clamp de valores fora de 0..1', () => {
    const v = parseVerdict('{"faithfulness":1.5,"citationAccuracy":-0.3,"completeness":2}');
    expect(v.faithfulness).toBe(1);
    expect(v.citationAccuracy).toBe(0);
    expect(v.completeness).toBe(1);
  });

  it('overall pondera fidelidade e citações (peso 2) acima de completude', () => {
    // f=1, c=1, compl=0 → (2+2+0)/5 = 0.8
    const v = parseVerdict('{"faithfulness":1,"citationAccuracy":1,"completeness":0}');
    expect(v.overall).toBe(0.8);
    // f=0, c=0, compl=1 → 1/5 = 0.2
    const v2 = parseVerdict('{"faithfulness":0,"citationAccuracy":0,"completeness":1}');
    expect(v2.overall).toBe(0.2);
  });

  it('trata campos ausentes/inválidos como 0 / vazio', () => {
    const v = parseVerdict('{"rationale":"só isso"}');
    expect(v.faithfulness).toBe(0);
    expect(v.overall).toBe(0);
    expect(v.issues).toEqual([]);
    expect(v.rationale).toBe('só isso');
  });
});
