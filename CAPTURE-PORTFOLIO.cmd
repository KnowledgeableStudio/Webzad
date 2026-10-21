@echo off
setlocal
cd /d "%~dp0"
echo Capturing actual portfolio websites using a temporary, signed-out browser.
echo This does not deploy the website, sign into accounts, or make purchases.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.16 or newer is required.
  pause
  exit /b 1
)
node tools\capture-portfolio.cjs
set RESULT=%ERRORLEVEL%
echo.
if "%RESULT%"=="0" (
  echo Captures saved. Review assets\portfolio before publishing.
) else (
  echo Some captures remain unavailable. No substitute images were used.
)
pause
exit /b %RESULT%
