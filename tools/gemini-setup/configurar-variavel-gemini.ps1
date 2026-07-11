# Script Seguro para Configurar GEMINI_API_KEY
# Este script LÊ do .env.local e configura a variável de ambiente
# SEM expor a chave no código

Write-Host "=== Configuração Segura GEMINI_API_KEY ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se .env.local existe
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ Erro: .env.local não encontrado!" -ForegroundColor Red
    Write-Host "Crie o arquivo .env.local primeiro." -ForegroundColor Yellow
    pause
    exit 1
}

# Ler chave do .env.local
Write-Host "📖 Lendo chave do .env.local..." -ForegroundColor Gray
$envContent = Get-Content ".env.local" -Raw
$match = [regex]::Match($envContent, 'GEMINI_API_KEY\s*=\s*["'']?([^"''`r`n]+)["'']?')

if (-not $match.Success) {
    Write-Host "❌ Erro: GEMINI_API_KEY não encontrada no .env.local!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Adicione esta linha ao .env.local:" -ForegroundColor Yellow
    Write-Host "GEMINI_API_KEY=sua_chave_aqui" -ForegroundColor White
    pause
    exit 1
}

$apiKey = $match.Groups[1].Value.Trim()

# Validar formato da chave
if ($apiKey.Length -lt 30) {
    Write-Host "❌ Erro: Chave parece inválida (muito curta)" -ForegroundColor Red
    Write-Host "Comprimento: $($apiKey.Length) caracteres" -ForegroundColor Gray
    pause
    exit 1
}

if (-not $apiKey.StartsWith("AIza")) {
    Write-Host "⚠️  Aviso: Chave não começa com 'AIza'" -ForegroundColor Yellow
    Write-Host "Chaves Google normalmente começam com 'AIza'" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continuar mesmo assim? (s/n)"
    if ($continue -ne "s") {
        exit 0
    }
}

# Mostrar preview seguro
$preview = $apiKey.Substring(0, [Math]::Min(8, $apiKey.Length)) + "..." + $apiKey.Substring([Math]::Max(0, $apiKey.Length - 4))
Write-Host "✅ Chave encontrada: $preview" -ForegroundColor Green
Write-Host "   Comprimento: $($apiKey.Length) caracteres" -ForegroundColor Gray
Write-Host ""

# Configurar variável de ambiente do usuário
Write-Host "🔧 Configurando variável de ambiente..." -ForegroundColor Cyan
try {
    [System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $apiKey, 'User')
    Write-Host "✅ Variável de ambiente configurada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao configurar variável:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    pause
    exit 1
}

# Verificar configuração
Write-Host ""
Write-Host "🧪 Verificando configuração..." -ForegroundColor Cyan
$testKey = [System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')

if ($testKey -eq $apiKey) {
    Write-Host "✅ Verificação OK! Variável configurada corretamente." -ForegroundColor Green
} else {
    Write-Host "❌ Erro: Verificação falhou!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "1. Feche TODOS os terminais abertos" -ForegroundColor White
Write-Host "2. Feche o VSCode (se estiver aberto)" -ForegroundColor White
Write-Host "3. Reabra o VSCode" -ForegroundColor White
Write-Host "4. Teste com: echo `$env:GEMINI_API_KEY" -ForegroundColor White
Write-Host ""
Write-Host "📚 Veja o guia completo: CONFIGURAR_GEMINI_SEGURO.md" -ForegroundColor Gray
Write-Host ""
pause
