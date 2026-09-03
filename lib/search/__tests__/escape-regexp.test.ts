import { describe, expect, it } from 'vitest';
import { extractRelevantExcerpts, searchLeiArticlesWithExcerpts } from '@/data/lei-14133-artigos';
import { escapeRegExp } from '../escape-regexp';

describe('escapeRegExp', () => {
  it.each(['(', '[', 'a+b', '.*', '\\'])('trata %s como texto literal', (query) => {
    const regex = new RegExp(escapeRegExp(query));
    expect(regex.test(query)).toBe(true);
    expect(() => extractRelevantExcerpts(`Trecho literal ${query} no texto`, query)).not.toThrow();
    expect(() => searchLeiArticlesWithExcerpts(query)).not.toThrow();
  });
});
