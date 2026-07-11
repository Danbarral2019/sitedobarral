# Configurar GEMINI_API_KEY - Versao Simples

$ErrorActionPreference = "Stop"

Write-Host "Configurando Gemini..." -ForegroundColor Cyan

# Ler do .env.local
$envPath = Join-Path $PSScriptRoot ".env.local"
$content = Get-Content $envPath -Raw

# Extrair chave
if ($content -match 'GEMINI_API_KEY="([^"]+)"') {
    $key = $matches[1]

    Write-Host "Chave encontrada: $($key.Substring(0,15))..." -ForegroundColor Green

    # Configurar variavel de ambiente
    [Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $key, "User")

    Write-Host "SUCESSO! Variavel configurada." -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "1. Feche o Claude Code completamente" -ForegroundColor Yellow
    Write-Host "2. Feche este terminal" -ForegroundColor Yellow
    Write-Host "3. Abra um novo terminal e inicie o Claude Code" -ForegroundColor Yellow

} else {
    Write-Host "ERRO: Chave nao encontrada no .env.local" -ForegroundColor Red
    exit 1
}

Write-Host ""
Read-Host "Pressione Enter para sair"
