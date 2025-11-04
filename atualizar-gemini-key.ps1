# Script para atualizar GEMINI_API_KEY no sistema
# Execucao: powershell -ExecutionPolicy Bypass -File atualizar-gemini-key.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Atualizacao GEMINI_API_KEY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ler a chave atual do .env.local
$envLocalPath = "C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\.env.local"

if (Test-Path $envLocalPath) {
    $content = Get-Content $envLocalPath
    $geminiLine = $content | Where-Object { $_ -match '^GEMINI_API_KEY=' }

    if ($geminiLine) {
        $currentKey = $geminiLine -replace '^GEMINI_API_KEY=', ''
        $currentKey = $currentKey.Trim()

        Write-Host "OK Chave encontrada no .env.local" -ForegroundColor Green
        Write-Host "Primeiros caracteres: $($currentKey.Substring(0, [Math]::Min(10, $currentKey.Length)))..." -ForegroundColor Yellow
        Write-Host ""

        # Confirmar se deseja usar esta chave
        $confirm = Read-Host "Deseja configurar esta chave no sistema? (S/N)"

        if ($confirm -eq 'S' -or $confirm -eq 's') {
            try {
                # Configurar variavel de ambiente para o USUARIO
                [Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $currentKey, "User")

                Write-Host ""
                Write-Host "OK Variavel de ambiente configurada com sucesso!" -ForegroundColor Green
                Write-Host ""
                Write-Host "========================================" -ForegroundColor Cyan
                Write-Host "   PROXIMOS PASSOS OBRIGATORIOS" -ForegroundColor Yellow
                Write-Host "========================================" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "1. FECHE o Claude Code completamente" -ForegroundColor Yellow
                Write-Host "2. FECHE este terminal/PowerShell" -ForegroundColor Yellow
                Write-Host "3. Abra um NOVO terminal" -ForegroundColor Yellow
                Write-Host "4. Inicie o Claude Code novamente" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "AVISO: A variavel so estara disponivel apos reiniciar!" -ForegroundColor Red
                Write-Host ""

                # Verificar se a variavel foi configurada
                $envKey = [Environment]::GetEnvironmentVariable("GEMINI_API_KEY", "User")
                if ($envKey -eq $currentKey) {
                    Write-Host "OK Verificacao: Variavel configurada corretamente" -ForegroundColor Green
                } else {
                    Write-Host "AVISO: Nao foi possivel verificar a configuracao" -ForegroundColor Yellow
                }

            } catch {
                Write-Host ""
                Write-Host "ERRO ao configurar variavel:" -ForegroundColor Red
                Write-Host $_.Exception.Message -ForegroundColor Red
                Write-Host ""
                Write-Host "Execute este PowerShell como Administrador" -ForegroundColor Yellow
            }
        } else {
            Write-Host ""
            Write-Host "Operacao cancelada" -ForegroundColor Red
        }

    } else {
        Write-Host "ERRO: GEMINI_API_KEY nao encontrada no .env.local" -ForegroundColor Red
        Write-Host ""
        Write-Host "Digite sua chave API do Gemini:" -ForegroundColor Yellow
        $manualKey = Read-Host

        if ($manualKey) {
            [Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $manualKey, "User")
            Write-Host ""
            Write-Host "OK Chave configurada! Reinicie o Claude Code." -ForegroundColor Green
        }
    }

} else {
    Write-Host "ERRO: Arquivo .env.local nao encontrado em:" -ForegroundColor Red
    Write-Host $envLocalPath -ForegroundColor Red
    Write-Host ""
    Write-Host "Digite sua chave API do Gemini:" -ForegroundColor Yellow
    $manualKey = Read-Host

    if ($manualKey) {
        [Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $manualKey, "User")
        Write-Host ""
        Write-Host "OK Chave configurada! Reinicie o Claude Code." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
