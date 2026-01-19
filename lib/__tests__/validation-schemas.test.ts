/**
 * Testes para lib/validation-schemas.ts
 *
 * Testa todos os schemas Zod de validação usados nas rotas API.
 */

import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  ContactFormSchema,
  NewsletterSubscribeSchema,
  AdminDocumentCreateSchema,
  AdminQRCodeCreateSchema,
  DocumentQuerySchema,
} from '../validation-schemas';

describe('Validation Schemas', () => {
  describe('LoginSchema', () => {
    it('deve validar login válido', () => {
      const result = LoginSchema.safeParse({
        email: 'usuario@teste.com',
        password: 'senha123',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar email inválido', () => {
      const result = LoginSchema.safeParse({
        email: 'nao-e-email',
        password: 'senha123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Email inválido');
      }
    });

    it('deve rejeitar email vazio', () => {
      const result = LoginSchema.safeParse({
        email: '',
        password: 'senha123',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar senha curta (menos de 6 caracteres)', () => {
      const result = LoginSchema.safeParse({
        email: 'usuario@teste.com',
        password: '12345',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('6 caracteres');
      }
    });

    it('deve rejeitar senha muito longa (mais de 100 caracteres)', () => {
      const result = LoginSchema.safeParse({
        email: 'usuario@teste.com',
        password: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar se email estiver faltando', () => {
      const result = LoginSchema.safeParse({
        password: 'senha123',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar se senha estiver faltando', () => {
      const result = LoginSchema.safeParse({
        email: 'usuario@teste.com',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RegisterSchema', () => {
    const validRegister = {
      name: 'João Silva',
      email: 'joao@teste.com',
      password: 'senha123',
      qrCodeId: 'qr-code-123',
    };

    it('deve validar registro válido', () => {
      const result = RegisterSchema.safeParse(validRegister);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar nome curto (menos de 2 caracteres)', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        name: 'J',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar nome muito longo (mais de 100 caracteres)', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        name: 'J'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar qrCodeId vazio', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        qrCodeId: '',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar email inválido', () => {
      const result = RegisterSchema.safeParse({
        ...validRegister,
        email: 'email-invalido',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar campos faltando', () => {
      const result = RegisterSchema.safeParse({
        email: 'joao@teste.com',
        password: 'senha123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ResetPasswordSchema', () => {
    it('deve validar reset válido', () => {
      const result = ResetPasswordSchema.safeParse({
        token: 'token-reset-123',
        newPassword: 'novaSenha123',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar token vazio', () => {
      const result = ResetPasswordSchema.safeParse({
        token: '',
        newPassword: 'novaSenha123',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar nova senha curta', () => {
      const result = ResetPasswordSchema.safeParse({
        token: 'token-123',
        newPassword: '12345',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ContactFormSchema', () => {
    const validContact = {
      name: 'Maria Santos',
      email: 'maria@teste.com',
      subject: 'Dúvida sobre o curso',
      message: 'Gostaria de saber mais informações sobre o curso de licitações.',
    };

    it('deve validar formulário válido', () => {
      const result = ContactFormSchema.safeParse(validContact);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar assunto curto (menos de 3 caracteres)', () => {
      const result = ContactFormSchema.safeParse({
        ...validContact,
        subject: 'Oi',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar mensagem curta (menos de 10 caracteres)', () => {
      const result = ContactFormSchema.safeParse({
        ...validContact,
        message: 'Curta',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar mensagem muito longa (mais de 2000 caracteres)', () => {
      const result = ContactFormSchema.safeParse({
        ...validContact,
        message: 'M'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar mensagem no limite (2000 caracteres)', () => {
      const result = ContactFormSchema.safeParse({
        ...validContact,
        message: 'M'.repeat(2000),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('NewsletterSubscribeSchema', () => {
    it('deve validar apenas com email', () => {
      const result = NewsletterSubscribeSchema.safeParse({
        email: 'newsletter@teste.com',
      });
      expect(result.success).toBe(true);
    });

    it('deve validar com email e nome', () => {
      const result = NewsletterSubscribeSchema.safeParse({
        email: 'newsletter@teste.com',
        name: 'Ana Costa',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar email inválido', () => {
      const result = NewsletterSubscribeSchema.safeParse({
        email: 'invalido',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar nome muito curto se fornecido', () => {
      const result = NewsletterSubscribeSchema.safeParse({
        email: 'newsletter@teste.com',
        name: 'A',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AdminDocumentCreateSchema', () => {
    const validDocument = {
      title: 'Manual de Licitações',
      courseId: 'course-1',
      type: 'pdf' as const,
      url: 'https://example.com/manual.pdf',
    };

    it('deve validar documento válido', () => {
      const result = AdminDocumentCreateSchema.safeParse(validDocument);
      expect(result.success).toBe(true);
    });

    it('deve validar com campos opcionais', () => {
      const result = AdminDocumentCreateSchema.safeParse({
        ...validDocument,
        description: 'Descrição do documento',
        isPublic: true,
        tags: ['licitação', 'manual'],
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar tipo inválido', () => {
      const result = AdminDocumentCreateSchema.safeParse({
        ...validDocument,
        type: 'imagem', // tipo inválido
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar todos os tipos válidos', () => {
      const validTypes = ['pdf', 'link', 'video', 'word', 'excel'];

      for (const type of validTypes) {
        const result = AdminDocumentCreateSchema.safeParse({
          ...validDocument,
          type,
        });
        expect(result.success).toBe(true);
      }
    });

    it('deve rejeitar título vazio', () => {
      const result = AdminDocumentCreateSchema.safeParse({
        ...validDocument,
        title: '',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar título muito longo', () => {
      const result = AdminDocumentCreateSchema.safeParse({
        ...validDocument,
        title: 'T'.repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it('deve usar isPublic false por padrão', () => {
      const result = AdminDocumentCreateSchema.safeParse(validDocument);
      if (result.success) {
        expect(result.data.isPublic).toBe(false);
      }
    });

    it('deve usar tags vazio por padrão', () => {
      const result = AdminDocumentCreateSchema.safeParse(validDocument);
      if (result.success) {
        expect(result.data.tags).toEqual([]);
      }
    });
  });

  describe('AdminQRCodeCreateSchema', () => {
    it('deve validar QR code básico', () => {
      const result = AdminQRCodeCreateSchema.safeParse({
        courseId: 'course-1',
      });
      expect(result.success).toBe(true);
    });

    it('deve validar com todos os campos opcionais', () => {
      const result = AdminQRCodeCreateSchema.safeParse({
        courseId: 'course-1',
        turma: 'Turma 2024.1',
        expiresAt: '2024-12-31T23:59:59.999Z',
        isLifetime: false,
        maxUses: 30,
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar courseId vazio', () => {
      const result = AdminQRCodeCreateSchema.safeParse({
        courseId: '',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar expiresAt em formato inválido', () => {
      const result = AdminQRCodeCreateSchema.safeParse({
        courseId: 'course-1',
        expiresAt: '2024-12-31', // formato incompleto
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar maxUses negativo', () => {
      const result = AdminQRCodeCreateSchema.safeParse({
        courseId: 'course-1',
        maxUses: -5,
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar maxUses decimal', () => {
      const result = AdminQRCodeCreateSchema.safeParse({
        courseId: 'course-1',
        maxUses: 10.5,
      });
      expect(result.success).toBe(false);
    });

    it('deve usar isLifetime false por padrão', () => {
      const result = AdminQRCodeCreateSchema.safeParse({
        courseId: 'course-1',
      });
      if (result.success) {
        expect(result.data.isLifetime).toBe(false);
      }
    });
  });

  describe('DocumentQuerySchema', () => {
    it('deve validar courseId válido', () => {
      const result = DocumentQuerySchema.safeParse({
        courseId: 'course-123',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar courseId vazio', () => {
      const result = DocumentQuerySchema.safeParse({
        courseId: '',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar sem courseId', () => {
      const result = DocumentQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com email no limite máximo (255 caracteres)', () => {
      // @teste.com = 10 caracteres, então 245 + 10 = 255
      const longLocalPart = 'a'.repeat(245);
      const email = `${longLocalPart}@teste.com`; // 255 chars

      const result = LoginSchema.safeParse({
        email,
        password: 'senha123',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar email acima do limite', () => {
      // @teste.com = 10 caracteres, então 246 + 10 = 256
      const longLocalPart = 'a'.repeat(246);
      const email = `${longLocalPart}@teste.com`; // 256 chars

      const result = LoginSchema.safeParse({
        email,
        password: 'senha123',
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar caracteres especiais em nome', () => {
      const result = RegisterSchema.safeParse({
        name: "José O'Connor-Müller",
        email: 'jose@teste.com',
        password: 'senha123',
        qrCodeId: 'qr-123',
      });
      expect(result.success).toBe(true);
    });

    it('deve aceitar email com subdomínio', () => {
      const result = LoginSchema.safeParse({
        email: 'usuario@mail.empresa.com.br',
        password: 'senha123',
      });
      expect(result.success).toBe(true);
    });
  });
});
