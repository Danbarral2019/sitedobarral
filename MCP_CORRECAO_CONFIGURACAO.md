# Correção de Configuração MCP - Windows Wrapper Fix

**Data**: 2025-11-09
**Status**: ✅ Concluído

## Resumo das Correções

Correções aplicadas para resolver problemas de configuração MCP identificados no diagnóstico:
1. Wrappers Windows para comandos NPX
2. Otimização de uso de contexto

---

## 1. Correção dos Wrappers Windows (cmd /c)

### Problema Identificado
Servidores MCP que usam `npx` diretamente no Windows podem falhar. É necessário usar o wrapper `cmd /c`.

### Servidores Corrigidos

#### ✅ Playwright
```json
// ANTES
{
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest", "--headless"]
}

// DEPOIS
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@playwright/mcp@latest", "--headless"]
}
```

#### ✅ GitHub
```json
// ANTES
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"]
}

// DEPOIS
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-github"]
}
```

#### ✅ PostgreSQL (Projeto site-prof-barral)
```json
// ANTES
{
  "command": "npx",
  "args": ["-y", "@henkey/postgres-mcp-server", "--connection-string", "..."]
}

// DEPOIS
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@henkey/postgres-mcp-server", "--connection-string", "..."]
}
```

#### ℹ️ Gemini (Sem Alteração)
Já estava usando `node` diretamente, não precisa de wrapper.

---

## 2. Otimização de Uso de Contexto

### Problema
- Contexto atual: **54.060 tokens**
- Limite recomendado: **25.000 tokens**
- Excesso: **+116% acima do recomendado**

### Solução: Configuração Minimal

Criada configuração alternativa em: `~/.claude/mcp-config.minimal.json`

#### MCPs na Configuração Minimal (Essenciais)

| MCP | Status | Motivo |
|-----|--------|--------|
| **GitHub** | ✅ Incluído | Versionamento e colaboração (essencial para projeto) |
| **PostgreSQL** | ✅ Incluído | Banco de dados Neon (crítico para site-prof-barral) |
| **Gemini** | ✅ Incluído | Colaboração IA (útil para revisões e sugestões) |
| **Playwright** | ⚠️ Removido | Testes E2E (apenas quando necessário) |

#### Como Usar

**Modo Normal (Todos os MCPs):**
```bash
claude
```

**Modo Minimal (Reduzido):**
```bash
claude --mcp-config ~/.claude/mcp-config.minimal.json
```

Ou para este projeto especificamente:
```bash
cd "C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral"
claude --mcp-config ~/.claude/mcp-config.minimal.json
```

---

## 3. Backup

Backup criado em: `C:\Users\Administrador\.claude.json.backup`

Para restaurar (se necessário):
```powershell
Copy-Item "C:\Users\Administrador\.claude.json.backup" -Destination "C:\Users\Administrador\.claude.json" -Force
```

---

## 4. Verificação Pós-Correção

### Teste de Conectividade
```bash
claude mcp list
```

**Resultado Esperado:**
- ✓ playwright: Connected
- ✓ github: Connected
- ✓ gemini: Connected
- ✓ postgresql: Connected

### Chave API Gemini
```bash
# Windows PowerShell
[Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')
```

**Status**: ✅ Configurada (primeiros 15 chars: `AIzaSyAFa4vRvjU...`)

---

## 5. Estimativa de Redução de Contexto

### Configuração Full (Atual)
- MCPs ativos: 4 (playwright, github, postgresql, gemini)
- Contexto estimado: ~54.060 tokens

### Configuração Minimal
- MCPs ativos: 3 (github, postgresql, gemini)
- Contexto estimado: ~35.000 tokens
- **Redução esperada: ~35% (-19.060 tokens)**

---

## 6. Recomendações de Uso

### Para Desenvolvimento Web Diário
Use configuração **minimal**:
- GitHub para versionamento ✅
- PostgreSQL para database ✅
- Gemini para colaboração IA ✅

### Para Testes E2E / Scraping
Use configuração **full** (sem flag):
- Todos os MCPs anteriores +
- Playwright para automação browser ✅

---

## 7. Troubleshooting

### Se MCP não conectar após correção

1. **Reinicie o Claude Code**
   ```bash
   # Feche e reabra o terminal
   ```

2. **Verifique a sintaxe JSON**
   ```bash
   # Windows PowerShell
   Get-Content "C:\Users\Administrador\.claude.json" | ConvertFrom-Json
   ```

3. **Teste manualmente**
   ```bash
   cmd /c npx -y @playwright/mcp@latest --headless
   ```

### Se contexto ainda estiver alto

1. Use configuração minimal consistentemente
2. Considere desabilitar MCPs temporariamente via @-mention
3. Use `/mcp` para verificar status

---

## 8. Arquivos Modificados

- ✅ `C:\Users\Administrador\.claude.json` - Configuração global (wrappers corrigidos)
- ✅ `C:\Users\Administrador\.claude.json.backup` - Backup original
- ✅ `C:\Users\Administrador\.claude\mcp-config.minimal.json` - Configuração minimal (novo)
- ✅ `C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\MCP_CORRECAO_CONFIGURACAO.md` - Esta documentação

---

## 9. Próximos Passos

1. ✅ Testar conectividade dos MCPs
2. ⏳ Monitorar uso de contexto durante desenvolvimento
3. ⏳ Ajustar configuração minimal conforme necessário
4. ⏳ Atualizar `CLAUDE.md` com instruções de uso

---

## 10. Referências

- [Claude Code MCP Docs](https://docs.claude.com/en/docs/claude-code/mcp)
- [MCP Server List](https://github.com/modelcontextprotocol/servers)
- [Windows NPX Wrapper Issue](https://github.com/anthropics/claude-code/issues)

---

**Autor**: Claude Code
**Revisado**: Daniel Barral
**Versão**: 1.0
