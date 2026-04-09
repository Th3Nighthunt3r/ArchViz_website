@echo off
title ArchViz Local Server
cd /d "%~dp0"

echo.
echo  ArchViz - Starting Local Server
echo  ================================
echo.

:: Try Node.js / npx first
where npx >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo  Server: http://localhost:3000
    echo  Press Ctrl+C to stop.
    echo.
    start "" "http://localhost:3000"
    npx serve -p 3000 .
    goto :done
)

:: Try Python 3
where python >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo  Server: http://localhost:3000
    echo  Press Ctrl+C to stop.
    echo.
    start "" "http://localhost:3000"
    python -m http.server 3000
    goto :done
)

:: Try Python 3 (alternate command)
where python3 >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo  Server: http://localhost:3000
    echo  Press Ctrl+C to stop.
    echo.
    start "" "http://localhost:3000"
    python3 -m http.server 3000
    goto :done
)

:: Nothing found
echo  ERROR: Node.js or Python is required to run the server.
echo.
echo  Option 1 - Install Node.js (recommended):
echo    https://nodejs.org  (download LTS version)
echo    Then double-click this file again.
echo.
echo  Option 2 - Use VS Code Live Server extension:
echo    Install "Live Server" by Ritwick Dey in VS Code,
echo    right-click index.html, choose "Open with Live Server".
echo.
pause

:done
