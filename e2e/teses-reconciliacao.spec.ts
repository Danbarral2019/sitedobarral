import { expect, test } from '@playwright/test';
import { prisma } from '../lib/prisma';
import { reconciliarTeses } from '../lib/embeddings/tese-reconciliacao';
import { bancoDescartavelOk, exigirBancoDescartavel } from './fixtures/banco-descartavel';

// É um teste do Playwright por causa do banco, não do navegador: nenhuma página
// é aberta. Ele existe porque o teste unitário da reconciliação usa um dublê do
// Prisma e só prova que o código PEDE a coisa certa. Um `deleteMany` que
// seleciona as linhas erradas é o defeito mais caro e mais silencioso aqui, e
// só um banco de verdade o pega.
//
// `reconciliarTeses` passa por `lib/prisma`, que lê DATABASE_URL: ver a guarda
// em `e2e/fixtures/banco-descartavel.ts`.

// Alvo isolado dos demais cenários e2e. O 9999/2026 é de heranca-editorial,
// que roda em paralelo e apaga o seu alvo no afterAll.
const NUMERO_ALVO = 9998;
const ANO_ALVO = 2026;

const ID_VALIDA = 'e2e-tese-valida';
const ID_RETIRADA = 'e2e-tese-retirada';
const ID_SEM_EVIDENCIA = 'e2e-tese-sem-evidencia';

const VETOR = `[${Array(768).fill(0.01).join(',')}]`;

test.describe('reconciliação do índice das teses', () => {
  test.beforeAll(async () => {
    exigirBancoDescartavel();

    const destilacao = await prisma.teseDestilacao.create({
      data: {
        numeroAlvo: NUMERO_ALVO,
        anoAlvo: ANO_ALVO,
        chave: `${NUMERO_ALVO}/${ANO_ALVO}`,
        assunto: 'Assunto de teste: reconciliação',
        confianca: 'alta',
        versaoMotor: 1,
        dossieTrechos: 1,
        dossieNoVoto: 1,
        atual: true,
      },
    });

    // Três teses iguais em tudo, exceto no que decide a elegibilidade: uma
    // válida, uma retirada editorialmente e uma que declara dois trechos mas
    // só tem um persistido (evidência incompleta, spec §6).
    const casos = [
      { id: ID_VALIDA, retiradoEm: null, trechosFonte: [0] },
      { id: ID_RETIRADA, retiradoEm: new Date(), trechosFonte: [0] },
      { id: ID_SEM_EVIDENCIA, retiradoEm: null, trechosFonte: [0, 1] },
    ];

    for (const [ordem, caso] of casos.entries()) {
      await prisma.teseEnunciado.create({
        data: {
          id: caso.id,
          destilacaoId: destilacao.id,
          ordem,
          enunciado: `Enunciado ${caso.id}`,
          inovacao: '',
          trechosFonte: caso.trechosFonte,
          veredito: 'fiel',
          retiradoEm: caso.retiradoEm,
          publicado: true,
          trechos: {
            create: [
              {
                ordem: 0,
                trecho: 'trecho',
                origemNumero: 1,
                origemAno: 2020,
                origemUrl: 'https://portal.tcu.gov.br',
                noVoto: true,
              },
            ],
          },
        },
      });
      // Chunk pré-existente para todas, com um vetor qualquer: o que está sob
      // teste é quem sobrevive à reconciliação, não a qualidade do vetor.
      await prisma.$executeRawUnsafe(
        `INSERT INTO "TeseEnunciadoChunk" (id, "enunciadoId", content, embedding, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'conteúdo', $2::vector, NOW(), NOW())`,
        caso.id,
        VETOR,
      );
    }
  });

  test.afterAll(async () => {
    // Se a guarda barrou o `beforeAll`, nada foi criado, e a limpeza não pode
    // ser a primeira escrita a escapar para o banco errado.
    if (!bancoDescartavelOk()) return;
    // Cascade cuida de TeseEnunciado, TeseTrechoFonte e TeseEnunciadoChunk.
    await prisma.teseDestilacao.deleteMany({
      where: { numeroAlvo: NUMERO_ALVO, anoAlvo: ANO_ALVO },
    });
  });

  test('apaga o chunk da retirada e o da sem evidência, e preserva o da válida', async () => {
    await reconciliarTeses();

    const sobreviventes = await prisma.teseEnunciadoChunk.findMany({
      where: { enunciadoId: { in: [ID_VALIDA, ID_RETIRADA, ID_SEM_EVIDENCIA] } },
      select: { enunciadoId: true },
    });

    expect(sobreviventes.map((s) => s.enunciadoId)).toEqual([ID_VALIDA]);
  });
});
