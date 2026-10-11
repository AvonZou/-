@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto setup_required
node -e "process.exit(Number(process.versions.node.split('.')[0])===24?0:1)"
if errorlevel 1 goto setup_required
if not exist "node_modules\next\package.json" goto setup_required
if not exist ".next\BUILD_ID" goto setup_required
call npm run db:init
if errorlevel 1 goto failed
echo 正在启动 NextStep OS：http://127.0.0.1:3000
echo 请保持本窗口打开；停止服务请按 Ctrl+C。
start "" /b node scripts\open-browser.mjs
call npm run start
if errorlevel 1 goto failed
echo 服务已停止。
pause
exit /b 0
:setup_required
echo 请安装 Node.js 24 LTS 并先运行 setup.bat。
pause
exit /b 1
:failed
echo 启动失败。若 3000 端口被占用，请关闭此前的 NextStep OS 窗口再重试。
echo 请保留上方错误信息。
pause
exit /b 1
