Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICACAO COMPLETA - GEMINI API KEY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar variavel de ambiente do SISTEMA (User level)
Write-Host "1. Variavel de ambiente do sistema (User):" -ForegroundColor Yellow
$sysKey = [System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')
if ($sysKey) {
    Write-Host "   OK - Configurada (tamanho: $($sysKey.Length) chars)" -ForegroundColor Green
    Write-Host "   Primeiros chars: $($sysKey.Substring(0, [Math]::Min(10, $sysKey.Length)))..." -ForegroundColor Gray
} else {
    Write-Host "   ERRO - NAO configurada!" -ForegroundColor Red
}

# 2. Verificar variavel na sessao atual
Write-Host ""
Write-Host "2. Variavel na sessao atual (este processo):" -ForegroundColor Yellow
if ($env:GEMINI_API_KEY) {
    Write-Host "   OK - Visivel (tamanho: $($env:GEMINI_API_KEY.Length) chars)" -ForegroundColor Green
} else {
    Write-Host "   AVISO - Nao visivel neste processo (normal - precisa reiniciar)" -ForegroundColor Yellow
}

# 3. Verificar .env.local
Write-Host ""
Write-Host "3. Arquivo .env.local:" -ForegroundColor Yellow
if (Test-Path ".env.local") {
    $hasKey = Select-String -Path ".env.local" -Pattern "GEMINI_API_KEY=" -Quiet
    if ($hasKey) {
        $keyLine = Select-String -Path ".env.local" -Pattern "GEMINI_API_KEY=" | Select-Object -First 1
        Write-Host "   OK - Contem GEMINI_API_KEY" -ForegroundColor Green
    } else {
        Write-Host "   AVISO - Nao contem GEMINI_API_KEY" -ForegroundColor Yellow
    }
} else {
    Write-Host "   AVISO - Arquivo nao existe" -ForegroundColor Yellow
}

# 4. Verificar MCP server Gemini
Write-Host ""
Write-Host "4. MCP Server Gemini:" -ForegroundColor Yellow
if (Test-Path "mcp-server-gemini\build\index.js") {
    Write-Host "   OK - Build existe" -ForegroundColor Green
} else {
    Write-Host "   ERRO - Build nao encontrado" -ForegroundColor Red
}

# 5. Testar se a chave funciona (se estiver visivel)
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSTICO FINAL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($sysKey -and $sysKey.Length -gt 30) {
    Write-Host "STATUS: CONFIGURACAO OK!" -ForegroundColor Green
    Write-Host ""
    Write-Host "A variavel esta configurada no sistema." -ForegroundColor Green
    Write-Host ""
    if (-not $env:GEMINI_API_KEY) {
        Write-Host "ACAO NECESSARIA:" -ForegroundColor Yellow
        Write-Host "1. FECHE o VSCode completamente" -ForegroundColor White
        Write-Host "2. FECHE todos os terminais" -ForegroundColor White
        Write-Host "3. REABRA o VSCode" -ForegroundColor White
        Write-Host "4. A variavel estara visivel" -ForegroundColor White
    } else {
        Write-Host "Variavel visivel! Gemini deve funcionar." -ForegroundColor Green
    }
} else {
    Write-Host "STATUS: CONFIGURACAO INCOMPLETA" -ForegroundColor Red
    Write-Host ""
    Write-Host "Execute novamente: .\setup-gemini.ps1" -ForegroundColor Yellow
}

Write-Host ""
