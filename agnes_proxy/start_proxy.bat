@echo off
chcp 65001 >nul
title Agnes AI Proxy

echo ============================================
echo   Agnes AI ^<^> DeepSeek 翻译代理
echo ============================================
echo.

cd /d "%~dp0"
python proxy.py

pause
