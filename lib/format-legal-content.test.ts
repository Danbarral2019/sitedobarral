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

describe('regressão: assinatura não mescla signatários nem rodapé DOU', () => {
  // Bug real (Decreto 12.926, Lei 12.598, etc.): ministros em linhas consecutivas
  // (sem linha em branco) eram grudados entre si e com o rodapé do DOU numa única
  // linha ("Esther Dweck Luiz Marinho Este texto não substitui...").
  it('mantém cada signatário em sua linha e o rodapé DOU separado e íntegro', () => {
    const input = [
      'Art. 18. Esta Lei entra em vigor na data de sua publicação.',
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

    const out = formatLegalContent(input);

    // Signatários não podem estar grudados
    expect(out).not.toMatch(/Esther Dweck Luiz Marinho/);
    // Nem o nome do ministro grudado no rodapé
    expect(out).not.toMatch(/Marinho\s+Este texto/);
    // Cada signatário em sua própria linha (parágrafo)
    expect(out).toMatch(/(^|\n)Esther Dweck(\n|$)/);
    expect(out).toMatch(/(^|\n)Luiz Marinho(\n|$)/);
    // O rodapé DOU permanece uma frase única e íntegra
    expect(out).toMatch(/Este texto não substitui o publicado no DOU de 14\.4\.2026/);
  });
});

describe('regressão: marcadores de diretiva não devem ser reformatados', () => {
  // Bug real (Lei 12.598/2012, LC 147/2014): quando um bloco :::alteracao termina
  // com um heading (ex.: CAPÍTULO), o loop de formatação tratava o ":::" de
  // fechamento como "subtítulo curto após header" e o corrompia em "#### :::",
  // deixando o bloco aberto (desbalanço).
  it('não corrompe o "::" de fechamento quando o bloco termina em CAPÍTULO', () => {
    const input = [
      'Art. 1º A Lei nº 12.598, de 2012, passa a vigorar com as seguintes alterações:',
      '',
      '“CAPÍTULO V DO REGIME ESPECIAL PARA A INDÚSTRIA AEROESPACIAL - RETAERO” (NR)',
    ].join('\n');

    const out = formatLegalContent(input);
    const opens = (out.match(/^:::alteracao$/gm) || []).length;
    const closes = (out.match(/^:::$/gm) || []).length;

    // O fechamento não pode ter sido corrompido em "#### :::"
    expect(out).not.toMatch(/####\s+:::/);
    // Exatamente 1 abertura e 1 fechamento balanceados
    expect(opens).toBe(1);
    expect(closes).toBe(1);
  });
});

  describe('cabeçalhos estruturais', () => {
    it('marca TÍTULO curto como h2', () => {
      const out = formatLegalContent('TÍTULO I\n\nDAS DISPOSIÇÕES GERAIS');
      expect(out).toContain('## TÍTULO I');
    });

    it('marca ANEXO como h2', () => {
      const out = formatLegalContent('ANEXO I\n\nTabela de valores de referência');
      expect(out).toContain('## ANEXO I');
    });

    it('marca seção all-caps (DAS/DOS/DISPOSIÇÕES) como h3 em title case', () => {
      const out = formatLegalContent('DAS DISPOSIÇÕES PRELIMINARES');
      expect(out).toMatch(/### Das Disposições Preliminares/);
    });

    it('destaca texto curto em caixa alta no corpo (rótulos/tabelas)', () => {
      const out = formatLegalContent('Texto introdutório normal aqui.\n\nTABELA DE PENALIDADES APLICÁVEIS');
      // toTitleCase mantém preposições ("de") em minúsculo
      expect(out).toContain('**Tabela de Penalidades Aplicáveis**');
    });

    it('NÃO trata TÍTULO longo (>= 80 chars) como cabeçalho', () => {
      const longTitulo = 'TÍTULO ' + 'X'.repeat(90);
      const out = formatLegalContent(longTitulo);
      expect(out).not.toContain('## ' + longTitulo);
    });

    it('reconhece SEÇÃO e SUBSEÇÃO como h3/h4', () => {
      expect(formatLegalContent('SEÇÃO II')).toContain('### SEÇÃO II');
      expect(formatLegalContent('SUBSEÇÃO III')).toContain('#### SUBSEÇÃO III');
    });

    it('marca verbos separadores (DECRETA/RESOLVE) em negrito', () => {
      const out = formatLegalContent('O PRESIDENTE DA REPÚBLICA\n\nDECRETA:');
      expect(out).toContain('**DECRETA:**');
    });
  });

  /**
   * Textos antigos do Planalto trazem grafias fora do padrão — "Art.1º" (sem
   * espaço) e "Art . 8º" (espaço antes do ponto). O regex só aceitava "Art. N",
   * então nesses 10 atos (incluindo a LGPD e o Decreto-Lei 200/1967) o artigo
   * não virava negrito e podia ser tratado como texto corrido.
   */
  describe('grafias não padronizadas de artigo', () => {
    it('reconhece "Art.1º" sem espaço', () => {
      expect(formatLegalContent('Art.1º Esta lei dispõe sobre a proteção de dados.')).toContain('**Art.1º**');
    });

    it('reconhece "Art . 8º" com espaço antes do ponto', () => {
      expect(formatLegalContent('Art . 8º Os Ministérios são os seguintes.')).toContain('**Art . 8º**');
    });

    it('continua reconhecendo a grafia padrão', () => {
      expect(formatLegalContent('Art. 5º Todos são iguais.')).toContain('**Art. 5º**');
    });

    it('não marca menção a artigo no meio da frase', () => {
      const out = formatLegalContent('nos termos do art. 5º da Constituição, aplica-se a regra.');
      expect(out).not.toContain('**art. 5º**');
    });
  });

  /**
   * Regressão: uma MENÇÃO a capítulo/seção no corpo do texto virava título.
   * "…nos termos do Capítulo VI do Decreto nº 9.191…" começava uma linha e a
   * regra `/^CAPÍTULO\s+/i` (case-insensitive, sem limite de tamanho) promovia
   * a frase inteira a `##`. Um rótulo de verdade é seguido de numeral romano e
   * é curto.
   */
  describe('menção a capítulo/seção não vira título', () => {
    it('não promove frase que apenas cita um capítulo', () => {
      const out = formatLegalContent('Capítulo VI do Decreto nº 9.191, de 1º de novembro de 2017, se a matéria objeto de consulta pública for relevante.');
      expect(out).not.toMatch(/^#{1,4} /m);
    });

    it('não promove frase que apenas cita uma seção', () => {
      const out = formatLegalContent('Seção de Dissídios Individuais do Tribunal Superior do Trabalho, ou contrariarem súmula de jurisprudência.');
      expect(out).not.toMatch(/^#{1,4} /m);
    });

    it('continua reconhecendo rótulos de verdade', () => {
      expect(formatLegalContent('CAPÍTULO III')).toContain('## CAPÍTULO III');
      expect(formatLegalContent('SEÇÃO II')).toContain('### SEÇÃO II');
      expect(formatLegalContent('CAPÍTULO ÚNICO')).toContain('## CAPÍTULO ÚNICO');
      expect(formatLegalContent('SUBSEÇÃO IV')).toContain('#### SUBSEÇÃO IV');
    });

    it('reconhece rótulo com título na mesma linha', () => {
      expect(formatLegalContent('CAPÍTULO II - DAS CONTRATAÇÕES')).toContain('## CAPÍTULO II - DAS CONTRATAÇÕES');
    });
  });

  /**
   * Regressão: headings terminados em numeral romano de UMA letra (I, V, X)
   * disparavam a heurística `prevEndsWithSingleLetter` do merge e engoliam o
   * bloco seguinte — "## CAPÍTULO I DISPOSIÇÕES PRELIMINARES" em vez de dois
   * headings. "CAPÍTULO II" não reproduzia (duas letras), o que mascarou o bug.
   */
  describe('heading terminado em numeral romano de uma letra', () => {
    it('não funde CAPÍTULO I com o subtítulo seguinte', () => {
      const out = formatLegalContent('CAPÍTULO I\n\nDISPOSIÇÕES PRELIMINARES');
      expect(out).not.toContain('CAPÍTULO I DISPOSIÇÕES');
      expect(out).toContain('## CAPÍTULO I');
    });

    it('trata CAPÍTULO I igual a CAPÍTULO II', () => {
      const um = formatLegalContent('CAPÍTULO I\n\nDAS DISPOSIÇÕES');
      const dois = formatLegalContent('CAPÍTULO II\n\nDAS DISPOSIÇÕES');
      expect(um.replace('CAPÍTULO I', 'CAPÍTULO N')).toBe(dois.replace('CAPÍTULO II', 'CAPÍTULO N'));
    });

    it('vale para SEÇÃO I, TÍTULO I, TÍTULO V e ANEXO X', () => {
      expect(formatLegalContent('SEÇÃO I\n\nDO OBJETO')).not.toContain('SEÇÃO I DO OBJETO');
      expect(formatLegalContent('TÍTULO I\n\nDAS NORMAS')).not.toContain('TÍTULO I DAS NORMAS');
      expect(formatLegalContent('TÍTULO V\n\nDAS NORMAS')).not.toContain('TÍTULO V DAS NORMAS');
      expect(formatLegalContent('ANEXO X\n\nDOS MODELOS')).not.toContain('ANEXO X DOS MODELOS');
    });

    it('não funde CAPÍTULO I com o Art. 1º que o segue', () => {
      const out = formatLegalContent('CAPÍTULO I\n\nDISPOSIÇÕES PRELIMINARES\n\nArt. 1º Esta norma dispõe sobre algo.');
      expect(out).toContain('**Art. 1º**');
      expect(out).not.toMatch(/##[^\n]*Art\. 1º/);
    });

    it('ainda mescla continuação real terminada em letra única', () => {
      // "alínea a" quebrado no meio da frase continua sendo remontado
      const out = formatLegalContent('nos termos da alínea a\ndo inciso II do art. 5º.');
      expect(out).toContain('alínea a do inciso II');
    });
  });
