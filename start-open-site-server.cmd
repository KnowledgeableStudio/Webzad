@echo off
cd /d "%~dp0"
node "%~dp0open-site-server.cjs" > "%~dp0open-site-server.out.log" 2> "%~dp0open-site-server.err.log"