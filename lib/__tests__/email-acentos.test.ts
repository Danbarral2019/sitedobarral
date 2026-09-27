/**
 * Checklist P2 (FUTURE_TASKS.md): emails do cadastro com acentuação correta.
 *
 * Confere o conteúdo exatamente como é entregue à Resend (HTML, texto e
 * assunto), sem enviar nada: o cliente da Resend é substituído por um mock
 * que só captura o payload. A renderização em Gmail e Outlook continua fora
 * do escopo automatizado.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

import { sendCourseWelcomeEmail, sendVerificationEmail, sendWelcomeEmail } from '../email';

interface PayloadResend {
  subject: string;
  html: string;
  text?: string;
}

const NOME = 'João Conceição Araújo';
const CURSO = 'Planejamento das Contratações Públicas';

// Sequências típicas de UTF-8 lido como Latin-1 ("Ã©" no lugar de "é") e o
// caractere de substituição que aparece quando a conversão falha.
const MOJIBAKE = /Ã[ -¿]|Â[ -¿]|�/;

function ultimoPayload(): PayloadResend {
  expect(mockSend).toHaveBeenCalledTimes(1);
  return mockSend.mock.calls[0][0] as PayloadResend;
}

describe('emails do cadastro: acentuação', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: 'email-teste' }, error: null });
    vi.stubEnv('RESEND_API_KEY', 're_teste_sem_envio');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://exemplo.test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('boas-vindas preserva acentos no assunto, no HTML e no texto', async () => {
    await expect(sendWelcomeEmail('aluno@example.test', NOME)).resolves.toBe(true);
    const { subject, html, text } = ultimoPayload();

    expect(subject).toBe('Bem-vindo(a) ao site do Prof. Daniel Barral!');
    for (const trecho of [
      `Bem-vindo(a), ${NOME}!`,
      'É um prazer ter você conosco!',
      'Na área restrita você encontra',
      'Tire dúvidas sobre licitações e contratos',
      'Acesse acórdãos do TCU, pareceres, orientações normativas',
      'Navegue pelos 195 artigos da Nova Lei de Licitações',
      'página de perguntas frequentes',
      'Este é um email automático, por favor não responda.',
    ]) {
      expect(html).toContain(trecho);
    }
    for (const trecho of [
      `Bem-vindo(a), ${NOME}!`,
      'Acesse seus cursos - Na área restrita você encontra todos os materiais.',
      'Acórdãos do TCU, pareceres, orientações normativas e mais.',
      'Dúvidas? Acesse:',
    ]) {
      expect(text).toContain(trecho);
    }
    expect(html).not.toMatch(MOJIBAKE);
    expect(text).not.toMatch(MOJIBAKE);
  });

  it('boas-vindas: título do guia na versão em texto leva acento', async () => {
    await sendWelcomeEmail('aluno@example.test', NOME);
    expect(ultimoPayload().text).toContain('GUIA RÁPIDO');
  });

  it('boas-vindas ao curso (registro por QR code) preserva acentos', async () => {
    await expect(
      sendCourseWelcomeEmail('aluno@example.test', NOME, CURSO, 'planejamento-contratacoes'),
    ).resolves.toBe(true);
    const { subject, html, text } = ultimoPayload();

    expect(subject).toBe(`Bem-vindo(a) ao curso: ${CURSO}`);
    expect(html).toContain(`Olá ${NOME},`);
    expect(html).toContain(`Que bom que você iniciou seus estudos no curso <strong>${CURSO}</strong>!`);
    expect(html).toContain('Use o assistente de IA para tirar dúvidas');
    expect(text).toContain(`Que bom que você iniciou seus estudos no curso: ${CURSO}!`);
    expect(text).toContain('Dicas para aproveitar ao máximo:');
    expect(html).not.toMatch(MOJIBAKE);
    expect(text).not.toMatch(MOJIBAKE);
  });

  it('verificação de email preserva acentos', async () => {
    await expect(sendVerificationEmail('aluno@example.test', NOME, 'token-teste')).resolves.toBe(true);
    const { subject, html, text } = ultimoPayload();

    expect(subject).toBe('Confirme seu email - Prof. Daniel Barral');
    expect(html).toContain(`Olá ${NOME},`);
    expect(html).toContain('confirme seu endereço de email');
    expect(html).toContain('Se você não se cadastrou no nosso site');
    expect(text).toContain('Este link é válido por 24 horas.');
    expect(html).not.toMatch(MOJIBAKE);
    expect(text).not.toMatch(MOJIBAKE);
  });

  // O reenvio (send-verification) grava token de 30 minutos; o email não pode
  // prometer as 24 horas do cadastro.
  it('verificação reenviada informa o prazo de 30 minutos', async () => {
    await sendVerificationEmail('aluno@example.test', NOME, 'token-teste', '30 minutos');
    const { html, text } = ultimoPayload();

    expect(html).toContain('Link válido por 30 minutos');
    expect(html).toContain('expira em 30 minutos');
    expect(html).not.toContain('24 horas');
    expect(text).toContain('Este link é válido por 30 minutos.');
    expect(text).not.toContain('24 horas');
  });
});
