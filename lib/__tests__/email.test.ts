/**
 * Testes para lib/email.ts
 *
 * Testa envio de emails em diferentes cenários:
 * - Modo desenvolvimento (simulado)
 * - Com API Key configurada (Resend)
 * - Sem API Key (fallback)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Resend com vi.hoisted para garantir que seja aplicado antes dos imports
const mockSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
    },
  };
});

// Mock console para não poluir output dos testes
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

import {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendExpirationNotification,
  sendContactNotification,
  sendNewDocumentsNotification,
} from '../email';

describe('Email Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_BASE_URL = 'https://test.com';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendEmail', () => {
    const emailOptions = {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML content</p>',
      text: 'Test text content',
    };

    describe('Modo Desenvolvimento (sem API Key)', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        delete process.env.RESEND_API_KEY;
      });

      it('deve simular envio em desenvolvimento', async () => {
        const result = await sendEmail(emailOptions);

        expect(result.success).toBe(true);
        expect(consoleSpy.log).toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
      });

      it('deve logar informacoes do email simulado', async () => {
        await sendEmail(emailOptions);

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('EMAIL SIMULADO');
        expect(logCalls).toContain(emailOptions.to);
        expect(logCalls).toContain(emailOptions.subject);
      });
    });

    describe('Com Resend API Key', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        process.env.RESEND_API_KEY = 'test-api-key';
        process.env.EMAIL_FROM = 'sender@test.com';
      });

      it('deve enviar email via Resend com sucesso', async () => {
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });

        const result = await sendEmail(emailOptions);

        expect(result.success).toBe(true);
        expect(mockSend).toHaveBeenCalledWith({
          from: 'sender@test.com',
          to: emailOptions.to,
          subject: emailOptions.subject,
          html: emailOptions.html,
          text: emailOptions.text,
        });
      });

      it('deve usar email padrao quando EMAIL_FROM nao esta configurado', async () => {
        delete process.env.EMAIL_FROM;
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });

        await sendEmail(emailOptions);

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'noreply@profbarral.com.br',
          })
        );
      });

      it('deve retornar false quando Resend falha', async () => {
        mockSend.mockRejectedValue(new Error('API Error'));

        const result = await sendEmail(emailOptions);

        expect(result.success).toBe(false);
        expect(consoleSpy.error).toHaveBeenCalled();
      });

      it('deve enviar email sem texto opcional', async () => {
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });
        const optionsWithoutText = {
          to: emailOptions.to,
          subject: emailOptions.subject,
          html: emailOptions.html,
        };

        await sendEmail(optionsWithoutText);

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            text: undefined,
          })
        );
      });
    });

    describe('Sem API Key (Fallback)', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        delete process.env.RESEND_API_KEY;
      });

      it('deve retornar false e logar aviso', async () => {
        const result = await sendEmail(emailOptions);

        expect(result.success).toBe(false);
        expect(consoleSpy.warn).toHaveBeenCalled();
        const warnCalls = consoleSpy.warn.mock.calls.flat().join(' ');
        expect(warnCalls).toContain('RESEND_API_KEY');
      });
    });
  });

  describe('sendVerificationEmail', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      delete process.env.RESEND_API_KEY;
    });

    it('deve gerar URL de verificacao correta', async () => {
      await sendVerificationEmail('user@test.com', 'Test User', 'token-123');

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('https://test.com/verificar-email?token=token-123');
    });

    it('deve incluir nome do usuario no email', async () => {
      await sendVerificationEmail('user@test.com', 'Maria Silva', 'token-123');

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('Maria Silva');
    });

    it('deve ter assunto correto', async () => {
      await sendVerificationEmail('user@test.com', 'Test', 'token');

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('Confirme seu email');
    });

    it('deve retornar true em desenvolvimento', async () => {
      const result = await sendVerificationEmail('user@test.com', 'Test', 'token');
      expect(result).toBe(true);
    });
  });

  describe('sendPasswordResetEmail', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      delete process.env.RESEND_API_KEY;
    });

    it('deve gerar URL de reset correta (verificado via Resend em prod)', async () => {
      // Configurar para produção para verificar o conteudo completo
      (process.env as Record<string, string>).NODE_ENV = 'production';
      process.env.RESEND_API_KEY = 'test-key';
      mockSend.mockResolvedValue({ data: { id: '123' } });

      await sendPasswordResetEmail('user@test.com', 'Test User', 'reset-token');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://test.com/redefinir-senha?token=reset-token'),
        })
      );
    });

    it('deve ter assunto de recuperacao de senha', async () => {
      await sendPasswordResetEmail('user@test.com', 'Test', 'token');

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('Recuperação de Senha');
    });

    it('deve retornar true em desenvolvimento', async () => {
      const result = await sendPasswordResetEmail('user@test.com', 'Test', 'token');
      expect(result).toBe(true);
    });
  });

  describe('sendExpirationNotification', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      delete process.env.RESEND_API_KEY;
    });

    const expiresAt = new Date('2025-06-15T00:00:00Z');

    it('deve mostrar dias restantes corretamente (7 dias ou menos)', async () => {
      await sendExpirationNotification('user@test.com', 'Test', 'course-1', 5, expiresAt);

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('apenas 5 dias');
    });

    it('deve mostrar singular para 1 dia', async () => {
      await sendExpirationNotification('user@test.com', 'Test', 'course-1', 1, expiresAt);

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('apenas 1 dia');
    });

    it('deve mostrar dias para 8-30 dias', async () => {
      await sendExpirationNotification('user@test.com', 'Test', 'course-1', 15, expiresAt);

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('15 dias');
    });

    it('deve mostrar meses para mais de 30 dias', async () => {
      await sendExpirationNotification('user@test.com', 'Test', 'course-1', 60, expiresAt);

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('aproximadamente 2 meses');
    });

    it('deve mostrar singular para 1 mes', async () => {
      await sendExpirationNotification('user@test.com', 'Test', 'course-1', 35, expiresAt);

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('aproximadamente 1 mês');
    });

    it('deve gerar URL de upgrade correta (verificado via Resend em prod)', async () => {
      // Configurar para produção para verificar o conteudo completo
      (process.env as Record<string, string>).NODE_ENV = 'production';
      process.env.RESEND_API_KEY = 'test-key';
      mockSend.mockResolvedValue({ data: { id: '123' } });

      await sendExpirationNotification('user@test.com', 'Test', 'course-abc', 30, expiresAt);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://test.com/upgrade/course-abc'),
        })
      );
    });

    it('deve retornar true em desenvolvimento', async () => {
      const result = await sendExpirationNotification('user@test.com', 'Test', 'c1', 30, expiresAt);
      expect(result).toBe(true);
    });
  });

  describe('sendContactNotification', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      delete process.env.RESEND_API_KEY;
      process.env.ADMIN_EMAIL = 'admin@test.com';
    });

    const contactData = {
      name: 'Joao Silva',
      email: 'joao@test.com',
      phone: '11999999999',
      courseInterest: 'Nova Lei de Licitacoes',
      message: 'Tenho interesse no curso',
    };

    it('deve enviar para email do admin', async () => {
      await sendContactNotification(contactData, 'contact-123');

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      // Em desenvolvimento, loga o destinatário
      expect(logCalls).toContain('admin@test.com');
    });

    it('deve identificar depoimento corretamente', async () => {
      const testimonialData = {
        ...contactData,
        courseInterest: 'depoimento',
      };

      await sendContactNotification(testimonialData, 'contact-123');

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('Depoimento');
    });

    it('deve incluir dados do contato', async () => {
      await sendContactNotification(contactData, 'contact-123');

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain(contactData.name);
      expect(logCalls).toContain(contactData.email);
    });

    it('deve funcionar sem telefone', async () => {
      const dataWithoutPhone = {
        name: 'Test',
        email: 'test@test.com',
        message: 'Mensagem teste',
      };

      const result = await sendContactNotification(dataWithoutPhone, 'contact-123');
      expect(result).toBe(true);
    });

    it('deve usar email padrao quando ADMIN_EMAIL nao configurado', async () => {
      delete process.env.ADMIN_EMAIL;

      await sendContactNotification(contactData, 'contact-123');

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      // O email padrão é 'admin@profdanielbarral.com'
      expect(logCalls).toContain('admin@profdanielbarral.com');
    });
  });

  describe('sendNewDocumentsNotification', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      delete process.env.RESEND_API_KEY;
    });

    const documents = [
      {
        title: 'Apostila de Licitacoes',
        description: 'Material completo',
        category: 'apostila',
        uploadedAt: new Date('2025-01-15'),
      },
      {
        title: 'Jurisprudencia TCU',
        description: null,
        category: 'acordao',
        uploadedAt: new Date('2025-01-15'),
      },
    ];

    it('deve incluir titulo do curso', async () => {
      await sendNewDocumentsNotification(
        'user@test.com',
        'Test User',
        'Nova Lei de Licitacoes',
        documents
      );

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('Nova Lei de Licitacoes');
    });

    it('deve mostrar quantidade correta de documentos', async () => {
      await sendNewDocumentsNotification(
        'user@test.com',
        'Test',
        'Curso',
        documents
      );

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('2 novos materiais');
    });

    it('deve usar singular para 1 documento', async () => {
      await sendNewDocumentsNotification(
        'user@test.com',
        'Test',
        'Curso',
        [documents[0]]
      );

      const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
      expect(logCalls).toContain('1 novo material');
    });

    it('deve incluir titulos dos documentos (verificado via Resend em prod)', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      process.env.RESEND_API_KEY = 'test-key';
      mockSend.mockResolvedValue({ data: { id: '123' } });

      await sendNewDocumentsNotification(
        'user@test.com',
        'Test',
        'Curso',
        documents
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Apostila de Licitacoes'),
        })
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Jurisprudencia TCU'),
        })
      );
    });

    it('deve agrupar documentos por categoria (verificado via Resend em prod)', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      process.env.RESEND_API_KEY = 'test-key';
      mockSend.mockResolvedValue({ data: { id: '123' } });

      await sendNewDocumentsNotification(
        'user@test.com',
        'Test',
        'Curso',
        documents
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Apostilas'),
        })
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Acórdãos'),
        })
      );
    });

    it('deve gerar URL da area restrita (verificado via Resend em prod)', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      process.env.RESEND_API_KEY = 'test-key';
      mockSend.mockResolvedValue({ data: { id: '123' } });

      await sendNewDocumentsNotification(
        'user@test.com',
        'Test',
        'Curso',
        documents
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://test.com/area-restrita'),
        })
      );
    });

    it('deve lidar com categoria desconhecida', async () => {
      const docsWithUnknownCategory = [
        { ...documents[0], category: 'categoria-inexistente' },
      ];

      const result = await sendNewDocumentsNotification(
        'user@test.com',
        'Test',
        'Curso',
        docsWithUnknownCategory
      );

      expect(result).toBe(true);
    });

    it('deve retornar true em desenvolvimento', async () => {
      const result = await sendNewDocumentsNotification(
        'user@test.com',
        'Test',
        'Curso',
        documents
      );
      expect(result).toBe(true);
    });
  });

  describe('Integracao com Resend', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.EMAIL_FROM = 'sender@test.com';
      mockSend.mockResolvedValue({ data: { id: 'email-123' } });
    });

    it('sendVerificationEmail deve usar Resend em producao', async () => {
      const result = await sendVerificationEmail('user@test.com', 'Test', 'token');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: expect.stringContaining('Confirme seu email'),
        })
      );
    });

    it('sendPasswordResetEmail deve usar Resend em producao', async () => {
      const result = await sendPasswordResetEmail('user@test.com', 'Test', 'token');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: expect.stringContaining('Recuperação de Senha'),
        })
      );
    });

    it('sendExpirationNotification deve usar Resend em producao', async () => {
      const result = await sendExpirationNotification(
        'user@test.com',
        'Test',
        'course-1',
        30,
        new Date()
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: expect.stringContaining('expira'),
        })
      );
    });

    it('sendContactNotification deve usar Resend em producao', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';

      const result = await sendContactNotification(
        { name: 'Test', email: 'test@test.com', message: 'Msg' },
        'contact-1'
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com',
        })
      );
    });

    it('sendNewDocumentsNotification deve usar Resend em producao', async () => {
      const result = await sendNewDocumentsNotification(
        'user@test.com',
        'Test',
        'Curso',
        [{ title: 'Doc', category: 'apostila', uploadedAt: new Date() }]
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: expect.stringContaining('material'),
        })
      );
    });
  });
});
