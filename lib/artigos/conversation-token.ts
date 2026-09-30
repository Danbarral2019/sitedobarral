/**
 * Token da conversa do chat de artigos da Lei 14.133.
 *
 * O POST do chat emite um JWT (aud `article-chat`, sub = conversationId) que o
 * cliente devolve como `Authorization: Bearer` para ler o histórico ou dar
 * feedback de uma pergunta da conversa.
 */
import type { NextRequest } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { AuthenticationError } from '@/lib/errors/api-error';

const CONVERSATION_AUDIENCE = 'article-chat';

function conversationSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado');
  return new TextEncoder().encode(secret);
}

export async function signConversationToken(conversationId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(conversationId)
    .setAudience(CONVERSATION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(conversationSecret());
}

export async function verifyConversationToken(request: NextRequest, conversationId: string): Promise<void> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) throw new AuthenticationError('Token de conversa obrigatório');

  try {
    const { payload } = await jwtVerify(token, conversationSecret(), {
      audience: CONVERSATION_AUDIENCE,
    });
    if (payload.sub !== conversationId) {
      throw new AuthenticationError('Token de conversa inválido');
    }
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError('Token de conversa inválido');
  }
}
