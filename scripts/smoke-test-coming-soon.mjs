#!/usr/bin/env node
/**
 * Smoke test do coming-soon de pré-lançamento.
 *
 * Uso:
 *   node scripts/smoke-test-coming-soon.mjs <base-url> [--key=<preview-key>]
 *
 * Exemplos:
 *   node scripts/smoke-test-coming-soon.mjs http://localhost:3000
 *   node scripts/smoke-test-coming-soon.mjs https://www.profdanielbarral.com --key=abc123
 *
 * Verifica:
 *  - Anônimo: rotas vitrine retornam "Em breve" (200 OK); operacionais e blog passam normal
 *  - Com cookie preview (se --key fornecida): tudo passa normal
 *  - /preview?key=invalida retorna 404
 */

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('Uso: node scripts/smoke-test-coming-soon.mjs <base-url> [--key=<chave>]');
  process.exit(1);
}

const keyArg = process.argv.find(a => a.startsWith('--key='));
const previewKey = keyArg ? keyArg.split('=')[1] : null;

const VITRINE = ['/', '/sobre', '/lei-14133', '/cursos', '/contato', '/clipping', '/glossario', '/legislacao', '/publicacoes'];
const OPERATIONAL = ['/login', '/registro', '/blog', '/privacidade', '/termos', '/upgrade', '/planos'];

let failures = 0;
const check = (label, ok, detail = '') => {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function fetchText(path, opts = {}) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: 'manual', ...opts });
  const text = res.status >= 200 && res.status < 300 ? await res.text() : '';
  return { status: res.status, text, headers: res.headers };
}

console.log(`\n=== Anônimo (${baseUrl}) ===`);
for (const path of VITRINE) {
  const { status, text } = await fetchText(path);
  const isComingSoon = status === 200 && /Em breve/i.test(text);
  check(`${path} → coming-soon`, isComingSoon, `status=${status}, "Em breve" presente: ${/Em breve/i.test(text)}`);
}

for (const path of OPERATIONAL) {
  const { status, text } = await fetchText(path);
  const isNormal = status === 200 && !/Em breve/i.test(text);
  check(`${path} → conteúdo real`, isNormal, `status=${status}`);
}

console.log(`\n=== /preview ===`);
const invalid = await fetchText('/preview?key=chave-invalida-123');
check('/preview?key=invalida → 404', invalid.status === 404, `status=${invalid.status}`);

if (previewKey) {
  console.log(`\n=== Com chave válida ===`);
  const res = await fetch(`${baseUrl}/preview?key=${encodeURIComponent(previewKey)}`, { redirect: 'manual' });
  const cookieHeader = res.headers.get('set-cookie') || '';
  const hasCookie = cookieHeader.includes('preview-bypass=');
  check('/preview com key válida → 302 + cookie', res.status === 302 && hasCookie, `status=${res.status}, cookie: ${hasCookie}`);
}

console.log(`\n${failures === 0 ? '✓ Todos os smoke tests passaram' : `✗ ${failures} falha(s)`}`);
process.exit(failures === 0 ? 0 : 1);
