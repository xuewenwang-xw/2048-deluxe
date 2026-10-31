@echo off
title 2048 Deluxe
if exist "%~dp0launcher.py" (
    cd /d "%~dp0"
) else if exist "%~dp0..\launcher.py" (
    cd /d "%~dp0.."
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    python launcher.py
    goto end
)

if exist "E:\Anaconda\Python\python.exe" (
    "E:\Anaconda\Python\python.exe" launcher.py
    goto end
)

echo [ERROR] Python was not found on this system.
pause

:end
