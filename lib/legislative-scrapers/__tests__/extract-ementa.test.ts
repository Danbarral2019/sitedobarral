import { describe, it, expect } from 'vitest';
import {
  extractEmenta,
  looksLikeDefectiveEmenta,
  startsWithEpigrafe,
  isIdentificacaoDoAto,
  epigrafeNumber,
} from '../extract-ementa';

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

  it('texto truncado no meio da ementa (sem epígrafe) não vira ementa', () => {
    // Casos reais: MP 1.393/2026 e Lei 15.473/2026 baixados do DOU antes da
    // correção de stripDouBoilerplate.
    expect(
      extractEmenta(
        'Lei nº 14.690, de 3 de outubro de 2023, para instituir a Modalidade Emergencial.\n\nO PRESIDENTE DA REPÚBLICA, no uso da atribuição',
      ),
    ).toBeNull();
    expect(
      extractEmenta('Leis nºs 9.818, de 23 de agosto de 1999, para fortalecer o crédito.\n\nO PRESIDENTE DA REPÚBLICA\n\nFaço saber'),
    ).toBeNull();
  });

  it('epígrafe em caixa mista na primeira linha delimita a ementa', () => {
    // Casos reais: Portaria MGI 5.112/2026 e IN SPOA/SE/MAPA 25/2026.
    expect(
      extractEmenta(
        'Portaria MGI Nº 5.112, DE 24 DE junho DE 2026\n\nInstitui o Comitê Ministerial de Governança.\n\nA MINISTRA DE ESTADO DA GESTÃO E DA INOVAÇÃO EM SERVIÇOS PÚBLICOS, no uso das atribuições',
      ),
    ).toEqual({ ementa: 'Institui o Comitê Ministerial de Governança.', complete: true });
  });

  it('epígrafe em caixa mista sem ementa não vira ementa', () => {
    expect(
      extractEmenta('Portaria SGD/MGI nº 3.656, de 16 de junho de 2026\n\nO SECRETÁRIO DE GOVERNO DIGITAL DO MINISTÉRIO, no uso das atribuições'),
    ).toBeNull();
  });

  it('corta os links laterais do gov.br grudados na ementa', () => {
    expect(
      extractEmenta(
        'INSTRUÇÃO NORMATIVA Nº 2, DE 6 DE DEZEMBRO DE 2016\n\nDispõe sobre a ordem cronológica de pagamento no âmbito do Sisg\n\n• Perguntas e Respostas\n\n• Apresentação da IN\n\nO SECRETÁRIO DE GESTÃO DO MINISTÉRIO, no uso das atribuições',
      )?.ementa,
    ).toBe('Dispõe sobre a ordem cronológica de pagamento no âmbito do Sisg');
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

  it('detecta ementa recortada de texto truncado ou igual à epígrafe', () => {
    // Gravadas em produção pela versão anterior do saneamento.
    expect(
      looksLikeDefectiveEmenta(
        'Lei nº 14.690, de 3 de outubro de 2023, para instituir a Modalidade Emergencial de Renegociação de Dívidas.',
      ),
    ).toBe(true);
    expect(looksLikeDefectiveEmenta('Leis nºs 9.818, de 23 de agosto de 1999, e 12.712, de 30 de agosto de 2012.')).toBe(true);
    expect(looksLikeDefectiveEmenta('Portaria SGD/MGI nº 3.656, de 16 de junho de 2026')).toBe(true);
    expect(looksLikeDefectiveEmenta('outubro de 1991, 10.176, de 11 de janeiro de 2001, e 11.077, de 30 de dezembro de 2004,')).toBe(true);
  });

  it('aceita ementa que começa com nome de ato sem número', () => {
    expect(looksLikeDefectiveEmenta('Lei de Introdução às Normas do Direito Brasileiro (antiga Lei de Introdução ao Código Civil).')).toBe(false);
    expect(
      looksLikeDefectiveEmenta('Instrução Normativa (IN), destinada a proporcionar aos Órgãos Integrantes do SISG orientação nos procedimentos.'),
    ).toBe(false);
  });

  it('aceita ementa oficial', () => {
    expect(
      looksLikeDefectiveEmenta(
        'Altera o art. 1º do Decreto nº 11.462, de 31 de março de 2023, para dispor sobre o Sistema de Registro de Preços.',
      ),
    ).toBe(false);
  });
});

describe('startsWithEpigrafe', () => {
  it('reconhece epígrafe em qualquer caixa, com anotação entre parênteses', () => {
    expect(startsWithEpigrafe('MEDIDA PROVISÓRIA Nº 1.393, DE 25 DE SETEMBRO DE 2026\n\nAltera a Lei')).toBe(true);
    expect(startsWithEpigrafe('Portaria SGD/MGI nº 3.656, de 16 de junho de 2026\n\nO SECRETÁRIO')).toBe(true);
    expect(
      startsWithEpigrafe('PORTARIA SEGES/MGI Nº 1.363, DE 21 DE FEVEREIRO DE 2025 (Revoga a Portaria SEGES/ME nº 9.412)\n\nInstitui'),
    ).toBe(true);
  });

  it('rejeita texto que abre no meio da ementa', () => {
    expect(startsWithEpigrafe('Lei nº 14.690, de 3 de outubro de 2023, para instituir a Modalidade')).toBe(false);
    // Caso real (Lei 15.503/2026): a linha termina em outra citação datada.
    expect(
      startsWithEpigrafe(
        'Lei nº 9.503, de 23 de setembro de 1997 (Código de Trânsito Brasileiro), a Lei nº 11.484, de 31 de maio de 2007\n\nArt. 1º',
      ),
    ).toBe(false);
    expect(startsWithEpigrafe(null)).toBe(false);
  });
});

describe('casos reais das pendências de 28 de setembro de 2026', () => {
  it('epígrafe sem espaço antes do Nº (Resolução CIIA-PAC/CC 3/2025)', () => {
    const texto =
      'RESOLUÇÃO CIIA - PAC/CCNº 3, DE 28 DE JULHO DE 2025\n\nDefine os produtos manufaturados sujeitos à margem de preferência.\n\nA COMISSÃO INTERMINISTERIAL DE INOVAÇÕES E AQUISIÇÕES DO PAC, no uso das atribuições';
    expect(startsWithEpigrafe(texto)).toBe(true);
    expect(extractEmenta(texto)?.ementa).toBe('Define os produtos manufaturados sujeitos à margem de preferência.');
  });

  it('preâmbulo com vírgula colada ("CRESCIMENTO,no uso") encerra a ementa', () => {
    const texto =
      'RESOLUÇÃO CIIA - PAC/CCNº 3, DE 28 DE JULHO DE 2025\n\nDefine os produtos manufaturados sujeitos à margem de preferência.\n\nA COMISSÃO INTERMINISTERIAL DE INOVAÇÕES E AQUISIÇÕES DO PROGRAMA DE ACELERAÇÃO DO CRESCIMENTO,no uso das atribuições que lhe confere o art. 2º, resolve:\n\nArt. 1º Ficam';
    expect(extractEmenta(texto)?.ementa).toBe('Define os produtos manufaturados sujeitos à margem de preferência.');
    // A ementa errada gravada por um instante em produção seria reconhecida como defeito.
    expect(
      looksLikeDefectiveEmenta(
        'Define os produtos manufaturados. A COMISSÃO INTERMINISTERIAL DE INOVAÇÕES E AQUISIÇÕES DO PROGRAMA DE ACELERAÇÃO DO CRESCIMENTO,no uso das atribuições, resolve:',
      ),
    ).toBe(true);
  });

  it('preâmbulo em caixa mista de ato antigo (IN MP 12/1997)', () => {
    expect(
      extractEmenta(
        'INSTRUÇÃO NORMATIVA N° 12, DE 05 DE SETEMBRO DE 1997\n\nDispõe sobre aquisição, utilização, controle e manutenção dos equipamentos de telefonia fixa e celular.\n\nO Ministro de Estado da Administração Federal e Reforma do Estado, no uso de suas atribuições, resolve:',
      )?.ementa,
    ).toBe('Dispõe sobre aquisição, utilização, controle e manutenção dos equipamentos de telefonia fixa e celular.');
  });

  it('ementa oficial curta não é defeito (Código Civil)', () => {
    expect(looksLikeDefectiveEmenta('Institui o Código Civil.')).toBe(false);
    expect(looksLikeDefectiveEmenta('Presidência')).toBe(true);
  });

  it('ato antigo sem ementa, com "N.º" e preâmbulo em caixa alta (IN MP 142/1983)', () => {
    const texto =
      'INSTRUÇÃO NORMATIVA N.º 142, DE 05 DE AGOSTO DE 1983\n\nO SECRETÁRIO-GERAL ADJUNTO DO DEPARTAMENTO ADMINISTRATIVO DO SERVIÇO PÚBLICO - DASP, TENDO EM VISTA O DISPOSTO NO DECRETO N.º 75.657, RESOLVE:\n\nArt. 1º Fica';
    expect(startsWithEpigrafe(texto)).toBe(true);
    expect(extractEmenta(texto)).toBeNull();
    expect(epigrafeNumber(texto)).toBe('142');
  });

  it('identificação do ato no lugar da ementa (atos sem ementa oficial)', () => {
    expect(isIdentificacaoDoAto('IN nº 142, de 5 de agosto de 1983')).toBe(true);
    expect(isIdentificacaoDoAto('Portaria SGD/MGI nº 3.656, de 16 de junho de 2026')).toBe(true);
    expect(isIdentificacaoDoAto('Institui o Código Civil.')).toBe(false);
  });

  it('número da epígrafe, para detectar texto cortado na citação de outro ato (Portaria 6.364/2026)', () => {
    expect(epigrafeNumber('Portaria SEGES/MGI nº 9.510, de 28 de outubro de 2025.\n\nA SECRETÁRIA')).toBe('9510');
    expect(epigrafeNumber('Lei nº 14.690, de 3 de outubro de 2023, para instituir')).toBeNull();
  });
});
