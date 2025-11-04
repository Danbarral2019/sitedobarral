# 🚨 CORREÇÃO URGENTE - Vazamento de Chave API Gemini

**Status:** CRÍTICO
**Data:** 2025-11-04
**Commit Afetado:** `c8a161d6fe5273b23eed0d885bf3b6794fad9a88`

## ⚠️ PROBLEMA IDENTIFICADO

A chave API do Gemini foi exposta publicamente no GitHub no arquivo:
- **Arquivo:** `configurar-gemini-definitivo.ps1`
- **Linha:** 2
- **Chave Exposta:** `AIzaSyApz9sojCqTCl77MbOeAkqPZ5uya4ekRUQ`

## 🚨 PASSO 1: REVOGAR A CHAVE IMEDIATAMENTE (FAÇA AGORA!)

**VOCÊ DEVE FAZER ISSO MANUALMENTE:**

1. Acesse: https://aistudio.google.com/app/apikey
2. Faça login com sua conta Google
3. Localize a chave que começa com `AIzaSyApz9...`
4. Clique em **"Delete"** ou **"Revoke"**
5. Confirme a revogação

⚠️ **IMPORTANTE:** Até você revogar a chave, qualquer pessoa que viu o repositório público pode usar sua chave!

## 🔧 PASSO 2: Limpar o Repositório Git

Vou executar os comandos para você agora:

```bash
# 1. Remover o arquivo do repositório
git rm configurar-gemini-definitivo.ps1

# 2. Remover do histórico usando git filter-repo (recomendado) ou BFG Repo-Cleaner
# Opção A: Com git filter-repo
git filter-repo --path configurar-gemini-definitivo.ps1 --invert-paths --force

# Opção B: Com BFG (alternativa)
# bfg --delete-files configurar-gemini-definitivo.ps1

# 3. Forçar push para sobrescrever o histórico remoto
git push origin main --force
```

## 🛡️ PASSO 3: Gerar Nova Chave

Após revogar a chave antiga:

1. Volte para: https://aistudio.google.com/app/apikey
2. Clique em **"Create API Key"**
3. Selecione um projeto Google Cloud ou crie um novo
4. Copie a nova chave gerada

## 🔒 PASSO 4: Configurar Nova Chave COM SEGURANÇA

### Windows (PowerShell como Administrador):
```powershell
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'SUA_NOVA_CHAVE_AQUI', 'User')
```

### Adicionar ao .env.local (que está no .gitignore):
```bash
echo 'GEMINI_API_KEY=SUA_NOVA_CHAVE_AQUI' >> .env.local
```

## ✅ PASSO 5: Verificações de Segurança

### Verificar que .gitignore está correto:
```bash
cat .gitignore | grep -E "\.env|\.ps1"
```

### Adicionar proteções extras ao .gitignore:
```
# Scripts de configuração com chaves
*-definitivo.ps1
configurar-*.ps1
setup-keys.*
```

### Verificar que não há chaves em arquivos rastreados:
```bash
git ls-files | xargs grep -l "AIza" 2>/dev/null
git ls-files | xargs grep -l "GEMINI_API_KEY.*=" 2>/dev/null
```

## 📋 PREVENÇÃO FUTURA

### 1. **NUNCA** comite arquivos com chaves hardcoded
- ❌ `$apiKey = "AIza..."`
- ✅ `$apiKey = $env:GEMINI_API_KEY`

### 2. Use variáveis de ambiente
```powershell
# Ler da variável de ambiente
$apiKey = [System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')
if (-not $apiKey) {
    Write-Error "GEMINI_API_KEY não configurada!"
    exit 1
}
```

### 3. Configure git-secrets (opcional mas recomendado)
```bash
# Instalar git-secrets
git secrets --install
git secrets --register-aws  # Detecta chaves AWS
git secrets --add 'AIza[0-9A-Za-z\\-_]{35}'  # Detecta chaves Google
```

### 4. Use pre-commit hooks
Crie `.git/hooks/pre-commit`:
```bash
#!/bin/bash
if git diff --cached | grep -E "AIza[0-9A-Za-z-_]{35}"; then
    echo "❌ ERRO: Chave API Google detectada!"
    echo "Remova a chave antes de commitar."
    exit 1
fi
```

## 📊 IMPACTO E RISCO

- **Exposição:** Pública no GitHub
- **Duração:** Desde commit c8a161d (2025-11-04 10:09)
- **Risco:** ALTO - Qualquer pessoa pode usar sua quota do Gemini API
- **Custo Potencial:** Dependendo do uso não autorizado

## ✅ CHECKLIST DE RECUPERAÇÃO

- [ ] Revogou a chave antiga no Google AI Studio
- [ ] Removeu `configurar-gemini-definitivo.ps1` do repositório
- [ ] Limpou o histórico Git com `git filter-repo` ou BFG
- [ ] Fez force push para o GitHub
- [ ] Gerou nova chave API
- [ ] Configurou nova chave usando variáveis de ambiente
- [ ] Verificou que nenhuma outra chave está exposta
- [ ] Atualizou .gitignore com proteções extras
- [ ] Testou que o MCP Gemini funciona com a nova chave

## 📞 SUPORTE

Se precisar de ajuda adicional:
- Documentação Google AI Studio: https://ai.google.dev/docs
- GitHub Support: https://support.github.com/

---

**Gerado por:** Claude Code Audit System
**Data:** 2025-11-04
**Prioridade:** CRÍTICA - Ação Imediata Necessária
