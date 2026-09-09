import { expect, test } from '@playwright/test';
import { prisma } from '../lib/prisma';
import { persistirDestilacao } from '../lib/tcu/persistir-tese';
import type { TeseDestilada } from '../lib/tcu/destilar-tese';
import type { DossieUso } from '../lib/tcu/trechos-de-citacao';

// Alvo isolado dos demais cenários e2e — números fora da faixa de qualquer
// acórdão real do dataset.
const NUMERO_ALVO = 9999;
const ANO_ALVO = 2026;

// Este teste chama `persistirDestilacao` diretamente (não via HTTP), então
// depende de `DATABASE_URL` — não de `TEST_DATABASE_URL` — apontando para o
// banco descartável: é o que `lib/prisma` lê ao montar o client. Ver o passo
// "Run isolated database scenarios" em .github/workflows/test.yml.
//
// É o único spec de `e2e/` que fala com o banco fora do navegador, e por isso
// escapa da guarda de `e2e/fixtures/database.ts`: aquela função só decide o
// que vai para `webServer.env`, e devolve `TEST_DATABASE_URL` sem sequer olhar
// para `DATABASE_URL`. Neste projeto a `DATABASE_URL` local aponta para
// PRODUÇÃO — então quem definisse apenas `TEST_DATABASE_URL` para rodar os
// cenários isolados veria este spot escrever no banco de verdade. A guarda
// abaixo pertence a este arquivo, e não ao helper compartilhado: endurecer o
// helper quebraria a execução local dos outros specs, que nunca tocam
// `DATABASE_URL`.

/** Mesmo host e mesmo nome de banco — credenciais e parâmetros podem diferir. */
function mesmoBanco(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.hostname.toLowerCase() === ub.hostname.toLowerCase() && ua.pathname === ub.pathname;
  } catch {
    return false;
  }
}

/**
 * Aborta o spec quando as duas variáveis não concordam. Com elas apontando
 * para o mesmo banco, o único destino possível das escritas é o banco
 * descartável que o operador escolheu de propósito — no CI, a branch efêmera
 * da Neon; localmente, o que ele tiver montado para isto.
 */
function bancoDescartavelOk(): boolean {
  const doPrisma = process.env.DATABASE_URL;
  const doTeste = process.env.TEST_DATABASE_URL;
  return Boolean(doPrisma && doTeste && mesmoBanco(doPrisma, doTeste));
}

function exigirBancoDescartavel(): void {
  if (!bancoDescartavelOk()) {
    throw new Error(
      'Spec recusado: este arquivo escreve no banco via `lib/prisma`, que lê DATABASE_URL. ' +
        'Defina DATABASE_URL e TEST_DATABASE_URL apontando para o MESMO banco descartável antes de rodá-lo. ' +
        'Sem isso, a DATABASE_URL local deste projeto aponta para produção.',
    );
  }
}

test.describe('herança editorial entre versões de uma tese', () => {
  test.beforeAll(async () => {
    exigirBancoDescartavel();

    // Versão anterior: conferida individualmente, publicada e na vitrine —
    // o estado dos acórdãos que a redestilação apagou antes da herança de
    // nível 2 existir (spec §7).
    await prisma.teseDestilacao.create({
      data: {
        numeroAlvo: NUMERO_ALVO,
        anoAlvo: ANO_ALVO,
        chave: `${NUMERO_ALVO}/${ANO_ALVO}`,
        assunto: 'Assunto de teste — herança editorial',
        confianca: 'alta',
        versaoMotor: 1,
        dossieTrechos: 0,
        dossieNoVoto: 0,
        atual: true,
        enunciados: {
          create: [
            {
              ordem: 0,
              enunciado: 'Texto antigo, conferido por uma pessoa.',
              inovacao: '',
              trechosFonte: [],
              veredito: 'fiel',
              julgadoEm: new Date('2026-01-01T00:00:00Z'),
              julgadoPor: 'daniel',
              publicado: true,
              vitrinePublica: true,
            },
          ],
        },
      },
    });
  });

  test.afterAll(async () => {
    // Se a guarda barrou o `beforeAll`, nada foi criado — e a limpeza não pode
    // ser a primeira escrita a escapar para o banco errado.
    if (!bancoDescartavelOk()) return;
    // Cascade cuida de TeseEnunciado (e de TeseTrechoFonte, se houvesse).
    await prisma.teseDestilacao.deleteMany({
      where: { numeroAlvo: NUMERO_ALVO, anoAlvo: ANO_ALVO },
    });
  });

  test('texto novo sai da vitrine, fica no acervo e entra na fila', async () => {
    const tese: TeseDestilada = {
      chave: `${NUMERO_ALVO}/${ANO_ALVO}`,
      assunto: 'Assunto de teste — herança editorial',
      teses: [
        { enunciado: 'Texto novo, com redação diferente da conferida.', inovacao: '', trechosFonte: [] },
      ],
      sinaisQualitativos: [],
      divergencias: [],
      confianca: 'alta',
    };
    const dossie: DossieUso = {
      alvo: { numero: NUMERO_ALVO, ano: ANO_ALVO },
      contagem: { citantesDistintos: 0, noVoto: 0, ocorrenciasTotal: 0 },
      trechos: [],
    };

    await persistirDestilacao({ numero: NUMERO_ALVO, ano: ANO_ALVO }, tese, dossie);

    const vigente = await prisma.teseEnunciado.findFirstOrThrow({
      where: { destilacao: { numeroAlvo: NUMERO_ALVO, anoAlvo: ANO_ALVO, atual: true } },
    });

    expect(vigente.veredito).toBe('fiel');
    expect(vigente.publicado).toBe(true);
    expect(vigente.vitrinePublica).toBe(false);
    expect(vigente.julgadoPor).toBeNull();
    expect(vigente.reconferenciaPendente).toBe(true);
  });
});
