@echo off
setlocal EnableDelayedExpansion
title QuoteXtract — Docker Launcher

echo.
echo  ============================================================
echo   QuoteXtract — Local Docker Setup
echo  ============================================================
echo.

:: ── Check Docker is installed ────────────────────────────────────
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Docker is not installed or not in PATH.
    echo          Download it from https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

:: ── Check Docker daemon is running ───────────────────────────────
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Docker Desktop is not running.
    echo          Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

echo  [OK] Docker is running.
echo.

:: ── Copy .env if it does not exist ───────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        echo  [INFO] No .env file found. Copying from .env.example...
        copy /Y ".env.example" ".env" >nul
        echo  [INFO] .env created. Edit it to set your credentials before continuing.
        echo.
        echo  Press any key to open .env in Notepad, then re-run this script.
        pause >nul
        notepad .env
        exit /b 0
    ) else (
        echo  [WARN] No .env or .env.example found. Using Docker Compose defaults.
        echo.
    )
) else (
    echo  [OK] .env file found.
    echo.
)

:: ── Pull / start the local AI model ──────────────────────────────
echo  [STEP 1/3] Starting local AI model via Docker Model Runner...
echo             (This may take a few minutes on first run — model is ~500 MB)
echo.
docker model run hf.co/unsloth/Qwen3.5-0.8B-GGUF:Q4_K_M
if %errorlevel% neq 0 (
    echo.
    echo  [WARN] Could not start the local AI model.
    echo         Ensure Docker Desktop has the "AI / Model Runner" feature enabled.
    echo         Settings ^> Beta features ^> Enable Docker Model Runner
    echo.
    echo  Continuing without local model — set OPENAI_BASE_URL in .env to use
    echo  a different OpenAI-compatible API endpoint (e.g. OpenAI, Ollama).
    echo.
)

:: ── Build and launch all services ────────────────────────────────
echo.
echo  [STEP 2/3] Building Docker images (first run may take 3-5 minutes)...
echo.
docker compose build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Docker build failed. See output above for details.
    pause
    exit /b 1
)

echo.
echo  [STEP 3/3] Starting all services...
echo.
docker compose up -d
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Failed to start services. See output above for details.
    pause
    exit /b 1
)

:: ── Health check — wait for dashboard to respond ─────────────────
echo.
echo  [INFO] Waiting for services to become ready...
set /a retries=0
:wait_loop
timeout /t 3 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000 | findstr "200 301 302" >nul 2>&1
if %errorlevel% equ 0 goto ready
set /a retries+=1
if %retries% lss 20 (
    echo  [INFO] Still starting... (%retries%/20)
    goto wait_loop
)
echo  [WARN] Dashboard did not respond in time. Check logs with: docker compose logs

:ready
echo.
echo  ============================================================
echo   QuoteXtract is running!
echo  ============================================================
echo.
echo   Dashboard  ^>  http://localhost:3000
echo   API        ^>  http://localhost:8080
echo   Database   ^>  localhost:5432  (db: quotextract)
echo.
echo   To view logs:    docker compose logs -f
echo   To stop:         docker compose down
echo   To stop + wipe:  docker compose down -v
echo.
echo  ============================================================
echo.

:: ── Open in default browser ───────────────────────────────────────
start http://localhost:3000

pause
endlocal
