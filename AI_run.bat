@echo off
setlocal
title QuoteXtract - Local AI Chat
set "MODEL_ID=hf.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF:q4_k_m"

echo.
echo  ============================================================
echo   QuoteXtract - Local AI Terminal (Qwen 2.5)
echo  ============================================================
echo.

:: Check if model is pulled
docker model ls | findstr /i "qwen2.5-1.5b" >nul
if %errorlevel% neq 0 (
    echo  [INFO] Model not found locally. Pulling now...
    docker model pull %MODEL_ID%
)

echo  [OK] Starting interactive chat...
echo  (Note: Type "/exit" to close the chat and return to terminal)
echo.

:: Run the model in interactive mode
docker model run %MODEL_ID%

echo.
echo  ============================================================
echo   Chat Session Ended.
echo  ============================================================
echo.

pause
endlocal
