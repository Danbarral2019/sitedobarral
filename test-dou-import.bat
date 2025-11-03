@echo off
echo ========================================
echo  TESTE MANUAL DE IMPORTACAO DO DOU
echo ========================================
echo.
echo Buscando documentos dos ultimos 7 dias...
echo.

curl -X GET "http://localhost:3000/api/cron/import-dou?days=7" ^
  -H "x-cron-secret: FAaMGJNrzh4EX0YoGCGqMnKtfkmT/RqR59d4G5ZvT+g="

echo.
echo.
echo ========================================
echo  TESTE CONCLUIDO!
echo ========================================
echo.
echo Verifique os resultados acima ou va para:
echo http://localhost:3000/admin/documentos-pendentes
echo.
pause
