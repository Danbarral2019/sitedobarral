Write-Host "==================================="
Write-Host "Configuracao Gemini API Key"
Write-Host "==================================="
Write-Host ""

Write-Host "Acesse: https://aistudio.google.com/apikey" -ForegroundColor Yellow
Write-Host ""
$apiKey = Read-Host "Cole sua chave API do Gemini aqui"

if (-not $apiKey) {
    Write-Host "ERRO: Nenhuma chave foi fornecida!" -ForegroundColor Red
    exit 1
}

if ($apiKey.Length -lt 30) {
    Write-Host "ERRO: Chave muito curta. Verifique se colou a chave completa." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configurando variavel de ambiente..." -ForegroundColor Green

try {
    [System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $apiKey, 'User')
    Write-Host "OK: Variavel configurada!" -ForegroundColor Green
} catch {
    Write-Host "ERRO: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Adicionando ao .env.local..." -ForegroundColor Green

$envPath = ".env.local"
$envLine = "GEMINI_API_KEY=$apiKey"

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "GEMINI_API_KEY=") {
        $envContent = $envContent -replace "GEMINI_API_KEY=.*", $envLine
        Set-Content -Path $envPath -Value $envContent -NoNewline
        Write-Host "OK: Chave atualizada no .env.local" -ForegroundColor Green
    } else {
        Add-Content -Path $envPath -Value "`n$envLine"
        Write-Host "OK: Chave adicionada ao .env.local" -ForegroundColor Green
    }
} else {
    Set-Content -Path $envPath -Value $envLine
    Write-Host "OK: Arquivo .env.local criado" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================="
Write-Host "CONFIGURACAO CONCLUIDA!"
Write-Host "==================================="
Write-Host ""
Write-Host "PROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "1. FECHE este terminal"
Write-Host "2. FECHE o VSCode"
Write-Host "3. REABRA o VSCode"
Write-Host "4. Abra novo terminal"
Write-Host "5. Execute: echo `$env:GEMINI_API_KEY"
Write-Host ""
Write-Host "Primeiros caracteres da chave: $($apiKey.Substring(0, 10))..." -ForegroundColor Gray
Write-Host ""
