import { describe, it, expect } from 'vitest';
import { selectSourceText } from '../source-text';

describe('selectSourceText', () => {
  it('usa content quando presente (prioridade máxima)', () => {
    const doc = { content: 'Texto integral', tcuEmentaCompleta: 'EMENTA', description: 'resumo IA' };
    expect(selectSourceText(doc)).toBe('Texto integral');
  });

  it('usa a ementa oficial quando content vazio (acórdão TCU)', () => {
    const doc = { content: null, tcuEmentaCompleta: 'REPRESENTAÇÃO. LICITAÇÃO. EMENTA OFICIAL.', description: 'resumo gerado por IA' };
    expect(selectSourceText(doc)).toBe('REPRESENTAÇÃO. LICITAÇÃO. EMENTA OFICIAL.');
  });

  it('cai para description quando não há content nem ementa oficial', () => {
    const doc = { content: null, tcuEmentaCompleta: null, description: 'resumo IA' };
    expect(selectSourceText(doc)).toBe('resumo IA');
  });

  it('ignora candidatos só com espaços em branco', () => {
    const doc = { content: '   ', tcuEmentaCompleta: '', description: 'conteúdo real' };
    expect(selectSourceText(doc)).toBe('conteúdo real');
  });

  it('retorna string vazia quando nenhum campo tem conteúdo', () => {
    expect(selectSourceText({ content: null, tcuEmentaCompleta: null, description: null })).toBe('');
  });
});
