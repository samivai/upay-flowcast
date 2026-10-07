# UPAY FLOWCAST — AI Agent Liquidity Forecasting

UPAY FLOWCAST is a responsive hackathon prototype for forecasting agent cash and e-money shortages, finding safe rebalancing options, and measuring simulated service outcomes. All data and operations are simulated. There is no official upay integration, live transfer, production authentication, or customer data.

## Run locally

Requirements: Python 3.13+, Node.js 20.19+ or 22.12+, and npm. From the project root:

```bash
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm install
```

The backend creates and seeds `backend/flowcast.sqlite3` automatically on first startup. To explicitly restore the fixed seed and clock before running:

```bash
.venv/bin/python -c "from backend import core; db=core.connect(); core.seed(db); db.close()"
```

Start each server in its own terminal:

```bash
.venv/bin/python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. The Vite server proxies `/api` to the backend. The API documentation is at `http://127.0.0.1:8000/docs`.

Checks and production frontend build:

```bash
.venv/bin/python -m pytest -q
npm run typecheck
npm run build
```

## Demo flow

The clock is fixed at **7 October 2026, 11:00 AM Asia/Dhaka**. The seed contains 18 fictional Dhaka-area agents, one distributor, and 96 days of generated hourly requested demand for most agents. A18 has only nine days of history. A01 (Lake View Store) approaches a cash shortage, A02 approaches an e-money shortage, A03 is a nearby unsuitable donor, A04 has genuine projected surplus, A05 has a stale balance, and A17 is low volume.

1. Open A01 in Agent View and inspect its cash trajectory and warning.
2. Open Rebalance and compare safe capacity and exclusion reasons. Create a request, optionally for a partial amount.
3. Switch to Supervisor View → Operations, accept the request, then complete it.
4. Return to A01 to see updated balances, forecast, alert, and activity.
5. Open Demo walkthrough for a same-sequence service replay with and without the scheduled exchange.

The role switch is only a demo convenience; it is not secure access control. “Reset demo” asks for confirmation and restores all seeded balances, history, requests, corrections, and the fixed clock. SQLite retains completed actions through page reloads and server restarts until reset.

## Forecast and risk rules

The API predicts six hourly buckets for cash-in amount, cash-out amount, and requested transaction count. Historical averages use comparable agent, weekday, and hour. A small Random Forest uses only agent ID, hour, weekday, and salary-period indicator, which are known before every predicted hour. It does not read future actual demand or lag values. Training and validation are chronological: the final 14 days are held out. Baseline and model MAE are calculated on the same holdout for each target, and the lower-error method is selected per target. A18 uses a peer-history fallback and is labeled accordingly.

Balances propagate as `next cash = cash + cash-in − cash-out` and `next e-money = e-money − cash-in + cash-out`. The required top-up is `max(0, reserve − lowest projected balance)`. The chart’s range uses selected-method historical validation MAE for cash-in and cash-out, scaled by the square root of horizon hours. It is illustrative error context, **not a calibrated probability**.

- **High:** a projected balance becomes negative, or a reserve breach occurs in either of the first two buckets.
- **Medium:** a later reserve breach occurs within six hours.
- **Low:** neither condition occurs.
- **Needs confirmation:** last balance confirmation is more than 120 minutes before the scenario clock, overriding the displayed risk label. The underlying trajectory is still visible with a freshness warning.

A reserve breach is an early operating warning; it is not equivalent to a failed transaction.

## Rebalance accounting

For cash assistance of X, recipient cash rises by X and e-money falls by X. Donor cash falls by X and e-money rises by X. E-money assistance reverses all four changes. The distributor has modeled balances and reserves under the same accounting.

Candidates are checked for availability, business hours at estimated arrival, balance freshness, both projected reserves, accepted commitments, recipient exchange capacity, and arrival before the expected breach. Distance uses Haversine. Travel is an **estimate** of 12 handling minutes plus distance at 15 km/h; it does not use traffic data.

Requests move through Pending, Accepted, Rejected, Cancelled, and Completed. Pending requests do not modify balances. Acceptance reserves safe capacity. Acceptance and completion recheck capacity. Completion advances the simulated clock to the estimated arrival time and writes both participants’ balances and audit events in one SQLite transaction; repeating completion does not transfer value twice. The UI supports requests smaller than the full need and shows a distributor fallback.

## CSV import

The Import CSV screen provides a downloadable example, preview, row-numbered errors, and commit. Required columns:

| Column | Meaning |
| --- | --- |
| `agent_id` | Existing agent ID, such as `A01` |
| `timestamp` | ISO 8601 with offset, such as `2026-10-06T10:00:00+06:00` |
| `transaction_type` | `cash_in` or `cash_out` |
| `amount` | Positive integer **paisa** |
| `status` | `requested`, `completed`, or `failed` |

Optional `record_id` provides a stable duplicate key. Without it, agent, timestamp, type, amount, and status form the key. Existing and within-file duplicates are rejected. Failed/requested demand remains separate from completed count. Imported historical completed records enrich demand history but do not silently rewrite the agent’s current balance snapshot; use balance confirmation to correct that snapshot.

## Simulation method and limitations

The outcome replay creates one seeded, timestamped demand sequence and runs it twice. At each attempt, it checks the required balance and records unserved attempts without letting actual balances go negative. The intervention path applies the exchange only at its scheduled time. Attempted, served, unserved, service rate, rebalanced amount, and alert lead time are calculated from that replay. After completion, the replay uses the recorded pre-exchange balance and actual request amount.

The seed is fictional and deliberately compact. Generated requested demand is richer than completed-only operational records; real shortages can hide unmet demand. The model is a modest demonstration, not a calibrated financial forecast. Travel estimates omit traffic. Simulated clock advancement does not post intervening customer transactions to the live balance snapshot; the outcome replay handles them separately. There is no identity verification, secure role enforcement, live reconciliation, or real physical delivery. Real upay integration would require approved data access, consent and privacy controls, authenticated roles, balance reconciliation, transaction webhooks, distributor authorization, audit retention, and operational validation.

No clean logo image was included with the supplied text attachment. The interface uses a local text wordmark and brand colors `#2253A0` and `#F8D749`; place an approved, clean upay logo asset in `public/` and replace the wordmark in `src/App.tsx` when available.

## Manual responsive check

At 360px, 768px, and 1440px widths, check Dashboard, Rebalance, Operations, Import, and Demo walkthrough. Confirm there is no page-level horizontal overflow, charts fit their cards, the table scrolls within its container, navigation remains reachable, and keyboard focus is visible. Exercise request creation, acceptance, completion, CSV preview, language switching, balance confirmation, and reset. Automated browser inspection was unavailable in the authoring environment; these are manual verification steps.
