// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validarAtualizacaoAutomatica } from '../../lib/legislative-scrapers/validate-content';

const ATO = `INSTRUÇÃO NORMATIVA Nº 5, DE 26 DE MAIO DE 2017

Dispõe sobre as regras e diretrizes do procedimento de contratação de serviços.

O SECRETÁRIO DE GESTÃO DO MINISTÉRIO DO PLANEJAMENTO, no uso das atribuições que lhe confere o Decreto nº 9.035, de 20 de abril de 2017, resolve:

Art. 1º As contratações de serviços observarão, no que couber, as fases de Planejamento, Seleção e Gestão.

Art. 2º Para os efeitos desta Instrução Normativa são adotadas as definições constantes do Anexo I.
`;

describe('validarAtualizacaoAutomatica', () => {
  it('aceita texto novo de tamanho parecido', () => {
    const anterior = ATO.repeat(4);
    const r = validarAtualizacaoAutomatica({ content: ATO.repeat(4) + 'Art. 3º Nova redação.', previousContent: anterior });
    expect(r.ok).toBe(true);
  });

  it('bloqueia texto novo com menos da metade do anterior e diz que mantém o antigo', () => {
    const r = validarAtualizacaoAutomatica({ content: ATO.repeat(2), previousContent: ATO.repeat(6) });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/33% do anterior.*mantido o texto anterior/);
  });

  it('não compara com texto anterior curto ou ausente', () => {
    expect(validarAtualizacaoAutomatica({ content: ATO.repeat(3), previousContent: 'curto' }).ok).toBe(true);
    expect(validarAtualizacaoAutomatica({ content: ATO.repeat(3), previousContent: null }).ok).toBe(true);
  });

  it('mantém os erros da validação comum (página de FAQ, texto vazio)', () => {
    expect(
      validarAtualizacaoAutomatica({ url: 'https://www.gov.br/x/perguntas-frequentes/in-5', content: ATO.repeat(3) }).ok,
    ).toBe(false);
    expect(validarAtualizacaoAutomatica({ content: '', previousContent: ATO.repeat(3) }).ok).toBe(false);
  });
});
