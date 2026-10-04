@echo off
chcp 65001 > nul
title 音声入力SOAPノート - サーバー起動
echo ========================================================
echo   音声入力SOAPノート を起動しています...
echo ========================================================
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "server.ps1"
pause
