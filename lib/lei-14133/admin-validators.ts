import { z } from 'zod';

export const CommentSchema = z.object({
  markdown: z.string().max(50_000),
});

const ARTICLE_NUMBER_RE = /^\d+(-[A-Z])?$/;

export const CrossRefSchema = z.object({
  targetNumber: z.string().regex(ARTICLE_NUMBER_RE, 'Número de artigo inválido'),
  note: z.string().min(1).max(500),
  order: z.number().int().nonnegative().optional(),
});

export const CrossRefUpdateSchema = CrossRefSchema.partial();

const INTERNAL_TYPES = ['blog', 'glossary', 'legislative-act', 'document'] as const;
const EXTERNAL_TYPES = ['video', 'article', 'book', 'other'] as const;

export const ReadingSchema = z
  .object({
    kind: z.enum(['internal', 'external']),
    internalType: z.enum(INTERNAL_TYPES).optional(),
    internalId: z.string().min(1).optional(),
    externalUrl: z
      .string()
      .url('URL externa precisa começar com http:// ou https://')
      .optional(),
    externalType: z.enum(EXTERNAL_TYPES).optional(),
    title: z.string().max(300).optional(),
    description: z.string().max(1500).optional(),
    author: z.string().max(200).optional(),
    order: z.number().int().nonnegative().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'internal') {
      if (!val.internalType) {
        ctx.addIssue({ code: 'custom', message: 'internalType obrigatório quando kind=internal', path: ['internalType'] });
      }
      if (!val.internalId) {
        ctx.addIssue({ code: 'custom', message: 'internalId obrigatório quando kind=internal', path: ['internalId'] });
      }
    } else if (val.kind === 'external') {
      if (!val.externalUrl) {
        ctx.addIssue({ code: 'custom', message: 'externalUrl obrigatório quando kind=external', path: ['externalUrl'] });
      }
      if (!val.externalType) {
        ctx.addIssue({ code: 'custom', message: 'externalType obrigatório quando kind=external', path: ['externalType'] });
      }
      if (!val.title) {
        ctx.addIssue({ code: 'custom', message: 'title obrigatório quando kind=external', path: ['title'] });
      }
    }
  });

export const ReadingUpdateSchema = ReadingSchema;

export const ReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids não pode ser vazio'),
});

export type CommentInput = z.infer<typeof CommentSchema>;
export type CrossRefInput = z.infer<typeof CrossRefSchema>;
export type ReadingInput = z.infer<typeof ReadingSchema>;
export type ReorderInput = z.infer<typeof ReorderSchema>;
