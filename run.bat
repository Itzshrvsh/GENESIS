@echo off
title Genesis Pipeline
echo =========================================
echo       Starting Genesis Pipeline
echo =========================================
echo.

:: Check if the virtual environment exists
if exist venv\Scripts\activate.bat (
    echo [INFO] Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo [WARNING] Virtual environment 'venv' not found!
    echo Please make sure you have installed the requirements.
    echo.
)

:: Run the genesis orchestrator script
echo [INFO] Running genesis.py...
python genesis.py

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Pipeline encountered an error.
) else (
    echo.
    echo [SUCCESS] Pipeline execution finished.
)

echo.
pause
