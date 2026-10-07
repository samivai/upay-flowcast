from __future__ import annotations

from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import core

engine: core.ForecastEngine | None = None
DIST_DIR = Path(__file__).resolve().parent.parent / 'dist'
DEV_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
cors_origins = [origin.strip() for origin in os.environ.get('FLOWCAST_CORS_ORIGINS', DEV_ORIGINS).split(',') if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    with core.connect() as db:
        core.ensure(db)
        engine = core.ForecastEngine(db)
    yield


app = FastAPI(title='UPAY FLOWCAST API', version='1.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_methods=['*'], allow_headers=['*'])


def run(fn):
    try:
        with core.connect() as db:
            return fn(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


class BalanceIn(BaseModel):
    cash: int = Field(ge=0)
    emoney: int = Field(ge=0)
    reason: str = Field(default='', max_length=500)


class RequestIn(BaseModel):
    recipient_id: str
    donor_id: str
    kind: str
    amount: int = Field(gt=0)


class ReplayIn(BaseModel):
    agent_id: str = 'A01'
    amount: int | None = Field(default=None, ge=0)
    kind: str = 'cash'


@app.get('/api/health')
def health():
    return {'ok': True, 'product': 'UPAY FLOWCAST'}


@app.get('/api/agents')
def agents():
    return run(lambda db: core.all_agents(db))


@app.get('/api/agents/{aid}')
def agent(aid: str):
    return run(lambda db: core.agent(db, aid))


@app.get('/api/agents/{aid}/forecast')
def forecast(aid: str):
    return run(lambda db: core.forecast(db, engine, aid))


@app.get('/api/agents/{aid}/alerts')
def alerts(aid: str):
    def get(db):
        f = core.forecast(db, engine, aid)
        active = []
        for kind in ('cash', 'emoney'):
            if f[f'breach_{kind}']:
                active.append({'kind': kind, 'risk': f['risk'], 'time': f[f'breach_{kind}'], 'required': f['required'][kind], 'active': True, 'explanation_en': f['explanation_en'], 'explanation_bn': f['explanation_bn']})
        resolved = [dict(r) for r in db.execute("SELECT * FROM events WHERE agent_id=? AND kind='rebalance' AND detail LIKE '%completed%' ORDER BY id DESC LIMIT 10", (aid,))]
        return {'active': active, 'resolved': resolved, 'needs_confirmation': f['stale'], 'confirmed_at': f['agent']['confirmed_at']}
    return run(get)


@app.get('/api/agents/{aid}/recommendations')
def recommendations(aid: str):
    return run(lambda db: core.recommendations(db, engine, aid))


@app.post('/api/agents/{aid}/confirm')
def confirm(aid: str, body: BalanceIn):
    return run(lambda db: core.confirm(db, aid, body.cash, body.emoney, body.reason))


@app.get('/api/agents/{aid}/activity')
def activity(aid: str):
    def get(db):
        core.agent(db, aid)
        events = [dict(r) for r in db.execute('SELECT * FROM events WHERE agent_id=? ORDER BY id DESC LIMIT 30', (aid,))]
        recent = [dict(r) for r in db.execute('SELECT * FROM history WHERE agent_id=? ORDER BY timestamp DESC LIMIT 12', (aid,))]
        return {'events': events, 'transactions': recent}
    return run(get)


@app.get('/api/agents/{aid}/history')
def historical(aid: str):
    def get(db):
        core.agent(db, aid)
        return [dict(r) for r in db.execute('SELECT * FROM history WHERE agent_id=? ORDER BY timestamp DESC LIMIT 48', (aid,))]
    return run(get)


@app.get('/api/summary')
def summary():
    return run(lambda db: core.summary(db, engine))


@app.get('/api/model-metrics')
def model_metrics():
    return {'targets': engine.metrics, 'method': 'Chronological holdout: last 14 days of 96-day generated history; no future actual lag features.', 'limitations': 'Simulated requested demand. Imported completed-only history can conceal unmet demand. Error bands are illustrative MAE ranges, not calibrated probabilities.'}


@app.get('/api/requests')
def requests():
    return run(lambda db: [dict(r) for r in db.execute('SELECT * FROM requests ORDER BY id DESC')])


@app.post('/api/requests')
def create_request(body: RequestIn):
    return run(lambda db: core.create_request(db, engine, body.recipient_id, body.donor_id, body.kind, body.amount))


@app.post('/api/requests/{rid}/{action}')
def request_action(rid: int, action: str):
    return run(lambda db: core.transition(db, engine, rid, action))


@app.post('/api/reset')
def reset():
    global engine
    with core.connect() as db:
        core.seed(db)
        engine = core.ForecastEngine(db)
    return {'ok': True, 'clock': core.iso(core.START)}


@app.post('/api/replay')
def replay(body: ReplayIn):
    if body.kind not in ('cash', 'emoney'): raise HTTPException(400, 'Invalid exchange type')
    return run(lambda db: core.replay(db, engine, body.agent_id, body.amount, body.kind))


@app.get('/api/import/sample', response_class=PlainTextResponse)
def sample_csv():
    return PlainTextResponse('record_id,agent_id,timestamp,transaction_type,amount,status\nexample-001,A01,2026-10-06T10:00:00+06:00,cash_out,125000,requested\n', media_type='text/csv', headers={'Content-Disposition': 'attachment; filename="upay-flowcast-sample.csv"'})


@app.post('/api/import/preview')
async def import_preview(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 3_000_000: raise HTTPException(400, 'CSV must be 3 MB or smaller')
    return run(lambda db: core.preview_csv(db, content))


@app.post('/api/import/commit')
async def import_commit(file: UploadFile = File(...)):
    global engine
    content = await file.read()
    if len(content) > 3_000_000: raise HTTPException(400, 'CSV must be 3 MB or smaller')
    result = run(lambda db: core.import_csv(db, content))
    with core.connect() as db: engine = core.ForecastEngine(db)
    return result


# Production build: API and frontend share one origin. Static files are mounted
# after API registration; unknown API paths must remain JSON 404 responses.
app.mount('/assets', StaticFiles(directory=DIST_DIR / 'assets', check_dir=False), name='assets')


@app.get('/favicon.svg', include_in_schema=False)
def favicon():
    icon = DIST_DIR / 'favicon.svg'
    if not icon.is_file():
        raise HTTPException(status_code=404, detail='Favicon not built')
    return FileResponse(icon, media_type='image/svg+xml')


@app.get('/', include_in_schema=False)
@app.get('/{path:path}', include_in_schema=False)
def frontend(path: str = ''):
    if path == 'api' or path.startswith(('api/', 'assets/')) or path in ('docs', 'redoc', 'openapi.json'):
        raise HTTPException(status_code=404, detail='Not found')
    if '.' in Path(path).name:
        raise HTTPException(status_code=404, detail='Asset not found')
    index = DIST_DIR / 'index.html'
    if not index.is_file():
        raise HTTPException(status_code=503, detail='Frontend not built. Run npm run build.')
    return FileResponse(index, media_type='text/html')
