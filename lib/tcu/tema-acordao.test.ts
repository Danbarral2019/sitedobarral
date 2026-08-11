import { describe, it, expect } from 'vitest';
import { ehTema, naBase, temaDaAreaOficial, TEMAS, TEMAS_FORA_DA_BASE } from './tema-acordao';

describe('naBase', () => {
  it('mantém licitações e contratos na base', () => {
    expect(naBase('licitacoes-contratos')).toBe(true);
    expect(naBase('obras-engenharia')).toBe(true);
  });

  it('deixa pessoal fora da base', () => {
    expect(naBase('pessoal')).toBe(false);
  });

  it('trata desconhecido e ausente como fora da base', () => {
    // Default fechado: sem tema, não entra. O contrário reencheria a base de
    // pessoal por omissão, que é justamente o que o filtro existe para evitar.
    expect(naBase(null)).toBe(false);
    expect(naBase(undefined)).toBe(false);
    expect(naBase('')).toBe(false);
    expect(naBase('tema-que-nao-existe')).toBe(false);
  });

  it('só exclui o que está declarado em TEMAS_FORA_DA_BASE', () => {
    for (const t of Object.keys(TEMAS)) {
      expect(naBase(t)).toBe(!TEMAS_FORA_DA_BASE.includes(t as never));
    }
  });
});

describe('ehTema', () => {
  it('reconhece os blocos declarados e recusa o resto', () => {
    expect(ehTema('pessoal')).toBe(true);
    expect(ehTema('Pessoal')).toBe(false); // a chave é minúscula, sem acento
  });
});

describe('temaDaAreaOficial', () => {
  it('mapeia as áreas do TCU para os blocos daqui', () => {
    expect(temaDaAreaOficial('Licitação')).toBe('licitacoes-contratos');
    expect(temaDaAreaOficial('Contrato Administrativo')).toBe('licitacoes-contratos');
    expect(temaDaAreaOficial('Pessoal')).toBe('pessoal');
    expect(temaDaAreaOficial('Competência do TCU')).toBe('processo-controle');
  });

  it('tolera espaços em volta', () => {
    expect(temaDaAreaOficial('  Licitação ')).toBe('licitacoes-contratos');
  });

  it('devolve null para área ausente ou desconhecida — não chuta', () => {
    expect(temaDaAreaOficial(null)).toBeNull();
    expect(temaDaAreaOficial(undefined)).toBeNull();
    expect(temaDaAreaOficial('Área Nova do TCU')).toBeNull();
  });
});
