# UPAY FLOWCAST — Project report draft

**Team name:** [TO FILL]  
**Members and registration IDs:** [TO FILL]  
**Competition:** AI DEV FEST 2026 AI Hackathon — confirm eligibility and submission details with organizers.  
**Public repository:** Not published yet.  
**Live application:** Not deployed yet.  
**Demo video:** Not recorded yet.  
**Required export format:** Confirm with organizers. This Markdown file is the editable source, not a claimed submitted report.

## Abstract

UPAY FLOWCAST is a simulated decision-support application for mobile-money agents who need both physical cash and electronic balance to serve customers. It forecasts hourly cash-in, cash-out, and attempted transaction demand for the next six hours. It then calculates possible reserve breaches, checks whether another agent or a distributor can safely exchange value, and simulates service outcomes under identical demand with and without a scheduled exchange. The application uses generated fictional data and does not connect to upay or execute financial transfers.

## Problem and proposed idea

A cash-out requires an agent to hand over physical cash and receive e-money; a cash-in uses the opposite balances. Either balance may run low during a busy period. An agent who sees only current balances may discover the problem after a customer arrives. UPAY FLOWCAST presents the projected direction of both balances, the earliest reserve breach, the amount needed to stay above reserve, and safe nearby options. A supervisor can monitor the network and process simulated requests. The intended benefit is earlier preparation and fewer unserved customer attempts, subject to real-world validation.

## Intended users and implemented features

An **agent** can select a fictional shop, view current and reserve balances, inspect six-hour charts and hourly cash-in/cash-out/count data, read English or Bangla warnings, review candidate exchanges, create a request, confirm balances, and inspect activity. A **supervisor** can filter a risk-ranked network table, inspect agent details and historical demand, accept/reject/complete requests, and compare model errors. Both roles can use a guided walkthrough. Role switching is a demonstration control, not authentication.

CSV upload has a downloadable sample, validation preview, row-numbered errors, duplicate detection, and commit. Changes to balances and request state persist in SQLite. Reset restores the deterministic scenario. No customer wallet, live transfer, map service, external AI API, or secure access control is implemented.

## Architecture and dataset

The frontend is React/TypeScript/Vite with CSS, Recharts, and Lucide icons. It calls relative `/api` endpoints. FastAPI serves those endpoints and, after `npm run build`, the frontend assets from the same origin. `backend/core.py` owns demand generation, a scikit-learn Random Forest, historical baseline, reserve rules, recommendation checks, request accounting, CSV validation, and replay. SQLite stores agents, hourly history, requests, settings, and audit events. `FLOWCAST_DB_PATH` selects a writable database file; a persistent volume is needed for public hosting.

The fixed scenario starts at **7 October 2026, 11:00 AM Asia/Dhaka**. The seed has 18 fictional agents, one distributor, and **39,384** generated hourly history records. Most agents have 96 days; A18 has nine and receives a peer fallback. Patterns vary by hour, weekday, agent, simulated salary period, and fixed-seed randomness. A01 approaches a cash shortage, A02 an e-money shortage, A03 is a closer unsafe donor, A04 has surplus, and A05 has stale confirmation. Requested and completed counts are separately represented. Generated patterns are demonstration assumptions, not observations of real upay demand. Completed-only logs can hide unserved demand.

## AI methodology and evaluation

Three separate six-hour targets are forecast: requested cash-in amount, requested cash-out amount, and attempted transaction count. A historical-average baseline uses comparable agent/weekday/hour records. A 24-tree Random Forest uses agent ID, hour, weekday, and a salary-period indicator, all known before prediction. It does not use future actual demand as a lag. The last 14 days are held out chronologically; 5,712 rows per target are evaluated. The lower **unrounded** MAE selects the method per target.

| Synthetic holdout target | Baseline MAE | Random Forest MAE | Selected |
| --- | ---: | ---: | --- |
| Cash-in | 42,405.4 paisa | 41,518.7 paisa | Random Forest |
| Cash-out | 57,340.8 paisa | 63,198.1 paisa | Baseline |
| Attempt count | 2.6 | 2.6 | Baseline on unrounded comparison |

These values were calculated by running the existing engine on a fresh deterministic seed with Python 3.13.14. They measure performance on **synthetic** records. The displayed MAE-based range is illustrative; it is not a calibrated probability or guaranteed coverage interval. English and Bangla explanations use templates rather than a language model. Haversine and liquidity rules are deterministic, not AI.

## Liquidity risk and exchanges

For each hour, projected cash = prior cash + cash-in − cash-out; projected e-money = prior e-money − cash-in + cash-out. Required top-up is `max(0, reserve − lowest six-hour projected balance)`. A projected negative balance or breach in the first two buckets is High risk; a later reserve breach is Medium; otherwise Low. Balances last confirmed more than 120 minutes ago are labeled Needs confirmation. A reserve breach is an early operating threshold, not necessarily transaction failure.

Cash assistance of X increases recipient cash and decreases recipient e-money by X, while the donor receives exactly opposite entries. E-money assistance reverses those directions. The distributor has modeled balances and reserves. Recommendations check current and projected capacity, accepted commitments, freshness, opening hours at estimated arrival, and whether arrival precedes breach. Distance uses Haversine; travel is a disclosed estimate of 12 handling minutes plus travel at 15 km/h. Pending requests do not change balances. Acceptance reserves capacity; completion rechecks and atomically records both sides and audit events. Duplicate completion is idempotent.

## Testing and measured simulation results

Ten focused backend tests cover transaction directions and nonnegative service balances, reserve breach and top-up, safe/unsafe donors, conservation, duplicate completion, accepted capacity reservations, stale/fallback behavior, CSV errors/duplicates, identical demand replay, database path creation, and static fallback routing. TypeScript checks and the Vite production build pass. A production-style FastAPI run served `/`, assets, `/docs`, and `/api` while returning a JSON 404 for unknown API routes. A clean configured database initialized and seeded on startup. Docker image construction and automated mobile/desktop browser inspection were unavailable in this workspace.

For A01 on the fresh seed, the same timestamped synthetic sequence contains **602 attempts**. Without the prospective exchange, **523** are served and **79** unserved (**86.9%**). With the scheduled exchange, **602** are served (**100.0%**). This is a **simulation outcome**, not measured real-world impact or a claim of commercial return. The alert lead time is **120 minutes** in that scenario.

## Intended impact, limits, and real integration

The intended practical value is to help agents prepare earlier and help supervisors direct scarce cash and e-money without creating a new shortage. Real impact has **not** been validated. The model is trained on generated data; actual agent behavior, transaction failures, route times, and distributor constraints may differ. The prototype has no secure roles, live reconciliation, physical delivery workflow, real financial execution, or customer privacy controls. The simulated clock advances on completion, but intervening customer transactions are not posted to the current balance snapshot; replay evaluates them separately.

Real upay integration would require provider-authorized APIs and data access, consent and privacy controls, authenticated roles, reconciled cash snapshots, transaction-event ingestion, operational permissions, audit retention, security review, a shadow-mode validation period, and a supervised pilot. None of those integrations are claimed complete.

## Resources, provenance, and submission status

See [`docs/EXTERNAL_RESOURCES.md`](../docs/EXTERNAL_RESOURCES.md) for package, model, synthetic-data, brand, and AI-assistance disclosures. This project existed before the present submission-preparation request and lacked Git history in this workspace. The team must verify its origin and timing against the official development window and disclose prior components honestly. Current local commits do not establish earlier continuous development.

**Repository link:** [ADD VERIFIED PUBLIC URL]  
**Deployment link:** [ADD VERIFIED PUBLIC HTTPS URL]  
**Video link:** [ADD RECORDED VIDEO URL]  
**Team details and organizer-required report/video formats:** [CONFIRM WITH TEAM AND ORGANIZERS]
