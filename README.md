# UPAY FLOWCAST — AI Agent Liquidity Forecasting

**Team:** [TEAM NAME — TO FILL]  
**Members / registration IDs:** [CONFIRM WITH TEAM]  
**Public GitHub repository:** **Not published yet** — a dedicated destination is required.  
**Live deployment:** **Not deployed yet** — a verified public HTTPS URL is required.  
**Demo video:** **Not recorded yet** — [script](submission/VIDEO_SCRIPT.md) and [storyboard](submission/VIDEO_STORYBOARD.md) are prepared.  
**Project report:** [Editable draft](submission/PROJECT_REPORT.md); export format: **Confirm with organizers**.

UPAY FLOWCAST is a **simulated hackathon prototype** that helps fictional mobile-money agents anticipate cash or e-money shortages and arrange safe exchanges before customers go unserved. A customer may reach an agent during a busy period only to find that the agent lacks the balance needed for cash-in or cash-out. The app combines a six-hour demand forecast, reserve warnings, nearby surplus checks, request operations, and a same-demand service replay. It has no official upay integration, real customer information, live money transfer, or production authentication.

The [official AI Hackathon rules](https://aidevfest.top/rules) require a public repository with continuous development history, a complete README and live URL, a video, a report, and project materials. This workspace did **not** contain earlier Git history. A local repository was initialized during submission preparation; its current commits cannot prove the earlier development timeline or eligibility. Team members must verify the actual requirement-publication time and the origin of this pre-existing solution before submission. See the [compliance mapping](docs/RULEBOOK_COMPLIANCE.md).

## Implemented features

- **Agent View:** selector for 18 fictional agents; counted cash and e-money, separate reserves, balance freshness, six-hour trajectory and requested-demand charts, active/resolved warnings, recommendations, balance confirmation, and activity.
- **Supervisor View:** network metrics, risk and area filters, agent detail and history, request acceptance/rejection/completion, and model performance.
- **Rebalance:** Haversine distance and estimated arrival, projected surplus and both participants' reserves, accepted commitments, distributor option, partial requests, and an auditable Pending → Accepted → Completed flow. Rejected and Cancelled states are also supported.
- **Guided simulation:** identical seeded attempted transactions in before/after paths; unserved attempts do not make actual balances negative, and exchange is applied at its scheduled time.
- **CSV history import:** sample download, preview with row-numbered validation, duplicate detection, and commit.
- **English/Bangla switch** for essential navigation, warnings, and actions; language preference persists in browser storage.
- **Reset demo** restores the seed, fixed clock, balances, and request state after confirmation.

The app does **not** implement secure roles, real balance integration, live transfers, real traffic, or calibrated shortage probabilities. Those are future integration tasks, not completed features.

## AI components and decision rules

The machine-learning part predicts cash-in amount, cash-out amount, and requested transaction count in six hourly buckets. A historical weekday/hour average is the baseline. A small scikit-learn Random Forest uses agent ID, hour, weekday, and salary-period indicator, all known at forecast time. The final 14 historical days are held out chronologically. Both methods receive calculated MAE scores on the same holdout, and the lower-error method is chosen **per target**. A18's nine days of history trigger a labeled peer fallback. The UI displays an illustrative historical-error range, not a calibrated confidence or shortage probability.

The balance trajectories, reserve breaches, risk levels, top-up amounts, donor safety checks, Haversine distances, travel estimates, and English/Bangla explanations are **rule-based calculations or templates, not AI**. No LLM or hosted model is used in the product. The [AI approach](docs/AI_APPROACH.md) records the model features, split, measured synthetic-data MAE, risk rules, and replay method.

## Technology and prerequisites

Frontend: React 19, TypeScript 7, Vite 8, Recharts, Lucide React, and CSS. Backend: Python 3.13, FastAPI, Uvicorn, scikit-learn Random Forest, and SQLite. No cloud service or external API is needed for the local demo.

**Tested here:** Python **3.13.14**, Node.js **24.11.1**, npm, and the versions resolved by the lockfile/requirements. Other runtime versions have not been verified. The source archive does not need `.venv/` or `node_modules/`; install them from the manifests. Docker is optional for production-style serving; a Docker engine was not available here for image-build verification.

## Clean-checkout installation and configuration

Run from the project root:

```bash
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci
```

No external credentials are needed. `.env.example` documents optional variables. FastAPI does **not** auto-load `.env`; to use it in a POSIX shell:

```bash
cp .env.example .env
set -a
. ./.env
set +a
```

| Variable | Purpose | Default / required? |
| --- | --- | --- |
| `FLOWCAST_DB_PATH` | Writable SQLite file. Parent directory is created when needed. | `backend/flowcast.sqlite3`; optional. Set to a persistent mount path in production. |
| `FLOWCAST_CORS_ORIGINS` | Comma-separated browser origins for split-origin development. | `http://localhost:5173,http://127.0.0.1:5173`; optional. Single-origin production does not require CORS. |
| `PORT` | Port used by the Docker start command or shell commands that reference it. | `8000`; optional. FastAPI itself does not read this variable. |

The backend initializes an empty database on startup with a fixed seed. To seed or reset explicitly:

```bash
.venv/bin/python -c "from backend import core; db=core.connect(); core.seed(db); db.close()"
```

**Existing local data:** Leaving `FLOWCAST_DB_PATH` unset preserves the old `backend/flowcast.sqlite3` location. Setting it to the `.env.example` path `./data/flowcast.sqlite3` creates a separate new database. If you intend to keep existing demo changes, stop the backend and copy the old file to the configured path before starting. Do not commit or package either mutable database.

## Run locally and build for production

Development uses two terminals. Vite proxies relative `/api` calls to FastAPI:

```bash
# Terminal 1
.venv/bin/python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. API documentation is at `http://127.0.0.1:8000/docs`.

For **one-origin production-style serving** without Docker:

```bash
npm ci
npm run build
.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
```

Open `http://127.0.0.1:8000/`; API calls stay on `/api`, `/docs` remains available, and `/api/health` returns service status. Use a public HTTPS reverse proxy and a **persistent writable path** for `FLOWCAST_DB_PATH` when hosting. A host that erases its filesystem on restart will erase requests and corrections even though this app uses SQLite. The initial container is deliberately one worker because its forecast engine is held in process memory and its database is local. Startup seeds an empty database and trains the model, so allow a short cold start. Changes survive restart only when the selected SQLite file survives.

Optional Docker path, when a Docker engine is available:

```bash
docker build -t upay-flowcast .
mkdir -p data
docker run --rm -p 8000:8000 -v "$(pwd)/data:/data" upay-flowcast
```

The image builds Vite output and serves it from FastAPI; its database path is `/data/flowcast.sqlite3`. Mount `/data` to persistent storage on the chosen host. Docker configuration is prepared but was **not image-build tested** here because Docker was unavailable. Deployment destination and credentials were not configured; no live URL is claimed.

## Test and verify

```bash
.venv/bin/python -m pytest -q
npm run typecheck
npm run build
```

Manual flow: open A01 (Lake View Store), inspect its High cash warning, compare closer excluded A03 with suitable A04, request cash, switch to Supervisor → Operations, accept and complete, then inspect A01's updated Low risk and the Demo walkthrough replay. Test the language switch, balance confirmation, CSV preview, and reset. Check Dashboard, Rebalance, Operations, Import, and Demo at roughly 360px, 768px, and 1440px for overflow, chart readability, touch targets, keyboard focus, and table scrolling. Browser automation was unavailable during submission preparation, so these visual checks remain manual.

## Demo settings and operational limits

The scenario begins at **7 October 2026, 11:00 AM Asia/Dhaka**. The seed contains 18 fictional Dhaka agents, one modeled distributor, and 39,384 generated hourly history records; most agents have 96 days, A18 has nine. A01 faces a cash shortage, A02 an e-money shortage, A03 is closer but unsafe as a donor, A04 has projected surplus, A05 has a stale balance, and A17 is low volume. Completing an exchange advances the simulated clock to estimated arrival. All stored amounts are integer **paisa**; the UI formats Bangladeshi taka with `৳`. Imported CSV amounts are also paisa. The role switch is a demo convenience, not authentication.

Cash-in adds physical cash and removes e-money; cash-out reverses that. A cash exchange of X adds X cash and removes X e-money from the recipient, with the exact opposite entries for the donor. A reserve breach is an operating warning, not automatically a failed transaction. The [architecture](docs/ARCHITECTURE.md) explains persistence and routing; [external resources](docs/EXTERNAL_RESOURCES.md) records provenance. No clean logo image was present in the supplied attachment; the interface uses a text wordmark with the requested blue `#2253A0` and yellow `#F8D749`.

For a submission, replace the team placeholders, verify real chronology and eligibility, publish the public repository and HTTPS deployment, record the actual video, export the report in the organizer-required format, and submit through the official channel by the announced deadline. Do not treat the [local ZIP package](scripts/package_submission.py) as a substitute for GitHub history.
