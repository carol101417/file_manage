@echo off
REM =============================================================
REM  Enterprise File Sharing System - One-Click Deploy (Windows)
REM =============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   File Sharing System - Deploy Script
echo ========================================
echo.

REM ---------- Resolve project root ----------
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

REM ---------- 1. Check Node.js ----------
echo [INFO]  Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Please install Node.js 18+: https://nodejs.org
    goto :error_exit
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
for /f "tokens=2 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if !NODE_MAJOR! lss 18 (
    echo [ERROR] Node.js 18+ is required, current version:
    node -v
    goto :error_exit
)

for /f "delims=" %%v in ('node -v') do echo [OK]    Node.js %%v detected

REM ---------- 2. Check npm ----------
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found. Please reinstall Node.js.
    goto :error_exit
)
for /f "delims=" %%v in ('npm -v') do echo [OK]    npm %%v detected

REM ---------- 3. Install backend dependencies ----------
echo [INFO]  Installing backend dependencies...
cd /d "%PROJECT_DIR%backend"
call npm install --production >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Backend dependency installation failed.
    goto :error_exit
)
echo [OK]    Backend dependencies installed

REM ---------- 4. Install frontend dependencies & build ----------
echo [INFO]  Installing frontend dependencies...
cd /d "%PROJECT_DIR%frontend"
call npm install >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Frontend dependency installation failed.
    goto :error_exit
)
echo [OK]    Frontend dependencies installed

echo [INFO]  Building frontend...
call npm run build >nul 2>&1
if not exist "%PROJECT_DIR%frontend\dist" (
    echo [ERROR] Frontend build failed - dist directory not found.
    goto :error_exit
)
echo [OK]    Frontend built successfully

REM ---------- 5. Setup .env ----------
cd /d "%PROJECT_DIR%backend"

if not exist .env (
    echo [INFO]  Generating .env configuration...

    REM Generate random JWT secret using Node.js
    for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"') do set "JWT_SECRET=%%s"

    (
        echo PORT=3000
        echo JWT_SECRET=!JWT_SECRET!
        echo UPLOAD_DIR=./uploads
        echo MAX_FILE_SIZE=524288000
        echo DATABASE_PATH=./database.sqlite
        echo NODE_ENV=production
        echo CORS_ORIGIN=*
    ) > .env

    echo [OK]    .env file created with secure JWT_SECRET
) else (
    findstr /C:"your-secret-key-change-this-in-production" .env >nul 2>&1
    if !errorlevel! equ 0 (
        echo [WARN]  .env exists but JWT_SECRET is the default value. Updating...

        for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"') do set "JWT_SECRET=%%s"

        REM Rewrite .env with new secret
        set "PORT_VAL=3000"
        set "UPLOAD_VAL=./uploads"
        set "MAX_SIZE=524288000"
        set "DB_PATH=./database.sqlite"

        for /f "tokens=1,2 delims==" %%a in (.env) do (
            if "%%a"=="PORT" set "PORT_VAL=%%b"
            if "%%a"=="UPLOAD_DIR" set "UPLOAD_VAL=%%b"
            if "%%a"=="MAX_FILE_SIZE" set "MAX_SIZE=%%b"
            if "%%a"=="DATABASE_PATH" set "DB_PATH=%%b"
        )

        (
            echo PORT=!PORT_VAL!
            echo JWT_SECRET=!JWT_SECRET!
            echo UPLOAD_DIR=!UPLOAD_VAL!
            echo MAX_FILE_SIZE=!MAX_SIZE!
            echo DATABASE_PATH=!DB_PATH!
            echo NODE_ENV=production
            echo CORS_ORIGIN=*
        ) > .env

        echo [OK]    JWT_SECRET updated
    ) else (
        echo [OK]    .env file already configured
    )
)

REM ---------- 6. Create required directories ----------
if not exist "%PROJECT_DIR%backend\uploads" mkdir "%PROJECT_DIR%backend\uploads"
echo [OK]    Upload directory ready

REM ---------- 7. Check for PM2 ----------
set "USE_PM2=0"
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    set "USE_PM2=1"
    echo [OK]    PM2 detected
) else (
    echo [INFO]  PM2 not found. Installing globally...
    call npm install -g pm2 >nul 2>&1
    if !errorlevel! equ 0 (
        set "USE_PM2=1"
        echo [OK]    PM2 installed
    ) else (
        echo [WARN]  PM2 install failed. Will use plain Node.js.
        echo         For production, run: npm install -g pm2
    )
)

REM ---------- 8. Start the server ----------
cd /d "%PROJECT_DIR%backend"

if "!USE_PM2!"=="1" (
    pm2 delete file-share >nul 2>&1
    echo [INFO]  Starting server with PM2...
    pm2 start src/app.js --name file-share --max-memory-restart 512M
    pm2 save >nul 2>&1
    echo.
    pm2 status file-share
) else (
    echo [INFO]  Starting server with Node.js...

    REM Kill any existing node process on the port
    for /f "tokens=2 delims==" %%p in ('findstr "^PORT=" .env') do set "APP_PORT=%%p"
    if not defined APP_PORT set "APP_PORT=3000"

    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":!APP_PORT! " ^| findstr "LISTENING"') do (
        echo [WARN]  Port !APP_PORT! is in use. Stopping existing process (PID: %%a^)...
        taskkill /F /PID %%a >nul 2>&1
        timeout /t 2 >nul
    )

    start /b "" node src/app.js > "%PROJECT_DIR%backend\app.log" 2>&1
    timeout /t 3 >nul

    REM Check if server is running
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":!APP_PORT! " ^| findstr "LISTENING"') do (
        echo [OK]    Server started (PID: %%a^)
        echo %%a > "%PROJECT_DIR%backend\.pid"
        goto :server_started
    )
    echo [ERROR] Server failed to start. Check backend\app.log for details.
    goto :error_exit
)

:server_started

REM ---------- 9. Read port from .env ----------
for /f "tokens=2 delims==" %%p in ('findstr "^PORT=" .env') do set "APP_PORT=%%p"
if not defined APP_PORT set "APP_PORT=3000"

REM ---------- 10. Health check ----------
timeout /t 2 >nul
curl -sf "http://localhost:!APP_PORT!/api/health" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK]    Health check passed
) else (
    echo [WARN]  Health check failed - server may still be starting
)

REM ---------- Done ----------
echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo   Access URL:    http://localhost:!APP_PORT!
echo   Admin account: admin / Admin123!
echo.
echo   IMPORTANT: Change the default password after first login!
echo.

if "!USE_PM2!"=="1" (
    echo   Management commands:
    echo     pm2 status              - View status
    echo     pm2 logs file-share     - View logs
    echo     pm2 restart file-share  - Restart
    echo     pm2 stop file-share     - Stop
    echo.
)

pause
exit /b 0

:error_exit
echo.
echo [ERROR] Deployment failed!
pause
exit /b 1
