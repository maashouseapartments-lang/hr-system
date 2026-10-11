@echo off
chcp 65001 >nul
title HR System
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Please install Node.js 22 LTS from: https://nodejs.org
  echo  Then run this file again.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo.
  echo  Your Node.js version is too old. Please install Node.js 22 LTS or newer from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing packages, first run only - please wait...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)

if not exist .next\BUILD_ID (
  echo Preparing the system, first run only - please wait...
  call npm run build
  if errorlevel 1 ( pause & exit /b 1 )
)

set HR_INSECURE_COOKIE=1
echo.
echo  The system is running at: http://localhost:3000
echo  Keep this window open while using the system.
echo.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
call npm start
pause
