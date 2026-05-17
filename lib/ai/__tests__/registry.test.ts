import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveTask } from '../registry';

describe('resolveTask', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AI_CLASSIFICATION_PROVIDER;
    delete process.env.AI_CLASSIFICATION_MODEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('usa defaults do registry quando nem env nem override existem', () => {
    const r = resolveTask('classification');
    expect(r.provider.name).toBe('anthropic');
    expect(r.modelId).toBe('claude-haiku-4-5-20251001');
  });

  it('env var sobrescreve default', () => {
    process.env.AI_CLASSIFICATION_PROVIDER = 'gemini';
    process.env.AI_CLASSIFICATION_MODEL = 'gemini-2.5-pro';
    const r = resolveTask('classification');
    expect(r.provider.name).toBe('gemini');
    expect(r.modelId).toBe('gemini-2.5-pro');
  });

  it('override per-call sobrescreve env e default', () => {
    process.env.AI_CLASSIFICATION_PROVIDER = 'gemini';
    process.env.AI_CLASSIFICATION_MODEL = 'gemini-2.5-pro';
    const r = resolveTask('classification', { provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
    expect(r.provider.name).toBe('anthropic');
    expect(r.modelId).toBe('claude-sonnet-4-20250514');
  });

  it('override parcial (so model) preserva provider de env/default', () => {
    process.env.AI_CLASSIFICATION_PROVIDER = 'gemini';
    const r = resolveTask('classification', { model: 'gemini-2.5-flash-preview' });
    expect(r.provider.name).toBe('gemini');
    expect(r.modelId).toBe('gemini-2.5-flash-preview');
  });

  it('override parcial (so provider) preserva model de env/default', () => {
    process.env.AI_CLASSIFICATION_MODEL = 'claude-sonnet-4-20250514';
    const r = resolveTask('classification', { provider: 'gemini' });
    expect(r.provider.name).toBe('gemini');
    expect(r.modelId).toBe('claude-sonnet-4-20250514');
  });

  it('throw quando provider invalido', () => {
    expect(() => resolveTask('classification', { provider: 'invalid' as 'gemini' })).toThrow(
      /Unknown AI provider/,
    );
  });
});
