#!/bin/sh
# Build da Vercel: gera o client, aplica migrações (só em produção) e monta o site.
#
# Pré-visualização e produção usam a mesma DATABASE_URL (vale para todos os
# ambientes). Se a pré-visualização rodasse `prisma migrate deploy`:
# - a migração de um PR ainda não revisado chegaria ao banco de produção;
# - builds simultâneos disputariam o advisory lock do Prisma, que desiste em
#   10 s (P1002). Foi o que derrubou dois deploys de produção em 27/09/2026.
#
# Em produção, uma segunda tentativa após 20 s cobre o lock ocupado por outro
# processo (sessão rodando migração, conexão presa).
set -e

prisma generate

if [ "$VERCEL_ENV" = "production" ]; then
  prisma migrate deploy || {
    echo "[vercel-build] migrate deploy falhou; nova tentativa em 20 s"
    sleep 20
    prisma migrate deploy
  }
else
  echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-indefinido}: migrações ficam para o deploy de produção"
fi

next build
