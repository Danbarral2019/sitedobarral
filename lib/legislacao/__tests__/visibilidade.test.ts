import { describe, it, expect } from 'vitest';
import { ATO_VISIVEL, atoVisivelSql, ressalvaDeRevogacao, ressalvaDeRevogacaoSql } from '../visibilidade';

describe('visibilidade dos atos', () => {
  it('oculta só o revogado que não é de consulta corrente', () => {
    expect(ATO_VISIVEL).toEqual({ NOT: { revoked: true, revokedVisible: false } });
  });
  it('predicado SQL, com e sem alias', () => {
    expect(atoVisivelSql()).toBe('NOT ("revoked" AND NOT "revokedVisible")');
    expect(atoVisivelSql('la')).toBe('NOT (la."revoked" AND NOT la."revokedVisible")');
  });
});

describe('ressalva de revogação', () => {
  it('vazia para ato vigente; com a nota, sem ponto duplicado', () => {
    expect(ressalvaDeRevogacao(false, 'Revogada pela Lei nº 14.133, de 2021')).toBe('');
    expect(ressalvaDeRevogacao(true, 'Revogada pela Lei nº 14.133, de 2021.')).toBe(
      '[Ato revogado: Revogada pela Lei nº 14.133, de 2021.] ',
    );
    expect(ressalvaDeRevogacao(true, null)).toBe('[Ato revogado.] ');
    expect(ressalvaDeRevogacao(true, '  ')).toBe('[Ato revogado.] ');
  });
  it('SQL usa o alias e termina em quebra de linha', () => {
    const sql = ressalvaDeRevogacaoSql('la');
    expect(sql).toContain('la."revoked"');
    expect(sql).toContain('la."revokedNote"');
    expect(sql).toContain("E'\\n'");
  });
});
