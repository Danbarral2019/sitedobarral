import { describe, it, expect } from 'vitest';
import { ATO_VISIVEL, atoVisivelSql } from '../visibilidade';

describe('visibilidade dos atos', () => {
  it('oculta só o revogado que não é de consulta corrente', () => {
    expect(ATO_VISIVEL).toEqual({ NOT: { revoked: true, revokedVisible: false } });
  });
  it('predicado SQL, com e sem alias', () => {
    expect(atoVisivelSql()).toBe('NOT ("revoked" AND NOT "revokedVisible")');
    expect(atoVisivelSql('la')).toBe('NOT (la."revoked" AND NOT la."revokedVisible")');
  });
});
