# Script simples para configurar GEMINI_API_KEY
# Le do .env.local e configura a variavel de ambiente

Write-Host "Configurando GEMINI_API_KEY..." -ForegroundColor Cyan

# Ler .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "ERRO: .env.local nao encontrado!" -ForegroundColor Red
    exit 1
}

$lines = Get-Content ".env.local"
$apiKey = ""

foreach ($line in $lines) {
    if ($line -match "^GEMINI_API_KEY=(.+)$") {
        $apiKey = $Matches[1].Trim()
        break
    }
}

if ([string]::IsNullOrEmpty($apiKey)) {
    Write-Host "ERRO: GEMINI_API_KEY nao encontrada no .env.local!" -ForegroundColor Red
    Write-Host "Adicione: GEMINI_API_KEY=sua_chave" -ForegroundColor Yellow
    exit 1
}

# Remover aspas se existirem
$apiKey = $apiKey.Trim('"').Trim("'")

# Validar
if ($apiKey.Length -lt 30) {
    Write-Host "ERRO: Chave muito curta!" -ForegroundColor Red
    exit 1
}

# Mostrar preview
$preview = $apiKey.Substring(0, 8) + "..."
Write-Host "Chave encontrada: $preview" -ForegroundColor Green

# Configurar variavel
[System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $apiKey, 'User')

Write-Host "Sucesso! Variavel configurada." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "1. Feche todos os terminais"
Write-Host "2. Feche o VSCode"
Write-Host "3. Reabra o VSCode"
Write-Host ""
