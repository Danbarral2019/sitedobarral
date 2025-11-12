# 🔍 Search API Documentation

## Overview

The Search API provides semantic search capabilities across indexed documents using Google Gemini File API with Redis caching.

**Endpoint:** `POST /api/documents/query`
**Authentication:** Required (JWT cookie: `auth-token`)
**Rate Limit:** 10 queries/minute (non-admin users)

---

## Request Format

```typescript
POST /api/documents/query
Content-Type: application/json
Cookie: auth-token=<jwt_token>

{
  "query": string,              // Required: Search query (min 3 chars)
  "filters"?: {
    "courseId"?: string,         // Filter by course ID
    "category"?: string,         // Filter by category
    "dateFrom"?: string,         // ISO date (YYYY-MM-DD)
    "dateTo"?: string,           // ISO date (YYYY-MM-DD)
    "tags"?: string[],           // Filter by tags
    "isPublic"?: boolean         // Public documents only
  },
  "maxResults"?: number,         // Default: 5, Max: 20
  "includeContent"?: boolean,    // Include full content (default: false)
  "useCache"?: boolean           // Use Redis cache (default: true)
}
```

---

## Response Format

```typescript
{
  "success": boolean,
  "results": [
    {
      "documentId": string,
      "title": string,
      "category": string,
      "geminiResponse": string,    // AI-generated response
      "relevance": number,          // 0-1 (1 = most relevant)
      "excerpt": string,            // ~200 chars summary
      "url"?: string,
      "uploadedAt": string,         // ISO timestamp
      "tags"?: string[],
      "courseIds"?: string[]        // Empty if isCommon
    }
  ],
  "totalDocuments": number,        // Total docs matching filters
  "cached": boolean,               // If result was cached
  "latency": number,               // Response time in ms
  "query": string,
  "error"?: string                 // Error message if failed
}
```

---

## Examples

### Basic Query

```bash
curl -X POST http://localhost:3000/api/documents/query \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=<token>" \
  -d '{
    "query": "Quais são os requisitos de licitação?",
    "maxResults": 3
  }'
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "documentId": "uuid-123",
      "title": "Orientação Normativa 01/2024",
      "category": "orientacao-normativa",
      "geminiResponse": "Os principais requisitos de licitação segundo...",
      "relevance": 0.89,
      "excerpt": "Os principais requisitos de licitação segundo a Lei 14.133/2021...",
      "url": "https://...",
      "uploadedAt": "2024-03-15T10:30:00Z",
      "tags": ["licitação", "lei-14133"]
    }
  ],
  "totalDocuments": 5,
  "cached": false,
  "latency": 2580,
  "query": "Quais são os requisitos de licitação?"
}
```

---

### Query with Filters

```bash
curl -X POST http://localhost:3000/api/documents/query \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=<token>" \
  -d '{
    "query": "Explique pregão eletrônico",
    "filters": {
      "category": "orientacao-normativa",
      "dateFrom": "2024-01-01"
    },
    "maxResults": 5
  }'
```

---

### Query by Course

```bash
curl -X POST http://localhost:3000/api/documents/query \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=<token>" \
  -d '{
    "query": "Como funciona dispensa de licitação?",
    "filters": {
      "courseId": "1"  // Nova Lei de Licitações
    }
  }'
```

---

## Performance

| Scenario | Latency | Notes |
|----------|---------|-------|
| **Cold Query** | ~2.5-5s | First query to Gemini |
| **Cached Query** | ~50-150ms | Subsequent identical queries |
| **Cache Speedup** | **60-110x** | Dramatic improvement |

---

## Rate Limiting

**Non-admin users:** 10 queries per minute
**Admin users:** Unlimited

**Error Response (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Maximum 10 queries per minute."
}
```

---

## Access Control

### Admins
- Can query ALL documents (public + private)
- Bypass rate limiting
- Can use `isPublic` filter

### Non-admin Users
- Can query:
  - Public documents (`isPublic: true`)
  - Common documents (`isCommon: true`)
  - Documents from enrolled courses (active enrollments only)

---

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| **400** | Bad Request | Invalid query (< 3 chars) or maxResults out of range |
| **401** | Unauthorized | No auth token or invalid token |
| **429** | Too Many Requests | Rate limit exceeded (non-admin) |
| **500** | Internal Server Error | Database or Gemini API error |

---

## Relevance Scoring

Documents are ranked by relevance (0-1):

**Factors:**
- **Query word matching** (70%): How many query words appear in response
- **Response length** (30%): Longer responses indicate more content

**Example:**
- Query: "licitação pregão eletrônico"
- Doc A: Mentions all 3 words + 500 chars → **0.95 relevance**
- Doc B: Mentions 1 word + 100 chars → **0.35 relevance**

---

## Cache Behavior

### Cache Key
```
gemini:query:<fileUri>:<queryHash>
```

### TTL (Time To Live)
- **24 hours** for Gemini queries
- Auto-refresh on cache hit

### Cache Invalidation
- Automatic expiration after 24h
- Manual invalidation: not implemented yet

---

## Integration Example (TypeScript)

```typescript
async function searchDocuments(
  query: string,
  filters?: { courseId?: string; category?: string }
) {
  const response = await fetch('/api/documents/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include auth cookie
    body: JSON.stringify({
      query,
      filters,
      maxResults: 5,
      useCache: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const data = await response.json();

  console.log(`Found ${data.results.length} results in ${data.latency}ms`);
  console.log(`Cached: ${data.cached ? 'YES' : 'NO'}`);

  return data.results;
}

// Usage
const results = await searchDocuments(
  'Quais são os tipos de contratação direta?',
  { courseId: '1' }
);
```

---

## Testing

Run the test suite:

```bash
npx dotenv -e .env.local -- npx tsx scripts/test-search-api.ts
```

**Test Coverage:**
- ✅ Basic query
- ✅ Query with category filter
- ✅ Query with date filter
- ✅ Cached query (repeat)
- ✅ Rate limiting

---

## Known Limitations

1. **Max 20 results per query** (configurable in code)
2. **No full-text search** (relies on Gemini semantic understanding)
3. **No pagination** (returns top N by relevance)
4. **No query suggestions** (no autocomplete)
5. **No multi-language support** (Portuguese only)

---

## Roadmap

### Planned Features
- [ ] Query history tracking
- [ ] Query analytics (popular searches)
- [ ] Saved searches
- [ ] Search within specific document
- [ ] Export results (PDF, JSON)
- [ ] Batch queries
- [ ] Webhook notifications for new content

---

## Support

For issues or questions:
- Check logs in dev server console
- Review `test-search-api.ts` for examples
- Verify Gemini API key is configured
- Ensure Redis is connected

**Common Issues:**
- **401 Unauthorized**: Login first to get auth token
- **429 Rate Limit**: Wait 1 minute or use admin account
- **Empty results**: Check if documents are indexed (`geminiIndexed=true`)
- **Slow queries**: First query is always slow (~5s), subsequent queries are cached

---

## API Changelog

### v1.0.0 (2025-11-12)
- Initial release
- Semantic search with Gemini
- Redis caching (60-110x speedup)
- Course/category/date filters
- Rate limiting (10 req/min)
- Relevance scoring
- Access control (public/enrolled)

---

**Last Updated:** 2025-11-12
**Version:** 1.0.0
**Status:** Production Ready ✅
