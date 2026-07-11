# 🔧 Configurar Gemini API Key CORRETAMENTE
# Este script configura a variável de ambiente do sistema

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Configuração Gemini API Key" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Passo 1: Solicitar a chave API
Write-Host "IMPORTANTE: Acesse https://aistudio.google.com/apikey para obter sua chave" -ForegroundColor Yellow
Write-Host ""
$apiKey = Read-Host "Cole sua chave API do Gemini aqui"

if (-not $apiKey) {
    Write-Host "❌ Erro: Nenhuma chave foi fornecida!" -ForegroundColor Red
    exit 1
}

if ($apiKey.Length -lt 30) {
    Write-Host "❌ Erro: Chave muito curta. Verifique se colou a chave completa." -ForegroundColor Red
    exit 1
}

# Passo 2: Configurar variável de ambiente DO USUÁRIO
Write-Host ""
Write-Host "Configurando variável de ambiente..." -ForegroundColor Green

try {
    [System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $apiKey, 'User')
    Write-Host "✅ Variável de ambiente configurada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao configurar variável: $_" -ForegroundColor Red
    exit 1
}

# Passo 3: Adicionar ao .env.local (para uso futuro)
Write-Host ""
Write-Host "Adicionando ao .env.local..." -ForegroundColor Green

$envPath = ".env.local"
$envLine = "GEMINI_API_KEY=$apiKey"

# Verificar se .env.local existe
if (Test-Path $envPath) {
    # Ler o arquivo e verificar se GEMINI_API_KEY já existe
    $envContent = Get-Content $envPath -Raw

    if ($envContent -match "GEMINI_API_KEY=") {
        # Substituir linha existente
        $envContent = $envContent -replace "GEMINI_API_KEY=.*", $envLine
        Set-Content -Path $envPath -Value $envContent -NoNewline
        Write-Host "✅ Chave atualizada no .env.local" -ForegroundColor Green
    } else {
        # Adicionar nova linha
        Add-Content -Path $envPath -Value "`n$envLine"
        Write-Host "✅ Chave adicionada ao .env.local" -ForegroundColor Green
    }
} else {
    # Criar novo arquivo
    Set-Content -Path $envPath -Value $envLine
    Write-Host "✅ Arquivo .env.local criado com a chave" -ForegroundColor Green
}

# Passo 4: Verificar configuração
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "VERIFICAÇÃO" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Verificar variável de ambiente (da sessão atual - ainda não refletida)
Write-Host "Variável de ambiente foi configurada em: [User]" -ForegroundColor Green
Write-Host "Primeiros caracteres: $($apiKey.Substring(0, [Math]::Min(10, $apiKey.Length)))..." -ForegroundColor Gray

# Verificar .env.local
if (Test-Path $envPath) {
    $hasKey = Select-String -Path $envPath -Pattern "GEMINI_API_KEY=" -Quiet
    if ($hasKey) {
        Write-Host "✅ .env.local contém GEMINI_API_KEY" -ForegroundColor Green
    }
}

# Passo 5: Instruções finais
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "PRÓXIMOS PASSOS IMPORTANTES" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. FECHE este terminal" -ForegroundColor Yellow
Write-Host "2. FECHE o VSCode (se estiver aberto)" -ForegroundColor Yellow
Write-Host "3. REABRA o VSCode" -ForegroundColor Yellow
Write-Host "4. Abra um novo terminal" -ForegroundColor Yellow
Write-Host "5. Execute: " -NoNewline; Write-Host "echo `$env:GEMINI_API_KEY" -ForegroundColor Cyan
Write-Host "6. Deve mostrar sua chave completa" -ForegroundColor Gray
Write-Host ""
Write-Host "Após reiniciar, teste o Gemini com:" -ForegroundColor Yellow
Write-Host "claude mcp list" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Configuração concluída!" -ForegroundColor Green
Write-Host ""
