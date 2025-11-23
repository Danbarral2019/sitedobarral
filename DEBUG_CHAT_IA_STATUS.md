# Status Debug: Chat IA - Erro 500 em Produção

**Data:** 2025-11-23
**Status:** 🔴 PROBLEMA IDENTIFICADO - AGUARDANDO CORREÇÃO

---

## 🎯 CAUSA RAIZ ENCONTRADA

**A chave `GEMINI_API_KEY` configurada no Vercel está EXPIRADA.**

### Erro Completo:
```
[GoogleGenerativeAI Error]: Error fetching from
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent:
[400 Bad Request] API key expired. Please renew the API key.
```

---

## 📊 Diagnóstico

| Ambiente | Status | Detalhes |
|----------|--------|----------|
| **Desenvolvimento Local** | ✅ Funcionando | Usa `.env.local` com chave válida |
| **Produção Vercel** | ❌ Falhando | Usa variável ambiente com chave expirada |
| **Código** | ✅ Correto | Sem bugs, tipagem correta |

---

## 🔍 Investigação Realizada

### Tentativas de Correção (4 commits):

1. **Commit `7e65bea`**: Fix Prisma query syntax
   - ❌ Não resolveu (não era a causa)

2. **Commit `34dc46d`**: Fix Next.js 15 params typing
   - ❌ Não resolveu (mas corrigiu outro problema)

3. **Commit `dbd1186`**: Handle params Promise inconsistency
   - ❌ Não resolveu (tentativa de compatibilidade)

4. **Commit `92ff9fa`**: Adicionar logs detalhados
   - ✅ **REVELOU A CAUSA RAIZ!**

### Descoberta do Problema:

```bash
# Teste em produção revelou:
$ curl -X POST https://www.profdanielbarral.com/api/artigos/92/chat \
  -H "Content-Type: application/json" -d '{"question":"teste"}'

# Resposta:
{
  "error":"Erro ao processar pergunta",
  "details":"API key expired. Please renew the API key.",
  "name":"Error"
}
```

---

## ✅ SOLUÇÃO

### 1. Gerar Nova Chave Gemini API

**URL:** https://aistudio.google.com/app/apikey

1. Acessar Google AI Studio
2. Criar nova API key
3. Copiar a chave gerada

### 2. Atualizar Vercel Environment Variables

```bash
# Remover chave antiga
vercel env rm GEMINI_API_KEY production
vercel env rm GEMINI_API_KEY preview
vercel env rm GEMINI_API_KEY development

# Adicionar nova chave
vercel env add GEMINI_API_KEY production
# (colar nova chave quando solicitado)

vercel env add GEMINI_API_KEY preview
vercel env add GEMINI_API_KEY development
```

### 3. Fazer Novo Deploy

```bash
vercel --prod --yes
```

---

## 📝 Arquivos Modificados (para debug)

### `app/api/artigos/[numero]/chat/route.ts`

**Mudanças para debug:**
- ✅ Adicionado logging detalhado de erros
- ✅ Corrigido handling de `params` (Promise vs Object)
- ✅ Retorna `details` e `name` no erro JSON

**Código de tratamento de erro:**
```typescript
} catch (error) {
  console.error('[Chat API] ERRO DETALHADO:', error);
  console.error('[Chat API] Error name:', error instanceof Error ? error.name : 'Unknown');
  console.error('[Chat API] Error message:', error instanceof Error ? error.message : String(error));
  console.error('[Chat API] Error stack:', error instanceof Error ? error.stack : 'No stack');
  return NextResponse.json(
    {
      error: 'Erro ao processar pergunta',
      details: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown'
    },
    { status: 500 }
  );
}
```

---

## 🔄 Próximos Passos

1. **Usuário deve:**
   - [ ] Acessar https://aistudio.google.com/app/apikey
   - [ ] Gerar nova API key
   - [ ] Fornecer a nova chave

2. **Claude deve:**
   - [ ] Atualizar GEMINI_API_KEY no Vercel (production, preview, development)
   - [ ] Fazer deploy
   - [ ] Testar em produção
   - [ ] Remover logs de debug (opcional - manter pode ser útil)

---

## 🧪 Teste de Validação

Após atualizar a chave, testar:

```bash
# 1. Teste direto da API
curl -X POST https://www.profdanielbarral.com/api/artigos/92/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Qual o objetivo deste artigo?"}'

# Esperado: Status 200 com resposta da IA

# 2. Teste no navegador
# - Acessar: https://www.profdanielbarral.com/area-restrita/lei-comentada?artigo=92
# - Fazer pergunta à IA
# - Verificar resposta funciona
```

---

## 📌 Notas Importantes

1. **Por que funcionava localmente?**
   - `.env.local` tem chave válida: `AIzaSyDPoKoJPl_LhKZpLLkHSdw3QvgwQGQT3jc`
   - Vercel tinha chave expirada

2. **Chaves Gemini expiram?**
   - Sim, podem expirar ou ser revogadas
   - Sempre gerar nova chave via Google AI Studio

3. **Outras variáveis ambiente OK:**
   - ✅ GEMINI_API_KEY (local) - válida
   - ❌ GEMINI_API_KEY (Vercel) - expirada ← **PROBLEMA**
   - ℹ️ UPSTASH_REDIS_* - não configuradas (opcional)

---

## 💾 Commits Relacionados

```
92ff9fa - debug: Adicionar logs detalhados de erro na API de chat
dbd1186 - fix: Handle Next.js 15 params inconsistency (Promise in prod, object in dev)
34dc46d - fix: CAUSA RAIZ - Corrigir tipagem params no Next.js 15 (route handlers)
7e65bea - fix: Corrigir sintaxe Prisma query na API de chat (erro 500)
```

---

## 🚀 Deploy Info

- **Último deploy:** sitedobarral-4hym5hgi1-daniel-barrals-projects.vercel.app
- **Status:** ● Ready (mas API key expirada)
- **Produção:** https://www.profdanielbarral.com

---

**Resumo:** Problema 100% identificado. Solução simples: renovar chave Gemini API no Vercel.
