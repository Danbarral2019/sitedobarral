/**
 * Testes para lib/cache/redis-client.ts
 *
 * Testa todas as funcionalidades do cache Redis:
 * - CacheKeys builders (funcoes puras)
 * - Cache utilities (get, set, delete, exists, increment)
 * - Rate limiting
 * - Registry e invalidacao por prefixo
 * - withCache wrapper
 * - Health check, isCacheEnabled, getCacheStats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Configurar env vars via vi.hoisted para garantir disponibilidade antes do import do modulo
vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token-123';
});

// Mock Redis com vi.hoisted para garantir que seja aplicado antes dos imports
const mockGet = vi.hoisted(() => vi.fn());
const mockSetex = vi.hoisted(() => vi.fn());
const mockDel = vi.hoisted(() => vi.fn());
const mockExists = vi.hoisted(() => vi.fn());
const mockIncr = vi.hoisted(() => vi.fn());
const mockExpire = vi.hoisted(() => vi.fn());
const mockPing = vi.hoisted(() => vi.fn());
const mockSadd = vi.hoisted(() => vi.fn());
const mockSmembers = vi.hoisted(() => vi.fn());
const mockScan = vi.hoisted(() => vi.fn());

vi.mock('@upstash/redis', () => {
  return {
    Redis: class MockRedis {
      get = mockGet;
      setex = mockSetex;
      del = mockDel;
      exists = mockExists;
      incr = mockIncr;
      expire = mockExpire;
      ping = mockPing;
      sadd = mockSadd;
      smembers = mockSmembers;
      scan = mockScan;
    },
  };
});

// Mock console para nao poluir output dos testes
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

import {
  redis,
  CACHE_TTL,
  CacheKeys,
  getCache,
  setCache,
  deleteCache,
  existsCache,
  incrementCache,
  checkRateLimit,
  registerCacheKey,
  getRegisteredKeys,
  invalidateCacheByPrefix,
  deleteCachePattern,
  withCache,
  healthCheck,
  isCacheEnabled,
  getCacheStats,
  CacheInvalidation,
} from '../redis-client';

describe('Redis Cache Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================
  // Redis Client Initialization
  // ===========================

  describe('Redis Client Initialization', () => {
    it('deve criar instancia Redis quando env vars estao configuradas', () => {
      expect(redis).not.toBeNull();
    });
  });

  // ===========================
  // CACHE_TTL Configuration
  // ===========================

  describe('CACHE_TTL', () => {
    it('deve ter TTL correto para GEMINI_QUERY (24 horas)', () => {
      expect(CACHE_TTL.GEMINI_QUERY).toBe(86400);
    });

    it('deve ter TTL correto para DOCUMENT_META (1 hora)', () => {
      expect(CACHE_TTL.DOCUMENT_META).toBe(3600);
    });

    it('deve ter TTL correto para SEARCH_RESULTS (15 minutos)', () => {
      expect(CACHE_TTL.SEARCH_RESULTS).toBe(900);
    });

    it('deve ter TTL correto para RATE_LIMIT (60 segundos)', () => {
      expect(CACHE_TTL.RATE_LIMIT).toBe(60);
    });

    it('deve ter TTL correto para FAQ_LIST (2 horas)', () => {
      expect(CACHE_TTL.FAQ_LIST).toBe(7200);
    });

    it('deve ter TTL correto para TESTIMONIALS (4 horas)', () => {
      expect(CACHE_TTL.TESTIMONIALS).toBe(14400);
    });
  });

  // ===========================
  // CacheKeys Builders
  // ===========================

  describe('CacheKeys', () => {
    describe('geminiQuery', () => {
      it('deve gerar chave com formato correto', () => {
        const key = CacheKeys.geminiQuery('file-1', 'what is this?');
        expect(key).toMatch(/^gemini:query:file-1:\w+$/);
      });

      it('deve gerar hash diferente para queries diferentes', () => {
        const key1 = CacheKeys.geminiQuery('file-1', 'query A');
        const key2 = CacheKeys.geminiQuery('file-1', 'query B');
        expect(key1).not.toBe(key2);
      });

      it('deve gerar mesma chave para mesma query', () => {
        const key1 = CacheKeys.geminiQuery('file-1', 'same query');
        const key2 = CacheKeys.geminiQuery('file-1', 'same query');
        expect(key1).toBe(key2);
      });
    });

    describe('documentMeta', () => {
      it('deve gerar chave com formato correto', () => {
        const key = CacheKeys.documentMeta('doc-123');
        expect(key).toBe('doc:meta:doc-123');
      });
    });

    describe('searchResults', () => {
      it('deve gerar chave sem filtros', () => {
        const key = CacheKeys.searchResults('test query');
        expect(key).toMatch(/^search:\w+:none$/);
      });

      it('deve gerar chave com filtros', () => {
        const key = CacheKeys.searchResults('test query', { type: 'doc' });
        expect(key).toMatch(/^search:\w+:\w+$/);
        expect(key).not.toContain('none');
      });

      it('deve gerar chaves diferentes para filtros diferentes', () => {
        const key1 = CacheKeys.searchResults('query', { type: 'a' });
        const key2 = CacheKeys.searchResults('query', { type: 'b' });
        expect(key1).not.toBe(key2);
      });
    });

    describe('rateLimit', () => {
      it('deve gerar chave com window padrao', () => {
        const key = CacheKeys.rateLimit('user-1');
        expect(key).toBe('ratelimit:user-1:default');
      });

      it('deve gerar chave com window customizada', () => {
        const key = CacheKeys.rateLimit('user-1', 'minute');
        expect(key).toBe('ratelimit:user-1:minute');
      });
    });

    describe('geminiIndexed', () => {
      it('deve gerar chave com formato correto', () => {
        const key = CacheKeys.geminiIndexed('doc-abc');
        expect(key).toBe('gemini:indexed:doc-abc');
      });
    });

    describe('leiArticles', () => {
      it('deve diferenciar autenticado vs publico', () => {
        const authKey = CacheKeys.leiArticles(true);
        const publicKey = CacheKeys.leiArticles(false);
        expect(authKey).toContain('auth');
        expect(publicKey).toContain('public');
        expect(authKey).not.toBe(publicKey);
      });

      it('deve incluir hash dos filtros', () => {
        const key = CacheKeys.leiArticles(true, { withDocuments: true });
        expect(key).toMatch(/^lei:articles:auth:\w+$/);
      });

      it('deve usar "all" sem filtros', () => {
        const key = CacheKeys.leiArticles(false);
        expect(key).toBe('lei:articles:public:all');
      });
    });

    describe('faqList', () => {
      it('deve usar "all" sem categoria', () => {
        expect(CacheKeys.faqList()).toBe('faq:list:all');
        expect(CacheKeys.faqList(null)).toBe('faq:list:all');
      });

      it('deve incluir categoria quando fornecida', () => {
        expect(CacheKeys.faqList('licitacao')).toBe('faq:list:licitacao');
      });
    });

    describe('testimonialsList', () => {
      it('deve retornar chave fixa', () => {
        expect(CacheKeys.testimonialsList()).toBe('testimonials:list');
      });
    });

    describe('glossaryTerms', () => {
      it('deve gerar chave com valores padrao', () => {
        const key = CacheKeys.glossaryTerms({});
        expect(key).toBe('glossary:all:all:0:100');
      });

      it('deve gerar chave com todos os parametros', () => {
        const key = CacheKeys.glossaryTerms({
          category: 'juridico',
          letter: 'A',
          offset: 10,
          limit: 50,
        });
        expect(key).toBe('glossary:juridico:A:10:50');
      });
    });

    describe('legislativeActs', () => {
      it('deve gerar chave com paginacao padrao', () => {
        const key = CacheKeys.legislativeActs({});
        expect(key).toMatch(/^acts:\w+:1:20$/);
      });

      it('deve gerar chave com paginacao customizada', () => {
        const key = CacheKeys.legislativeActs({ page: 3, limit: 10 });
        expect(key).toMatch(/^acts:\w+:3:10$/);
      });
    });

    describe('courseDocuments', () => {
      it('deve gerar chave com courseId e userId', () => {
        const key = CacheKeys.courseDocuments('course-1', 'user-1');
        expect(key).toBe('docs:course:course-1:user-1');
      });
    });

    describe('registry', () => {
      it('deve gerar chave de registro', () => {
        expect(CacheKeys.registry('faq')).toBe('registry:faq');
      });
    });

    describe('blogPosts', () => {
      it('deve gerar chave com valores padrao', () => {
        expect(CacheKeys.blogPosts()).toBe('blog:1:20:all');
      });

      it('deve gerar chave com parametros', () => {
        expect(CacheKeys.blogPosts(2, 10, true)).toBe('blog:2:10:true');
      });
    });

    describe('blogPost', () => {
      it('deve gerar chave com slug', () => {
        expect(CacheKeys.blogPost('meu-post')).toBe('blog:post:meu-post');
      });
    });

    describe('publications', () => {
      it('deve gerar chave com valores padrao', () => {
        expect(CacheKeys.publications()).toBe('pub:all:1:20');
      });

      it('deve gerar chave com tipo', () => {
        expect(CacheKeys.publications('artigo', 2, 5)).toBe('pub:artigo:2:5');
      });
    });

    describe('courseVideos', () => {
      it('deve usar "all" sem courseId', () => {
        expect(CacheKeys.courseVideos()).toBe('videos:all');
      });

      it('deve incluir courseId', () => {
        expect(CacheKeys.courseVideos('c1')).toBe('videos:c1');
      });
    });

    describe('recommendedSites', () => {
      it('deve usar "all" sem courseId', () => {
        expect(CacheKeys.recommendedSites()).toBe('sites:all');
      });

      it('deve incluir courseId', () => {
        expect(CacheKeys.recommendedSites('c2')).toBe('sites:c2');
      });
    });

    describe('enunciados', () => {
      it('deve usar "all" sem filtros', () => {
        expect(CacheKeys.enunciados()).toBe('enunciados:all');
      });

      it('deve gerar hash com filtros', () => {
        const key = CacheKeys.enunciados({ artigo: '5' });
        expect(key).toMatch(/^enunciados:\w+$/);
        expect(key).not.toBe('enunciados:all');
      });
    });

    describe('articleDetails', () => {
      it('deve gerar chave sem sufixo', () => {
        expect(CacheKeys.articleDetails('5')).toBe('article:5');
      });

      it('deve gerar chave com sufixo', () => {
        expect(CacheKeys.articleDetails('5', 'docs')).toBe('article:5:docs');
      });
    });

    describe('articleDocuments', () => {
      it('deve gerar chave com numero', () => {
        expect(CacheKeys.articleDocuments('10')).toBe('article:docs:10');
      });
    });

    describe('adminAnalytics', () => {
      it('deve gerar chave sem filtros', () => {
        expect(CacheKeys.adminAnalytics('overview')).toBe('analytics:overview:all');
      });

      it('deve gerar chave com filtros', () => {
        const key = CacheKeys.adminAnalytics('search', { period: '7d' });
        expect(key).toMatch(/^analytics:search:\w+$/);
      });
    });

    describe('douStats', () => {
      it('deve retornar chave fixa', () => {
        expect(CacheKeys.douStats()).toBe('dou:stats');
      });
    });

    describe('vectorSearch', () => {
      it('deve gerar chave com valores padrao', () => {
        const key = CacheKeys.vectorSearch({ query: 'test' });
        expect(key).toMatch(/^vector-search:\w+:all:all:5:0\.5$/);
      });

      it('deve gerar chave com todos os parametros', () => {
        const key = CacheKeys.vectorSearch({
          query: 'test',
          courseId: 'c1',
          category: 'doc',
          limit: 10,
          threshold: 0.7,
        });
        expect(key).toMatch(/^vector-search:\w+:c1:doc:10:0\.7$/);
      });
    });

    describe('queryEmbedding', () => {
      it('deve gerar chave com hash da query', () => {
        const key = CacheKeys.queryEmbedding('test query');
        expect(key).toMatch(/^query-embedding:\w+$/);
      });
    });

    describe('synthesizedAnswer', () => {
      it('deve gerar chave com hash de query e contexto', () => {
        const key = CacheKeys.synthesizedAnswer('test', ['id1', 'id2']);
        expect(key).toMatch(/^synth-answer:\w+:\w+$/);
      });

      it('deve gerar mesma chave independente da ordem dos contextIds', () => {
        const key1 = CacheKeys.synthesizedAnswer('test', ['id1', 'id2']);
        const key2 = CacheKeys.synthesizedAnswer('test', ['id2', 'id1']);
        expect(key1).toBe(key2);
      });
    });

    describe('embeddingStatus', () => {
      it('deve gerar chave com documentId', () => {
        expect(CacheKeys.embeddingStatus('doc-1')).toBe('embed-status:doc-1');
      });
    });
  });

  // ===========================
  // Cache Utilities
  // ===========================

  describe('getCache', () => {
    it('deve retornar valor do cache', async () => {
      mockGet.mockResolvedValue({ data: 'cached' });
      const result = await getCache<{ data: string }>('test-key');
      expect(result).toEqual({ data: 'cached' });
      expect(mockGet).toHaveBeenCalledWith('test-key');
    });

    it('deve retornar null quando chave nao existe', async () => {
      mockGet.mockResolvedValue(null);
      const result = await getCache('nonexistent');
      expect(result).toBeNull();
    });

    it('deve retornar null e logar erro em caso de falha', async () => {
      mockGet.mockRejectedValue(new Error('Redis error'));
      const result = await getCache('test-key');
      expect(result).toBeNull();
    });
  });

  describe('setCache', () => {
    it('deve salvar valor no cache com TTL padrao', async () => {
      mockSetex.mockResolvedValue('OK');
      await setCache('key', { data: 'value' });
      expect(mockSetex).toHaveBeenCalledWith(
        'key',
        CACHE_TTL.SEARCH_RESULTS,
        { data: 'value' }
      );
    });

    it('deve salvar valor com TTL customizado', async () => {
      mockSetex.mockResolvedValue('OK');
      await setCache('key', 'value', 3600);
      expect(mockSetex).toHaveBeenCalledWith('key', 3600, 'value');
    });

    it('deve lidar com erro sem lancar excecao', async () => {
      mockSetex.mockRejectedValue(new Error('Redis error'));
      await expect(setCache('key', 'value')).resolves.toBeUndefined();
    });

    it('deve registrar a chave no registry quando prefix é fornecido', async () => {
      mockSetex.mockResolvedValue('OK');
      mockSadd.mockResolvedValue(1);
      await setCache('faq:list:all', { data: 'x' }, 60, 'faq');
      // registerCacheKey grava a chave no set do registry do prefixo
      expect(mockSadd).toHaveBeenCalledWith(CacheKeys.registry('faq'), 'faq:list:all');
    });
  });

  describe('deleteCache', () => {
    it('deve deletar chave do cache', async () => {
      mockDel.mockResolvedValue(1);
      await deleteCache('key-to-delete');
      expect(mockDel).toHaveBeenCalledWith('key-to-delete');
    });

    it('deve lidar com erro sem lancar excecao', async () => {
      mockDel.mockRejectedValue(new Error('Redis error'));
      await expect(deleteCache('key')).resolves.toBeUndefined();
    });
  });

  describe('existsCache', () => {
    it('deve retornar true quando chave existe', async () => {
      mockExists.mockResolvedValue(1);
      const result = await existsCache('existing-key');
      expect(result).toBe(true);
    });

    it('deve retornar false quando chave nao existe', async () => {
      mockExists.mockResolvedValue(0);
      const result = await existsCache('missing-key');
      expect(result).toBe(false);
    });

    it('deve retornar false em caso de erro', async () => {
      mockExists.mockRejectedValue(new Error('Redis error'));
      const result = await existsCache('key');
      expect(result).toBe(false);
    });
  });

  describe('incrementCache', () => {
    it('deve incrementar e definir TTL na primeira chamada', async () => {
      mockIncr.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      const result = await incrementCache('counter-key', 120);

      expect(result).toBe(1);
      expect(mockIncr).toHaveBeenCalledWith('counter-key');
      expect(mockExpire).toHaveBeenCalledWith('counter-key', 120);
    });

    it('deve incrementar sem redefinir TTL em chamadas subsequentes', async () => {
      mockIncr.mockResolvedValue(5);

      const result = await incrementCache('counter-key');

      expect(result).toBe(5);
      expect(mockIncr).toHaveBeenCalledWith('counter-key');
      expect(mockExpire).not.toHaveBeenCalled();
    });

    it('deve usar TTL padrao de RATE_LIMIT', async () => {
      mockIncr.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await incrementCache('key');

      expect(mockExpire).toHaveBeenCalledWith('key', CACHE_TTL.RATE_LIMIT);
    });

    it('deve retornar 0 em caso de erro', async () => {
      mockIncr.mockRejectedValue(new Error('Redis error'));
      const result = await incrementCache('key');
      expect(result).toBe(0);
    });
  });

  // ===========================
  // Rate Limiting
  // ===========================

  describe('checkRateLimit', () => {
    it('deve permitir quando abaixo do limite', async () => {
      mockIncr.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      const result = await checkRateLimit('user-1', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(9);
      expect(result.reset).toBeGreaterThan(Date.now());
    });

    it('deve negar quando acima do limite', async () => {
      mockIncr.mockResolvedValue(11);

      const result = await checkRateLimit('user-1', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('deve permitir exatamente no limite', async () => {
      mockIncr.mockResolvedValue(10);

      const result = await checkRateLimit('user-1', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('deve usar valores padrao de limite e janela', async () => {
      mockIncr.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      const result = await checkRateLimit('user-1');

      expect(result.limit).toBe(10);
    });

    it('deve fail open em caso de erro (permitir acesso)', async () => {
      mockIncr.mockRejectedValue(new Error('Redis error'));

      const result = await checkRateLimit('user-1', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });
  });

  // ===========================
  // Registry e Invalidacao
  // ===========================

  describe('registerCacheKey', () => {
    it('deve registrar chave no set de registro', async () => {
      mockSadd.mockResolvedValue(1);

      await registerCacheKey('faq', 'faq:list:all');

      expect(mockSadd).toHaveBeenCalledWith('registry:faq', 'faq:list:all');
    });

    it('deve lidar com erro sem lancar excecao', async () => {
      mockSadd.mockRejectedValue(new Error('Redis error'));
      await expect(registerCacheKey('faq', 'faq:list:all')).resolves.toBeUndefined();
    });
  });

  describe('getRegisteredKeys', () => {
    it('deve retornar chaves registradas', async () => {
      mockSmembers.mockResolvedValue(['faq:list:all', 'faq:list:licitacao']);

      const keys = await getRegisteredKeys('faq');

      expect(keys).toEqual(['faq:list:all', 'faq:list:licitacao']);
      expect(mockSmembers).toHaveBeenCalledWith('registry:faq');
    });

    it('deve retornar array vazio em caso de erro', async () => {
      mockSmembers.mockRejectedValue(new Error('Redis error'));
      const keys = await getRegisteredKeys('faq');
      expect(keys).toEqual([]);
    });
  });

  describe('invalidateCacheByPrefix', () => {
    it('deve deletar todas as chaves registradas e limpar o registro', async () => {
      mockSmembers.mockResolvedValue(['faq:list:all', 'faq:list:cat1']);
      mockDel.mockResolvedValue(1);

      const count = await invalidateCacheByPrefix('faq');

      expect(count).toBe(2);
      expect(mockDel).toHaveBeenCalledWith('faq:list:all');
      expect(mockDel).toHaveBeenCalledWith('faq:list:cat1');
      // Tambem limpa o registro
      expect(mockDel).toHaveBeenCalledWith('registry:faq');
    });

    it('deve retornar 0 quando nao ha chaves para invalidar', async () => {
      mockSmembers.mockResolvedValue([]);

      const count = await invalidateCacheByPrefix('empty');

      expect(count).toBe(0);
    });

    it('deve retornar 0 quando smembers retorna null', async () => {
      mockSmembers.mockResolvedValue(null);

      const count = await invalidateCacheByPrefix('null-prefix');

      expect(count).toBe(0);
    });

    it('deve retornar 0 em caso de erro', async () => {
      mockSmembers.mockRejectedValue(new Error('Redis error'));

      const count = await invalidateCacheByPrefix('error-prefix');

      expect(count).toBe(0);
    });
  });

  // ===========================
  // withCache Wrapper
  // ===========================

  describe('withCache', () => {
    it('deve retornar valor do cache em caso de HIT', async () => {
      mockGet.mockResolvedValue({ data: 'cached-value' });
      const fn = vi.fn().mockResolvedValue({ data: 'fresh-value' });

      const result = await withCache('key', fn);

      expect(result).toEqual({ data: 'cached-value' });
      expect(fn).not.toHaveBeenCalled();
    });

    it('deve executar funcao e cachear em caso de MISS', async () => {
      mockGet.mockResolvedValue(null);
      mockSetex.mockResolvedValue('OK');
      const fn = vi.fn().mockResolvedValue({ data: 'fresh' });

      const result = await withCache('key', fn, 3600);

      expect(result).toEqual({ data: 'fresh' });
      expect(fn).toHaveBeenCalled();
      expect(mockSetex).toHaveBeenCalledWith('key', 3600, { data: 'fresh' });
    });

    it('deve registrar chave no registry quando prefix fornecido', async () => {
      mockGet.mockResolvedValue(null);
      mockSetex.mockResolvedValue('OK');
      mockSadd.mockResolvedValue(1);
      const fn = vi.fn().mockResolvedValue('value');

      await withCache('faq:list:all', fn, 3600, { prefix: 'faq' });

      expect(mockSadd).toHaveBeenCalledWith('registry:faq', 'faq:list:all');
    });

    it('deve nao registrar chave quando prefix nao fornecido', async () => {
      mockGet.mockResolvedValue(null);
      mockSetex.mockResolvedValue('OK');
      const fn = vi.fn().mockResolvedValue('value');

      await withCache('key', fn, 3600);

      expect(mockSadd).not.toHaveBeenCalled();
    });

    it('deve usar TTL padrao de SEARCH_RESULTS', async () => {
      mockGet.mockResolvedValue(null);
      mockSetex.mockResolvedValue('OK');
      const fn = vi.fn().mockResolvedValue('value');

      await withCache('key', fn);

      expect(mockSetex).toHaveBeenCalledWith(
        'key',
        CACHE_TTL.SEARCH_RESULTS,
        'value'
      );
    });
  });

  // ===========================
  // Health Check
  // ===========================

  describe('healthCheck', () => {
    it('deve retornar connected=true com latencia quando ping funciona', async () => {
      mockPing.mockResolvedValue('PONG');

      const result = await healthCheck();

      expect(result.connected).toBe(true);
      expect(result.latency).toBeDefined();
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('deve retornar connected=false com erro quando ping falha', async () => {
      mockPing.mockRejectedValue(new Error('Connection refused'));

      const result = await healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('deve lidar com erro nao-Error', async () => {
      mockPing.mockRejectedValue('unknown error');

      const result = await healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  // ===========================
  // isCacheEnabled
  // ===========================

  describe('isCacheEnabled', () => {
    it('deve retornar true quando redis esta configurado e cache nao desabilitado', () => {
      expect(isCacheEnabled()).toBe(true);
    });
  });

  // ===========================
  // getCacheStats
  // ===========================

  describe('getCacheStats', () => {
    it('deve retornar estatisticas com prefixos registrados', async () => {
      mockPing.mockResolvedValue('PONG');
      mockSmembers.mockResolvedValue([]);

      const stats = await getCacheStats();

      expect(stats.enabled).toBe(true);
      expect(stats.connected).toBe(true);
      expect(stats.registeredPrefixes).toBeInstanceOf(Array);
      expect(stats.registeredPrefixes.length).toBeGreaterThan(0);
    });

    it('deve incluir contagem de chaves por prefixo', async () => {
      mockPing.mockResolvedValue('PONG');
      mockSmembers.mockImplementation((key: string) => {
        if (key === 'registry:faq') return Promise.resolve(['faq:list:all', 'faq:list:cat1']);
        return Promise.resolve([]);
      });

      const stats = await getCacheStats();

      const faqPrefix = stats.registeredPrefixes.find((p) => p.prefix === 'faq');
      expect(faqPrefix).toBeDefined();
      expect(faqPrefix!.count).toBe(2);
    });

    it('deve refletir status de conexao do healthCheck', async () => {
      mockPing.mockRejectedValue(new Error('Connection error'));
      mockSmembers.mockResolvedValue([]);

      const stats = await getCacheStats();

      expect(stats.connected).toBe(false);
    });
  });

  describe('deleteCachePattern', () => {
    it('varre com SCAN e deleta as chaves casadas (múltiplos cursores)', async () => {
      // 1º SCAN devolve cursor != 0 com 2 chaves; 2º devolve cursor 0 com 1 chave
      mockScan
        .mockResolvedValueOnce(['5', ['faq:a', 'faq:b']])
        .mockResolvedValueOnce(['0', ['faq:c']]);
      mockDel.mockResolvedValue(1);

      const deleted = await deleteCachePattern('faq:*');
      expect(deleted).toBe(3);
      expect(mockScan).toHaveBeenCalledTimes(2);
      expect(mockDel).toHaveBeenCalledWith('faq:a');
      expect(mockDel).toHaveBeenCalledWith('faq:c');
    });

    it('retorna 0 quando não há chaves casadas', async () => {
      mockScan.mockResolvedValueOnce(['0', []]);
      expect(await deleteCachePattern('none:*')).toBe(0);
    });

    it('retorna 0 e não lança em caso de erro no SCAN', async () => {
      mockScan.mockRejectedValueOnce(new Error('scan boom'));
      expect(await deleteCachePattern('err:*')).toBe(0);
    });
  });

  describe('CacheInvalidation', () => {
    beforeEach(() => {
      // Cada invalidateCacheByPrefix lê o registry (smembers) e deleta (del)
      mockSmembers.mockResolvedValue(['k1']);
      mockDel.mockResolvedValue(1);
    });

    it('leiArticle(numero) deleta a chave específica do editor', async () => {
      mockDel.mockResolvedValue(1);
      const n = await CacheInvalidation.leiArticle('75');
      expect(n).toBe(1);
      expect(mockDel).toHaveBeenCalledWith(CacheKeys.leiArticleEditor('75'));
    });

    it('courseDocuments(courseId) invalida o prefixo específico do curso', async () => {
      await CacheInvalidation.courseDocuments('3');
      // registry do prefixo docs:course:3
      expect(mockSmembers).toHaveBeenCalledWith(CacheKeys.registry('docs:course:3'));
    });

    it('all() invoca todos os invalidadores e agrega total + detalhes', async () => {
      const res = await CacheInvalidation.all();
      expect(res).toHaveProperty('total');
      expect(res.details).toHaveProperty('faq');
      expect(res.details).toHaveProperty('adminAnalytics');
      // sanity: total é a soma dos counts numéricos
      expect(typeof res.total).toBe('number');
    });
  });
});
