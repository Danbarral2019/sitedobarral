# Script para configurar GEMINI_API_KEY de forma persistente

Write-Host "=== Configuração da API Key do Gemini ===" -ForegroundColor Cyan
Write-Host ""

# Ler API key do usuário
$apiKey = Read-Host "Cole sua API Key do Gemini aqui"

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "❌ API Key não pode ser vazia" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configurando variável de ambiente..." -ForegroundColor Yellow

try {
    # Configurar no sistema (permanente)
    [System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $apiKey, [System.EnvironmentVariableTarget]::User)

    # Configurar também na sessão atual
    $env:GEMINI_API_KEY = $apiKey

    Write-Host "✅ API Key configurada com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Testando conexão com Gemini..." -ForegroundColor Yellow

    # Testar se Node consegue ler a variável
    $testResult = node -e "console.log(process.env.GEMINI_API_KEY ? 'OK' : 'FAIL')" 2>&1

    if ($testResult -match "OK") {
        Write-Host "✅ Node.js consegue ler a API Key" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Pode ser necessário reiniciar o terminal" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor Cyan
    Write-Host "1. Reinicie o Claude Code para que ele veja a nova variável"
    Write-Host "2. Teste com: claude mcp list"
    Write-Host ""

} catch {
    Write-Host "❌ Erro ao configurar: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
