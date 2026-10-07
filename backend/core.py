from __future__ import annotations

import csv
import io
import json
import math
import random
import sqlite3
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Asia/Dhaka')
START = datetime(2026, 10, 7, 11, 0, tzinfo=TZ)
DB = Path(__file__).resolve().parent / 'flowcast.sqlite3'
STALE_MINUTES = 120
AREAS = [('Dhanmondi', 23.7465, 90.3760), ('Kalabagan', 23.7493, 90.3861), ('Panthapath', 23.7516, 90.3933), ('New Market', 23.7339, 90.3841), ('Mohammadpur', 23.7625, 90.3586), ('Shahbag', 23.7388, 90.3956)]
NAMES = ['Lake View Store', 'Satmasjid Telecom', 'Road 7 Traders', 'City Corner', 'Green Point', 'Azimpur Mart', 'Rafiq Digital', 'Bengal Variety', 'Metro Stationery', 'Shapla Store', 'Lalmatia Hub', 'Baitul Shop', 'Campus Corner', 'Nilkhet Books', 'Central Telecom', 'Garden Mart', 'Bridge Bazaar', 'Sunrise Store']


def now(db):
    return datetime.fromisoformat(db.execute("SELECT value FROM settings WHERE key='clock'").fetchone()[0])


def iso(dt):
    return dt.isoformat()


def money(v):
    return round(v / 100)


def apply_transaction(cash, emoney, kind, amount):
    if kind not in ('cash_in', 'cash_out') or amount <= 0:
        raise ValueError('Invalid transaction')
    dc, de = (amount, -amount) if kind == 'cash_in' else (-amount, amount)
    if cash + dc < 0 or emoney + de < 0:
        return None
    return cash + dc, emoney + de


def connect(path=DB):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def setup(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, name TEXT, area TEXT, lat REAL, lon REAL, open_hour INTEGER, close_hour INTEGER, cash INTEGER, emoney INTEGER, cash_reserve INTEGER, emoney_reserve INTEGER, confirmed_at TEXT, available INTEGER, distributor_id TEXT, limited INTEGER DEFAULT 0, is_distributor INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS history (record_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, timestamp TEXT NOT NULL, cash_in INTEGER NOT NULL, cash_out INTEGER NOT NULL, demand_count INTEGER NOT NULL, completed_count INTEGER NOT NULL, source TEXT NOT NULL, FOREIGN KEY(agent_id) REFERENCES agents(id));
    CREATE INDEX IF NOT EXISTS history_agent_time ON history(agent_id,timestamp);
    CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_id TEXT NOT NULL, donor_id TEXT NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, eta TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, before_json TEXT, after_json TEXT);
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT, at TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL);
    ''')


def seed(db):
    setup(db)
    db.executescript('DELETE FROM events; DELETE FROM requests; DELETE FROM history; DELETE FROM agents; DELETE FROM settings; DELETE FROM sqlite_sequence;')
    db.execute('INSERT INTO settings VALUES (?,?)', ('clock', iso(START)))
    rng = random.Random(4107)
    agents = []
    for i, name in enumerate(NAMES):
        area, lat, lon = AREAS[i % len(AREAS)]
        if i == 2: area, lat, lon = 'Dhanmondi', 23.7470, 90.3766
        cash = 12500000 + (i % 5) * 2000000
        emoney = 12500000 + (i % 4) * 1600000
        if i == 0: cash, emoney = 8000000, 17000000
        if i == 1: cash, emoney = 18000000, 5700000
        if i == 2: cash, emoney = 2000000, 5700000  # close, but unsafe
        if i == 3: cash, emoney = 35000000, 30000000  # genuinely safe donor
        if i == 4: cash, emoney = 21000000, 22000000
        confirmed = START - timedelta(hours=5 if i == 4 else 0, minutes=25)
        agents.append((f'A{i+1:02}', name, area, lat + (i // 6) * .002, lon + (i // 6) * .002, 9, 21, cash, emoney, 5000000, 5000000, iso(confirmed), 1, 'D01', int(i == 17), 0))
    agents.append(('D01', 'Dhaka Central Distributor', 'Dhanmondi', 23.7475, 90.3790, 8, 22, 200000000, 200000000, 20000000, 20000000, iso(START - timedelta(minutes=15)), 1, None, 0, 1))
    db.executemany('INSERT INTO agents VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', agents)
    rows = []
    begin = START - timedelta(days=96)
    for agent in agents[:-1]:
        aid = agent[0]
        idx = int(aid[1:]) - 1
        base = 2000000 if idx == 0 else 240000 if idx != 16 else 35000
        if idx == 17: begin_agent = START - timedelta(days=9)
        else: begin_agent = begin
        t = begin_agent
        while t < START:
            h, wd = t.hour, t.weekday()
            activity = .15 if h < 9 or h >= 21 else (.7 if h < 11 else 1.25 if 12 <= h <= 16 else .95)
            activity *= 1.15 if wd in (4, 5) else 1
            activity *= 1.35 if t.day <= 7 else 1
            volume = base * activity * rng.uniform(.68, 1.33)
            bias = 1.5 if idx == 0 else .63 if idx == 1 else 1.15 if idx == 2 else 1 + (idx % 4 - 1.5) * .10
            cash_out = int(volume * bias)
            cash_in = int(volume * (2 - min(bias, 1.7)) * rng.uniform(.83, 1.17))
            count = max(1, round((cash_in + cash_out) / rng.randint(35000, 70000)))
            rows.append((f'seed:{aid}:{iso(t)}', aid, iso(t), cash_in, cash_out, count, count, 'seed_requested'))
            t += timedelta(hours=1)
    db.executemany('INSERT INTO history VALUES (?,?,?,?,?,?,?,?)', rows)
    db.execute('INSERT INTO events(agent_id,at,kind,detail) VALUES (?,?,?,?)', ('A03', iso(START - timedelta(days=2)), 'correction', 'Historical balance correction recorded in seeded demo'))
    db.commit()


def ensure(db):
    setup(db)
    if not db.execute('SELECT 1 FROM agents LIMIT 1').fetchone(): seed(db)


def agent(db, aid):
    row = db.execute('SELECT * FROM agents WHERE id=?', (aid,)).fetchone()
    if not row: raise ValueError('Unknown agent')
    return dict(row)


def all_agents(db):
    return [dict(r) for r in db.execute('SELECT * FROM agents WHERE is_distributor=0 ORDER BY id')]


def stale(a, clock):
    return (clock - datetime.fromisoformat(a['confirmed_at'])).total_seconds() > STALE_MINUTES * 60


def open_at(a, at):
    return bool(a['available']) and a['open_hour'] <= at.hour < a['close_hour']


def history(db, aid=None, limit=None):
    q = 'SELECT * FROM history'
    params = []
    if aid: q += ' WHERE agent_id=?'; params.append(aid)
    q += ' ORDER BY timestamp'
    if limit: q += ' LIMIT ?'; params.append(limit)
    return [dict(r) for r in db.execute(q, params)]


def features(aid, dt):
    # All features are known before the predicted hour, including for multi-hour forecasts.
    return [int(aid[1:]), dt.hour, dt.weekday(), int(dt.day <= 7)]


class ForecastEngine:
    def __init__(self, db):
        self.rows = history(db)
        self.by_agent = defaultdict(list)
        for r in self.rows: self.by_agent[r['agent_id']].append(r)
        self.metrics = {}
        self.models = {}
        self.full_stats = self.make_stats(self.rows)
        self.fit()

    @staticmethod
    def make_stats(rows):
        stats = defaultdict(lambda: [0, 0])
        for r in rows:
            dt = datetime.fromisoformat(r['timestamp'])
            for target in ('cash_in', 'cash_out', 'demand_count'):
                for key in ((r['agent_id'], dt.weekday(), dt.hour, target), (r['agent_id'], None, dt.hour, target)):
                    stats[key][0] += r[target]
                    stats[key][1] += 1
        return stats

    def baseline(self, aid, dt, target, cutoff=None):
        stats = self.train_stats if cutoff else self.full_stats
        total, count = stats[(aid, dt.weekday(), dt.hour, target)]
        if not count: total, count = stats[(aid, None, dt.hour, target)]
        return total / count if count else 0

    def fit(self):
        try:
            from sklearn.ensemble import RandomForestRegressor
        except ImportError:
            RandomForestRegressor = None
        ordered = sorted((r for r in self.rows if r['agent_id'] != 'A18'), key=lambda r: r['timestamp'])
        split = START - timedelta(days=14)
        train = [r for r in ordered if r['timestamp'] < iso(split)]
        val = [r for r in ordered if r['timestamp'] >= iso(split)]
        self.train_stats = self.make_stats(train)
        # A deterministic sample keeps local startup quick while retaining all agents and hours.
        train = train[::3]
        xtrain = [features(r['agent_id'], datetime.fromisoformat(r['timestamp'])) for r in train]
        xval = [features(r['agent_id'], datetime.fromisoformat(r['timestamp'])) for r in val]
        for target in ('cash_in', 'cash_out', 'demand_count'):
            model = RandomForestRegressor(n_estimators=24, max_depth=11, min_samples_leaf=6, random_state=4107, n_jobs=2) if RandomForestRegressor else None
            if model is not None: model.fit(xtrain, [r[target] for r in train])
            baseline_errors = [abs(r[target] - self.baseline(r['agent_id'], datetime.fromisoformat(r['timestamp']), target, split)) for r in val]
            model_errors = [abs(r[target] - float(p)) for r, p in zip(val, model.predict(xval))] if model is not None else []
            b = sum(baseline_errors) / len(baseline_errors)
            m = sum(model_errors) / len(model_errors) if model_errors else None
            self.models[target] = model
            self.metrics[target] = {'baseline_mae': round(b, 1), 'model_mae': round(m, 1) if m is not None else None, 'selected': 'model' if m is not None and m < b else 'baseline', 'samples': len(val), 'train_end': iso(split), 'validation_end': iso(START), 'error_band': round(min(b, m) if m is not None else b, 1)}

    def predict(self, aid, dt, target):
        if len(self.by_agent[aid]) < 24 * 30:
            peers = [a for a in self.by_agent if a != aid and a != 'A18']
            return sum(self.baseline(a, dt, target) for a in peers) / len(peers), 'peer fallback'
        metric = self.metrics[target]
        if metric['selected'] == 'model' and self.models[target] is not None:
            return max(0, float(self.models[target].predict([features(aid, dt)])[0])), 'Random Forest'
        return max(0, self.baseline(aid, dt, target)), 'historical baseline'


def forecast(db, engine, aid):
    a = agent(db, aid)
    clock = now(db)
    cash, emoney = a['cash'], a['emoney']
    buckets = []
    for i in range(1, 7):
        dt = clock.replace(minute=0, second=0, microsecond=0) + timedelta(hours=i)
        ci, method = engine.predict(aid, dt, 'cash_in')
        co, _ = engine.predict(aid, dt, 'cash_out')
        count, _ = engine.predict(aid, dt, 'demand_count')
        cash += round(ci - co)
        emoney += round(co - ci)
        band = round((engine.metrics['cash_in']['error_band'] + engine.metrics['cash_out']['error_band']) * math.sqrt(i))
        buckets.append({'time': iso(dt), 'cash_in': round(ci), 'cash_out': round(co), 'demand_count': round(count), 'cash': cash, 'emoney': emoney, 'range_half_width': band})
    minimum_cash = min(b['cash'] for b in buckets)
    minimum_emoney = min(b['emoney'] for b in buckets)
    breach_cash = next((b['time'] for b in buckets if b['cash'] < a['cash_reserve']), None)
    breach_emoney = next((b['time'] for b in buckets if b['emoney'] < a['emoney_reserve']), None)
    negative = next((i for i, b in enumerate(buckets) if b['cash'] < 0 or b['emoney'] < 0), None)
    breaches = [(i, k, b['time']) for i, b in enumerate(buckets) for k, key, reserve in [('cash', 'cash', a['cash_reserve']), ('emoney', 'emoney', a['emoney_reserve'])] if b[key] < reserve]
    first = min(breaches) if breaches else None
    risk = 'High' if negative is not None or first and first[0] <= 1 else 'Medium' if first else 'Low'
    if stale(a, clock): risk = 'Needs confirmation'
    kind = first[1] if first else None
    topup = {'cash': max(0, a['cash_reserve'] - minimum_cash), 'emoney': max(0, a['emoney_reserve'] - minimum_emoney)}
    when = datetime.fromisoformat(first[2]).strftime('%-I:%M %p') if first else ''
    if first:
        reserve = a[f'{kind}_reserve']
        explanation_en = f"{kind.replace('emoney','e-money').capitalize()} may fall below the ৳{money(reserve):,} reserve around {when}. Prepare about ৳{money(topup[kind]):,} additional {kind.replace('emoney','e-money')}."
        explanation_bn = f"{when} নাগাদ {('নগদ' if kind == 'cash' else 'ই-মানি')} ৳{money(reserve):,} সংরক্ষণের নিচে যেতে পারে। প্রায় ৳{money(topup[kind]):,} যোগ করুন।"
    else:
        explanation_en = 'Both balances remain above their reserves for the next six hours.'
        explanation_bn = 'পরবর্তী ছয় ঘণ্টায় উভয় ব্যালেন্স সংরক্ষণের ওপরে থাকবে।'
    if stale(a, clock):
        explanation_en = 'Balance needs confirmation. ' + explanation_en
        explanation_bn = 'ব্যালেন্স নিশ্চিত করা দরকার। ' + explanation_bn
    return {'agent': a, 'clock': iso(clock), 'buckets': buckets, 'minimum_cash': minimum_cash, 'minimum_emoney': minimum_emoney, 'breach_cash': breach_cash, 'breach_emoney': breach_emoney, 'earliest_breach': first[2] if first else None, 'kind': kind, 'required': topup, 'risk': risk, 'stale': stale(a, clock), 'method': method, 'limited_history': len(engine.by_agent[aid]) < 24 * 30, 'explanation_en': explanation_en, 'explanation_bn': explanation_bn, 'range_method': '± historical validation MAE of selected cash-in and cash-out methods, scaled by square root of hours; illustrative, not a probability.'}


def distance(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (a['lat'], a['lon'], b['lat'], b['lon']))
    dlat, dlon = lat2-lat1, lon2-lon1
    return 6371 * 2 * math.asin(math.sqrt(math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2))


def commitments(db, aid, exclude=None):
    cash = emoney = 0
    for r in db.execute("SELECT * FROM requests WHERE status='Accepted' AND id IS NOT ? AND (recipient_id=? OR donor_id=?)", (exclude, aid, aid)):
        x = r['amount']
        sign = 1 if r['recipient_id'] == aid else -1
        cash += sign * x if r['kind'] == 'cash' else -sign * x
        emoney -= sign * x if r['kind'] == 'cash' else -sign * x
    return cash, emoney


def safe_capacity(db, engine, recipient_id, donor_id, kind, exclude=None):
    a, b = agent(db, recipient_id), agent(db, donor_id)
    af, bf = forecast(db, engine, recipient_id), forecast(db, engine, donor_id)
    ac, ae = commitments(db, recipient_id, exclude)
    bc, be = commitments(db, donor_id, exclude)
    if kind == 'cash':
        return max(0, min(min(a['emoney'], af['minimum_emoney']) + ae - a['emoney_reserve'], min(b['cash'], bf['minimum_cash']) + bc - b['cash_reserve']))
    return max(0, min(min(a['cash'], af['minimum_cash']) + ac - a['cash_reserve'], min(b['emoney'], bf['minimum_emoney']) + be - b['emoney_reserve']))


def recommendations(db, engine, aid):
    f = forecast(db, engine, aid)
    kind = f['kind'] or ('cash' if f['required']['cash'] >= f['required']['emoney'] else 'emoney')
    required = f['required'][kind]
    recipient = f['agent']
    clock = now(db)
    candidates = []
    for donor in [*all_agents(db), agent(db, 'D01')]:
        if donor['id'] == aid: continue
        km = distance(recipient, donor)
        minutes = math.ceil(12 + km / 15 * 60)
        eta = clock + timedelta(minutes=minutes)
        capacity = safe_capacity(db, engine, aid, donor['id'], kind)
        reasons = []
        if stale(recipient, clock): reasons.append('Recipient balance needs confirmation')
        if stale(donor, clock): reasons.append('Balance needs confirmation')
        if not open_at(recipient, eta): reasons.append('Recipient closed or unavailable at arrival')
        if not open_at(donor, eta): reasons.append('Closed or unavailable at arrival')
        if f['earliest_breach'] and eta >= datetime.fromisoformat(f['earliest_breach']): reasons.append('Arrival after expected breach')
        if capacity <= 0: reasons.append('No safe projected surplus after both reserves and commitments')
        if not required: reasons.append('No top-up currently needed')
        suitable = not reasons
        candidates.append({'id': donor['id'], 'name': donor['name'], 'area': donor['area'], 'distance_km': round(km, 2), 'travel_minutes': minutes, 'eta': iso(eta), 'safe_available': capacity, 'suggested_amount': min(required, capacity) if suitable else 0, 'suitable': suitable, 'reason': 'Can help while preserving both participants’ reserves' if suitable else '; '.join(reasons), 'distributor': bool(donor['is_distributor'])})
    candidates.sort(key=lambda x: (not x['suitable'], x['distributor'], x['distance_km'], -x['suggested_amount']))
    return {'kind': kind, 'required': required, 'candidates': candidates, 'travel_method': 'Estimate: 12-minute handling plus distance at 15 km/h; no live traffic or map service.'}


def create_request(db, engine, recipient_id, donor_id, kind, amount):
    if recipient_id == donor_id: raise ValueError('Recipient and donor must differ')
    if kind not in ('cash', 'emoney') or not isinstance(amount, int) or amount <= 0: raise ValueError('Enter a positive amount and valid exchange type')
    rec = recommendations(db, engine, recipient_id)
    if rec['kind'] != kind: raise ValueError('Exchange type does not match current need')
    c = next((x for x in rec['candidates'] if x['id'] == donor_id), None)
    if not c or not c['suitable'] or amount > c['safe_available']: raise ValueError('Candidate cannot safely provide that amount')
    clock = now(db)
    cur = db.execute('INSERT INTO requests(recipient_id,donor_id,kind,amount,status,eta,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', (recipient_id, donor_id, kind, amount, 'Pending', c['eta'], iso(clock), iso(clock)))
    db.execute('INSERT INTO events(agent_id,at,kind,detail) VALUES (?,?,?,?)', (recipient_id, iso(clock), 'request', f'Request #{cur.lastrowid} created for ৳{money(amount):,} {kind}'))
    db.commit()
    return request(db, cur.lastrowid)


def request(db, rid):
    row = db.execute('SELECT * FROM requests WHERE id=?', (rid,)).fetchone()
    if not row: raise ValueError('Unknown request')
    return dict(row)


def transition(db, engine, rid, action):
    db.execute('BEGIN IMMEDIATE')
    try:
        r = request(db, rid)
        if action == 'complete' and r['status'] == 'Completed': db.commit(); return r
        allowed = {'accept': ('Pending', 'Accepted'), 'reject': ('Pending', 'Rejected'), 'cancel': ('Pending', 'Cancelled'), 'complete': ('Accepted', 'Completed')}
        if action not in allowed or r['status'] != allowed[action][0]: raise ValueError(f'Cannot {action} a {r["status"].lower()} request')
        clock = now(db)
        if action in ('accept', 'complete'):
            capacity = safe_capacity(db, engine, r['recipient_id'], r['donor_id'], r['kind'], rid if action == 'complete' else None)
            if r['amount'] > capacity: raise ValueError('Insufficient safe capacity after other accepted commitments')
        before = after = None
        if action == 'complete':
            clock = max(clock, datetime.fromisoformat(r['eta']))
            db.execute("UPDATE settings SET value=? WHERE key='clock'", (iso(clock),))
            a, b = agent(db, r['recipient_id']), agent(db, r['donor_id'])
            sign = 1 if r['kind'] == 'cash' else -1
            delta_cash = sign * r['amount']
            delta_emoney = -delta_cash
            if min(a['cash']+delta_cash, a['emoney']+delta_emoney, b['cash']-delta_cash, b['emoney']-delta_emoney) < 0: raise ValueError('Insufficient current balance')
            before = json.dumps({a['id']: {'cash': a['cash'], 'emoney': a['emoney']}, b['id']: {'cash': b['cash'], 'emoney': b['emoney']}})
            db.execute('UPDATE agents SET cash=cash+?,emoney=emoney+?,confirmed_at=? WHERE id=?', (delta_cash, delta_emoney, iso(clock), a['id']))
            db.execute('UPDATE agents SET cash=cash-?,emoney=emoney-?,confirmed_at=? WHERE id=?', (delta_cash, delta_emoney, iso(clock), b['id']))
            after = json.dumps({a['id']: {'cash': a['cash']+delta_cash, 'emoney': a['emoney']+delta_emoney}, b['id']: {'cash': b['cash']-delta_cash, 'emoney': b['emoney']-delta_emoney}})
        new = allowed[action][1]
        db.execute('UPDATE requests SET status=?,updated_at=?,before_json=COALESCE(?,before_json),after_json=COALESCE(?,after_json) WHERE id=?', (new, iso(clock), before, after, rid))
        for aid in (r['recipient_id'], r['donor_id']):
            db.execute('INSERT INTO events(agent_id,at,kind,detail) VALUES (?,?,?,?)', (aid, iso(clock), 'rebalance', f'Request #{rid} {new.lower()}: ৳{money(r["amount"]):,} {r["kind"]}'))
        db.commit()
        return request(db, rid)
    except Exception:
        db.rollback()
        raise


def confirm(db, aid, cash, emoney, reason):
    if min(cash, emoney) < 0: raise ValueError('Balances cannot be negative')
    a = agent(db, aid)
    clock = now(db)
    db.execute('UPDATE agents SET cash=?,emoney=?,confirmed_at=? WHERE id=?', (cash, emoney, iso(clock), aid))
    detail = json.dumps({'before': {'cash': a['cash'], 'emoney': a['emoney']}, 'after': {'cash': cash, 'emoney': emoney}, 'reason': reason or 'Counted balance confirmed'})
    db.execute('INSERT INTO events(agent_id,at,kind,detail) VALUES (?,?,?,?)', (aid, iso(clock), 'correction', detail))
    db.commit()
    return {'before': {'cash': a['cash'], 'emoney': a['emoney']}, 'after': {'cash': cash, 'emoney': emoney}, 'at': iso(clock)}


def summary(db, engine):
    fs = [forecast(db, engine, a['id']) for a in all_agents(db)]
    clock = now(db)
    return {'clock': iso(clock), 'open': sum(open_at(f['agent'], clock) for f in fs), 'high_risk': sum(f['risk'] == 'High' for f in fs), 'cash_breaches': sum(bool(f['breach_cash']) for f in fs), 'emoney_breaches': sum(bool(f['breach_emoney']) for f in fs), 'stale': sum(f['stale'] for f in fs), 'demand_count': sum(sum(b['demand_count'] for b in f['buckets']) for f in fs), 'pending': db.execute("SELECT count(*) FROM requests WHERE status='Pending'").fetchone()[0], 'accepted': db.execute("SELECT count(*) FROM requests WHERE status='Accepted'").fetchone()[0], 'agents': fs}


def preview_csv(db, content):
    try: reader = csv.DictReader(io.StringIO(content.decode('utf-8-sig')))
    except UnicodeError: raise ValueError('CSV must be UTF-8')
    required = {'agent_id', 'timestamp', 'transaction_type', 'amount', 'status'}
    if not reader.fieldnames or not required.issubset(reader.fieldnames): raise ValueError('Missing required CSV columns: ' + ', '.join(sorted(required)))
    errors, parsed = [], []
    seen = set()
    for n, row in enumerate(reader, 2):
        try:
            aid = row['agent_id']
            agent(db, aid)
            dt = datetime.fromisoformat(row['timestamp'])
            if dt.tzinfo is None: raise ValueError('timestamp needs a timezone offset')
            if row['transaction_type'] not in ('cash_in', 'cash_out'): raise ValueError('transaction_type must be cash_in or cash_out')
            if row['status'] not in ('requested', 'completed', 'failed'): raise ValueError('status must be requested, completed, or failed')
            amount = int(row['amount'])
            if amount <= 0: raise ValueError('amount must be positive integer paisa')
            rid = (row.get('record_id') or f"{aid}|{iso(dt)}|{row['transaction_type']}|{amount}|{row['status']}").strip()
            if rid in seen or db.execute('SELECT 1 FROM history WHERE record_id=?', ('csv:'+rid,)).fetchone(): raise ValueError('duplicate record')
            seen.add(rid)
            parsed.append({'record_id': 'csv:'+rid, 'agent_id': aid, 'timestamp': iso(dt), 'cash_in': amount if row['transaction_type']=='cash_in' else 0, 'cash_out': amount if row['transaction_type']=='cash_out' else 0, 'demand_count': 1, 'completed_count': int(row['status']=='completed'), 'source': 'csv_'+row['status']})
        except (ValueError, TypeError) as e: errors.append({'row': n, 'message': str(e)})
    return {'rows': parsed, 'errors': errors, 'valid_count': len(parsed)}


def import_csv(db, content):
    result = preview_csv(db, content)
    if result['errors']: raise ValueError(f"Import blocked: {len(result['errors'])} invalid row(s). Preview for details.")
    db.executemany('INSERT INTO history VALUES (?,?,?,?,?,?,?,?)', [tuple(r[k] for k in ('record_id','agent_id','timestamp','cash_in','cash_out','demand_count','completed_count','source')) for r in result['rows']])
    db.commit()
    return {'imported': len(result['rows'])}


def replay(db, engine, aid, amount=None, kind='cash', completion=None):
    f = forecast(db, engine, aid)
    a = f['agent']
    clock = now(db)
    completed = db.execute("SELECT * FROM requests WHERE recipient_id=? AND status='Completed' ORDER BY id DESC LIMIT 1", (aid,)).fetchone()
    if completed and completed['before_json']:
        clock = datetime.fromisoformat(completed['created_at'])
        original = json.loads(completed['before_json'])[aid]
        a = {**a, **original}
        amount = completed['amount']
        kind = completed['kind']
        completion = datetime.fromisoformat(completed['eta'])
    amount = amount if amount is not None else f['required'][kind]
    completion = completion or clock + timedelta(minutes=30)
    rng = random.Random(8300 + int(aid[1:]))
    attempts = []
    for i, bucket in enumerate(f['buckets']):
        start = datetime.fromisoformat(bucket['time']) - timedelta(hours=1)
        for typ, total in [('cash_in', bucket['cash_in']), ('cash_out', bucket['cash_out'])]:
            if total <= 0:
                continue
            count = min(total, max(1, round(bucket['demand_count']/2)))
            parts = [total // count] * count
            parts[-1] += total - sum(parts)
            for j, value in enumerate(parts):
                attempts.append((start + timedelta(minutes=(j * 53 // count) + rng.randrange(0, 5)), typ, value))
    attempts.sort(key=lambda x: x[0])
    def run(intervene):
        cash, emoney = a['cash'], a['emoney']
        served = unserved = 0
        applied = False
        for at, typ, value in attempts:
            if intervene and not applied and at >= completion:
                cash += amount if kind == 'cash' else -amount
                emoney += -amount if kind == 'cash' else amount
                applied = True
            result = apply_transaction(cash, emoney, typ, value)
            if result is not None:
                cash, emoney = result; served += 1
            else: unserved += 1
        return {'attempted': len(attempts), 'served': served, 'unserved': unserved, 'service_rate': round(served / len(attempts) * 100, 1) if attempts else 100}
    before, after = run(False), run(True)
    projected_cash, projected_emoney = a['cash'], a['emoney']
    first_breach = None
    for bucket in f['buckets']:
        projected_cash += bucket['cash_in'] - bucket['cash_out']
        projected_emoney += bucket['cash_out'] - bucket['cash_in']
        if projected_cash < a['cash_reserve'] or projected_emoney < a['emoney_reserve']:
            first_breach = datetime.fromisoformat(bucket['time'])
            break
    lead = round((first_breach - clock).total_seconds()/60) if first_breach else None
    return {'without': before, 'with': after, 'amount': amount, 'kind': kind, 'completion': iso(completion), 'alert_lead_minutes': lead, 'attempts_identical': True, 'note': 'Simulation outcomes use one seeded demand sequence. Failed attempts do not change balances; exchange applies at its scheduled time.'}
