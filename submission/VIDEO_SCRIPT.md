# UPAY FLOWCAST demo video script — prepared, not recorded

Suggested length: **about 4 minutes**. This is a presentation choice, **not** a rulebook duration requirement. Capture the actual app and audio; replace any values that differ after reset or deployment. Do not submit this script as if it were a video.

| Time | Screen action | Natural narration |
| --- | --- | --- |
| 0:00–0:25 | Show title, fictional-data label, and A01 Agent dashboard. | “A customer can arrive for a withdrawal and find that an agent has run short of cash. Agents need both cash and electronic balance to keep cash-in and cash-out available. UPAY FLOWCAST gives a six-hour view of that pressure.” |
| 0:25–0:55 | Point to A01 balances, separate reserves, and confirmation time. Toggle cash/e-money chart. | “This is Lake View Store in our fictional Dhaka scenario. The screen separates current balances from safe reserves and shows when the balances were last confirmed.” |
| 0:55–1:30 | Show the cash trajectory, breach time, required top-up, and hourly demand. | “The cash forecast falls below reserve during the next busy hours. The required top-up comes from the lowest projected balance over the full horizon. A reserve breach is a warning, not automatically a failed transaction.” |
| 1:30–2:00 | Open Supervisor → Model performance. | “The machine-learning part forecasts cash-in, cash-out, and attempted transaction count. We compare a Random Forest with a historical weekday/hour average on a later holdout period. The app chooses whichever has lower measured error for each target; the model does not always win.” |
| 2:00–2:35 | Open Rebalance; compare closer excluded A03 and suitable A04. | “A nearby agent is not automatically a safe donor. We check projected balances, both reserves, existing commitments, opening hours, freshness, and estimated arrival. A03 is closer but cannot safely provide cash. A04 can.” |
| 2:35–3:05 | Request from A04; switch to Supervisor → Operations, accept, then complete. | “The request begins Pending, so no balance changes. Acceptance reserves capacity. Completion rechecks it and records equal and opposite cash and e-money changes for both agents.” |
| 3:05–3:30 | Return to A01 dashboard and activity. | “The updated balances and forecast now show lower risk. The activity log records the request and the before/after exchange values.” |
| 3:30–4:00 | Open Demo walkthrough outcome panel and finish on limitations. | “We replay the same timestamped customer attempts in both paths, applying the exchange only at its scheduled time. In this synthetic seed, service changes from 523 of 602 attempts to 602 of 602. This is simulated evidence, not proof of real-world impact. Live use would need authorized data, secure roles, and operational validation.” |

Before recording: reset the demo, confirm the shown numbers, test English/Bangla switch, capture a legible desktop view, and add a short mobile view if time allows. The actual recording, upload URL, duration rule, and file format remain to be confirmed.
