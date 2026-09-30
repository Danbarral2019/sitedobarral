// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    articleQuestion: {
      findFirst: (...args: unknown[]) => mocks.findFirst(...args),
      update: (...args: unknown[]) => mocks.update(...args),
    },
  },
}));

import { PATCH } from '../route';
import { signConversationToken } from '@/lib/artigos/conversation-token';

const CONVERSATION = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function req(token?: string, body: unknown = { wasHelpful: true }) {
  return new NextRequest('http://localhost/api/artigos/75/chat/q1/feedback', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ numero: '75', questionId: 'q1' }) };

describe('PATCH /api/artigos/[numero]/chat/[questionId]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-para-feedback-com-tamanho-suficiente';
    mocks.findFirst.mockResolvedValue({ id: 'q1', conversationId: CONVERSATION });
    mocks.update.mockResolvedValue({ id: 'q1', wasHelpful: true, createdAt: new Date() });
  });

  it('recusa sem token de conversa', async () => {
    const res = await PATCH(req(), params);
    expect(res.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('recusa token de outra conversa', async () => {
    const token = await signConversationToken(OTHER);
    const res = await PATCH(req(token), params);
    expect(res.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('recusa pergunta sem conversa', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'q1', conversationId: null });
    const token = await signConversationToken(CONVERSATION);
    const res = await PATCH(req(token), params);
    expect(res.status).toBe(404);
  });

  it('aceita o token da própria conversa', async () => {
    const token = await signConversationToken(CONVERSATION);
    const res = await PATCH(req(token), params);
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'q1' }, data: { wasHelpful: true } })
    );
  });

  it('valida o corpo', async () => {
    const token = await signConversationToken(CONVERSATION);
    const res = await PATCH(req(token, { wasHelpful: 'sim' }), params);
    expect(res.status).toBe(400);
  });
});
