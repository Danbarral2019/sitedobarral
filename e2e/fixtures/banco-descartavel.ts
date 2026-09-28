/**
 * Guarda dos specs que escrevem no banco FORA do navegador, via `lib/prisma`.
 *
 * `lib/prisma` lê `DATABASE_URL`, não `TEST_DATABASE_URL`. Neste projeto a
 * `DATABASE_URL` local aponta para PRODUÇÃO, então quem definisse apenas
 * `TEST_DATABASE_URL` para rodar os cenários isolados veria o spec escrever no
 * banco de verdade. `e2e/fixtures/database.ts` não cobre esse caso: aquela
 * função só decide o que vai para `webServer.env`, e devolve
 * `TEST_DATABASE_URL` sem sequer olhar para `DATABASE_URL`. Endurecê-la
 * quebraria a execução local dos outros specs, que nunca tocam `DATABASE_URL`;
 * por isso a guarda mora aqui, num módulo à parte.
 *
 * Ver o passo "Run isolated database scenarios" em .github/workflows/test.yml.
 */

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
 * Com as duas variáveis apontando para o mesmo banco, o único destino possível
 * das escritas é o banco descartável que o operador escolheu de propósito — no
 * CI, a branch efêmera da Neon; localmente, o que ele tiver montado para isto.
 */
export function bancoDescartavelOk(): boolean {
  const doPrisma = process.env.DATABASE_URL;
  const doTeste = process.env.TEST_DATABASE_URL;
  return Boolean(doPrisma && doTeste && mesmoBanco(doPrisma, doTeste));
}

/** Aborta o spec quando as duas variáveis não concordam. */
export function exigirBancoDescartavel(): void {
  if (!bancoDescartavelOk()) {
    throw new Error(
      'Spec recusado: este arquivo escreve no banco via `lib/prisma`, que lê DATABASE_URL. ' +
        'Defina DATABASE_URL e TEST_DATABASE_URL apontando para o MESMO banco descartável antes de rodá-lo. ' +
        'Sem isso, a DATABASE_URL local deste projeto aponta para produção.',
    );
  }
}
