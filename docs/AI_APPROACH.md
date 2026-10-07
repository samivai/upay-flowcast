# Forecasting and decision logic

## Machine-learning component

The forecast engine predicts six hourly buckets for three separate targets: cash-in requested amount, cash-out requested amount, and requested transaction count. The baseline averages the same agent's historical weekday and hour, falling back to that agent's hour when needed. A 24-tree Random Forest regressor uses agent ID, hour, weekday, and a simulated salary-period indicator (`day <= 7`). These features are known before each forecast hour. There are no future actuals or future lag features in multi-hour inference.

The generated history spans 96 days for most agents. The last 14 days are held out chronologically. The Random Forest trains on a deterministic one-in-three sample of earlier hourly rows; the baseline uses the earlier rows. Both are scored on the same 5,712 held-out rows per target using mean absolute error (MAE). Selection compares unrounded MAE per target, so a displayed tie may still select one method. A18 has nine days of history and uses a peer-history fallback, which the UI labels.

Measured on a freshly seeded **synthetic** database using Python 3.13.14 and scikit-learn installed from `requirements.txt`:

| Target | Baseline MAE | Random Forest MAE | Selected |
| --- | ---: | ---: | --- |
| Cash-in amount | 42,405.4 paisa (about ৳424.05) | 41,518.7 paisa (about ৳415.19) | Random Forest |
| Cash-out amount | 57,340.8 paisa (about ৳573.41) | 63,198.1 paisa (about ৳631.98) | Historical baseline |
| Demand count | 2.6 attempts | 2.6 attempts | Historical baseline, based on unrounded MAE |

These are errors on generated records, not claims of real-world accuracy. A synthetic salary pattern and the special high-volume A01 scenario are built into the generator. Completed-only operational logs can hide requests that could not be served.

## Rule-based calculations

The following are deterministic operating rules, **not AI models**:

- Projected cash: prior cash + cash-in − cash-out. Projected e-money: prior e-money − cash-in + cash-out.
- Required top-up: `max(0, reserve − minimum projected balance)` across six hours.
- High risk: a projected negative balance or a reserve breach in the first two buckets. Medium: a later breach. Low: no breach. A balance older than 120 minutes displays Needs confirmation.
- Historical MAE for cash-in and cash-out forms an illustrative `±` range scaled by square root of horizon. It is not a calibrated interval or shortage probability.
- Haversine computes distance; estimated travel is 12 handling minutes plus distance at 15 km/h. It is not map or traffic data.
- Candidate checks cover business hours at arrival, availability, freshness, arrival before breach, both participants' current and projected reserves, and accepted commitments.
- English and Bangla warnings come from value-filled templates. There is no LLM call in the product.

## Same-demand replay

A fixed random seed generates timestamped attempted transactions from the forecast buckets. Both paths receive that exact sequence. A transaction is served only if its required cash or e-money is available; an unserved attempt leaves balances unchanged. The intervention path applies the exchange at its scheduled time. For A01 in the fresh seed, the prospective replay has 602 attempts: 523 served without exchange (86.9%) and 602 served with exchange (100.0%). The alert lead time is 120 minutes. These are **simulation outcomes**, not observed customer-service improvements.
