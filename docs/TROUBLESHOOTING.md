# Troubleshooting — Site do Barral

Soluções para problemas comuns de ambiente/dev. Movido do `CLAUDE.md` para carregar sob demanda (mantém o `CLAUDE.md` enxuto). Os gotchas **específicos do projeto** (identificadores de versionamento, `thinkingBudget` do Gemini) continuam no `CLAUDE.md`.

## Database — Prisma engine error

```bash
taskkill /F /IM node.exe     # matar Node.js travando o engine
npx prisma generate
```

## MCP não funciona

```bash
claude mcp list              # verificar status dos MCPs
claude mcp add playwright    # reinstalar se Playwright cair
```

## Build errors (limpeza completa)

```bash
rm -rf .next node_modules
npm install
npx prisma generate
npm run build
```

## Tags Parse Errors (`JSON.parse` em tags/leiArticles)

Use `safeParseArray()` (suporta CSV **e** JSON) em vez de `JSON.parse` cru:

```typescript
import { safeParseArray } from './safe-parse';

// ❌ pode falhar com CSV
const tags = JSON.parse(doc.tags);
// ✅ funciona com CSV e JSON
const tags = safeParseArray(doc.tags);
```

Migrar dados existentes CSV→JSON:
```bash
export DATABASE_URL="..." && npx tsx scripts/fix-csv-tags.ts
```

## Chat RAG / Gemini não conecta

```bash
claude mcp list              # deve mostrar "gemini: ✓ Connected"
echo $GEMINI_API_KEY         # Linux/Mac
echo %GEMINI_API_KEY%        # Windows

# Reinstalar MCP Gemini
cd ~/.claude-mcp-servers/gemini
./setup-global.bat           # Windows
./setup-global.sh            # Linux/Mac
```

## React Hydration Errors

Valores não-determinísticos (ex.: `new Date()`) no primeiro render causam mismatch. Use flag de mount no cliente:

```typescript
// ❌ WRONG — hydration mismatch
function Header() {
  return <div>{new Date().toISOString()}</div>;
}

// ✅ CORRECT — client-side mounting flag
function Header() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;
  return <div>{new Date().toISOString()}</div>;
}
```

## Índice de documentação

Setup: `SETUP.md`, `RESEND_SETUP_COMPLETO.md`, `MCP_SETUP.md`, `DEPLOY_VERCEL.md`.
Features/domínio: `AGU_SCRAPER_V4.md`, `IMPORTACAO_EXCEL.md`, `AUTOMACAO_CRON_JOBS.md`, `COURSE_IDS_REFERENCE.md`.
Referência canônica: `prisma/schema.prisma` (schema), `FUTURE_TASKS.md` (backlog), `docs/PROJECT_HISTORY.md` (changelog).
Demais docs de domínio: ver os `*.md` no root e em `docs/`.
