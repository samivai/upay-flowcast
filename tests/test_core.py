import pytest

from backend import core


@pytest.fixture
def scenario(tmp_path):
    db = core.connect(tmp_path / 'test.sqlite3')
    core.seed(db)
    engine = core.ForecastEngine(db)
    yield db, engine
    db.close()


def test_transaction_directions_and_no_negative_balance():
    assert core.apply_transaction(1000, 1000, 'cash_in', 200) == (1200, 800)
    assert core.apply_transaction(1000, 1000, 'cash_out', 200) == (800, 1200)
    assert core.apply_transaction(100, 1000, 'cash_out', 200) is None
    assert core.apply_transaction(1000, 100, 'cash_in', 200) is None


def test_forecast_breach_and_topup(scenario):
    db, engine = scenario
    f = core.forecast(db, engine, 'A01')
    assert f['risk'] == 'High'
    assert f['breach_cash']
    assert f['required']['cash'] == max(0, f['agent']['cash_reserve'] - min(b['cash'] for b in f['buckets']))
    for before, after in zip([{'cash': f['agent']['cash'], 'emoney': f['agent']['emoney']}] + f['buckets'][:-1], f['buckets']):
        assert after['cash'] == before['cash'] + after['cash_in'] - after['cash_out'] or abs(after['cash'] - before['cash'] - after['cash_in'] + after['cash_out']) <= 1
        assert before['cash'] + before['emoney'] == after['cash'] + after['emoney']


def test_safe_donor_and_unsafe_nearby(scenario):
    db, engine = scenario
    rec = core.recommendations(db, engine, 'A01')
    by_id = {c['id']: c for c in rec['candidates']}
    assert by_id['A04']['suitable']
    assert not by_id['A03']['suitable']
    assert by_id['A03']['distance_km'] < by_id['A04']['distance_km']
    with pytest.raises(ValueError):
        core.create_request(db, engine, 'A01', 'A03', 'cash', 10000)


def test_exchange_conservation_and_duplicate_completion(scenario):
    db, engine = scenario
    before_a, before_b = core.agent(db, 'A01'), core.agent(db, 'A04')
    r = core.create_request(db, engine, 'A01', 'A04', 'cash', 1_000_000)
    assert core.agent(db, 'A01')['cash'] == before_a['cash']
    core.transition(db, engine, r['id'], 'accept')
    core.transition(db, engine, r['id'], 'complete')
    after_a, after_b = core.agent(db, 'A01'), core.agent(db, 'A04')
    assert core.now(db) >= core.START
    assert core.iso(core.now(db)) == r['eta']
    assert after_a['cash'] - before_a['cash'] == 1_000_000
    assert after_a['emoney'] - before_a['emoney'] == -1_000_000
    assert after_b['cash'] - before_b['cash'] == -1_000_000
    assert after_b['emoney'] - before_b['emoney'] == 1_000_000
    assert sum(x['cash'] + x['emoney'] for x in (before_a,before_b)) == sum(x['cash'] + x['emoney'] for x in (after_a,after_b))
    assert core.transition(db, engine, r['id'], 'complete')['status'] == 'Completed'
    assert core.agent(db, 'A01') == after_a
    assert core.replay(db, engine, 'A01')['alert_lead_minutes'] > 0


def test_accepted_reservations_prevent_overcommit(scenario):
    db, engine = scenario
    cap = core.safe_capacity(db, engine, 'A01', 'A04', 'cash')
    first = core.create_request(db, engine, 'A01', 'A04', 'cash', cap - 10000)
    second = core.create_request(db, engine, 'A01', 'A04', 'cash', 20000)
    core.transition(db, engine, first['id'], 'accept')
    with pytest.raises(ValueError, match='Insufficient safe capacity'):
        core.transition(db, engine, second['id'], 'accept')


def test_stale_balance_and_limited_history(scenario):
    db, engine = scenario
    assert core.forecast(db, engine, 'A05')['risk'] == 'Needs confirmation'
    assert core.forecast(db, engine, 'A18')['limited_history']
    assert core.forecast(db, engine, 'A18')['method'] == 'peer fallback'


def test_csv_validation_and_duplicates(scenario):
    db, _ = scenario
    bad = b'agent_id,timestamp,transaction_type,amount,status\nA01,2026-10-01T10:00:00,cash_out,-5,failed\nBAD,2026-10-01T10:00:00+06:00,cash_in,100,requested\n'
    result = core.preview_csv(db, bad)
    assert [e['row'] for e in result['errors']] == [2,3]
    good = b'record_id,agent_id,timestamp,transaction_type,amount,status\nx1,A01,2026-10-01T10:00:00+06:00,cash_out,100,failed\n'
    assert core.import_csv(db, good)['imported'] == 1
    assert core.preview_csv(db, good)['errors'][0]['message'] == 'duplicate record'
    assert db.execute("SELECT completed_count FROM history WHERE record_id='csv:x1'").fetchone()[0] == 0


def test_identical_replay_and_scheduled_intervention(scenario):
    db, engine = scenario
    result = core.replay(db, engine, 'A01')
    assert result['attempts_identical']
    assert result['without']['attempted'] == result['with']['attempted']
    assert result['without']['served'] + result['without']['unserved'] == result['without']['attempted']
    assert result['with']['served'] >= result['without']['served']
    assert result['with']['unserved'] < result['without']['unserved']
