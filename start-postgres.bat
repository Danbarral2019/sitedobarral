@echo off
echo ========================================
echo   PostgreSQL Setup - Site Prof Barral
echo ========================================
echo.

REM Verificar se Docker esta instalado
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Docker nao encontrado!
    echo.
    echo Por favor, instale Docker Desktop:
    echo https://www.docker.com/products/docker-desktop
    echo.
    echo Ou use PostgreSQL nativo ou Neon.tech
    echo Veja: START_POSTGRES.md
    pause
    exit /b 1
)

echo [OK] Docker encontrado!
echo.

REM Verificar se Docker esta rodando
docker ps >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Docker nao esta rodando!
    echo.
    echo Por favor, inicie o Docker Desktop primeiro.
    pause
    exit /b 1
)

echo [OK] Docker esta rodando!
echo.

REM Iniciar PostgreSQL
echo Iniciando PostgreSQL...
docker compose up -d

if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao iniciar PostgreSQL
    pause
    exit /b 1
)

echo.
echo [OK] PostgreSQL iniciado com sucesso!
echo.

REM Aguardar PostgreSQL estar pronto
echo Aguardando PostgreSQL ficar pronto...
timeout /t 5 /nobreak >nul

REM Aplicar migrations
echo Aplicando migrations do Prisma...
call npx prisma db push --accept-data-loss

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Erro ao aplicar migrations
    echo Voce pode tentar manualmente: npx prisma db push
    echo.
) else (
    echo.
    echo [OK] Migrations aplicadas com sucesso!
    echo.
)

echo ========================================
echo   PostgreSQL esta pronto!
echo ========================================
echo.
echo Connection String:
echo postgresql://postgres:postgres@localhost:5432/profbarral
echo.
echo Comandos uteis:
echo   - Ver logs: docker logs profbarral-postgres
echo   - Parar: docker compose down
echo   - Prisma Studio: npx prisma studio
echo   - Dev server: npm run dev
echo.
pause
