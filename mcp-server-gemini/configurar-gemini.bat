@echo off
echo 🔑 Configurando GEMINI_API_KEY...
echo.

if "%1"=="" (
    echo ❌ Erro: API key não fornecida
    echo.
    echo Uso: configurar-gemini.bat SUA_API_KEY_AQUI
    echo.
    echo Exemplo:
    echo configurar-gemini.bat AIzaSyC...
    exit /b 1
)

echo Configurando variável de ambiente GEMINI_API_KEY...
setx GEMINI_API_KEY "%1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ GEMINI_API_KEY configurada com sucesso!
    echo.
    echo ⚠️  IMPORTANTE:
    echo 1. Feche TODAS as janelas do Claude Code
    echo 2. Feche este terminal
    echo 3. Abra um novo terminal para testar
    echo.
    echo Para verificar:
    echo   echo %%GEMINI_API_KEY%%
    echo.
    echo Para testar o MCP:
    echo   claude mcp list
) else (
    echo.
    echo ❌ Erro ao configurar a variável
    echo Tente manualmente:
    echo   setx GEMINI_API_KEY "sua-api-key"
)
