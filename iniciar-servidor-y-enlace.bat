@echo off
title Servidor y Enlace Publico #VOY CON EL KZ
color 0B
echo ========================================================
echo   INICIANDO SISTEMA DE CAMPANA #VOY CON EL KZ
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Iniciando Servidor Node.js (Puerto 5000)...
start "Servidor Campana KZ" cmd /k "node server/index.js"

timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Tunel Cloudflare Seguro...
start "Tunel Publico Cloudflare" cmd /k ".\cloudflared.exe tunnel --url http://localhost:5000"

echo.
echo ========================================================
echo  SISTEMA ACTIVO!
echo  - Local: http://localhost:5000
echo  - El enlace publico aparecera en la ventana del Tunel.
echo ========================================================
pause
