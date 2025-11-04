# verificar-gemini.ps1
Write-Host "🔍 Verificando configuração do Gemini MCP..." -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 1. Verificar API Key
Write-Host "1. API Key:" -ForegroundColor Yellow
if ($env:GEMINI_API_KEY) {
    Write-Host "   ✅ GEMINI_API_KEY configurada" -ForegroundColor Green
    $keyPreview = $env:GEMINI_API_KEY.Substring(0, [Math]::Min(10, $env:GEMINI_API_KEY.Length))
    Write-Host "   Key: $keyPreview..." -ForegroundColor Gray
} else {
    Write-Host "   ❌ GEMINI_API_KEY não encontrada" -ForegroundColor Red
    Write-Host "   Configure com: setx GEMINI_API_KEY ""sua-api-key""" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# 2. Verificar build
Write-Host "2. Build:" -ForegroundColor Yellow
if (Test-Path ".\build\index.js") {
    Write-Host "   ✅ Server compilado (build/index.js existe)" -ForegroundColor Green
    $buildSize = (Get-Item ".\build\index.js").Length
    Write-Host "   Tamanho: $([Math]::Round($buildSize/1KB, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Server não compilado" -ForegroundColor Red
    Write-Host "   Execute: npm run build" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# 3. Verificar dependências
Write-Host "3. Dependências:" -ForegroundColor Yellow
if (Test-Path ".\package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json

    if ($packageJson.dependencies.'@google/generative-ai') {
        Write-Host "   ✅ @google/generative-ai: $($packageJson.dependencies.'@google/generative-ai')" -ForegroundColor Green
    } else {
        Write-Host "   ❌ @google/generative-ai não instalada" -ForegroundColor Red
        $allGood = $false
    }

    if ($packageJson.dependencies.'@modelcontextprotocol/sdk') {
        Write-Host "   ✅ @modelcontextprotocol/sdk: $($packageJson.dependencies.'@modelcontextprotocol/sdk')" -ForegroundColor Green
    } else {
        Write-Host "   ❌ @modelcontextprotocol/sdk não instalada" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "   ❌ package.json não encontrado" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# 4. Verificar node_modules
Write-Host "4. Instalação:" -ForegroundColor Yellow
if (Test-Path ".\node_modules") {
    $moduleCount = (Get-ChildItem ".\node_modules" -Directory).Count
    Write-Host "   ✅ node_modules existe ($moduleCount pacotes)" -ForegroundColor Green
} else {
    Write-Host "   ❌ node_modules não encontrado" -ForegroundColor Red
    Write-Host "   Execute: npm install" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# 5. Verificar MCP registration
Write-Host "5. Registro MCP:" -ForegroundColor Yellow
$claudeConfigPath = "$env:USERPROFILE\.claude.json"
if (Test-Path $claudeConfigPath) {
    $claudeConfig = Get-Content $claudeConfigPath | ConvertFrom-Json
    if ($claudeConfig.mcpServers.gemini) {
        Write-Host "   ✅ MCP 'gemini' registrado no Claude Code" -ForegroundColor Green
        Write-Host "   Command: $($claudeConfig.mcpServers.gemini.command)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  MCP 'gemini' não encontrado na config" -ForegroundColor Yellow
        Write-Host "   Execute: claude mcp add gemini ""node \""...\build\index.js\""""" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Arquivo de config do Claude não encontrado" -ForegroundColor Yellow
}
Write-Host ""

# Resumo
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ Tudo configurado corretamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor Cyan
    Write-Host "1. Reinicie o Claude Code" -ForegroundColor White
    Write-Host "2. Teste com: 'Ask Gemini about Next.js'" -ForegroundColor White
} else {
    Write-Host "⚠️  Algumas configurações estão faltando" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Siga as instruções acima para corrigir" -ForegroundColor White
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
