import { describe, it, expect } from 'vitest';
import { formatLegalContent } from './format-legal-content';

describe('formatLegalContent', () => {
  describe('caput em itálico', () => {
    it('italiciza caput entre vírgulas', () => {
      const input = 'art. 84, caput, inciso IV, da Constituição';
      const output = formatLegalContent(input);
      expect(output).toContain('*caput*');
    });

    it('italiciza caput seguido de espaço', () => {
      const input = 'previsto no caput deste artigo';
      const output = formatLegalContent(input);
      expect(output).toContain('*caput*');
    });

    it('NÃO italiciza caput dentro de outra palavra (word boundary)', () => {
      const input = 'isto é capturar dados, não capitular';
      const output = formatLegalContent(input);
      expect(output).not.toContain('*capt*urar');
      expect(output).not.toContain('*capt*ular');
      expect(output).toContain('capturar');
      expect(output).toContain('capitular');
    });
  });

  describe('[...] → :omitido', () => {
    it('substitui [...] simples por marcador inline', () => {
      const input = 'Art. 1º [...] Parágrafo único.';
      const output = formatLegalContent(input);
      expect(output).toContain(':omitido');
      expect(output).not.toContain('[...]');
    });

    it('substitui [ ... ] com espaços', () => {
      const input = 'Art. 1º [ ... ] fim';
      const output = formatLegalContent(input);
      expect(output).toContain(':omitido');
    });

    it('substitui múltiplas ocorrências no mesmo parágrafo', () => {
      const input = 'Art. 1º [...] meio [...] fim';
      const output = formatLegalContent(input);
      expect(output.match(/:omitido/g)?.length).toBe(2);
    });
  });

  describe('(NR) preserva e marca', () => {
    it('envolve (NR) no fim de parágrafo em :nr[]', () => {
      const input = 'Parágrafo único. O disposto no art. 2º... (NR)';
      const output = formatLegalContent(input);
      expect(output).toContain(':nr[(NR)]');
    });

    it('NÃO envolve (NR) no meio de parágrafo', () => {
      const input = '(NR) é uma sigla. O texto continua.';
      const output = formatLegalContent(input);
      // (NR) no início não deve virar diretiva
      expect(output).not.toContain(':nr[(NR)]');
    });
  });

  describe('aspas curvas → :::alteracao', () => {
    it('envolve bloco de aspas em um único parágrafo', () => {
      const input = 'Art. 1º\n\nO Decreto X passa a vigorar:\n\n“Art. 1º novo texto.” (NR)';
      const output = formatLegalContent(input);
      expect(output).toContain(':::alteracao');
      expect(output).toContain(':::');
    });

    it('envolve aspas atravessando múltiplos parágrafos', () => {
      const input = [
        'Texto base.',
        '',
        '“Art. 1º começo do bloco',
        '',
        'Parágrafo único. Continua.',
        '',
        'Mais texto fechamento.” (NR)',
        '',
        'Depois do bloco.',
      ].join('\n');
      const output = formatLegalContent(input);
      expect(output).toContain(':::alteracao');
      // O parágrafo "Mais texto fechamento" deve estar dentro do bloco
      const blockMatch = output.match(/:::alteracao([\s\S]*?):::/);
      expect(blockMatch).toBeTruthy();
      expect(blockMatch![1]).toContain('Mais texto fechamento');
      expect(blockMatch![1]).toContain('Parágrafo único');
    });

    it('aspas aninhadas: balanceamento de contador', () => {
      const input = '“externo “interno” externo continua.” (NR)';
      const output = formatLegalContent(input);
      const blocos = output.match(/:::alteracao/g);
      expect(blocos?.length).toBe(1);
    });

    it('aspa abrindo sem fechar: fail-safe (não cria bloco)', () => {
      const input = '”texto sem fechamento até o fim do ato';
      const output = formatLegalContent(input);
      expect(output).not.toContain(':::alteracao');
      // Mas o conteúdo permanece
      expect(output).toContain('texto sem fechamento');
    });
  });

  describe('título oficial → H1', () => {
    it('promove DECRETO Nº … a # heading', () => {
      const input = [
        'Presidência da República',
        'Casa Civil',
        'DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026',
        '',
        'Altera o Decreto nº 12.174...',
      ].join('\n');
      const output = formatLegalContent(input);
      expect(output).toContain('# DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026');
    });

    it('promove LEI Nº … a # heading', () => {
      const input = 'LEI Nº 14.133, DE 1º DE ABRIL DE 2021\n\nDispõe sobre...';
      const output = formatLegalContent(input);
      expect(output).toContain('# LEI Nº 14.133');
    });

    it('promove PORTARIA / INSTRUÇÃO NORMATIVA / MEDIDA PROVISÓRIA', () => {
      const tipos = ['PORTARIA Nº 1', 'INSTRUÇÃO NORMATIVA Nº 1', 'MEDIDA PROVISÓRIA Nº 1'];
      for (const titulo of tipos) {
        const output = formatLegalContent(`${titulo}, DE 1 DE JANEIRO\n\nEmenta.`);
        expect(output).toContain(`# ${titulo}`);
      }
    });
  });

  describe('preâmbulo e cláusula', () => {
    it('DECRETA: vira **DECRETA:** sem régua horizontal', () => {
      const input = 'preâmbulo.\n\nDECRETA:\n\nArt. 1º texto.';
      const output = formatLegalContent(input);
      expect(output).toContain('**DECRETA:**');
      expect(output).not.toMatch(/^---$/m); // sem régua
    });

    it('RESOLVE: vira **RESOLVE:** sem régua', () => {
      const input = '...\n\nRESOLVE:\n\nArt. 1º texto.';
      const output = formatLegalContent(input);
      expect(output).toContain('**RESOLVE:**');
    });

    it('O PRESIDENTE DA REPÚBLICA no início do preâmbulo vira bold', () => {
      const input = 'O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere...';
      const output = formatLegalContent(input);
      expect(output).toContain('**O PRESIDENTE DA REPÚBLICA**');
    });

    it('O CONGRESSO NACIONAL vira bold', () => {
      const input = 'O CONGRESSO NACIONAL decreta:';
      const output = formatLegalContent(input);
      expect(output).toContain('**O CONGRESSO NACIONAL**');
    });
  });

  describe('assinatura', () => {
    it('envolve Brasília + assinantes em :::signature', () => {
      const input = [
        'Art. 1º texto final.',
        '',
        'Brasília, 13 de abril de 2026; 205º da Independência e 138º da República.',
        '',
        'LUIZ INÁCIO LULA DA SILVA',
        '',
        'Esther Dweck',
      ].join('\n');
      const output = formatLegalContent(input);
      expect(output).toContain(':::signature');
      const sigMatch = output.match(/:::signature([\s\S]*?):::/);
      expect(sigMatch).toBeTruthy();
      expect(sigMatch![1]).toContain('Brasília');
      expect(sigMatch![1]).toContain('LULA');
      expect(sigMatch![1]).toContain('Esther');
    });
  });

  describe('merge agressivo de quebras aberrantes', () => {
    it('mergeia "Art. 1º O" + "Decreto nº 12.174"', () => {
      const input = 'Art. 1º O\n\nDecreto nº 12.174, de 11 de setembro.';
      const output = formatLegalContent(input);
      // Não deve haver quebra entre "O" e "Decreto"
      // Nota: após formatação o Art. fica em bold (**Art. 1º**), então o regex
      // precisa tolerar os marcadores markdown entre "1º" e "O"
      expect(output).toMatch(/Art\.\s+1º\S*\s+O\s+Decreto/);
    });

    it('mergeia preposição órfã: "no" + "art. 8º"', () => {
      const input = 'observado o disposto no\n\nart. 8º do Decreto nº 9.507.';
      const output = formatLegalContent(input);
      expect(output).toMatch(/disposto no art\. 8º/);
    });

    it('mergeia palavra + número quebrado: "art." + "46 da Lei"', () => {
      const input = 'trata o art.\n\n46 da Lei nº 14.133.';
      const output = formatLegalContent(input);
      expect(output).toMatch(/o art\.\s+46 da Lei/);
    });

    it('NÃO mergeia parágrafos terminados com pontuação completa', () => {
      const input = 'Art. 1º Primeira frase.\n\nArt. 2º Segunda frase.';
      const output = formatLegalContent(input);
      // Os dois devem permanecer separados
      expect(output).toMatch(/Art\.\s+1º[^\n]*\.[\s\n]+\*\*Art\.\s+2º\*\*/);
    });
  });
});

describe('snapshots (golden cases)', () => {
  // Caso real (abreviado) do Decreto 12.926/2026 — inclui a assinatura oficial
  // completa (presidente + ministros + rodapé DOU) para travar o comportamento
  // de formatação ponta a ponta.
  it('Decreto 12.926/2026 — formato completo', () => {
    const input = [
      'Presidência da República',
      'Casa Civil',
      'Secretaria Especial para Assuntos Jurídicos',
      '',
      'DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026',
      '',
      'Altera o Decreto nº 12.174, de 11 de setembro de 2024, que dispõe sobre as garantias trabalhistas.',
      '',
      'O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere o art. 84, caput, inciso IV, da Constituição,',
      '',
      'DECRETA:',
      '',
      'Art. 1º O Decreto nº 12.174, de 11 de setembro de 2024, passa a vigorar com as seguintes alterações:',
      '',
      '“Art. 1º [...]',
      '',
      'Parágrafo único. O disposto no art. 2º deste Decreto aplica-se aos contratos.” (NR)',
      '',
      '“Art. 3º [...]',
      '',
      'I - a previsibilidade da época de gozo de suas férias;',
      '',
      'II - [...]',
      '',
      'b) necessidade eventual de caráter pessoal;',
      '',
      'III - a concessão do benefício de reembolso-creche.” (NR)',
      '',
      'Brasília, 13 de abril de 2026; 205º da Independência e 138º da República.',
      '',
      'LUIZ INÁCIO LULA DA SILVA',
      'Esther Dweck',
      'Luiz Marinho',
      '',
      'Este texto não substitui o',
      'publicado no DOU de 14.4.2026',
    ].join('\n');

    expect(formatLegalContent(input)).toMatchSnapshot();
  });
});
