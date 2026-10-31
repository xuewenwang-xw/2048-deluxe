@echo off
setlocal enabledelayedexpansion

set "TEST_TARGETS=tests/test_engine_unit.js tests/test_ui_unit.js tests/test_juice_unit.js"
if not "%~1"=="" set "TEST_TARGETS=%*"

:: Check for node in PATH first
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node --test %TEST_TARGETS%
    exit /b %ERRORLEVEL%
)

:: Check known Node.js install locations
set "NODE_CANDIDATE_1=E:\codex\node.js\node.exe"
set "NODE_CANDIDATE_2=C:\Users\24726\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "NODE_CANDIDATE_3=C:\Program Files\nodejs\node.exe"

if exist "%NODE_CANDIDATE_1%" (
    "%NODE_CANDIDATE_1%" --test %TEST_TARGETS%
    exit /b !ERRORLEVEL!
)

if exist "%NODE_CANDIDATE_2%" (
    "%NODE_CANDIDATE_2%" --test %TEST_TARGETS%
    exit /b !ERRORLEVEL!
)

if exist "%NODE_CANDIDATE_3%" (
    "%NODE_CANDIDATE_3%" --test %TEST_TARGETS%
    exit /b !ERRORLEVEL!
)

echo [ERROR] Node.js executable not found in PATH or standard candidate paths.
exit /b 1
