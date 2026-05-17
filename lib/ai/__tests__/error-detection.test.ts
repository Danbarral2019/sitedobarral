import { describe, it, expect } from 'vitest';
import {
  isRateLimitError,
  isModelAvailabilityError,
  shouldTryFallbackModel,
} from '../error-detection';

describe('isRateLimitError', () => {
  it('detecta 429 explicito', () => {
    expect(isRateLimitError(new Error('Gemini API error 429: too many'))).toBe(true);
  });

  it('detecta "rate limit"', () => {
    expect(isRateLimitError(new Error('You hit the rate limit, slow down'))).toBe(true);
  });

  it('detecta "quota exceeded"', () => {
    expect(isRateLimitError(new Error('quota exceeded for project'))).toBe(true);
  });

  it('detecta "too many requests"', () => {
    expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
  });

  it('detecta "resource exhausted"', () => {
    expect(isRateLimitError(new Error('RESOURCE_EXHAUSTED'))).toBe(true);
  });

  it('falso negativo seguro: 500 nao e rate limit', () => {
    expect(isRateLimitError(new Error('500 internal server error'))).toBe(false);
  });

  it('aceita string crua tambem', () => {
    expect(isRateLimitError('429')).toBe(true);
  });
});

describe('isModelAvailabilityError', () => {
  it('detecta 404', () => {
    expect(isModelAvailabilityError(new Error('404 model not found'))).toBe(true);
  });

  it('detecta "deprecated"', () => {
    expect(isModelAvailabilityError(new Error('claude-3-5-haiku is deprecated'))).toBe(true);
  });

  it('detecta "not found"', () => {
    expect(isModelAvailabilityError(new Error('model gemini-2.0 not found'))).toBe(true);
  });

  it('detecta "unsupported model"', () => {
    expect(isModelAvailabilityError(new Error('Unsupported model id'))).toBe(true);
  });

  it('detecta 400 + "model"', () => {
    expect(isModelAvailabilityError(new Error('400 invalid model parameter'))).toBe(true);
  });

  it('NAO detecta 400 generico (sem "model")', () => {
    expect(isModelAvailabilityError(new Error('400 bad request: invalid temperature'))).toBe(false);
  });

  it('NAO detecta 500', () => {
    expect(isModelAvailabilityError(new Error('500 internal server error'))).toBe(false);
  });
});

describe('shouldTryFallbackModel', () => {
  it('cascateia em 429', () => {
    expect(shouldTryFallbackModel(new Error('429 quota exceeded'))).toBe(true);
  });

  it('cascateia em 404 model not found', () => {
    expect(shouldTryFallbackModel(new Error('404 model not found'))).toBe(true);
  });

  it('NAO cascateia em safety/auth/network', () => {
    expect(shouldTryFallbackModel(new Error('Gemini blocked prompt: SAFETY'))).toBe(false);
    expect(shouldTryFallbackModel(new Error('401 unauthorized'))).toBe(false);
    expect(shouldTryFallbackModel(new Error('ECONNREFUSED'))).toBe(false);
  });
});
