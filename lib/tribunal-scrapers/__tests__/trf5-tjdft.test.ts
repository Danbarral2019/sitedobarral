import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { docParaDecisao, extrairEmenta, formatarCnj, noRecorteTrf5, montarUrlTrf5 } from '../trf5';
import { registroParaDecisao, noRecorteTjdft, montarCorpoTjdft } from '../tjdft';

// Formato real do Júlia (26/09/2026), texto encurtado.
const TEXTO_TRF5 = ` PODER JUDICIÁRIO
 Tribunal Regional Federal da 5ª Região
 4ª Turma
 APELAÇÃO CÍVEL (198) Nº 0028055-37.2025.4.05.8300
 APELANTE: BASIS TECNOLOGIA DA INFORMACAO S.A.
 APELADO: UNIAO FEDERAL
 EMENTA
 DIREITO ADMINISTRATIVO. EMBARGOS DE DECLARAÇÃO. <em>LICITAÇÃO</em> PÚBLICA. HABILITAÇÃO TÉCNICA. ART. 67, § 1º, DA LEI Nº 14.133/2021.
 I. CASO EM EXAME
 1. Embargos de Declaração opostos pela licitante vencida.
 ACÓRDÃO
 Vistos, relatados e discutidos estes autos.`;

const DOC = {
  codigoDocumento: 'TRF5:G2:PJE_NACIONAL:54503:11679210:11485403',
  numeroProcesso: '00280553720254058300',
  classeJudicial: 'APELAÇÃO CÍVEL',
  relator: 'MANOEL DE OLIVEIRA ERHARDT',
  orgaoJulgador: 'GAB 11 - DES. MANOEL ERHARDT',
  dataJulgamento: '2026-08-19',
  texto: TEXTO_TRF5,
};

describe('TRF5', () => {
  it('formata o número CNJ', () => {
    expect(formatarCnj('00280553720254058300')).toBe('0028055-37.2025.4.05.8300');
  });

  it('extrai a ementa entre a linha EMENTA e o dispositivo, sem as marcas <em>', () => {
    const e = extrairEmenta(TEXTO_TRF5);
    expect(e.startsWith('DIREITO ADMINISTRATIVO. EMBARGOS DE DECLARAÇÃO. LICITAÇÃO PÚBLICA.')).toBe(true);
    expect(e).toContain('I. CASO EM EXAME');
    expect(e).not.toContain('ACÓRDÃO');
    expect(e).not.toContain('<em>');
  });

  it('mapeia o documento e guarda o texto integral', () => {
    const d = docParaDecisao(DOC);
    expect(d.title).toBe('APELAÇÃO CÍVEL 0028055-37.2025.4.05.8300 - TRF5');
    expect(d.dataJulgamento?.toISOString().slice(0, 10)).toBe('2026-08-19');
    expect(d.fullText).toContain('APELANTE: BASIS TECNOLOGIA');
  });

  it('recorte: tema na ementa entra, inclusive crimes licitatórios', () => {
    expect(noRecorteTrf5(docParaDecisao(DOC))).toBe(true);
    expect(noRecorteTrf5(docParaDecisao({ ...DOC, classeJudicial: 'APELAÇÃO CRIMINAL' }))).toBe(true);
    expect(noRecorteTrf5(docParaDecisao({ ...DOC, texto: ' EMENTA \n PREVIDENCIÁRIO. APOSENTADORIA. ' }))).toBe(false);
  });

  it('monta a URL com janela de julgamento e paginação', () => {
    const u = new URL(montarUrlTrf5({ termo: 'licitação', inicio: new Date('2026-08-01T00:00:00Z'), deslocamento: 500 }));
    expect(u.searchParams.get('dataIni')).toBe('01/08/2026');
    expect(u.searchParams.get('start')).toBe('500');
    expect(u.searchParams.get('pesquisaLivre')).toBe('licitação');
  });
});

describe('TJDFT', () => {
  const REG = {
    uuid: 'cdfc8056-26cd-44d0-8892-32d3808f8302',
    identificador: '2170891',
    dataJulgamento: '2026-09-01T03:00:00.000Z',
    ementa: 'MANDADO DE SEGURANÇA. DIREITO ADMINISTRATIVO. CONTRATO ADMINISTRATIVO. FORNECIMENTO DE REFEIÇÕES A UNIDADES PRISIONAIS.',
    decisao: 'Denegou-se a segurança. Unânime.',
    processo: '0734382-69.2024.8.07.0000',
    nomeRelator: 'ROMULO DE ARAUJO MENDES',
    descricaoOrgaoJulgador: 'CONSELHO ESPECIAL',
    segredoJustica: false,
  };

  it('mapeia o acórdão com link público pelo uuid', () => {
    const d = registroParaDecisao(REG);
    expect(d.title).toBe('Acórdão 2170891 TJDFT');
    expect(d.uuid).toBe(REG.uuid);
    expect(d.dataJulgamento?.toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('recorte: tema na ementa e sem segredo de justiça, inclusive crimes licitatórios', () => {
    expect(noRecorteTjdft(REG, registroParaDecisao(REG))).toBe(true);
    expect(noRecorteTjdft({ ...REG, segredoJustica: true }, registroParaDecisao(REG))).toBe(false);
    const penal = { ...REG, ementa: 'APELAÇÃO CRIMINAL. FRAUDE À LICITAÇÃO. ART. 337-F DO CP.' };
    expect(noRecorteTjdft(penal, registroParaDecisao(penal))).toBe(true);
  });

  it('respeita o máximo de 40 por página e filtra acórdãos por data de julgamento', () => {
    const c = montarCorpoTjdft({ termo: 'licitação', inicio: '2026-08-01', fim: '2026-08-31', pagina: 2 }) as {
      tamanho: number;
      pagina: number;
      termosAcessorios: Array<{ campo: string; valor: string }>;
    };
    expect(c.tamanho).toBe(40);
    expect(c.pagina).toBe(2);
    expect(c.termosAcessorios).toContainEqual({ campo: 'base', valor: 'acordaos' });
    expect(c.termosAcessorios).toContainEqual({ campo: 'dataJulgamento', valor: 'entre 2026-08-01 e 2026-08-31' });
  });
});
