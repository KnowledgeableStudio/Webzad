@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.16 or later is required. Install it from nodejs.org, then run this file again.
  pause
  exit /b 1
)
node open-site-server.cjs --open
if errorlevel 1 pause
endlocal
