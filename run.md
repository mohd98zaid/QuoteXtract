# Running QuoteXtract Locally

Everything runs inside Docker — no Node.js, Python, or database installation required on your machine.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | 4.30+ | Windows, macOS, or Linux |
| Docker Model Runner | Built into Docker Desktop | Enable in **Settings → Beta features** |

---

## Quick Start (Windows)

Double-click **`run.bat`**. It will:

1. Verify Docker is running
2. Create `.env` from `.env.example` if missing and open it in Notepad
3. Pull and start the local AI model
4. Build all Docker images
5. Launch all services
6. Open `http://localhost:3000` in your browser

---

## Quick Start (macOS / Linux)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, SESSION_SECRET, and (optionally) email credentials

# 2. Pull the local AI model (one-time, ~2 GB download)
docker model run hf.co/blazeofchi/pdf-ocr-rl-qwen3vl2b-sft-only

# 3. Build and start everything
docker compose up --build -d

# 4. Open the dashboard
open http://localhost:3000        # macOS
xdg-open http://localhost:3000   # Linux
```

---

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | Main web UI |
| API Server | http://localhost:8080 | REST API |
| PostgreSQL | localhost:5432 | Database (user: `postgres`) |

---

## Environment Variables

Copy `.env.example` to `.env` and set these values:

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `POSTGRES_PASSWORD` | `postgres` | Recommended | Database password |
| `SESSION_SECRET` | `change-me-...` | **Yes** | Random string for session signing |
| `OPENAI_BASE_URL` | model-runner URL | No | Override to use OpenAI or Ollama |
| `OPENAI_API_KEY` | `local` | No | API key (use `local` for local model) |
| `OPENAI_MODEL` | pdf-ocr model | No | Model name to use for extraction |
| `IMAP_EMAIL` | _(blank)_ | No | Hostinger email for inbox polling |
| `IMAP_PASSWORD` | _(blank)_ | No | Email password |
| `SMTP_HOST` | _(blank)_ | No | SMTP host for sending emails |
| `SMTP_USER` | _(blank)_ | No | SMTP username |
| `SMTP_PASSWORD` | _(blank)_ | No | SMTP password |

---

## Using a Different AI Model

To use **OpenAI** instead of the local model:

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...your-key...
OPENAI_MODEL=gpt-4o
```

To use **Ollama** (running locally):

```env
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENAI_API_KEY=ollama
OPENAI_MODEL=llava
```

---

## Common Commands

```bash
# View logs from all services
docker compose logs -f

# View logs from one service
docker compose logs -f api-server
docker compose logs -f dashboard

# Stop all services (keeps data)
docker compose down

# Stop and delete all data (fresh start)
docker compose down -v

# Rebuild after code changes
docker compose up --build -d

# Open a database shell
docker compose exec postgres psql -U postgres -d quotextract
```

---

## Troubleshooting

**Dashboard shows a blank page**
- Wait 30 seconds and refresh — the API server may still be starting.
- Run `docker compose logs api-server` to check for errors.

**AI extraction returns errors**
- Confirm the model runner is active: `docker model list`
- If the model is missing, re-run: `docker model run hf.co/blazeofchi/pdf-ocr-rl-qwen3vl2b-sft-only`
- Alternatively, set `OPENAI_BASE_URL` and `OPENAI_API_KEY` to use OpenAI.

**Port already in use**
- Stop any conflicting service on port 3000 or 8080, or change the port mapping in `docker-compose.yml`:
  ```yaml
  ports:
    - "3001:80"   # dashboard on 3001 instead
  ```

**IMAP / SMTP not connecting**
- Confirm your email credentials in `.env` or via the Settings page in the UI.
- For Hostinger: IMAP = `imap.hostinger.com:993 (SSL)`, SMTP = `smtp.hostinger.com:465 (SSL/TLS)`.
