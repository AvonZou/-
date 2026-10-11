@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
node -e "process.exit(Number(process.versions.node.split('.')[0])===24?0:1)"
if errorlevel 1 goto missing_node
echo [1/3] 安装锁定版本的依赖...
call npm ci --no-audit --no-fund
if errorlevel 1 goto failed
echo [2/3] 初始化数据库（保留已有数据）...
call npm run db:init
if errorlevel 1 goto failed
echo [3/3] 构建本地应用...
call npm run build
if errorlevel 1 goto failed
echo 安装完成。以后双击 start.bat 即可启动。
pause
exit /b 0
:missing_node
echo 请先安装 Node.js 24 LTS（Windows x64 或 ARM64 对应版本），然后重新运行。
echo 下载地址：https://nodejs.org/
pause
exit /b 1
:failed
echo 安装失败。请保留上面的错误信息，修复后重新运行 setup.bat。
pause
exit /b 1
