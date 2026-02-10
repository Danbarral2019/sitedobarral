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
    .string({ error:'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string({ error:'Senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const RegisterSchema = z.object({
  name: z
    .string({ error:'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z
    .string({ error:'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string({ error:'Senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
  qrCodeId: z
    .string({ error:'Código QR é obrigatório' })
    .min(1, 'Código QR inválido'),
});

export const ResetPasswordSchema = z.object({
  token: z
    .string({ error:'Token é obrigatório' })
    .min(1, 'Token inválido'),
  newPassword: z
    .string({ error:'Nova senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const VerifyEmailSchema = z.object({
  token: z
    .string({ error:'Token é obrigatório' })
    .min(1, 'Token inválido'),
});

// ============================================================================
// ENROLLMENT
// ============================================================================

export const EnrollmentActivateSchema = z.object({
  qrCodeId: z
    .string({ error:'Código QR é obrigatório' })
    .min(1, 'Código QR inválido'),
});

export const EnrollmentUpgradeSchema = z.object({
  enrollmentId: z
    .string({ error:'ID da matrícula é obrigatório' })
    .min(1, 'ID da matrícula inválido'),
});

// ============================================================================
// DOCUMENTOS
// ============================================================================

export const DocumentQuerySchema = z.object({
  courseId: z
    .string({ error:'ID do curso é obrigatório' })
    .min(1, 'ID do curso inválido'),
});

export const DocumentIdSchema = z.object({
  id: z
    .string({ error:'ID do documento é obrigatório' })
    .min(1, 'ID do documento inválido'),
});

// ============================================================================
// ADMIN - DOCUMENTOS
// ============================================================================

export const AdminDocumentCreateSchema = z.object({
  title: z
    .string({ error:'Título é obrigatório' })
    .min(1, 'Título não pode ser vazio')
    .max(255, 'Título muito longo'),
  description: z
    .string()
    .max(1000, 'Descrição muito longa')
    .optional(),
  courseId: z
    .string({ error:'ID do curso é obrigatório' })
    .min(1, 'ID do curso inválido'),
  type: z.enum(['pdf', 'link', 'video', 'word', 'excel'], {
    error: 'Tipo de documento inválido'
  }),
  url: z
    .string({ error:'URL é obrigatória' })
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
    .string({ error:'ID do curso é obrigatório' })
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
    .string({ error:'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z
    .string({ error:'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  subject: z
    .string({ error:'Assunto é obrigatório' })
    .min(3, 'Assunto deve ter no mínimo 3 caracteres')
    .max(200, 'Assunto muito longo'),
  message: z
    .string({ error:'Mensagem é obrigatória' })
    .min(10, 'Mensagem deve ter no mínimo 10 caracteres')
    .max(2000, 'Mensagem muito longa'),
});

// ============================================================================
// NEWSLETTER
// ============================================================================

export const NewsletterSubscribeSchema = z.object({
  email: z
    .string({ error:'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  name: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo')
    .optional(),
});

// ============================================================================
// LMS — MÓDULOS
// ============================================================================

export const CreateModuleSchema = z.object({
  courseId: z.string().min(1, 'ID do curso é obrigatório'),
  title: z.string().min(1, 'Título é obrigatório').max(255, 'Título muito longo'),
  description: z.string().max(2000, 'Descrição muito longa').optional(),
  displayOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export const UpdateModuleSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255, 'Título muito longo').optional(),
  description: z.string().max(2000, 'Descrição muito longa').nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

// ============================================================================
// LMS — LIÇÕES
// ============================================================================

export const CreateLessonSchema = z.object({
  moduleId: z.string().min(1, 'ID do módulo é obrigatório'),
  title: z.string().min(1, 'Título é obrigatório').max(255, 'Título muito longo'),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  description: z.string().max(2000, 'Descrição muito longa').optional(),
  content: z.string().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
  leiArticles: z.array(z.string()).optional(),
});

export const UpdateLessonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).nullable().optional(),
  content: z.string().nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
  leiArticles: z.array(z.string()).nullable().optional(),
  aiSummary: z.string().nullable().optional(),
  aiKeyPoints: z.array(z.string()).nullable().optional(),
});

// ============================================================================
// LMS — PROGRESSO
// ============================================================================

export const UpdateLessonProgressSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  contentRead: z.boolean().optional(),
  videoWatched: z.string().optional(),
  documentViewed: z.string().optional(),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

// ============================================================================
// LMS — COMENTÁRIOS
// ============================================================================

export const CreateLessonCommentSchema = z.object({
  content: z.string().min(1, 'Comentário não pode ser vazio').max(5000, 'Comentário muito longo'),
  parentId: z.string().optional(),
});

// ============================================================================
// LMS — VÍNCULOS
// ============================================================================

export const LinkLessonDocumentSchema = z.object({
  documentId: z.string().min(1, 'ID do documento é obrigatório'),
  displayOrder: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

export const LinkLessonVideoSchema = z.object({
  courseVideoId: z.string().optional(),
  title: z.string().min(1, 'Título é obrigatório').max(255),
  youtubeUrl: z.string().url('URL do YouTube inválida'),
  youtubeId: z.string().min(1, 'ID do YouTube é obrigatório'),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
});

// ============================================================================
// LMS — REORDENAÇÃO
// ============================================================================

export const ReorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    displayOrder: z.number().int().min(0),
  })),
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

// LMS types
export type CreateModuleInput = z.infer<typeof CreateModuleSchema>;
export type UpdateModuleInput = z.infer<typeof UpdateModuleSchema>;
export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;
export type UpdateLessonInput = z.infer<typeof UpdateLessonSchema>;
export type UpdateLessonProgressInput = z.infer<typeof UpdateLessonProgressSchema>;
export type CreateLessonCommentInput = z.infer<typeof CreateLessonCommentSchema>;
export type LinkLessonDocumentInput = z.infer<typeof LinkLessonDocumentSchema>;
export type LinkLessonVideoInput = z.infer<typeof LinkLessonVideoSchema>;
export type ReorderInput = z.infer<typeof ReorderSchema>;
