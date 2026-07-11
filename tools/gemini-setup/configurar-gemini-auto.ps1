# Script AUTOMATICO para configurar GEMINI_API_KEY
# Executa sem confirmacoes

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Configuracao AUTOMATICA Gemini" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ler chave do .env.local
$envLocalPath = "C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\.env.local"

if (Test-Path $envLocalPath) {
    $content = Get-Content $envLocalPath -Raw

    if ($content -match 'GEMINI_API_KEY\s*=\s*"?([^"\r\n]+)"?') {
        $apiKey = $matches[1].Trim()

        Write-Host "✓ Chave encontrada no .env.local" -ForegroundColor Green
        Write-Host "  Primeiros 15 chars: $($apiKey.Substring(0, [Math]::Min(15, $apiKey.Length)))..." -ForegroundColor Yellow
        Write-Host ""

        try {
            # Configurar como variavel de ambiente de USUARIO
            [Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $apiKey, "User")

            Write-Host "✓ Variavel de ambiente configurada!" -ForegroundColor Green
            Write-Host ""

            # Verificar
            $testKey = [Environment]::GetEnvironmentVariable("GEMINI_API_KEY", "User")
            if ($testKey -eq $apiKey) {
                Write-Host "✓ Verificacao OK: Chave configurada corretamente" -ForegroundColor Green
            }

            Write-Host ""
            Write-Host "========================================" -ForegroundColor Yellow
            Write-Host "   ACAO NECESSARIA AGORA:" -ForegroundColor Yellow
            Write-Host "========================================" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "1. FECHE completamente o Claude Code" -ForegroundColor Cyan
            Write-Host "2. FECHE este terminal" -ForegroundColor Cyan
            Write-Host "3. Abra um NOVO terminal" -ForegroundColor Cyan
            Write-Host "4. Inicie o Claude Code novamente" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "A variavel so sera reconhecida apos reiniciar!" -ForegroundColor Red
            Write-Host ""

        } catch {
            Write-Host ""
            Write-Host "✗ ERRO ao configurar:" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            Write-Host ""
            Write-Host "Tente executar como Administrador" -ForegroundColor Yellow
            exit 1
        }

    } else {
        Write-Host "✗ GEMINI_API_KEY nao encontrada no .env.local" -ForegroundColor Red
        exit 1
    }

} else {
    Write-Host "✗ Arquivo .env.local nao encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "Concluido! Pressione qualquer tecla..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
