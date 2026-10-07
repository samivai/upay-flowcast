import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  LayoutDashboard,
  Menu,
  RefreshCcw,
  Search,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Agent = {
  id: string;
  name: string;
  area: string;
  cash: number;
  emoney: number;
  cash_reserve: number;
  emoney_reserve: number;
  confirmed_at: string;
  available: number;
  is_distributor: number;
};
type Bucket = {
  time: string;
  cash_in: number;
  cash_out: number;
  demand_count: number;
  cash: number;
  emoney: number;
  range_half_width: number;
};
type Forecast = {
  agent: Agent;
  clock: string;
  buckets: Bucket[];
  minimum_cash: number;
  minimum_emoney: number;
  breach_cash: string | null;
  breach_emoney: string | null;
  earliest_breach: string | null;
  kind: "cash" | "emoney" | null;
  required: { cash: number; emoney: number };
  risk: string;
  stale: boolean;
  method: string;
  limited_history: boolean;
  explanation_en: string;
  explanation_bn: string;
  range_method: string;
};
type Candidate = {
  id: string;
  name: string;
  area: string;
  distance_km: number;
  travel_minutes: number;
  eta: string;
  safe_available: number;
  suggested_amount: number;
  suitable: boolean;
  reason: string;
  distributor: boolean;
};
type Recommendations = {
  kind: "cash" | "emoney";
  required: number;
  candidates: Candidate[];
  travel_method: string;
};
type Request = {
  id: number;
  recipient_id: string;
  donor_id: string;
  kind: string;
  amount: number;
  status: string;
  eta: string;
  created_at: string;
  before_json: string | null;
  after_json: string | null;
};
type Summary = {
  clock: string;
  open: number;
  high_risk: number;
  cash_breaches: number;
  emoney_breaches: number;
  stale: number;
  demand_count: number;
  pending: number;
  accepted: number;
  agents: Forecast[];
};
type Metrics = {
  targets: Record<
    string,
    {
      baseline_mae: number;
      model_mae: number | null;
      selected: string;
      samples: number;
      train_end: string;
      validation_end: string;
      error_band: number;
    }
  >;
  method: string;
  limitations: string;
};
type Replay = {
  without: {
    attempted: number;
    served: number;
    unserved: number;
    service_rate: number;
  };
  with: {
    attempted: number;
    served: number;
    unserved: number;
    service_rate: number;
  };
  amount: number;
  kind: string;
  completion: string;
  alert_lead_minutes: number | null;
  attempts_identical: boolean;
  note: string;
};
type Page =
  | "dashboard"
  | "alerts"
  | "rebalance"
  | "confirm"
  | "activity"
  | "overview"
  | "details"
  | "operations"
  | "performance"
  | "import"
  | "demo";

const API = "/api";
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, init);
  if (!r.ok) {
    const body = await r.json().catch(() => ({ detail: r.statusText }));
    throw Error(body.detail || "Request failed");
  }
  return r.json();
}
const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
const taka = (n: number) => "৳" + Math.round(n / 100).toLocaleString("en-BD");
const time = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("en-BD", {
        timeZone: "Asia/Dhaka",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(v))
    : "—";
const dateTime = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("en-BD", {
        timeZone: "Asia/Dhaka",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(v))
    : "—";
const labels = {
  en: {
    dashboard: "Dashboard",
    alerts: "Alerts",
    rebalance: "Rebalance",
    confirm: "Confirm balance",
    activity: "Activity",
    overview: "Overview",
    details: "Agent details",
    operations: "Operations",
    performance: "Model performance",
    import: "Import CSV",
    demo: "Demo walkthrough",
    agent: "Agent view",
    supervisor: "Supervisor view",
    cash: "Cash",
    emoney: "E-money",
    reserve: "Safe reserve",
    forecast: "Six-hour forecast",
    action: "Recommended action",
    options: "Find options",
    request: "Request exchange",
    complete: "Complete",
    accept: "Accept",
    reject: "Reject",
    cancel: "Cancel",
    current: "Current balance",
    demand: "Forecast demand",
    warning: "Liquidity warning",
    allclear: "No reserve breach expected",
    reset: "Reset demo",
    simulation: "Simulated data",
    prototype: "Hackathon prototype",
  },
  bn: {
    dashboard: "ড্যাশবোর্ড",
    alerts: "সতর্কতা",
    rebalance: "ব্যালেন্স বিনিময়",
    confirm: "ব্যালেন্স নিশ্চিত",
    activity: "কার্যক্রম",
    overview: "সারসংক্ষেপ",
    details: "এজেন্ট বিবরণ",
    operations: "অনুরোধ",
    performance: "মডেল ফলাফল",
    import: "CSV আমদানি",
    demo: "ডেমো নির্দেশিকা",
    agent: "এজেন্ট ভিউ",
    supervisor: "সুপারভাইজার ভিউ",
    cash: "নগদ",
    emoney: "ই-মানি",
    reserve: "নিরাপদ সংরক্ষণ",
    forecast: "ছয় ঘণ্টার পূর্বাভাস",
    action: "প্রস্তাবিত পদক্ষেপ",
    options: "বিকল্প দেখুন",
    request: "বিনিময় অনুরোধ",
    complete: "সম্পন্ন",
    accept: "গ্রহণ",
    reject: "প্রত্যাখ্যান",
    cancel: "বাতিল",
    current: "বর্তমান ব্যালেন্স",
    demand: "সম্ভাব্য লেনদেন",
    warning: "ব্যালেন্স সতর্কতা",
    allclear: "সংরক্ষণের নিচে যাওয়ার আশঙ্কা নেই",
    reset: "ডেমো রিসেট",
    simulation: "সিমুলেটেড তথ্য",
    prototype: "হ্যাকাথন প্রোটোটাইপ",
  },
};
const agentNav: Page[] = [
  "dashboard",
  "alerts",
  "rebalance",
  "confirm",
  "activity",
];
const supervisorNav: Page[] = [
  "overview",
  "details",
  "operations",
  "performance",
  "import",
];
const icons: Record<Page, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  alerts: Bell,
  rebalance: ArrowLeftRight,
  confirm: Wallet,
  activity: Activity,
  overview: LayoutDashboard,
  details: Users,
  operations: ArrowLeftRight,
  performance: BarChart3,
  import: Upload,
  demo: CircleHelp,
};
function Badge({ risk, lang = "en" }: { risk: string; lang?: "en" | "bn" }) {
  const bn: Record<string, string> = {
    High: "উচ্চ",
    Medium: "মাঝারি",
    Low: "কম",
    "Needs confirmation": "নিশ্চিত করুন",
  };
  return (
    <span className={"badge " + risk.toLowerCase().replaceAll(" ", "-")}>
      {lang === "bn" ? bn[risk] || risk : risk}
    </span>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export default function App() {
  const [role, setRole] = useState<"agent" | "supervisor">("agent");
  const [page, setPage] = useState<Page>("dashboard");
  const [lang, setLang] = useState<"en" | "bn">(
    (localStorage.getItem("flowcast-lang") as "en" | "bn") || "en",
  );
  const [aid, setAid] = useState("A01");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [rec, setRec] = useState<Recommendations | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<{
    events: { id: number; at: string; kind: string; detail: string }[];
    transactions: {
      record_id: string;
      timestamp: string;
      cash_in: number;
      cash_out: number;
      completed_count: number;
    }[];
  } | null>(null);
  const [history, setHistory] = useState<
    { timestamp: string; cash_in: number; cash_out: number }[]
  >([]);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [chartKind, setChartKind] = useState<"cash" | "emoney">("cash");
  const [amount, setAmount] = useState("");
  const [cashInput, setCashInput] = useState("");
  const [emoneyInput, setEmoneyInput] = useState("");
  const [reason, setReason] = useState("");
  const [areaFilter, setAreaFilter] = useState("All areas");
  const [riskFilter, setRiskFilter] = useState("All risks");
  const [search, setSearch] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    valid_count: number;
    errors: { row: number; message: string }[];
    rows: unknown[];
  } | null>(null);
  const t = labels[lang];
  const nav = role === "agent" ? agentNav : supervisorNav;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, f, r, q, s, m, act, h] = await Promise.all([
        api<Agent[]>("/agents"),
        api<Forecast>(`/agents/${aid}/forecast`),
        api<Recommendations>(`/agents/${aid}/recommendations`),
        api<Request[]>("/requests"),
        api<Summary>("/summary"),
        api<Metrics>("/model-metrics"),
        api<typeof activity>(`/agents/${aid}/activity`),
        api<typeof history>(`/agents/${aid}/history`),
      ]);
      setAgents(a);
      setForecast(f);
      setRec(r);
      setRequests(q);
      setSummary(s);
      setMetrics(m);
      setActivity(act);
      setHistory(h);
      setCashInput(String(Math.round(f.agent.cash / 100)));
      setEmoneyInput(String(Math.round(f.agent.emoney / 100)));
      if (r.required) setAmount((r.required / 100).toFixed(2));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [aid]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    localStorage.setItem("flowcast-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const mutate = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      setSuccess(message);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const go = (p: Page) => {
    setPage(p);
    setMenu(false);
    setError("");
    setSuccess("");
  };
  const changeRole = (r: "agent" | "supervisor") => {
    setRole(r);
    go(r === "agent" ? "dashboard" : "overview");
  };
  const reset = () => {
    if (
      window.confirm(
        "Reset UPAY FLOWCAST demo? This removes all requests, corrections, and imports.",
      )
    )
      mutate(() => post("/reset"), "Demo restored to the fixed scenario.");
  };
  const chooseAgent = (id: string) => {
    setAid(id);
    if (role === "supervisor") go("details");
  };
  const filtered = useMemo(
    () =>
      summary?.agents.filter(
        (f) =>
          (areaFilter === "All areas" || f.agent.area === areaFilter) &&
          (riskFilter === "All risks" || f.risk === riskFilter) &&
          (f.agent.name.toLowerCase().includes(search.toLowerCase()) ||
            f.agent.id.toLowerCase().includes(search.toLowerCase())),
      ) || [],
    [summary, areaFilter, riskFilter, search],
  );
  const candidateList = useMemo(() => {
    if (!rec) return [];
    const safe = rec.candidates.filter((c) => c.suitable),
      excluded = rec.candidates.filter((c) => !c.suitable);
    return [
      ...safe.slice(0, 2),
      ...excluded.slice(0, 2),
      ...safe.slice(2),
      ...excluded.slice(2),
    ];
  }, [rec]);
  const areas = useMemo(
    () => ["All areas", ...new Set(agents.map((a) => a.area))],
    [agents],
  );
  const chartData =
    forecast?.buckets.map((b) => ({
      time: time(b.time),
      cash: Math.round(b.cash / 100),
      emoney: Math.round(b.emoney / 100),
      count: b.demand_count,
      cashIn: Math.round(b.cash_in / 100),
      cashOut: Math.round(b.cash_out / 100),
    })) || [];
  const activeRequests = requests.filter(
    (r) => r.recipient_id === aid || r.donor_id === aid,
  );
  const outstanding = Math.max(
    0,
    (rec?.required || 0) -
      requests
        .filter(
          (r) =>
            r.recipient_id === aid &&
            ["Pending", "Accepted"].includes(r.status),
        )
        .reduce((n, r) => n + r.amount, 0),
  );
  const refreshReplay = async () => {
    try {
      setReplay(
        await post<Replay>("/replay", {
          agent_id: aid,
          amount: rec?.required || 0,
          kind: rec?.kind || "cash",
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (page === "demo" && forecast) refreshReplay();
  }, [page, aid, forecast?.clock]);

  return (
    <div className="app">
      <aside
        className={"sidebar " + (menu ? "open" : "")}
        aria-label="Main navigation"
      >
        <div className="brand">
          <div>
            <strong>UPAY FLOWCAST</strong>
            <small>AI Agent Liquidity Forecasting</small>
          </div>
        </div>
        <div className="role-switch">
          <button
            className={role === "agent" ? "selected" : ""}
            onClick={() => changeRole("agent")}
          >
            {t.agent}
          </button>
          <button
            className={role === "supervisor" ? "selected" : ""}
            onClick={() => changeRole("supervisor")}
          >
            {t.supervisor}
          </button>
        </div>
        <div className="nav-label">
          {role === "agent" ? "AGENT WORKSPACE" : "SUPERVISOR WORKSPACE"}
        </div>
        <nav>
          {nav.map((p) => {
            const Icon = icons[p];
            return (
              <button
                key={p}
                className={"nav-item " + (page === p ? "active" : "")}
                onClick={() => go(p)}
              >
                <Icon size={18} />
                <span>{t[p]}</span>
              </button>
            );
          })}
          <div className="nav-sep" />
          <button
            className={"nav-item " + (page === "demo" ? "active" : "")}
            onClick={() => go("demo")}
          >
            <CircleHelp size={18} />
            <span>{t.demo}</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <span className="live-dot" />
          {t.simulation} · {t.prototype}
          <p>No live transfers or official integration</p>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Open menu"
            onClick={() => setMenu(true)}
          >
            <Menu size={23} />
          </button>
          <div className="top-title">
            <h1>{t[page]}</h1>
            <p>
              {forecast?.clock
                ? `Scenario: ${dateTime(forecast.clock)} · Asia/Dhaka`
                : t.simulation}
            </p>
          </div>
          <div className="top-actions">
            <span className="prototype-pill">{t.prototype}</span>
            <button
              className="language"
              onClick={() => setLang(lang === "en" ? "bn" : "en")}
              aria-label="Switch language"
            >
              {lang === "en" ? "বাংলা" : "English"}
            </button>
            <button
              className="icon-button"
              onClick={refresh}
              aria-label="Refresh data"
            >
              <RefreshCcw size={18} />
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="notice error" role="alert">
              <AlertTriangle size={18} />
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss">
                <X size={17} />
              </button>
            </div>
          )}
          {success && (
            <div className="notice success" role="status">
              <CheckCircle2 size={18} />
              {success}
              <button onClick={() => setSuccess("")} aria-label="Dismiss">
                <X size={17} />
              </button>
            </div>
          )}
          {loading && !forecast ? (
            <div className="loading">Loading scenario and forecasts…</div>
          ) : null}
          {forecast && (
            <>
              {(role === "agent" || page === "details" || page === "demo") && (
                <div className="agent-strip">
                  <div>
                    <span className="eyebrow">SELECTED AGENT</span>
                    <h2>
                      {forecast.agent.name}{" "}
                      <span className="muted">{forecast.agent.id}</span>
                    </h2>
                    <p>
                      {forecast.agent.area} · Last confirmed{" "}
                      {dateTime(forecast.agent.confirmed_at)}
                    </p>
                  </div>
                  <div className="strip-actions">
                    <Badge risk={forecast.risk} lang={lang} />
                    <label className="select-label">
                      Agent
                      <select
                        value={aid}
                        onChange={(e) => chooseAgent(e.target.value)}
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.id} — {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}
              {page === "dashboard" && (
                <>
                  <div className="balance-grid">
                    <BalanceCard
                      icon={Wallet}
                      title={t.cash}
                      value={forecast.agent.cash}
                      reserve={forecast.agent.cash_reserve}
                      tone="blue"
                    />
                    <BalanceCard
                      icon={ArrowLeftRight}
                      title={t.emoney}
                      value={forecast.agent.emoney}
                      reserve={forecast.agent.emoney_reserve}
                      tone="yellow"
                    />
                    <div
                      className={
                        "card risk-card " +
                        (forecast.risk === "High" ? "risk-high" : "")
                      }
                    >
                      <span className="eyebrow">{t.warning}</span>
                      <div className="risk-head">
                        <Badge risk={forecast.risk} lang={lang} />
                        <Clock3 size={21} />
                      </div>
                      <h3>
                        {forecast.earliest_breach
                          ? `${forecast.kind === "cash" ? t.cash : t.emoney} · ${time(forecast.earliest_breach)}`
                          : t.allclear}
                      </h3>
                      <p>
                        {lang === "en"
                          ? forecast.explanation_en
                          : forecast.explanation_bn}
                      </p>
                      <button
                        className="text-link"
                        onClick={() =>
                          go(forecast.stale ? "confirm" : "rebalance")
                        }
                      >
                        {forecast.stale ? t.confirm : t.options}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="two-col">
                    <div className="card chart-card">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">PROJECTION</span>
                          <h3>{t.forecast}</h3>
                        </div>
                        <div className="segmented">
                          <button
                            className={chartKind === "cash" ? "on" : ""}
                            onClick={() => setChartKind("cash")}
                          >
                            {t.cash}
                          </button>
                          <button
                            className={chartKind === "emoney" ? "on" : ""}
                            onClick={() => setChartKind("emoney")}
                          >
                            {t.emoney}
                          </button>
                        </div>
                      </div>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={chartData}
                            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid vertical={false} stroke="#e8edf3" />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                            />
                            <Tooltip
                              formatter={(v) =>
                                `৳${Number(v).toLocaleString("en-BD")}`
                              }
                            />
                            <Legend />
                            <ReferenceLine
                              y={
                                (chartKind === "cash"
                                  ? forecast.agent.cash_reserve
                                  : forecast.agent.emoney_reserve) / 100
                              }
                              stroke="#c05649"
                              strokeDasharray="5 4"
                              label={{
                                value: "Reserve",
                                position: "insideTopRight",
                                fontSize: 11,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey={chartKind}
                              name={chartKind === "cash" ? t.cash : t.emoney}
                              stroke="#2253A0"
                              strokeWidth={3}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="chart-note">
                        Six-hour illustrative range: ±
                        {taka(forecast.buckets[5].range_half_width)}.{" "}
                        {forecast.range_method}
                      </p>
                    </div>
                    <div className="card chart-card">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">NEXT 6 HOURS</span>
                          <h3>{t.demand}</h3>
                        </div>
                        <span className="small-pill">{forecast.method}</span>
                      </div>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid vertical={false} stroke="#e8edf3" />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar
                              dataKey="count"
                              name="Requested transactions"
                              fill="#F1C93B"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="chart-note">
                        Forecast requested transaction count. Shortages can hide
                        demand in completed-only data.
                      </p>
                    </div>
                  </div>
                  <div className="card table-card">
                    <div className="card-title">
                      <h3>Hourly forecast</h3>
                      <span className="small-pill">Requested demand</span>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Hour</th>
                            <th>Cash-in</th>
                            <th>Cash-out</th>
                            <th>Demand count</th>
                            <th>Cash</th>
                            <th>E-money</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecast.buckets.map((b) => (
                            <tr key={b.time}>
                              <td>{time(b.time)}</td>
                              <td>{taka(b.cash_in)}</td>
                              <td>{taka(b.cash_out)}</td>
                              <td>{b.demand_count}</td>
                              <td>{taka(b.cash)}</td>
                              <td>{taka(b.emoney)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="card action-panel">
                    <div>
                      <span className="eyebrow">{t.action}</span>
                      <h3>
                        {forecast.stale
                          ? t.confirm
                          : forecast.kind
                            ? `Prepare ${taka(forecast.required[forecast.kind])} ${forecast.kind === "cash" ? t.cash : t.emoney}`
                            : "Keep monitoring balances"}
                      </h3>
                      <p>
                        {forecast.stale
                          ? "Reconfirm counted balances before relying on recommendations."
                          : rec?.candidates.find((c) => c.suitable)?.name
                            ? `Safe option: ${rec.candidates.find((c) => c.suitable)?.name}. Compare all sources before requesting.`
                            : "No safe nearby source identified; review distributor availability."}
                      </p>
                    </div>
                    <div className="button-row">
                      <button
                        className="button secondary"
                        onClick={() => go("confirm")}
                      >
                        {t.confirm}
                      </button>
                      <button
                        className="button primary"
                        onClick={() => go("rebalance")}
                      >
                        {t.options}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {page === "alerts" && (
                <>
                  <SectionHead
                    title="Active alerts"
                    subtitle="Operational rules use breach timing and projected negative balances, not probabilities."
                  />
                  <div className="card-grid">
                    {(["cash", "emoney"] as const)
                      .filter((k) => forecast[`breach_${k}`])
                      .map((k) => (
                        <div className="card alert-card" key={k}>
                          <div className="card-title">
                            <h3>
                              {k === "cash" ? t.cash : t.emoney} reserve breach
                            </h3>
                            <Badge risk={forecast.risk} lang={lang} />
                          </div>
                          <p className="big-time">
                            {dateTime(forecast[`breach_${k}`])}
                          </p>
                          <p>
                            Required top-up:{" "}
                            <strong>{taka(forecast.required[k])}</strong>
                          </p>
                          <p>
                            {lang === "en"
                              ? forecast.explanation_en
                              : forecast.explanation_bn}
                          </p>
                          <button
                            className="text-link"
                            onClick={() => go("rebalance")}
                          >
                            {t.options}
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      ))}
                    {!forecast.breach_cash && !forecast.breach_emoney && (
                      <Empty>{t.allclear}</Empty>
                    )}
                  </div>
                  {forecast.stale && (
                    <div className="notice warning">
                      <AlertTriangle size={18} />
                      Needs confirmation · Last confirmed{" "}
                      {dateTime(forecast.agent.confirmed_at)}.{" "}
                      <button
                        className="text-link"
                        onClick={() => go("confirm")}
                      >
                        Confirm now
                      </button>
                    </div>
                  )}
                  <SectionHead title="Resolved alerts" />
                  <div className="card list-card">
                    {activity?.events.filter(
                      (e) =>
                        e.kind === "rebalance" &&
                        e.detail.includes("completed"),
                    ).length ? (
                      activity.events
                        .filter(
                          (e) =>
                            e.kind === "rebalance" &&
                            e.detail.includes("completed"),
                        )
                        .map((e) => (
                          <div className="list-row" key={e.id}>
                            <CheckCircle2 size={18} />
                            <span>{e.detail}</span>
                            <span className="muted">{dateTime(e.at)}</span>
                          </div>
                        ))
                    ) : (
                      <Empty>
                        No resolved alerts yet. Complete a simulated exchange to
                        see the audit trail.
                      </Empty>
                    )}
                  </div>
                </>
              )}
              {page === "rebalance" && rec && (
                <>
                  <SectionHead
                    title="Rebalance options"
                    subtitle="Agent-to-agent exchanges transfer equal cash and e-money in opposite directions."
                  />
                  <div className="summary-banner">
                    <div>
                      <span className="eyebrow">PROJECTED NEED</span>
                      <h2>
                        {taka(rec.required)}{" "}
                        <span>{rec.kind === "cash" ? t.cash : t.emoney}</span>
                      </h2>
                      <p>
                        Lowest projected balance determines the required top-up.
                        A reserve breach does not mean transactions must fail.
                      </p>
                      <p>
                        Open requests cover {taka(rec.required - outstanding)};
                        remaining gap {taka(outstanding)}. The modeled
                        distributor is listed below as a fallback.
                      </p>
                    </div>
                    <ShieldCheck size={32} />
                  </div>
                  <div className="candidate-grid">
                    {candidateList.map((c) => (
                      <div
                        className={
                          "card candidate " +
                          (c.suitable ? "candidate-safe" : "candidate-excluded")
                        }
                        key={c.id}
                      >
                        <div className="card-title">
                          <div>
                            <h3>{c.name}</h3>
                            <p>
                              {c.area} · {c.id}
                              {c.distributor ? " · Distributor" : ""}
                            </p>
                          </div>
                          <span
                            className={
                              "status " + (c.suitable ? "good" : "bad")
                            }
                          >
                            {c.suitable ? "Suitable" : "Excluded"}
                          </span>
                        </div>
                        <div className="candidate-facts">
                          <span>
                            <strong>{c.distance_km} km</strong> away
                          </span>
                          <span>
                            <strong>{c.travel_minutes} min</strong> estimated
                          </span>
                          <span>
                            <strong>{taka(c.safe_available)}</strong> safe
                            capacity
                          </span>
                        </div>
                        <p className="reason">{c.reason}</p>
                        {c.suitable && (
                          <button
                            className="button primary"
                            disabled={busy}
                            onClick={() => {
                              const val = Number(amount);
                              if (
                                !Number.isFinite(val) ||
                                val <= 0 ||
                                Math.round(val * 100) > c.safe_available
                              ) {
                                setError(
                                  `Enter an amount from ৳1 to ${taka(c.safe_available)}.`,
                                );
                                return;
                              }
                              mutate(
                                () =>
                                  post("/requests", {
                                    recipient_id: aid,
                                    donor_id: c.id,
                                    kind: rec.kind,
                                    amount: Math.round(val * 100),
                                  }),
                                `Request sent to ${c.name}.`,
                              );
                            }}
                          >
                            {t.request}
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="card form-card">
                    <label>
                      Exchange amount (৳)
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                    <p>{rec.travel_method}</p>
                    {rec.required > 0 &&
                      rec.candidates.some(
                        (c) => c.suitable && c.safe_available < rec.required,
                      ) && (
                        <p>
                          Partial assistance is available. Request the safe
                          amount, then use the distributor for the remaining
                          gap.
                        </p>
                      )}
                  </div>
                  <SectionHead title="Existing requests" />
                  <RequestList
                    items={activeRequests}
                    onAction={(id, action) =>
                      mutate(
                        () => post(`/requests/${id}/${action}`),
                        `Request #${id}: ${action} completed.`,
                      )
                    }
                    busy={busy}
                    mode="agent"
                    lang={lang}
                  />
                </>
              )}
              {page === "confirm" && (
                <>
                  <SectionHead
                    title={t.confirm}
                    subtitle="Record a counted balance. Every correction is kept in the activity log."
                  />
                  <div className="card form-card narrow">
                    <div className="before-values">
                      <span>
                        Before: {t.cash}{" "}
                        <strong>{taka(forecast.agent.cash)}</strong>
                      </span>
                      <span>
                        {t.emoney}{" "}
                        <strong>{taka(forecast.agent.emoney)}</strong>
                      </span>
                    </div>
                    <label>
                      Counted physical cash (৳)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={cashInput}
                        onChange={(e) => setCashInput(e.target.value)}
                      />
                    </label>
                    <label>
                      Current e-money (৳)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={emoneyInput}
                        onChange={(e) => setEmoneyInput(e.target.value)}
                      />
                    </label>
                    <label>
                      Correction reason (optional)
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Example: end-of-shift count"
                      />
                    </label>
                    <div className="after-values">
                      After: {t.cash}{" "}
                      <strong>
                        {taka(Math.round(Number(cashInput || 0) * 100))}
                      </strong>{" "}
                      · {t.emoney}{" "}
                      <strong>
                        {taka(Math.round(Number(emoneyInput || 0) * 100))}
                      </strong>
                    </div>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => {
                        const cash = Number(cashInput),
                          emoney = Number(emoneyInput);
                        if (
                          cashInput.trim() === "" ||
                          emoneyInput.trim() === "" ||
                          !Number.isInteger(cash) ||
                          !Number.isInteger(emoney) ||
                          cash < 0 ||
                          emoney < 0
                        ) {
                          setError("Enter non-negative whole taka amounts.");
                          return;
                        }
                        mutate(
                          () =>
                            post(`/agents/${aid}/confirm`, {
                              cash: cash * 100,
                              emoney: emoney * 100,
                              reason,
                            }),
                          "Balance confirmation recorded. Forecast refreshed.",
                        );
                      }}
                    >
                      {t.confirm}
                    </button>
                  </div>
                </>
              )}
              {page === "activity" && (
                <>
                  <SectionHead
                    title="Recent activity"
                    subtitle="Simulated transactions, corrections, and request state changes."
                  />
                  <div className="two-col">
                    <div className="card list-card">
                      <h3>Audit events</h3>
                      {activity?.events.length ? (
                        activity.events.map((e) => (
                          <div className="list-row" key={e.id}>
                            <span className="activity-icon">
                              <Activity size={16} />
                            </span>
                            <div>
                              <strong>{e.kind}</strong>
                              <p>{eventText(e.kind, e.detail)}</p>
                            </div>
                            <time>{dateTime(e.at)}</time>
                          </div>
                        ))
                      ) : (
                        <Empty>No events recorded yet.</Empty>
                      )}
                    </div>
                    <div className="card list-card">
                      <h3>Recent demand history</h3>
                      {activity?.transactions.map((r) => (
                        <div className="list-row" key={r.record_id}>
                          <span className="activity-icon">
                            <ArrowLeftRight size={16} />
                          </span>
                          <div>
                            <strong>
                              {r.cash_out
                                ? taka(r.cash_out) + " cash-out"
                                : taka(r.cash_in) + " cash-in"}
                            </strong>
                            <p>
                              {r.completed_count
                                ? "Completed"
                                : "Requested or failed"}
                            </p>
                          </div>
                          <time>{dateTime(r.timestamp)}</time>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card table-card">
                    <h3>Completed exchange balances</h3>
                    {activeRequests.some((r) => r.status === "Completed") ? (
                      activeRequests
                        .filter((r) => r.status === "Completed")
                        .map((r) => (
                          <CompletionDetails key={r.id} request={r} />
                        ))
                    ) : (
                      <Empty>No completed exchanges yet.</Empty>
                    )}
                  </div>
                </>
              )}
              {page === "overview" && summary && (
                <>
                  <div className="metric-grid">
                    {[
                      ["Open agents", summary.open],
                      ["High risk", summary.high_risk],
                      ["Cash breaches", summary.cash_breaches],
                      ["E-money breaches", summary.emoney_breaches],
                      [
                        "Pending / accepted",
                        `${summary.pending} / ${summary.accepted}`,
                      ],
                      ["Stale balances", summary.stale],
                      ["Forecast demand", summary.demand_count],
                    ].map(([label, value]) => (
                      <div className="card metric" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="card table-card">
                    <div className="card-title">
                      <div>
                        <span className="eyebrow">NETWORK WATCHLIST</span>
                        <h3>Agents by risk</h3>
                      </div>
                      <span className="muted">{filtered.length} agents</span>
                    </div>
                    <div className="filters">
                      <label>
                        <Search size={16} />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search agent or shop"
                        />
                      </label>
                      <select
                        aria-label="Filter by area"
                        value={areaFilter}
                        onChange={(e) => setAreaFilter(e.target.value)}
                      >
                        {areas.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter by risk"
                        value={riskFilter}
                        onChange={(e) => setRiskFilter(e.target.value)}
                      >
                        {[
                          "All risks",
                          "High",
                          "Medium",
                          "Low",
                          "Needs confirmation",
                        ].map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Agent</th>
                            <th>Area</th>
                            <th>Risk</th>
                            <th>Breach</th>
                            <th>Required</th>
                            <th>Freshness</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...filtered]
                            .sort(
                              (a, b) =>
                                (({
                                  High: 0,
                                  "Needs confirmation": 1,
                                  Medium: 2,
                                  Low: 3,
                                })[a.risk] ?? 4) -
                                ({
                                  High: 0,
                                  "Needs confirmation": 1,
                                  Medium: 2,
                                  Low: 3,
                                }[b.risk] ?? 4),
                            )
                            .map((f) => (
                              <tr key={f.agent.id}>
                                <td>
                                  <strong>{f.agent.name}</strong>
                                  <small>{f.agent.id}</small>
                                </td>
                                <td>{f.agent.area}</td>
                                <td>
                                  <Badge risk={f.risk} lang={lang} />
                                </td>
                                <td>{dateTime(f.earliest_breach)}</td>
                                <td>
                                  {f.kind ? taka(f.required[f.kind]) : "—"}
                                </td>
                                <td>
                                  {f.stale
                                    ? "Stale"
                                    : dateTime(f.agent.confirmed_at)}
                                </td>
                                <td>
                                  <button
                                    className="text-link"
                                    onClick={() => chooseAgent(f.agent.id)}
                                  >
                                    View <ChevronRight size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {!filtered.length && (
                        <Empty>No agents match these filters.</Empty>
                      )}
                    </div>
                  </div>
                </>
              )}
              {page === "details" && (
                <>
                  <div className="balance-grid">
                    <BalanceCard
                      icon={Wallet}
                      title={t.cash}
                      value={forecast.agent.cash}
                      reserve={forecast.agent.cash_reserve}
                      tone="blue"
                    />
                    <BalanceCard
                      icon={ArrowLeftRight}
                      title={t.emoney}
                      value={forecast.agent.emoney}
                      reserve={forecast.agent.emoney_reserve}
                      tone="yellow"
                    />
                    <div className="card detail-status">
                      <span className="eyebrow">RISK ASSESSMENT</span>
                      <Badge risk={forecast.risk} lang={lang} />
                      <p>{forecast.explanation_en}</p>
                      <p>
                        Method:{" "}
                        <strong>
                          {forecast.limited_history
                            ? "Area/peer fallback"
                            : forecast.method}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <div className="two-col">
                    <div className="card chart-card">
                      <h3>Projected balances</h3>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid vertical={false} stroke="#e8edf3" />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                            />
                            <Tooltip
                              formatter={(v) =>
                                `৳${Number(v).toLocaleString()}`
                              }
                            />
                            <Legend />
                            <Line
                              dataKey="cash"
                              stroke="#2253A0"
                              strokeWidth={2}
                            />
                            <Line
                              dataKey="emoney"
                              stroke="#e0b52f"
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="card chart-card">
                      <h3>Recent hourly demand</h3>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[...history]
                              .reverse()
                              .slice(-12)
                              .map((h) => ({
                                time: time(h.timestamp),
                                cashIn: Math.round(h.cash_in / 100),
                                cashOut: Math.round(h.cash_out / 100),
                              }))}
                          >
                            <CartesianGrid vertical={false} stroke="#e8edf3" />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar
                              dataKey="cashIn"
                              name="Cash-in ৳"
                              fill="#2253A0"
                            />
                            <Bar
                              dataKey="cashOut"
                              name="Cash-out ৳"
                              fill="#F1C93B"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  <div className="card list-card">
                    <h3>Safe rebalance options</h3>
                    {rec?.candidates.slice(0, 5).map((c) => (
                      <div className="list-row" key={c.id}>
                        <span
                          className={"status " + (c.suitable ? "good" : "bad")}
                        >
                          {c.suitable ? "Suitable" : "Excluded"}
                        </span>
                        <div>
                          <strong>{c.name}</strong>
                          <p>{c.reason}</p>
                        </div>
                        <span>{taka(c.safe_available)}</span>
                      </div>
                    ))}
                    <button
                      className="text-link"
                      onClick={() => {
                        changeRole("agent");
                        go("rebalance");
                      }}
                    >
                      Open agent options <ChevronRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {page === "operations" && (
                <>
                  <SectionHead
                    title="Rebalance operations"
                    subtitle="Acceptance reserves capacity. Completion applies both sides atomically and records an audit event."
                  />
                  <RequestList
                    items={requests}
                    onAction={(id, action) =>
                      mutate(
                        () => post(`/requests/${id}/${action}`),
                        `Request #${id}: ${action} completed.`,
                      )
                    }
                    busy={busy}
                    mode="supervisor"
                    lang={lang}
                  />
                </>
              )}
              {page === "performance" && metrics && (
                <>
                  <SectionHead
                    title="Model performance"
                    subtitle="Calculated on a chronological historical holdout. Lower MAE is better."
                  />
                  <div className="card table-card">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Target</th>
                            <th>Baseline MAE</th>
                            <th>Random Forest MAE</th>
                            <th>Selected</th>
                            <th>Validation rows</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(metrics.targets).map(([key, m]) => (
                            <tr key={key}>
                              <td>
                                <strong>{key.replace("_", " ")}</strong>
                              </td>
                              <td>
                                {key === "demand_count"
                                  ? m.baseline_mae.toFixed(1)
                                  : taka(m.baseline_mae)}
                              </td>
                              <td>
                                {m.model_mae === null
                                  ? "Unavailable"
                                  : key === "demand_count"
                                    ? m.model_mae.toFixed(1)
                                    : taka(m.model_mae)}
                              </td>
                              <td>
                                <span className="small-pill">{m.selected}</span>
                              </td>
                              <td>{m.samples.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="card methodology">
                    <h3>How forecasts are selected</h3>
                    <p>{metrics.method}</p>
                    <p>
                      Training ended{" "}
                      {dateTime(metrics.targets.cash_in.train_end)}. Validation
                      ended {dateTime(metrics.targets.cash_in.validation_end)}.
                      A selected baseline means it scored better for that
                      target.
                    </p>
                    <p>{metrics.limitations}</p>
                    <p>
                      Risk rules: High if a balance is projected negative or
                      reserve breach occurs in the first two forecast buckets;
                      Medium for later reserve breaches; Low otherwise. Any
                      balance older than 120 minutes is Needs confirmation.
                    </p>
                  </div>
                </>
              )}
              {page === "import" && (
                <>
                  <SectionHead
                    title="Import demand history"
                    subtitle="Preview validation before committing. Amounts are positive integer paisa."
                  />
                  <div className="card form-card narrow">
                    <div className="column-list">
                      <span>
                        Required: agent_id, timestamp, transaction_type, amount,
                        status
                      </span>
                      <span>
                        Optional: record_id for stable duplicate detection
                      </span>
                      <span>
                        Types: cash_in, cash_out · Status: requested, completed,
                        failed
                      </span>
                    </div>
                    <a className="button secondary" href="/api/import/sample">
                      <Download size={16} /> Download sample CSV
                    </a>
                    <label>
                      Choose CSV file
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          setCsvFile(e.target.files?.[0] || null);
                          setCsvPreview(null);
                        }}
                      />
                    </label>
                    <div className="button-row">
                      <button
                        className="button secondary"
                        disabled={!csvFile || busy}
                        onClick={async () => {
                          if (!csvFile) return;
                          const fd = new FormData();
                          fd.append("file", csvFile);
                          try {
                            setError("");
                            setCsvPreview(
                              await api("/import/preview", {
                                method: "POST",
                                body: fd,
                              }),
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Preview import
                      </button>
                      <button
                        className="button primary"
                        disabled={
                          !csvFile ||
                          !csvPreview ||
                          csvPreview.errors.length > 0 ||
                          busy
                        }
                        onClick={() => {
                          if (!csvFile) return;
                          const fd = new FormData();
                          fd.append("file", csvFile);
                          mutate(
                            () =>
                              api("/import/commit", {
                                method: "POST",
                                body: fd,
                              }),
                            `${csvPreview?.valid_count} records imported.`,
                          );
                          setCsvPreview(null);
                        }}
                      >
                        Commit import
                      </button>
                    </div>
                    {csvPreview && (
                      <div className="preview">
                        <strong>
                          {csvPreview.valid_count} valid rows ·{" "}
                          {csvPreview.errors.length} errors
                        </strong>
                        {csvPreview.errors.map((e) => (
                          <p key={e.row}>
                            Row {e.row}: {e.message}
                          </p>
                        ))}
                        {!csvPreview.errors.length && (
                          <p>
                            Ready to import. Existing duplicate record IDs are
                            blocked.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
              {page === "demo" && (
                <>
                  <SectionHead
                    title="Guided demo walkthrough"
                    subtitle="Follow one fixed scenario from warning through a simulated exchange and measured service outcome."
                  />
                  <div className="demo-grid">
                    <ol className="card steps">
                      <li>
                        <button
                          onClick={() => {
                            setAid("A01");
                            changeRole("agent");
                          }}
                        >
                          Open the at-risk Lake View Store agent
                        </button>
                      </li>
                      <li>
                        <button onClick={() => go("dashboard")}>
                          Inspect the cash forecast and reserve breach
                        </button>
                      </li>
                      <li>
                        <button onClick={() => go("rebalance")}>
                          Compare a suitable donor with excluded nearby agents
                        </button>
                      </li>
                      <li>
                        <button onClick={() => go("rebalance")}>
                          Create a request for the suggested amount
                        </button>
                      </li>
                      <li>
                        <button onClick={() => changeRole("supervisor")}>
                          Switch to supervisor and accept the request
                        </button>
                      </li>
                      <li>
                        <button onClick={() => go("operations")}>
                          Complete the simulated exchange
                        </button>
                      </li>
                      <li>
                        <button onClick={() => go("details")}>
                          Review updated balances and risk
                        </button>
                      </li>
                      <li>
                        <button onClick={() => go("demo")}>
                          Compare service outcomes below
                        </button>
                      </li>
                    </ol>
                    <div className="card outcome">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">SAME SEEDED DEMAND</span>
                          <h3>Service outcome simulation</h3>
                        </div>
                        <button className="text-link" onClick={refreshReplay}>
                          Recalculate
                        </button>
                      </div>
                      {replay ? (
                        <>
                          <div className="outcome-columns">
                            <div>
                              <span>Without exchange</span>
                              <strong>{replay.without.service_rate}%</strong>
                              <p>
                                {replay.without.served} served ·{" "}
                                {replay.without.unserved} unserved
                              </p>
                            </div>
                            <div className="highlight">
                              <span>With scheduled exchange</span>
                              <strong>{replay.with.service_rate}%</strong>
                              <p>
                                {replay.with.served} served ·{" "}
                                {replay.with.unserved} unserved
                              </p>
                            </div>
                          </div>
                          <div className="outcome-facts">
                            <span>
                              Attempted{" "}
                              <strong>{replay.without.attempted}</strong>
                            </span>
                            <span>
                              Rebalanced <strong>{taka(replay.amount)}</strong>
                            </span>
                            <span>
                              Alert lead{" "}
                              <strong>
                                {replay.alert_lead_minutes ?? "—"} min
                              </strong>
                            </span>
                          </div>
                          <p>{replay.note}</p>
                        </>
                      ) : (
                        <p>Calculating outcomes…</p>
                      )}
                    </div>
                  </div>
                  <button className="button danger" onClick={reset}>
                    {t.reset}
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <footer>
          UPAY FLOWCAST · Simulated data · Hackathon prototype · No real
          transfer or official upay integration
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {(role === "agent"
          ? (["dashboard", "alerts", "rebalance", "activity"] as Page[])
          : (["overview", "details", "operations", "demo"] as Page[])
        ).map((p) => {
          const Icon = icons[p];
          return (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => go(p)}
            >
              <Icon size={19} />
              <span>{t[p]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function BalanceCard({
  icon: Icon,
  title,
  value,
  reserve,
  tone,
}: {
  icon: typeof Wallet;
  title: string;
  value: number;
  reserve: number;
  tone: string;
}) {
  return (
    <div className={"card balance-card " + tone}>
      <div className="balance-title">
        <span className="icon-box">
          <Icon size={21} />
        </span>
        <span>{title}</span>
      </div>
      <strong>{taka(value)}</strong>
      <div className="reserve-line">
        <span>Safe reserve</span>
        <b>{taka(reserve)}</b>
      </div>
    </div>
  );
}
function SectionHead({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
function eventText(kind: string, detail: string) {
  if (kind !== "correction" || !detail.startsWith("{")) return detail;
  try {
    const value = JSON.parse(detail) as {
      before: { cash: number; emoney: number };
      after: { cash: number; emoney: number };
      reason: string;
    };
    return `${value.reason}: cash ${taka(value.before.cash)} → ${taka(value.after.cash)}, e-money ${taka(value.before.emoney)} → ${taka(value.after.emoney)}`;
  } catch {
    return detail;
  }
}

function CompletionDetails({ request: r }: { request: Request }) {
  if (!r.before_json || !r.after_json) return null;
  const before = JSON.parse(r.before_json) as Record<
    string,
    { cash: number; emoney: number }
  >;
  const after = JSON.parse(r.after_json) as typeof before;
  return (
    <div className="completion-detail">
      <strong>
        Request #{r.id} · {taka(r.amount)} {r.kind}
      </strong>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Participant</th>
              <th>Cash before</th>
              <th>Cash after</th>
              <th>E-money before</th>
              <th>E-money after</th>
            </tr>
          </thead>
          <tbody>
            {[r.recipient_id, r.donor_id].map((id) => (
              <tr key={id}>
                <td>{id}</td>
                <td>{taka(before[id].cash)}</td>
                <td>{taka(after[id].cash)}</td>
                <td>{taka(before[id].emoney)}</td>
                <td>{taka(after[id].emoney)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RequestList({
  items,
  onAction,
  busy,
  mode,
  lang,
}: {
  items: Request[];
  onAction: (id: number, action: string) => void;
  busy: boolean;
  mode: string;
  lang: "en" | "bn";
}) {
  return (
    <div className="card table-card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Recipient / donor</th>
              <th>Exchange</th>
              <th>Amount</th>
              <th>ETA</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td>
                  {r.recipient_id} ← {r.donor_id}
                </td>
                <td>{r.kind === "cash" ? "Cash" : "E-money"}</td>
                <td>{taka(r.amount)}</td>
                <td>{dateTime(r.eta)}</td>
                <td>
                  <span
                    className={
                      "status " +
                      (r.status === "Completed"
                        ? "good"
                        : r.status === "Rejected" || r.status === "Cancelled"
                          ? "bad"
                          : "pending")
                    }
                  >
                    {lang === "bn"
                      ? (
                          {
                            Pending: "বিচারাধীন",
                            Accepted: "গৃহীত",
                            Rejected: "প্রত্যাখ্যাত",
                            Cancelled: "বাতিল",
                            Completed: "সম্পন্ন",
                          } as Record<string, string>
                        )[r.status] || r.status
                      : r.status}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    {r.status === "Pending" && (
                      <>
                        {mode === "supervisor" && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => onAction(r.id, "accept")}
                            >
                              {lang === "bn" ? "গ্রহণ" : "Accept"}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => onAction(r.id, "reject")}
                            >
                              {lang === "bn" ? "প্রত্যাখ্যান" : "Reject"}
                            </button>
                          </>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => onAction(r.id, "cancel")}
                        >
                          {lang === "bn" ? "বাতিল" : "Cancel"}
                        </button>
                      </>
                    )}
                    {r.status === "Accepted" && mode === "supervisor" && (
                      <button
                        disabled={busy}
                        onClick={() => onAction(r.id, "complete")}
                      >
                        {lang === "bn" ? "সম্পন্ন" : "Complete"}
                      </button>
                    )}
                    {r.status === "Completed" && <span>Audit saved</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <Empty>
            No requests yet. Create one from an agent’s rebalance options.
          </Empty>
        )}
      </div>
    </div>
  );
}
