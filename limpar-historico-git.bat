@echo off
REM Script para limpar chave API do histórico Git
REM ATENÇÃO: Este script reescreve o histórico do Git!
REM Use apenas se você tem certeza do que está fazendo

echo ========================================
echo LIMPEZA DE HISTÓRICO GIT - CHAVE API
echo ========================================
echo.
echo Este script irá:
echo 1. Remover o arquivo configurar-gemini-definitivo.ps1 do histórico completo
echo 2. Reescrever todos os commits afetados
echo 3. Forçar push para o repositório remoto
echo.
echo AVISO: Isso irá modificar o histórico do Git!
echo.
pause

echo.
echo [1/4] Verificando arquivo no histórico...
git log --all --oneline -- configurar-gemini-definitivo.ps1

echo.
echo [2/4] Removendo arquivo do histórico usando git filter-branch...
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch configurar-gemini-definitivo.ps1" --prune-empty --tag-name-filter cat -- --all

if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Falha ao limpar histórico!
    pause
    exit /b 1
)

echo.
echo [3/4] Limpando referências antigas...
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d

echo.
echo [4/4] Forçando garbage collection...
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo.
echo ========================================
echo LIMPEZA CONCLUÍDA!
echo ========================================
echo.
echo PRÓXIMO PASSO: Execute o comando abaixo para aplicar no GitHub:
echo.
echo     git push origin main --force
echo.
echo IMPORTANTE:
echo - Certifique-se de que já revogou a chave antiga!
echo - Este push irá sobrescrever o histórico remoto
echo - Outros colaboradores precisarão fazer 're-clone' do repositório
echo.
pause
