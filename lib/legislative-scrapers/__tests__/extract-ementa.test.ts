import { describe, it, expect } from 'vitest';
import { extractEmenta, looksLikeDefectiveEmenta } from '../extract-ementa';

const MP_ABSTRACT =
  'MEDIDA PROVISÓRIA Nº 1.303, DE 11 DE JUNHO DE 2025 Dispõe sobre a tributação de aplicações financeiras e ativos virtuais no País; e altera a Lei nº 10.892, de 13 de julho de 2004. O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere o art. 62 da Constituição, adota a seguinte Medida Provisória, com força de lei: Art. 1º Esta Medida...';

const PLANALTO_MP = `Presidência da República
Casa Civil
Secretaria Especial para Assuntos Jurídicos

MEDIDA PROVISÓRIA Nº 1.303, DE 11 DE JUNHO DE 2025

Exposição de motivos
Vigência
Produção de efeitos

Dispõe sobre a tributação de aplicações financeiras e ativos virtuais no País.

O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere o art. 62 da Constituição, adota a seguinte Medida Provisória, com força de lei:

Art. 1º Esta Medida Provisória dispõe sobre...`;

const PORTARIA_DOU = `PORTARIA SEGES/MGI Nº 8, DE 3 DE MAIO DE 2026

Atualiza os procedimentos de pesquisa de preços para aquisição de bens e contratação de serviços.

A SECRETÁRIA DE GESTÃO E INOVAÇÃO DO MINISTÉRIO DA GESTÃO E DA INOVAÇÃO EM SERVIÇOS PÚBLICOS, no uso das atribuições que lhe conferem o art. 23 da Lei nº 14.133, resolve:

Art. 1º Esta Portaria...`;

describe('extractEmenta', () => {
  it('recorta a ementa do abstract do DOU (epígrafe + ementa + preâmbulo)', () => {
    expect(extractEmenta(MP_ABSTRACT)).toEqual({
      ementa:
        'Dispõe sobre a tributação de aplicações financeiras e ativos virtuais no País; e altera a Lei nº 10.892, de 13 de julho de 2004.',
      complete: true,
    });
  });

  it('ignora cabeçalho institucional e anotações laterais do Planalto', () => {
    expect(extractEmenta(PLANALTO_MP)?.ementa).toBe(
      'Dispõe sobre a tributação de aplicações financeiras e ativos virtuais no País.',
    );
  });

  it('encerra no preâmbulo de autoridade que não é o Presidente', () => {
    expect(extractEmenta(PORTARIA_DOU)?.ementa).toBe(
      'Atualiza os procedimentos de pesquisa de preços para aquisição de bens e contratação de serviços.',
    );
  });

  it('marca como incompleto o trecho truncado antes do preâmbulo', () => {
    const r = extractEmenta('MEDIDA PROVISÓRIA Nº 1.303, DE 11 DE JUNHO DE 2025 Dispõe sobre a tributação de aplicações financeiras e...');
    expect(r).toEqual({
      ementa: 'Dispõe sobre a tributação de aplicações financeiras e',
      complete: false,
    });
  });

  it('não confunde "art. 1º" minúsculo dentro da ementa com o articulado', () => {
    const r = extractEmenta(
      'DECRETO Nº 12.000, DE 1º DE ABRIL DE 2026 Altera o art. 1º do Decreto nº 11.462, de 31 de março de 2023. O PRESIDENTE DA REPÚBLICA, no uso...',
    );
    expect(r?.ementa).toBe('Altera o art. 1º do Decreto nº 11.462, de 31 de março de 2023.');
  });

  it('retorna null sem epígrafe nem preâmbulo, ou quando só sobra artigo', () => {
    expect(extractEmenta('Texto qualquer sem estrutura de ato normativo reconhecível')).toBeNull();
    expect(extractEmenta('LEI Nº 1, DE 1 DE JANEIRO DE 2000 Art. 1º Fica...')).toBeNull();
    expect(extractEmenta(null)).toBeNull();
  });
});

describe('looksLikeDefectiveEmenta', () => {
  it('detecta abstract do DOU gravado como ementa', () => {
    expect(looksLikeDefectiveEmenta(MP_ABSTRACT)).toBe(true);
  });

  it('detecta título repetido e reticências', () => {
    const title = 'MEDIDA PROVISÓRIA Nº 1.303, DE 11 DE JUNHO DE 2025';
    expect(looksLikeDefectiveEmenta(title, title)).toBe(true);
    expect(looksLikeDefectiveEmenta('Dispõe sobre a tributação de aplicações financeiras e...')).toBe(true);
  });

  it('aceita ementa oficial', () => {
    expect(
      looksLikeDefectiveEmenta(
        'Altera o art. 1º do Decreto nº 11.462, de 31 de março de 2023, para dispor sobre o Sistema de Registro de Preços.',
      ),
    ).toBe(false);
  });
});
