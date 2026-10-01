import { randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { decodeJwt } from 'jose';
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';
import { authenticateAs, E2E_BASE_URL } from './fixtures/database';
import {
  disconnectE2EPrisma,
  E2E_PASSWORD,
  e2ePrisma,
  requireRateLimitBackend,
  uniqueEmail,
} from './fixtures/fluxos';

// O dev server compila cada rota no primeiro acesso; 30 s (padrão) não bastam
// quando login, logout, /me e redefinição de senha ainda estão frios.
test.describe.configure({ timeout: 120_000 });

/**
 * Revogação de sessão por User.tokenVersion (PR #317): o token carrega `tv`, e
 * verifyToken só o aceita se `tv` (0 quando ausente) for igual à versão do
 * usuário no banco. Logout e redefinição de senha incrementam a versão, o que
 * invalida toda cópia do cookie emitida antes.
 *
 * A rota usada como sonda é GET /api/auth/me, que autentica por verifyToken.
 * O middleware (edge) confere só a assinatura e deixa a requisição passar; a
 * recusa por revogação vem da rota, com 401.
 */

const ROTA_AUTENTICADA = '/api/auth/me';

/** Usuário aluno verificado, criado direto no banco descartável. */
async function criarAluno(fluxo: string) {
  const email = uniqueEmail(fluxo);
  const user = await e2ePrisma().user.create({
    data: {
      email,
      name: `Aluno ${fluxo} E2E`,
      role: 'student',
      passwordHash: await bcrypt.hash(E2E_PASSWORD, 4),
      emailVerified: true,
    },
  });
  return user;
}

async function versaoNoBanco(userId: string): Promise<number> {
  const user = await e2ePrisma().user.findUniqueOrThrow({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  return user.tokenVersion;
}

/** IP fictício por login: o limite de 5 logins por minuto é por IP. */
function ipFicticio(): string {
  return `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
}

/** Login real pela API; o cookie fica no contexto, como no navegador. */
async function loginPelaApi(context: BrowserContext, email: string): Promise<string> {
  const response = await context.request.post('/api/auth/login', {
    data: { email, password: E2E_PASSWORD },
    headers: { 'x-forwarded-for': ipFicticio() },
  });
  expect(response.status(), await response.text()).toBe(200);
  return cookieDoContexto(context);
}

async function cookieDoContexto(context: BrowserContext): Promise<string> {
  const cookie = (await context.cookies(E2E_BASE_URL)).find((c) => c.name === 'auth-token');
  expect(cookie?.value, 'cookie auth-token ausente no contexto').toBeTruthy();
  return cookie!.value;
}

async function reinjetarCookie(context: BrowserContext, token: string): Promise<void> {
  await context.addCookies([
    { name: 'auth-token', value: token, url: E2E_BASE_URL, httpOnly: true, sameSite: 'Strict' },
  ]);
}

/**
 * Cliente sem cookie próprio: cada chamada leva só o token informado, como
 * faria quem tivesse copiado o cookie.
 */
async function statusComToken(api: APIRequestContext, token: string): Promise<number> {
  const response = await api.get(ROTA_AUTENTICADA, {
    headers: { cookie: `auth-token=${token}` },
  });
  return response.status();
}

test.describe('revogação de sessão por tokenVersion', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL });
  });

  test.afterAll(async () => {
    await api.dispose();
    await disconnectE2EPrisma();
  });

  test('logout invalida o cookie antigo reinjetado', async ({ context }) => {
    requireRateLimitBackend();
    const aluno = await criarAluno('revoga-logout');

    const token = await loginPelaApi(context, aluno.email);
    expect(decodeJwt(token).tv).toBe(0);

    const antes = await context.request.get(ROTA_AUTENTICADA);
    expect(antes.status()).toBe(200);
    expect((await antes.json()).user.id).toBe(aluno.id);

    const logout = await context.request.post('/api/auth/logout');
    expect(logout.status()).toBe(200);
    expect(await versaoNoBanco(aluno.id)).toBe(1);

    // O logout apaga o cookie do contexto; sem ele, a rota responde 401.
    const restante = (await context.cookies(E2E_BASE_URL)).find((c) => c.name === 'auth-token');
    expect(restante?.value ?? '').toBe('');
    expect((await context.request.get(ROTA_AUTENTICADA)).status()).toBe(401);

    // A cópia guardada antes do logout continua com assinatura válida, mas
    // traz a versão revogada.
    await reinjetarCookie(context, token);
    expect((await context.request.get(ROTA_AUTENTICADA)).status()).toBe(401);
    expect(await statusComToken(api, token)).toBe(401);
  });

  test('logout numa sessão derruba a outra sessão do mesmo usuário', async ({ browser }) => {
    requireRateLimitBackend();
    const aluno = await criarAluno('revoga-duas-sessoes');

    const sessaoA = await browser.newContext({ baseURL: E2E_BASE_URL });
    const sessaoB = await browser.newContext({ baseURL: E2E_BASE_URL });
    try {
      await loginPelaApi(sessaoA, aluno.email);
      const tokenB = await loginPelaApi(sessaoB, aluno.email);

      expect((await sessaoA.request.get(ROTA_AUTENTICADA)).status()).toBe(200);
      expect((await sessaoB.request.get(ROTA_AUTENTICADA)).status()).toBe(200);

      const logout = await sessaoA.request.post('/api/auth/logout');
      expect(logout.status()).toBe(200);
      expect(await versaoNoBanco(aluno.id)).toBe(1);

      // A sessão B não fez nada: o cookie dela segue no contexto, mas foi
      // emitido na versão anterior.
      expect(await cookieDoContexto(sessaoB)).toBe(tokenB);
      expect((await sessaoB.request.get(ROTA_AUTENTICADA)).status()).toBe(401);
      expect((await sessaoA.request.get(ROTA_AUTENTICADA)).status()).toBe(401);
    } finally {
      await sessaoA.close();
      await sessaoB.close();
    }
  });

  test('redefinição de senha derruba o cookie anterior e emite um válido', async ({ context }) => {
    requireRateLimitBackend();
    const aluno = await criarAluno('revoga-reset');

    const tokenAntigo = await loginPelaApi(context, aluno.email);
    expect(await statusComToken(api, tokenAntigo)).toBe(200);

    // Token de redefinição gravado no banco descartável, no lugar do link do
    // email (nenhum email sai do dev server).
    const resetToken = randomBytes(32).toString('hex');
    await e2ePrisma().user.update({
      where: { id: aluno.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Sem cookie: quem redefine a senha pelo link não precisa estar logado.
    const reset = await api.post('/api/auth/reset-password', {
      data: { token: resetToken, newPassword: 'Senha-E2E-redefinida-2' },
    });
    expect(reset.status(), await reset.text()).toBe(200);
    expect(await versaoNoBanco(aluno.id)).toBe(1);

    const setCookie = reset
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
      .find((v) => v.startsWith('auth-token='));
    expect(setCookie, 'reset-password não emitiu cookie').toBeTruthy();
    const tokenNovo = setCookie!.split(';')[0].slice('auth-token='.length);
    expect(decodeJwt(tokenNovo).tv).toBe(1);

    // O cookie da sessão aberta com a senha antiga deixa de valer, no
    // contexto original e em qualquer cópia; o emitido pela redefinição vale.
    expect((await context.request.get(ROTA_AUTENTICADA)).status()).toBe(401);
    expect(await statusComToken(api, tokenAntigo)).toBe(401);
    expect(await statusComToken(api, tokenNovo)).toBe(200);

    const depois = await e2ePrisma().user.findUniqueOrThrow({ where: { id: aluno.id } });
    expect(depois.resetPasswordToken).toBeNull();
  });

  test('token sem tv vale como versão 0 e cai depois do logout', async ({ context }) => {
    // Sem login: o token é assinado como o das sessões abertas antes do
    // deploy do tokenVersion (authenticateAs não põe `tv` no payload).
    const aluno = await criarAluno('revoga-sem-tv');
    expect(aluno.tokenVersion).toBe(0);

    await authenticateAs(context, {
      userId: aluno.id,
      role: 'student',
      email: aluno.email,
      name: aluno.name,
    });
    const token = await cookieDoContexto(context);
    expect(decodeJwt(token)).not.toHaveProperty('tv');

    expect((await context.request.get(ROTA_AUTENTICADA)).status()).toBe(200);

    const logout = await context.request.post('/api/auth/logout');
    expect(logout.status()).toBe(200);
    expect(await versaoNoBanco(aluno.id)).toBe(1);

    await reinjetarCookie(context, token);
    expect((await context.request.get(ROTA_AUTENTICADA)).status()).toBe(401);
    expect(await statusComToken(api, token)).toBe(401);
  });
});
