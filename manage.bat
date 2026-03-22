@echo off
REM 系统管理脚本 - manage.bat (Windows版本)
chcp 65001 >nul
setlocal enabledelayedexpansion

:menu
cls
echo ================================
echo   文件共享系统管理工具
echo ================================
echo.
echo 1. 启动系统
echo 2. 停止系统
echo 3. 重启系统
echo 4. 查看状态
echo 5. 查看日志
echo 6. 备份数据
echo 7. 恢复数据
echo 8. 清理系统
echo 9. 更新系统
echo 10. 健康检查
echo 0. 退出
echo.
set /p choice="请选择操作 [0-10]: "

if "%choice%"=="1" goto start_system
if "%choice%"=="2" goto stop_system
if "%choice%"=="3" goto restart_system
if "%choice%"=="4" goto check_status
if "%choice%"=="5" goto view_logs
if "%choice%"=="6" goto backup_data
if "%choice%"=="7" goto restore_data
if "%choice%"=="8" goto clean_system
if "%choice%"=="9" goto update_system
if "%choice%"=="10" goto health_check
if "%choice%"=="0" goto exit_script
goto invalid_choice

:start_system
echo.
echo [启动] 正在启动系统...
docker-compose up -d
if %errorlevel% equ 0 (
    echo [成功] 系统启动成功！
    echo 前端地址: http://localhost:8080
    echo 后端地址: http://localhost:3000
    echo 默认账户: admin / admin123
) else (
    echo [错误] 启动失败，请检查 Docker 是否运行
)
goto pause_continue

:stop_system
echo.
echo [停止] 正在停止系统...
docker-compose down
if %errorlevel% equ 0 (
    echo [成功] 系统已停止
) else (
    echo [错误] 停止失败
)
goto pause_continue

:restart_system
echo.
echo [重启] 正在重启系统...
docker-compose restart
if %errorlevel% equ 0 (
    echo [成功] 系统重启成功！
) else (
    echo [错误] 重启失败
)
goto pause_continue

:check_status
echo.
echo [状态] 系统状态：
echo.
docker-compose ps
echo.
echo [资源] 资源使用：
docker stats --no-stream file-share-backend file-share-frontend
goto pause_continue

:view_logs
echo.
echo 1. 查看后端日志
echo 2. 查看前端日志
echo 3. 查看所有日志
set /p log_choice="请选择 [1-3]: "

if "%log_choice%"=="1" (
    docker logs file-share-backend --tail 50 -f
) else if "%log_choice%"=="2" (
    docker logs file-share-frontend --tail 50 -f
) else if "%log_choice%"=="3" (
    docker-compose logs -f
) else (
    echo [错误] 无效选择
)
goto pause_continue

:backup_data
echo.
echo [备份] 正在备份数据...

REM 创建备份目录
if not exist backups mkdir backups

REM 生成备份文件名
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set mytime=%mytime: =0%
set backup_file=backup-%mydate%-%mytime%.tar.gz

REM 备份数据
docker run --rm -v file_manage_database-data:/data -v "%cd%\backend\uploads":/uploads -v "%cd%\backups":/backup alpine tar czf /backup/%backup_file% /data /uploads 2>nul

if %errorlevel% equ 0 (
    echo [成功] 备份完成！
    echo 备份文件: backups\%backup_file%
    for %%A in ("backups\%backup_file%") do echo 备份大小: %%~zA 字节
) else (
    echo [错误] 备份失败
)
goto pause_continue

:restore_data
echo.
echo [恢复] 可用的备份文件：
echo.
dir /b backups\*.tar.gz 2>nul
if %errorlevel% neq 0 (
    echo [错误] 没有找到备份文件
    goto pause_continue
)

echo.
set /p backup_file="请输入备份文件名: "

if not exist "backups\%backup_file%" (
    echo [错误] 备份文件不存在
    goto pause_continue
)

echo.
echo [警告] 恢复数据会覆盖当前数据！
set /p confirm="确认恢复？(yes/no): "

if not "%confirm%"=="yes" (
    echo [取消] 已取消恢复
    goto pause_continue
)

echo [停止] 正在停止系统...
docker-compose down

echo [恢复] 正在恢复数据...
docker run --rm -v file_manage_database-data:/data -v "%cd%\backend\uploads":/uploads -v "%cd%\backups":/backup alpine tar xzf /backup/%backup_file% -C /

echo [启动] 正在启动系统...
docker-compose up -d

echo [成功] 数据恢复完成！
goto pause_continue

:clean_system
echo.
echo [清理] 清理选项：
echo 1. 清理 Docker 缓存
echo 2. 清理旧日志
echo 3. 清理旧备份（保留最近5个）
echo 4. 完全清理（删除所有数据）
set /p clean_choice="请选择 [1-4]: "

if "%clean_choice%"=="1" (
    echo [清理] 正在清理 Docker 缓存...
    docker system prune -f
    echo [成功] 清理完成
) else if "%clean_choice%"=="2" (
    echo [清理] 正在清理日志...
    docker-compose logs --tail=0 >nul 2>&1
    echo [成功] 清理完成
) else if "%clean_choice%"=="3" (
    echo [清理] 正在清理旧备份...
    REM 保留最新的5个备份文件
    for /f "skip=5 delims=" %%f in ('dir /b /o-d backups\*.tar.gz 2^>nul') do del "backups\%%f"
    echo [成功] 清理完成
) else if "%clean_choice%"=="4" (
    echo [警告] 这将删除所有数据！
    set /p confirm="确认删除？(yes/no): "
    if "!confirm!"=="yes" (
        docker-compose down -v
        del /q backend\uploads\* 2>nul
        echo [成功] 清理完成
    ) else (
        echo [取消] 已取消
    )
) else (
    echo [错误] 无效选择
)
goto pause_continue

:update_system
echo.
echo [更新] 正在更新系统...

echo [备份] 1. 备份当前数据...
call :backup_data_silent

echo [停止] 2. 停止系统...
docker-compose down

echo [构建] 3. 重新构建镜像...
docker-compose build --no-cache

echo [启动] 4. 启动系统...
docker-compose up -d

echo [成功] 更新完成！
goto pause_continue

:health_check
echo.
echo [检查] 正在进行健康检查...
echo.

REM 检查容器状态
echo [1/5] 检查容器状态...
docker inspect -f "{{.State.Status}}" file-share-backend >nul 2>&1
if %errorlevel% equ 0 (
    echo   后端: [√] 运行中
) else (
    echo   后端: [×] 未运行
)

docker inspect -f "{{.State.Status}}" file-share-frontend >nul 2>&1
if %errorlevel% equ 0 (
    echo   前端: [√] 运行中
) else (
    echo   前端: [×] 未运行
)

REM 检查端口
echo.
echo [2/5] 检查端口...
curl -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo   后端 API (3000): [√] 可访问
) else (
    echo   后端 API (3000): [×] 不可访问
)

curl -s -o nul -w "%%{http_code}" http://localhost:8080 | findstr "200" >nul 2>&1
if %errorlevel% equ 0 (
    echo   前端页面 (8080): [√] 可访问
) else (
    echo   前端页面 (8080): [×] 不可访问
)

REM 检查磁盘空间
echo.
echo [3/5] 检查磁盘空间...
for /f "tokens=3" %%a in ('dir /-c ^| find "bytes free"') do set free_space=%%a
echo   可用空间: %free_space% 字节

REM 检查上传目录
echo.
echo [4/5] 检查上传目录...
if exist backend\uploads (
    for /f "tokens=3" %%a in ('dir /s backend\uploads ^| find "File(s)"') do set upload_size=%%a
    echo   上传文件大小: !upload_size! 字节
) else (
    echo   上传目录: 不存在
)

REM 检查备份
echo.
echo [5/5] 检查备份...
for /f %%a in ('dir /b backups\*.tar.gz 2^>nul ^| find /c /v ""') do set backup_count=%%a
if defined backup_count (
    if !backup_count! gtr 0 (
        echo   备份数量: [√] !backup_count! 个
        for /f "delims=" %%f in ('dir /b /o-d backups\*.tar.gz 2^>nul') do (
            echo   最新备份: %%f
            goto :backup_found
        )
        :backup_found
    ) else (
        echo   备份数量: [!] 0 个 (建议创建备份)
    )
) else (
    echo   备份数量: [!] 0 个 (建议创建备份)
)

echo.
echo [成功] 健康检查完成！
goto pause_continue

:backup_data_silent
REM 静默备份（用于更新时）
if not exist backups mkdir backups
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set mytime=%mytime: =0%
set backup_file=backup-%mydate%-%mytime%.tar.gz
docker run --rm -v file_manage_database-data:/data -v "%cd%\backend\uploads":/uploads -v "%cd%\backups":/backup alpine tar czf /backup/%backup_file% /data /uploads 2>nul
goto :eof

:invalid_choice
echo.
echo [错误] 无效选择，请重试
goto pause_continue

:pause_continue
echo.
pause
goto menu

:exit_script
echo.
echo 再见！
exit /b 0
