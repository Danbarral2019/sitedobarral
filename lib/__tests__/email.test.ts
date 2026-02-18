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
  sendWelcomeEmail,
  sendTcuHighlightAlert,
  sendCourseWelcomeEmail,
  sendModuleCompletionEmail,
  sendInactivityReminderEmail,
  sendCertificateNotification,
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

  describe('sendWelcomeEmail', () => {
    describe('Modo Desenvolvimento', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        delete process.env.RESEND_API_KEY;
      });

      it('deve incluir nome do usuario no email', async () => {
        await sendWelcomeEmail('user@test.com', 'Maria Silva');

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('Maria Silva');
      });

      it('deve ter assunto de boas-vindas', async () => {
        await sendWelcomeEmail('user@test.com', 'Test User');

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('Bem-vindo');
      });

      it('deve retornar true em desenvolvimento', async () => {
        const result = await sendWelcomeEmail('user@test.com', 'Test');
        expect(result).toBe(true);
      });
    });

    describe('Com Resend em producao', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        process.env.RESEND_API_KEY = 'test-key';
        process.env.EMAIL_FROM = 'sender@test.com';
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });
      });

      it('deve enviar via Resend com subject e destinatario corretos', async () => {
        const result = await sendWelcomeEmail('user@test.com', 'Test User');

        expect(result).toBe(true);
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@test.com',
            from: 'sender@test.com',
            subject: expect.stringContaining('Bem-vindo'),
            html: expect.stringContaining('Test User'),
          })
        );
      });

      it('deve incluir link para area restrita no html', async () => {
        await sendWelcomeEmail('user@test.com', 'Test');

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('area-restrita'),
          })
        );
      });
    });
  });

  describe('sendTcuHighlightAlert', () => {
    const highlights = [
      {
        id: 'highlight-1',
        title: 'Acordao TCU 1234/2025',
        score: 90,
        thesisSummary: 'Tese sobre licitacao',
        whyImportant: 'Muda entendimento sobre pregao',
        articleAngle: 'Impacto da decisao no pregao eletronico',
        leiConnections: [{ article: '75', connection: 'Modalidades' }],
        documentUrl: 'https://example.com/acordao-1234',
      },
    ];

    describe('Modo Desenvolvimento', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        delete process.env.RESEND_API_KEY;
        process.env.ADMIN_EMAIL = 'admin@test.com';
      });

      it('deve enviar para email do admin', async () => {
        await sendTcuHighlightAlert(highlights);

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('admin@test.com');
      });

      it('deve incluir quantidade de acordaos no assunto', async () => {
        await sendTcuHighlightAlert(highlights);

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('1 acordao');
      });

      it('deve retornar true em desenvolvimento', async () => {
        const result = await sendTcuHighlightAlert(highlights);
        expect(result).toBe(true);
      });
    });

    describe('Com Resend em producao', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        process.env.RESEND_API_KEY = 'test-key';
        process.env.ADMIN_EMAIL = 'admin@test.com';
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });
      });

      it('deve enviar via Resend com titulo e score no html', async () => {
        const result = await sendTcuHighlightAlert(highlights);

        expect(result).toBe(true);
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'admin@test.com',
            subject: expect.stringContaining('[TCU]'),
            html: expect.stringContaining('Acordao TCU 1234/2025'),
          })
        );
      });

      it('deve incluir conexoes com a Lei no html', async () => {
        await sendTcuHighlightAlert(highlights);

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('Art. 75'),
          })
        );
      });

      it('deve lidar com multiplos highlights', async () => {
        const multipleHighlights = [
          ...highlights,
          {
            id: 'highlight-2',
            title: 'Acordao TCU 5678/2025',
            score: 70,
            thesisSummary: 'Segunda tese',
            whyImportant: 'Relevante para contratos',
            articleAngle: 'Angulo editorial',
            leiConnections: [],
            documentUrl: 'https://example.com/acordao-5678',
          },
        ];

        const result = await sendTcuHighlightAlert(multipleHighlights);

        expect(result).toBe(true);
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.stringContaining('2 acordao'),
            html: expect.stringContaining('Acordao TCU 5678/2025'),
          })
        );
      });
    });
  });

  describe('sendCourseWelcomeEmail', () => {
    describe('Modo Desenvolvimento', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        delete process.env.RESEND_API_KEY;
      });

      it('deve incluir nome do curso no email', async () => {
        await sendCourseWelcomeEmail('user@test.com', 'Test', 'Nova Lei de Licitacoes', 'nova-lei');

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('Nova Lei de Licitacoes');
      });

      it('deve ter assunto com titulo do curso', async () => {
        await sendCourseWelcomeEmail('user@test.com', 'Test', 'Gestao de Contratos', 'gestao');

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('Gestao de Contratos');
      });

      it('deve retornar true em desenvolvimento', async () => {
        const result = await sendCourseWelcomeEmail('user@test.com', 'Test', 'Curso', 'curso');
        expect(result).toBe(true);
      });
    });

    describe('Com Resend em producao', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        process.env.RESEND_API_KEY = 'test-key';
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });
      });

      it('deve enviar via Resend com URL do curso correta', async () => {
        const result = await sendCourseWelcomeEmail(
          'user@test.com',
          'Maria',
          'Nova Lei de Licitacoes',
          'nova-lei-licitacoes'
        );

        expect(result).toBe(true);
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@test.com',
            subject: expect.stringContaining('Nova Lei de Licitacoes'),
            html: expect.stringContaining('area-restrita/curso/nova-lei-licitacoes'),
          })
        );
      });
    });
  });

  describe('sendModuleCompletionEmail', () => {
    describe('Modo Desenvolvimento', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        delete process.env.RESEND_API_KEY;
      });

      it('deve incluir nome do modulo no email', async () => {
        await sendModuleCompletionEmail(
          'user@test.com', 'Test', 'Curso X', 'Modulo 1: Introducao', 'curso-x'
        );

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('Modulo 1: Introducao');
      });

      it('deve incluir nome do curso no email', async () => {
        await sendModuleCompletionEmail(
          'user@test.com', 'Test', 'Nova Lei de Licitacoes', 'Modulo 1', 'nova-lei'
        );

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('Nova Lei de Licitacoes');
      });

      it('deve retornar true em desenvolvimento', async () => {
        const result = await sendModuleCompletionEmail(
          'user@test.com', 'Test', 'Curso', 'Modulo', 'curso'
        );
        expect(result).toBe(true);
      });
    });

    describe('Com Resend em producao', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        process.env.RESEND_API_KEY = 'test-key';
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });
      });

      it('deve enviar via Resend com subject contendo modulo e curso', async () => {
        const result = await sendModuleCompletionEmail(
          'user@test.com',
          'Maria',
          'Nova Lei de Licitacoes',
          'Modulo 3: Pregao Eletronico',
          'nova-lei'
        );

        expect(result).toBe(true);
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@test.com',
            subject: expect.stringContaining('Modulo 3: Pregao Eletronico'),
            html: expect.stringContaining('Nova Lei de Licitacoes'),
          })
        );
      });

      it('deve incluir link para continuar o curso', async () => {
        await sendModuleCompletionEmail(
          'user@test.com', 'Test', 'Curso', 'Modulo 1', 'meu-curso'
        );

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('area-restrita/curso/meu-curso'),
          })
        );
      });
    });
  });

  describe('sendInactivityReminderEmail', () => {
    describe('Modo Desenvolvimento', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        delete process.env.RESEND_API_KEY;
      });

      it('deve incluir dias de inatividade no email', async () => {
        await sendInactivityReminderEmail(
          'user@test.com', 'Test', 'Curso X', 'curso-x', 14
        );

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('14 dias');
      });

      it('deve incluir nome do curso no email', async () => {
        await sendInactivityReminderEmail(
          'user@test.com', 'Test', 'Nova Lei de Licitacoes', 'nova-lei', 7
        );

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('Nova Lei de Licitacoes');
      });

      it('deve retornar true em desenvolvimento', async () => {
        const result = await sendInactivityReminderEmail(
          'user@test.com', 'Test', 'Curso', 'curso', 10
        );
        expect(result).toBe(true);
      });
    });

    describe('Com Resend em producao', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        process.env.RESEND_API_KEY = 'test-key';
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });
      });

      it('deve enviar via Resend com subject contendo nome do curso', async () => {
        const result = await sendInactivityReminderEmail(
          'user@test.com',
          'Joao',
          'Gestao de Contratos',
          'gestao-contratos',
          21
        );

        expect(result).toBe(true);
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@test.com',
            subject: expect.stringContaining('Gestao de Contratos'),
            html: expect.stringContaining('21 dias'),
          })
        );
      });

      it('deve incluir link para retomar o curso', async () => {
        await sendInactivityReminderEmail(
          'user@test.com', 'Test', 'Curso', 'meu-curso', 10
        );

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('area-restrita/curso/meu-curso'),
          })
        );
      });
    });
  });

  describe('sendCertificateNotification', () => {
    describe('Modo Desenvolvimento', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        delete process.env.RESEND_API_KEY;
      });

      it('deve incluir numero do certificado no email', async () => {
        await sendCertificateNotification(
          'user@test.com', 'Test', 'Curso X', 'CERT-2025-001', 'https://test.com/verify/CERT-2025-001'
        );

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('CERT-2025-001');
      });

      it('deve incluir nome do curso no email', async () => {
        await sendCertificateNotification(
          'user@test.com', 'Test', 'Nova Lei de Licitacoes', 'CERT-001', 'https://test.com/verify'
        );

        const logCalls = consoleSpy.log.mock.calls.flat().join(' ');
        expect(logCalls).toContain('Nova Lei de Licitacoes');
      });

      it('deve retornar true em desenvolvimento', async () => {
        const result = await sendCertificateNotification(
          'user@test.com', 'Test', 'Curso', 'CERT-001', 'https://test.com/verify'
        );
        expect(result).toBe(true);
      });
    });

    describe('Com Resend em producao', () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        process.env.RESEND_API_KEY = 'test-key';
        mockSend.mockResolvedValue({ data: { id: 'email-123' } });
      });

      it('deve enviar via Resend com subject, certificado e URL de verificacao', async () => {
        const result = await sendCertificateNotification(
          'user@test.com',
          'Maria Silva',
          'Nova Lei de Licitacoes',
          'CERT-2025-042',
          'https://profbarral.com.br/verify/CERT-2025-042'
        );

        expect(result).toBe(true);
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@test.com',
            subject: expect.stringContaining('Nova Lei de Licitacoes'),
            html: expect.stringContaining('CERT-2025-042'),
          })
        );
      });

      it('deve incluir URL de verificacao no html', async () => {
        await sendCertificateNotification(
          'user@test.com', 'Test', 'Curso', 'CERT-001', 'https://profbarral.com.br/verify/CERT-001'
        );

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('https://profbarral.com.br/verify/CERT-001'),
          })
        );
      });

      it('deve incluir link para download do certificado', async () => {
        await sendCertificateNotification(
          'user@test.com', 'Test', 'Curso', 'CERT-001', 'https://test.com/verify'
        );

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('certificado/CERT-001'),
          })
        );
      });
    });
  });

  describe('sendEmail - Logica de Retry', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      process.env.RESEND_API_KEY = 'test-key';
    });

    const emailOptions = {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    };

    it('deve fazer retry em erro retryable e ter sucesso na segunda tentativa', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValueOnce({ data: { id: 'email-123' } });

      const result = await sendEmail(emailOptions);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('deve falhar apos esgotar tentativas com erro retryable', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'));

      const result = await sendEmail(emailOptions);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('deve nao fazer retry em erro nao-retryable', async () => {
      mockSend.mockRejectedValueOnce(new Error('invalid API key'));

      const result = await sendEmail(emailOptions);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
