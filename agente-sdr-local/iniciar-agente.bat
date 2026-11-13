@echo off
title Agente SDR Local - Funcionario Autonomo
color 0b
echo ========================================================
echo    INICIANDO AGENTE SDR AUTONOMO 100%% LOCAL (PC)
echo ========================================================
echo.
echo [1/2] Verificando ambiente...
cd /d "%~dp0"

echo [2/2] Abrindo servidor e painel de controle...
start http://localhost:3001
node server.js

pause
