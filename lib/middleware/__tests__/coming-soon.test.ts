import { describe, test, expect } from 'vitest';
import { isAllowlistedRoute } from '../coming-soon';

describe('isAllowlistedRoute', () => {
  test('permite assets internos do Next', () => {
    expect(isAllowlistedRoute('/_next/static/foo.js')).toBe(true);
    expect(isAllowlistedRoute('/api/newsletter')).toBe(true);
    expect(isAllowlistedRoute('/favicon.ico')).toBe(true);
    expect(isAllowlistedRoute('/manifest.webmanifest')).toBe(true);
    expect(isAllowlistedRoute('/robots.txt')).toBe(true);
    expect(isAllowlistedRoute('/sitemap.xml')).toBe(true);
    expect(isAllowlistedRoute('/sitemap-artigos.xml')).toBe(true);
  });

  test('permite rotas de auth e validação', () => {
    expect(isAllowlistedRoute('/login')).toBe(true);
    expect(isAllowlistedRoute('/registro')).toBe(true);
    expect(isAllowlistedRoute('/esqueci-senha')).toBe(true);
    expect(isAllowlistedRoute('/redefinir-senha')).toBe(true);
    expect(isAllowlistedRoute('/verificar-email')).toBe(true);
    expect(isAllowlistedRoute('/validar-acesso')).toBe(true);
    expect(isAllowlistedRoute('/cancelar-newsletter')).toBe(true);
  });

  test('permite áreas autenticadas', () => {
    expect(isAllowlistedRoute('/area-restrita')).toBe(false); // raiz precisa de slash
    expect(isAllowlistedRoute('/area-restrita/meu-progresso')).toBe(true);
    expect(isAllowlistedRoute('/admin/dashboard')).toBe(true);
  });

  test('permite certificado público', () => {
    expect(isAllowlistedRoute('/certificado/abc-123')).toBe(true);
  });

  test('permite blog (vitrine permitida)', () => {
    expect(isAllowlistedRoute('/blog')).toBe(true);
    expect(isAllowlistedRoute('/blog/meu-slug-de-artigo')).toBe(true);
  });

  test('permite páginas legais', () => {
    expect(isAllowlistedRoute('/privacidade')).toBe(true);
    expect(isAllowlistedRoute('/termos')).toBe(true);
  });

  test('permite funil de pagamento Stripe', () => {
    expect(isAllowlistedRoute('/planos')).toBe(true);
    expect(isAllowlistedRoute('/upgrade')).toBe(true);
    expect(isAllowlistedRoute('/upgrade/curso-id')).toBe(true);
    expect(isAllowlistedRoute('/assinatura/sucesso')).toBe(true);
    expect(isAllowlistedRoute('/assinatura/cancelado')).toBe(true);
    expect(isAllowlistedRoute('/assinatura/pendente')).toBe(true);
  });

  test('permite a própria coming-soon e preview', () => {
    expect(isAllowlistedRoute('/coming-soon')).toBe(true);
    expect(isAllowlistedRoute('/preview')).toBe(true);
  });

  test('bloqueia homepage e rotas de vitrine', () => {
    expect(isAllowlistedRoute('/')).toBe(false);
    expect(isAllowlistedRoute('/sobre')).toBe(false);
    expect(isAllowlistedRoute('/lei-14133')).toBe(false);
    expect(isAllowlistedRoute('/lei-14133/art-1')).toBe(false);
    expect(isAllowlistedRoute('/cursos')).toBe(false);
    expect(isAllowlistedRoute('/cursos/nova-lei')).toBe(false);
    expect(isAllowlistedRoute('/contato')).toBe(false);
    expect(isAllowlistedRoute('/clipping')).toBe(false);
    expect(isAllowlistedRoute('/glossario')).toBe(false);
    expect(isAllowlistedRoute('/legislacao')).toBe(false);
    expect(isAllowlistedRoute('/legislacao/123')).toBe(false);
    expect(isAllowlistedRoute('/publicacoes')).toBe(false);
    expect(isAllowlistedRoute('/base-conhecimento')).toBe(false);
    expect(isAllowlistedRoute('/busca')).toBe(false);
    expect(isAllowlistedRoute('/novidades')).toBe(false);
    expect(isAllowlistedRoute('/jurisprudencia')).toBe(false);
  });

  test('bloqueia /artigo/[numero] (redirect Lei 14.133, é vitrine)', () => {
    expect(isAllowlistedRoute('/artigo/1')).toBe(false);
    expect(isAllowlistedRoute('/artigo/184-A')).toBe(false);
  });

  test('normaliza trailing slash', () => {
    expect(isAllowlistedRoute('/login/')).toBe(true);
    expect(isAllowlistedRoute('/blog/')).toBe(true);
    expect(isAllowlistedRoute('/sobre/')).toBe(false);
  });

  test('não confunde prefixos parecidos', () => {
    expect(isAllowlistedRoute('/blogx')).toBe(false);
    expect(isAllowlistedRoute('/admin-fake')).toBe(false);
    expect(isAllowlistedRoute('/loginhack')).toBe(false);
  });
});
