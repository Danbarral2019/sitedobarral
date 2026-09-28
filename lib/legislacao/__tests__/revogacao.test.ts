import { describe, it, expect } from 'vitest';
import { referenciaDoRevogador } from '../revogacao';

describe('referenciaDoRevogador', () => {
  it('lê tipo, número e ano da nota', () => {
    expect(referenciaDoRevogador('Revogado pelo Decreto nº 11.531, de 2023')).toEqual({ tipo: 'decreto', numero: '11.531', ano: 2023 });
    expect(referenciaDoRevogador('Revogado pela Medida Provisória nº 782, de 2017')).toEqual({ tipo: 'medida-provisoria', numero: '782', ano: 2017 });
    expect(referenciaDoRevogador('Revogada pela Lei nº 14.133, de 1º de abril de 2021')).toEqual({ tipo: 'lei', numero: '14.133', ano: 2021 });
  });
  it('nota livre ou ausente: nada', () => {
    expect(referenciaDoRevogador('Revogado parcialmente; ver texto compilado')).toBeNull();
    expect(referenciaDoRevogador(null)).toBeNull();
  });
});
