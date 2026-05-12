@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Steam Screenshot Gallery
echo ========================================
echo.
echo Installing dependencies if needed...
call npm install --silent 2>nul

echo.
echo Starting server (port 3000) + client (port 5173)...
echo Open http://localhost:5173 in browser
echo Press Ctrl+C to stop
echo.

npm run dev
pause
