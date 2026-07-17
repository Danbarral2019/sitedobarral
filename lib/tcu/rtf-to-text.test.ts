import { describe, it, expect } from 'vitest';
import { rtfToText } from './rtf-to-text';

/** RTF mínimo no formato que o TCU emite (cp1252, \'e3 = ã). */
const RTF_SIMPLES = String.raw`{\rtf1\ansi\ansicpg1252\deff0
{\fonttbl{\f0\froman Times;}}
\pard TRIBUNAL DE CONTAS DA UNI\'c3O\par
\pard RELAT\'d3RIO\par
\pard Cuidam os autos de representa\'e7\'e3o.\par
\pard VOTO\par
\pard Acolho o parecer, por viola\'e7\'e3o ao princ\'edpio da economicidade.\par
\pard AC\'d3RD\'c3O\par
\pard Os Ministros ACORDAM em conhecer.\par
}`;

/** Parágrafo que é dump hexadecimal de imagem embutida (EMF/WMF). */
const HEX = '0100'.repeat(40); // 160 chars, 100% hex
const RTF_COM_IMAGEM = String.raw`{\rtf1\ansi\ansicpg1252\deff0
\pard ${HEX}\par
\pard Texto de verdade aqui.\par
}`;

/** Parágrafo de prosa jurídica longa (>300 chars), estilo voto do TCU. */
const PROSA_LONGA =
  "Ante o exposto, entendo que a conduta do gestor respons\\'e1vel pela condu\\'e7\\'e3o do processo licitat\\'f3rio contraria os princ\\'edpios da economicidade, da efici\\'eancia e da vincula\\'e7\\'e3o ao instrumento convocat\\'f3rio insculpidos na Lei 14.133/2021, mormente porque n\\'e3o foram observados os requisitos m\\'ednimos de habilita\\'e7\\'e3o t\\'e9cnica e econ\\'f4mico-financeira exigidos no edital, tampouco restou demonstrada a vantajosidade da contrata\\'e7\\'e3o direta em detrimento do certame competitivo, raz\\'e3o pela qual voto no sentido de que seja determinada a cita\\'e7\\'e3o dos respons\\'e1veis para que apresentem, no prazo regimental, as raz\\'f5es de justificativa que entenderem cab\\'edveis.";
const RTF_PROSA_LONGA = `{\\rtf1\\ansi\\ansicpg1252\\deff0\n\\pard ${PROSA_LONGA}\\par\n}`;

/**
 * Parágrafo de tabela de valores (CNPJ de licitantes habilitados), estilo
 * tabela de acórdão: >300 chars, dominado por dígitos decimais, densidade
 * de "hex" (dígitos contam como [0-9a-f]) > 92%, mas sem nenhum run
 * contíguo de 100+ chars sem espaço.
 */
const CNPJS = [
  '12345678000190', '12345679010291', '12345680020392', '12345681030493',
  '12345682040594', '12345683050695', '12345684060796', '12345685070897',
  '12345686080998', '12345687091099', '12345688101200', '12345689111301',
  '12345690121402', '12345691131503', '12345692141604', '12345693151705',
  '12345694161806', '12345695171907', '12345696182008', '12345697192109',
  '12345698202210', '12345699212311', '12345700222412', '12345701232513',
  '12345702242614', '12345703252715', '12345704262816', '12345705272917',
  '12345706283018', '12345707293119',
].join(' ');
const RTF_TABELA_VALORES = `{\\rtf1\\ansi\\ansicpg1252\\deff0\n\\pard ${CNPJS}\\par\n}`;

/**
 * Citação de precedente no formato real do TCU, com hífen e espaço
 * inquebráveis (\_ e \~): "Acórdão 4851/2017 – TCU – 1ª Câmara". O
 * rtf-parser@1.3.3 processa os control symbols \_ e \- sem resetar o estado
 * do parser (os ramos de \~, \*, \' resetam; \_ e \- esquecem), então o \
 * seguinte é lido como "empty control word" e a extração inteira falha.
 * Era a causa de ~28% dos acórdãos "malformados" no primeiro backfill —
 * quase todo acórdão cita um precedente nesse formato.
 */
const RTF_CITACAO_PRECEDENTE = String.raw`{\rtf1\ansi\ansicpg1252\deff0
\pard VOTO\par
\pard Reitero o entendimento do Ac\'f3rd\~4851/2017\~\_\~TCU\~\_\~1\'aa C\'e2mara.\par
}`;

describe('rtfToText', () => {
  it('extrai o texto com acentuação cp1252 correta', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).toContain('TRIBUNAL DE CONTAS DA UNIÃO');
    expect(t).toContain('representação');
    expect(t).toContain('princípio da economicidade');
  });

  it('NÃO quebra palavras no meio (bug do extrator ingênuo: UNIÃ\\nO)', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).toMatch(/UNIÃO/);
    expect(t).not.toMatch(/UNIÃ\s*\n\s*O/);
  });

  it('preserva as quebras de parágrafo (o seccionamento depende delas)', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t.split('\n').length).toBeGreaterThan(3);
  });

  it('não deixa control word nem lixo de metadados', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).not.toMatch(/\\[a-z]{2,}\d*/);
    expect(t).not.toMatch(/shapeType|fFlipH|pictureGray|fonttbl/);
  });

  it('descarta o dump hexadecimal das imagens embutidas', async () => {
    const t = await rtfToText(Buffer.from(RTF_COM_IMAGEM, 'latin1'));
    expect(t).toContain('Texto de verdade aqui.');
    expect(t).not.toContain(HEX);
  });

  it('mantém texto legítimo que por acaso tem hex curto', async () => {
    const rtf = String.raw`{\rtf1\ansi\deff0 \pard Processo TC 024.321/2025-7 abcdef.\par}`;
    const t = await rtfToText(Buffer.from(rtf, 'latin1'));
    expect(t).toContain('Processo TC 024.321/2025-7 abcdef.');
  });

  it('rejeita RTF inválido com erro claro', async () => {
    await expect(rtfToText(Buffer.from('não é rtf', 'latin1'))).rejects.toThrow();
  });

  it('mantém prosa jurídica longa (>300 chars) intacta', async () => {
    const t = await rtfToText(Buffer.from(RTF_PROSA_LONGA, 'latin1'));
    expect(t).toContain(
      'Ante o exposto, entendo que a conduta do gestor responsável pela condução do processo licitatório'
    );
    expect(t).toContain('cabíveis.');
  });

  it('mantém tabela de valores (CNPJs) longa, mesmo com alta densidade de dígitos', async () => {
    // Prova do Achado 1: densidade de "hex" aqui é >92% (dígitos decimais
    // contam como [0-9a-f]), mas não há run contíguo de 100+ chars sem
    // espaço — não é dump binário, é uma tabela de valores legítima.
    const t = await rtfToText(Buffer.from(RTF_TABELA_VALORES, 'latin1'));
    expect(t).toContain(CNPJS);
  });

  it('extrai citação de precedente com hífen/espaço inquebráveis (\\_ \\~)', async () => {
    // Sem o sanitize, o rtf-parser lança "empty control word" e a extração
    // inteira falha — era a causa de ~28% dos acórdãos "malformados".
    const t = await rtfToText(Buffer.from(RTF_CITACAO_PRECEDENTE, 'latin1'));
    expect(t).toContain('VOTO');
    expect(t).toContain('4851/2017');
    expect(t).toContain('1ª Câmara');
    // O texto tem que sair contíguo, não interrompido no ponto do \_.
    expect(t).toMatch(/4851\/2017[\s\S]*TCU[\s\S]*1ª C[âa]mara/);
  });
});
