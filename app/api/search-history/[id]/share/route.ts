import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';
import { withUserApi } from '@/lib/api/handler';

// POST /api/search-history/[id]/share - Gerar link compartilhável
//
// O cliente indica só o id do histórico dele; o que se publica é o que o
// servidor gravou no momento da consulta (`respostaDoServidor`). Entradas
// antigas, cuja resposta vinha do cliente, não podem ser compartilhadas.
export const POST = withUserApi<{ id: string }>(async (_request, { user, params, logger }) => {
  const { id } = params;

  const entry = await prisma.searchHistory.findUnique({
    where: { id },
    select: { id: true, userId: true, shareId: true, isPublic: true, respostaDoServidor: true },
  });

  // Entrada de outro usuário é tratada como inexistente
  if (!entry || entry.userId !== user.userId) {
    throw new NotFoundError('Histórico de busca');
  }

  if (!entry.respostaDoServidor) {
    throw new ValidationError(
      'Esta resposta é anterior à gravação pelo servidor e não pode ser compartilhada. Refaça a pergunta para gerar um link.',
    );
  }

  // Se já tem shareId, retornar o existente
  if (entry.shareId && entry.isPublic) {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/busca/${entry.shareId}`;
    return NextResponse.json({ shareId: entry.shareId, url });
  }

  // 128 bits: o link é o único controle de acesso à resposta compartilhada
  const shareId = crypto.randomBytes(16).toString('base64url');

  await prisma.searchHistory.update({
    where: { id },
    data: {
      isPublic: true,
      shareId,
    },
  });

  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/busca/${shareId}`;

  logger.info({ searchHistoryId: id }, 'Search history shared');

  return NextResponse.json({ shareId, url });
});
