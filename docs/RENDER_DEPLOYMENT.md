# Deploy UPAY FLOWCAST on Render

## Cost and deployment status

**Persistent storage requires a paid Render web service.** Render's Free web service cannot attach a persistent disk, so the SQLite file would be lost on a restart or redeploy. The checked-in `render.yaml` specifies the lowest listed paid web-service compute plan, `0.5c-512mb`, and a 1 GB disk. As checked on 7 October 2026, Render lists **US$7/month** for that compute plan and **US$0.25/GB/month** for a persistent disk: about **US$7.25/month** if both run for a full month, before any usage overages or taxes. Hobby workspace membership has no separate monthly fee. Render prorates active compute and storage. **Review the current price and billing summary in Render before creating the service or adding a payment method.** No Render service has been created for this repository.

Official references: [persistent disks](https://render.com/docs/disks), [pricing](https://render.com/pricing), [Blueprint YAML](https://render.com/docs/blueprint-spec), [web services](https://render.com/docs/web-services).

## Create from the checked-in Blueprint

1. Sign in to [Render](https://dashboard.render.com/) and connect the GitHub account that can access [samivai/upay-flowcast](https://github.com/samivai/upay-flowcast). Use a Hobby workspace if you do not need a paid workspace subscription.
2. In the Render dashboard, choose **New → Blueprint**. Select `samivai/upay-flowcast`, branch `main`, and the root `render.yaml`. Review the proposed resources before applying anything. It should show **one Docker web service** named `upay-flowcast`, compute plan `0.5c-512mb`, and **one 1 GB disk** mounted at `/data`.
3. Confirm the displayed charges and add a payment method if Render requires one. Apply the Blueprint only if you accept the paid compute and disk costs. This starts a Docker build and deploy. The image builds the Vite frontend and serves it with FastAPI from the same origin.
4. Wait for the service status to become **Live** and for `/api/health` to pass. The first boot seeds the database and trains the forecast model, so it may take longer than a later start. Copy the actual HTTPS `onrender.com` URL from Render's service page.

**Manual Dashboard equivalent:** Choose **New → Web Service**, connect `samivai/upay-flowcast` at `main`, leave Root Directory blank, select **Docker** runtime and the root `Dockerfile`, choose the paid `0.5c-512mb` instance, and set health check path `/api/health`. Under **Advanced**, add a **1 GB persistent disk** with mount path `/data`, then add `FLOWCAST_DB_PATH=/data/flowcast.sqlite3` and `PORT=8000`. Keep instance count at **1**. Review the billing summary before clicking **Create Web Service**. The `render.yaml` and manual setup describe the same service; create it only once.

No API key, `.env` upload, separate frontend service, CORS setting, build command, or start-command override is required. The Dockerfile already binds Uvicorn to `0.0.0.0:$PORT` and uses one worker.

## Verify after deployment

Replace the example hostname below with the actual `onrender.com` hostname from the service page:

```bash
curl -fsS https://your-service.onrender.com/api/health
```

Expect `{"ok":true,"product":"UPAY FLOWCAST"}`. Open the root URL and `/docs`. In the app, create a fictional rebalance request or confirm a fictional balance. Redeploy or restart the service, then check that the change remains; this verifies that SQLite is actually using the mounted disk. **Do not click Reset Demo before checking**, because reset intentionally deletes mutable demo state. Finally, put the verified URL in `README.md`, `submission/PROJECT_REPORT.md`, and `submission/SUBMISSION_CHECKLIST.md`.

## Operating limits

- Only files under `/data` survive a Render restart or deploy. The database path must stay `/data/flowcast.sqlite3` unless the disk mount and variable are changed together.
- A disk-backed service runs as one instance; the checked-in Docker command also uses one Uvicorn worker. Render stops it before a new disk-backed version starts, causing a short deploy interruption.
- Disk size can be increased, not reduced. Watch disk usage and service memory in Render. The 512 MB plan is the least expensive eligible plan, but its behavior under real traffic has not been measured on Render; increase the compute plan if deployment logs show memory pressure.
- This public prototype has no authentication and all demo data must stay fictional. Anyone with access can use the demo's write and reset actions. Use a protected, authenticated design before any real financial data is involved.
