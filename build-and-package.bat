@echo off
chcp 65001 >nul
echo ========================================
echo Building and Packaging Docker Images
echo ========================================

echo.
echo [1/5] Building backend image...
cd backend
docker build -t file_manage-backend:latest .
if %errorlevel% neq 0 (
    echo Backend image build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [2/5] Building frontend image...
cd frontend
docker build -t file_manage-frontend:latest .
if %errorlevel% neq 0 (
    echo Frontend image build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [3/5] Exporting images to tar file...
docker save -o file_manage-images.tar file_manage-backend:latest file_manage-frontend:latest
if %errorlevel% neq 0 (
    echo Image export failed!
    pause
    exit /b 1
)

echo.
echo [4/5] Verifying tar file...
dir file_manage-images.tar

echo.
echo [5/5] Done!
echo ========================================
echo Images successfully packaged to: file_manage-images.tar
echo ========================================
echo.
echo Next steps:
echo 1. Copy file_manage-images.tar to target server
echo 2. On target server run: docker load -i file_manage-images.tar
echo 3. Start services: docker-compose -f docker-compose.offline.yml up -d
echo.
pause
