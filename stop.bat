@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0backend"

where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    pm2 list 2>nul | findstr "file-share" >nul 2>&1
    if !errorlevel! equ 0 (
        pm2 stop file-share
        echo [OK] Service stopped (PM2)
        goto :done
    )
)

if exist .pid (
    set /p PID=<.pid
    taskkill /F /PID !PID! >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Service stopped (PID: !PID!)
    ) else (
        echo [WARN] Process was not running
    )
    del .pid
) else (
    echo [WARN] No running service found
)

:done
pause
