import { z } from 'zod';

/**
 * Schemas Zod para validação de input em rotas API
 * Centralizado para reutilização e consistência
 */

// ============================================================================
// AUTENTICAÇÃO
// ============================================================================

export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const RegisterSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
  qrCodeId: z
    .string({ required_error: 'Código QR é obrigatório' })
    .min(1, 'Código QR inválido'),
});

export const ResetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Token é obrigatório' })
    .min(1, 'Token inválido'),
  newPassword: z
    .string({ required_error: 'Nova senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const VerifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'Token é obrigatório' })
    .min(1, 'Token inválido'),
});

// ============================================================================
// ENROLLMENT
// ============================================================================

export const EnrollmentActivateSchema = z.object({
  qrCodeId: z
    .string({ required_error: 'Código QR é obrigatório' })
    .min(1, 'Código QR inválido'),
});

export const EnrollmentUpgradeSchema = z.object({
  enrollmentId: z
    .string({ required_error: 'ID da matrícula é obrigatório' })
    .min(1, 'ID da matrícula inválido'),
});

// ============================================================================
// DOCUMENTOS
// ============================================================================

export const DocumentQuerySchema = z.object({
  courseId: z
    .string({ required_error: 'ID do curso é obrigatório' })
    .min(1, 'ID do curso inválido'),
});

export const DocumentIdSchema = z.object({
  id: z
    .string({ required_error: 'ID do documento é obrigatório' })
    .min(1, 'ID do documento inválido'),
});

// ============================================================================
// ADMIN - DOCUMENTOS
// ============================================================================

export const AdminDocumentCreateSchema = z.object({
  title: z
    .string({ required_error: 'Título é obrigatório' })
    .min(1, 'Título não pode ser vazio')
    .max(255, 'Título muito longo'),
  description: z
    .string()
    .max(1000, 'Descrição muito longa')
    .optional(),
  courseId: z
    .string({ required_error: 'ID do curso é obrigatório' })
    .min(1, 'ID do curso inválido'),
  type: z.enum(['pdf', 'link', 'video', 'word', 'excel'], {
    errorMap: () => ({ message: 'Tipo de documento inválido' })
  }),
  url: z
    .string({ required_error: 'URL é obrigatória' })
    .min(1, 'URL não pode ser vazia'),
  isPublic: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
});

export const AdminDocumentUpdateSchema = AdminDocumentCreateSchema.partial();

// ============================================================================
// ADMIN - QR CODES
// ============================================================================

export const AdminQRCodeCreateSchema = z.object({
  courseId: z
    .string({ required_error: 'ID do curso é obrigatório' })
    .min(1, 'ID do curso inválido'),
  turma: z
    .string()
    .max(100, 'Nome da turma muito longo')
    .optional(),
  expiresAt: z
    .string()
    .datetime('Data de expiração inválida')
    .optional(),
  isLifetime: z.boolean().optional().default(false),
  maxUses: z
    .number()
    .int('Número de usos deve ser um inteiro')
    .positive('Número de usos deve ser positivo')
    .optional(),
});

// ============================================================================
// CONTATO
// ============================================================================

export const ContactFormSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  subject: z
    .string({ required_error: 'Assunto é obrigatório' })
    .min(3, 'Assunto deve ter no mínimo 3 caracteres')
    .max(200, 'Assunto muito longo'),
  message: z
    .string({ required_error: 'Mensagem é obrigatória' })
    .min(10, 'Mensagem deve ter no mínimo 10 caracteres')
    .max(2000, 'Mensagem muito longa'),
});

// ============================================================================
// NEWSLETTER
// ============================================================================

export const NewsletterSubscribeSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  name: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo')
    .optional(),
});

// ============================================================================
// TIPOS INFERIDOS (para TypeScript)
// ============================================================================

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type EnrollmentActivateInput = z.infer<typeof EnrollmentActivateSchema>;
export type EnrollmentUpgradeInput = z.infer<typeof EnrollmentUpgradeSchema>;
export type DocumentQueryInput = z.infer<typeof DocumentQuerySchema>;
export type DocumentIdInput = z.infer<typeof DocumentIdSchema>;
export type AdminDocumentCreateInput = z.infer<typeof AdminDocumentCreateSchema>;
export type AdminDocumentUpdateInput = z.infer<typeof AdminDocumentUpdateSchema>;
export type AdminQRCodeCreateInput = z.infer<typeof AdminQRCodeCreateSchema>;
export type ContactFormInput = z.infer<typeof ContactFormSchema>;
export type NewsletterSubscribeInput = z.infer<typeof NewsletterSubscribeSchema>;
