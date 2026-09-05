# AI Job Tracker

An AI-powered job search aggregator and application tracker. It pulls fresh
postings (last 24h) from multiple job sources, scores each one against your
CV using an LLM, and gives you a clean kanban board to track your pipeline —
New → Saved → Applied → Interview → Offer/Rejected.

## Why this exists

Job hunting means checking five different sites a day for postings that match
you. This automates the checking and the filtering, and leaves you with a
short, ranked list plus a place to track where you actually stand with each
application.

## Architecture

```
                    ┌─────────────────────┐
                    │   Job Source APIs    │
                    │ Adzuna / JSearch /   │
                    │ Greenhouse boards    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   MCP Server          │   <- reusable over MCP (Claude
                    │  (search_jobs,        │      Desktop/Code) AND called
                    │   score_job_fit)      │      directly by the scheduler
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
┌─────────▼─────────┐ ┌────────▼────────┐  ┌─────────▼─────────┐
│  Daily Scheduler   │ │  Claude API     │  │   FastAPI Backend  │
│ (GitHub Actions    │ │ (CV parsing +   │  │  (jobs, statuses,  │
│  cron, free)       │ │  fit scoring)   │  │   SQLite/Postgres) │
└────────────────────┘ └─────────────────┘  └──────────┬─────────┘
                                                          │
                                              ┌───────────▼───────────┐
                                              │   React Frontend       │
                                              │  Kanban tracker board  │
                                              └────────────────────────┘
```

**Why an MCP server, specifically:** wrapping each job source as an MCP tool
(`search_jobs`, `score_job_fit`) means the same logic is usable two ways —
programmatically by the scheduler script, and conversationally through any
MCP client (e.g. asking Claude Desktop "find me jobs posted today that match
my CV"). Adding a new job source later means adding one function, not
rewriting integrations in multiple places.

## Project structure

```
job-tracker-ai/
├── mcp-servers/job_search_server/   # MCP server: search_jobs, score_job_fit tools
│   ├── server.py
│   ├── ai_scoring.py                # Claude API job-fit scoring
│   ├── cv_parser.py                 # Claude API CV -> structured JSON
│   └── sources/                     # adzuna.py, jsearch.py, greenhouse.py
├── backend/                         # FastAPI + SQLAlchemy tracker API
│   └── app/
├── frontend/                        # React + Tailwind kanban board
│   └── src/
├── scheduler/
│   └── run_daily_pipeline.py        # ties search -> scoring -> backend together
└── .github/workflows/daily-job-fetch.yml   # free daily cron via GitHub Actions
```

## Setup

### 1. Get free API keys
- **Adzuna**: https://developer.adzuna.com/ (free, 1,000 calls/month)
- **RapidAPI / JSearch**: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch (free tier)
- **Anthropic API**: https://console.anthropic.com/ (pay-as-you-go, cheap for this volume)
- Greenhouse needs no key — just company slugs (edit `sources/greenhouse.py`)

Copy `.env.example` to `.env` and fill these in.

### 2. Parse your CV once
```bash
cd mcp-servers/job_search_server
pip install -r requirements.txt
export ANTHROPIC_API_KEY=...
python cv_parser.py path/to/your_cv.txt > ../../scheduler/cv_profile.json
```
(Extract text from a PDF first with any PDF-to-text tool, or paste your CV as plain text.)

### 3. Run the backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4. Run the frontend
```bash
cd frontend
npm install
npm run dev
```
Visit http://localhost:5173

### 5. Run the pipeline manually (or let GitHub Actions do it daily)
```bash
cd scheduler
export $(cat ../.env | xargs)   # loads your API keys
python run_daily_pipeline.py
```

### 6. (Optional) Use the MCP server conversationally
Add to Claude Desktop's `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "job-search": {
      "command": "python",
      "args": ["/absolute/path/to/mcp-servers/job_search_server/server.py"]
    }
  }
}
```
Then just ask: *"Search for backend engineer jobs in Bangalore posted in the last 24 hours."*

### 7. Automate it
Push this repo to GitHub, add your API keys as repo secrets (Settings →
Secrets → Actions), and `.github/workflows/daily-job-fetch.yml` will run the
pipeline every day for free.

## Legal note
Adzuna, JSearch, and Greenhouse are all accessed through their public/official
APIs. There's no LinkedIn or Naukri scraping wired in by default because both
sites' terms of service prohibit it — JSearch's Google-for-Jobs index is the
practical way to surface LinkedIn/Indeed postings without scraping them
directly. If you add a scraper for personal use, treat it as fragile
(subject to breaking) and don't redistribute the data.

## How to talk about this project (resume/interview framing)

**Resume bullet options:**
- *Built a full-stack AI job-matching platform (React, FastAPI, MCP,
  Claude API) that aggregates postings from 3+ job APIs, scores fit against
  a parsed CV using an LLM, and tracks applications through a kanban
  pipeline — automated end-to-end via a daily GitHub Actions cron job.*
- *Designed a Model Context Protocol (MCP) server exposing reusable
  job-search and AI-scoring tools, callable both programmatically and
  conversationally through any MCP-compatible client.*

**What to be ready to explain in an interview:**
- *Why MCP*: separation of concerns — the tool logic is decoupled from both
  the scheduler and any chat client that wants to call it; it's a concrete
  example of building for an agentic/tool-use interface rather than a
  single hardcoded pipeline.
- *Deduplication strategy*: unique constraint on (title, company) at the DB
  level, plus in-memory dedup in the MCP server before ingestion.
- *Why LLM-based scoring instead of keyword matching*: handles synonyms and
  seniority nuance ("Staff Engineer" vs "Senior SWE") that keyword filters miss;
  trade-off is cost and latency per job, which is why scoring happens once at
  ingestion time and is cached in the DB, not recomputed on every page load.
- *Extensibility*: adding a new job source means writing one async function
  matching the existing `search_x(keywords, location, hours_old) -> List[Dict]`
  interface — no changes needed elsewhere.

## Possible extensions
- Add a vector DB (e.g. pgvector) for semantic search across saved jobs
- Slack/Telegram notification when a high-fit job appears
- Auto-fill application forms via a browser automation MCP tool
- Multi-user support with per-user CV profiles and auth
