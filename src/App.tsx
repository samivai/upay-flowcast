import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
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
  LabelList,
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
  open_hour: number;
  close_hour: number;
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
const taka = (n: number) =>
  `${n < 0 ? "-" : ""}৳${Math.round(Math.abs(n) / 100).toLocaleString("en-BD")}`;
const takaAxis = (n: number) =>
  `${n < 0 ? "-" : ""}৳` +
  new Intl.NumberFormat("en-BD", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.abs(n));
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
    balanceCurrent: "Balance current",
    staleCount: "stale",
    additionalRequired: "Additional required",
    forecastRequests: "Forecast requests",
    reserveWatch: "Reserve watch",
    safeSources: "Safe sources",
    recentActivity: "Recent activity",
    suitableSources: "Suitable sources",
    requestSummary: "Request summary",
    openAgents: "Open agents",
    highRisk: "High risk",
    cashBreaches: "Cash breaches",
    emoneyBreaches: "E-money breaches",
    pendingRequests: "Pending requests",
    staleBalances: "Stale balances",
    riskOverview: "Risk overview",
    filterByRisk: "Filter by risk",
    selectedAgent: "Selected agent",
    currentBalanceLabel: "Current balance",
    projectedBalance: "Projected balance",
    forecastHour: "Next six hours",
    peak: "Peak",
    more: "More",
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
    balanceCurrent: "ব্যালেন্স হালনাগাদ",
    staleCount: "পুরোনো",
    additionalRequired: "অতিরিক্ত প্রয়োজন",
    forecastRequests: "সম্ভাব্য লেনদেন",
    reserveWatch: "সংরক্ষণ নজরদারি",
    safeSources: "নিরাপদ উৎস",
    recentActivity: "সাম্প্রতিক কার্যক্রম",
    suitableSources: "উপযুক্ত উৎস",
    requestSummary: "অনুরোধের সারাংশ",
    openAgents: "খোলা এজেন্ট",
    highRisk: "উচ্চ ঝুঁকি",
    cashBreaches: "নগদ সংরক্ষণ ঘাটতি",
    emoneyBreaches: "ই-মানি সংরক্ষণ ঘাটতি",
    pendingRequests: "অপেক্ষমাণ অনুরোধ",
    staleBalances: "পুরোনো ব্যালেন্স",
    riskOverview: "ঝুঁকির সারাংশ",
    filterByRisk: "ঝুঁকি দিয়ে বাছাই",
    selectedAgent: "নির্বাচিত এজেন্ট",
    currentBalanceLabel: "বর্তমান ব্যালেন্স",
    projectedBalance: "সম্ভাব্য ব্যালেন্স",
    forecastHour: "পরবর্তী ছয় ঘণ্টা",
    peak: "সর্বোচ্চ",
    more: "আরও",
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
const riskBn: Record<string, string> = {
  "All risks": "সব ঝুঁকি",
  High: "উচ্চ",
  Medium: "মাঝারি",
  Low: "কম",
  "Needs confirmation": "নিশ্চিত করুন",
};
const riskLabel = (risk: string, lang: "en" | "bn") =>
  lang === "bn" ? riskBn[risk] || risk : risk;
function Badge({ risk, lang = "en" }: { risk: string; lang?: "en" | "bn" }) {
  return (
    <span className={"badge " + risk.toLowerCase().replaceAll(" ", "-")}>
      {risk === "High" ? (
        <AlertTriangle size={13} />
      ) : risk === "Low" ? (
        <CheckCircle2 size={13} />
      ) : (
        <Clock3 size={13} />
      )}
      {riskLabel(risk, lang)}
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
  const [replayBusy, setReplayBusy] = useState(false);
  const [replayAfterCompletion, setReplayAfterCompletion] = useState(false);
  const [scenarioVersion, setScenarioVersion] = useState(0);
  const [visitedPages, setVisitedPages] = useState<Set<Page>>(
    new Set(["dashboard"]),
  );
  const [menu, setMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const [chartKind, setChartKind] = useState<"cash" | "emoney">("cash");
  const [amount, setAmount] = useState("");
  const [cashInput, setCashInput] = useState("");
  const [emoneyInput, setEmoneyInput] = useState("");
  const [reason, setReason] = useState("");
  const [areaFilter, setAreaFilter] = useState("All areas");
  const [riskFilter, setRiskFilter] = useState("All risks");
  const [sortBy, setSortBy] = useState<"risk" | "breach" | "required">("risk");
  const [alertFilter, setAlertFilter] = useState<"all" | "cash" | "emoney">(
    "all",
  );
  const [alertRiskFilter, setAlertRiskFilter] = useState("All risks");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [search, setSearch] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
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
      const firstSource = r.candidates.find((candidate) => candidate.suitable);
      const uncovered = Math.max(
        0,
        r.required -
          q
            .filter(
              (request) =>
                request.recipient_id === aid &&
                ["Pending", "Accepted"].includes(request.status),
            )
            .reduce((total, request) => total + request.amount, 0),
      );
      setSelectedCandidateId(firstSource?.id || "");
      setAmount(
        (Math.min(uncovered, firstSource?.safe_available || 0) / 100).toFixed(
          2,
        ),
      );
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
    if (menu) menuButtonRef.current?.focus();
    setPage(p);
    setVisitedPages((current) => new Set(current).add(p));
    setMenu(false);
    setError("");
    setSuccess("");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  const changeRole = (r: "agent" | "supervisor") => {
    setRole(r);
    go(r === "agent" ? "dashboard" : "overview");
  };
  useEffect(() => {
    if (!menu) return;
    closeMenuRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menu]);
  const reset = () => {
    if (
      window.confirm(
        "Reset UPAY FLOWCAST demo? This removes all requests, corrections, and imports.",
      )
    ) {
      setReplayAfterCompletion(false);
      setReplay(null);
      void mutate(
        () => post("/reset"),
        "Demo restored to the fixed scenario.",
      ).then(() => setScenarioVersion((version) => version + 1));
    }
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
  const safeCandidates = rec?.candidates.filter((c) => c.suitable) || [];
  const excludedCandidates = rec?.candidates.filter((c) => !c.suitable) || [];
  const selectedCandidate =
    safeCandidates.find((c) => c.id === selectedCandidateId) ||
    safeCandidates[0];
  const areas = useMemo(
    () => ["All areas", ...new Set(agents.map((a) => a.area))],
    [agents],
  );
  const chartData =
    forecast?.buckets.map((b) => ({
      time: time(b.time),
      fullTime: dateTime(b.time),
      cash: Math.round(b.cash / 100),
      emoney: Math.round(b.emoney / 100),
      cashReserve: Math.round(forecast.agent.cash_reserve / 100),
      emoneyReserve: Math.round(forecast.agent.emoney_reserve / 100),
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
  const requestLimit = Math.min(
    selectedCandidate?.safe_available || 0,
    outstanding,
  );
  const scenarioHour = forecast
    ? Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Dhaka",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date(forecast.clock)),
      )
    : 0;
  const isOpen =
    !!forecast?.agent.available &&
    scenarioHour >= (forecast?.agent.open_hour ?? 0) &&
    scenarioHour < (forecast?.agent.close_hour ?? 24);
  const activeAlertCount =
    role === "agent"
      ? Number(!!forecast?.breach_cash) +
        Number(!!forecast?.breach_emoney) +
        Number(!!forecast?.stale)
      : (summary?.cash_breaches || 0) +
        (summary?.emoney_breaches || 0) +
        (summary?.stale || 0);
  const peakBucket = forecast?.buckets.reduce(
    (best, bucket) => (bucket.demand_count > best.demand_count ? bucket : best),
    forecast.buckets[0],
  );
  const riskOrder: Record<string, number> = {
    High: 0,
    "Needs confirmation": 1,
    Medium: 2,
    Low: 3,
  };
  const sortedAgents = [...filtered].sort((a, b) =>
    sortBy === "breach"
      ? (a.earliest_breach || "9999").localeCompare(b.earliest_breach || "9999")
      : sortBy === "required"
        ? (b.kind ? b.required[b.kind] : 0) - (a.kind ? a.required[a.kind] : 0)
        : (riskOrder[a.risk] ?? 4) - (riskOrder[b.risk] ?? 4),
  );
  const refreshReplay = async () => {
    setReplayBusy(true);
    try {
      const result = await post<Replay>("/replay", {
        agent_id: aid,
        amount: rec?.required || 0,
        kind: rec?.kind || "cash",
      });
      setReplay(result);
      if (
        aid === "A01" &&
        requests.some(
          (r) => r.recipient_id === "A01" && r.status === "Completed",
        )
      )
        setReplayAfterCompletion(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReplayBusy(false);
    }
  };
  useEffect(() => {
    if (page === "demo" && forecast) refreshReplay();
  }, [page, aid, forecast?.clock, scenarioVersion]);
  const demoHasRequest = requests.some((r) => r.recipient_id === "A01");
  const demoHasAccepted = requests.some(
    (r) =>
      r.recipient_id === "A01" && ["Accepted", "Completed"].includes(r.status),
  );
  const demoHasCompleted = requests.some(
    (r) => r.recipient_id === "A01" && r.status === "Completed",
  );
  const demoSteps = [
    {
      label: "Inspect A01's cash forecast and reserve warning",
      done: aid === "A01" && visitedPages.has("dashboard"),
      action: () => {
        setAid("A01");
        changeRole("agent");
      },
    },
    {
      label: "Compare suitable and excluded sources",
      done: visitedPages.has("rebalance"),
      action: () => {
        setAid("A01");
        changeRole("agent");
        go("rebalance");
      },
    },
    {
      label: "Create a simulated exchange request",
      done: demoHasRequest,
      action: () => {
        changeRole("agent");
        go("rebalance");
      },
    },
    {
      label: "Accept the request as supervisor",
      done: demoHasAccepted,
      action: () => {
        changeRole("supervisor");
        go("operations");
      },
    },
    {
      label: "Complete the exchange and review recorded balances",
      done: demoHasCompleted,
      action: () => {
        changeRole("supervisor");
        go("operations");
      },
    },
    {
      label: "Compare the same-demand service replay",
      done: replayAfterCompletion && demoHasCompleted,
      action: () => (page === "demo" ? refreshReplay() : go("demo")),
    },
  ];
  const currentDemoStep = demoSteps.findIndex((step) => !step.done);

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        className={"sidebar " + (menu ? "open" : "")}
        aria-label="Main navigation"
      >
        <div className="brand">
          <div>
            <strong>UPAY FLOWCAST</strong>
            <small>AI Agent Liquidity Forecasting</small>
          </div>
          <button
            ref={closeMenuRef}
            className="drawer-close"
            aria-label="Close navigation"
            onClick={() => {
              setMenu(false);
              menuButtonRef.current?.focus();
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="role-switch" aria-label="Workspace">
          <button
            className={role === "agent" ? "selected" : ""}
            aria-pressed={role === "agent"}
            onClick={() => changeRole("agent")}
          >
            {t.agent}
          </button>
          <button
            className={role === "supervisor" ? "selected" : ""}
            aria-pressed={role === "supervisor"}
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
                aria-current={page === p ? "page" : undefined}
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
            aria-current={page === "demo" ? "page" : undefined}
            onClick={() => go("demo")}
          >
            <CircleHelp size={18} />
            <span>{t.demo}</span>
          </button>
        </nav>
        <button
          className="sidebar-language"
          onClick={() => setLang(lang === "en" ? "bn" : "en")}
        >
          {lang === "en" ? "বাংলা ভাষা" : "English language"}
        </button>
        <div className="sidebar-foot">
          <span className="live-dot" />
          {t.simulation} · {t.prototype}
          <p>
            {lang === "bn"
              ? "বাস্তব লেনদেন বা সরকারি সংযোগ নেই"
              : "No live transfers or official integration"}
          </p>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="main" id="main-content">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="menu-button"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu size={23} />
          </button>
          <div className="top-title">
            <h1>{t[page]}</h1>
            <p>
              <CalendarDays size={13} aria-hidden="true" />{" "}
              {forecast?.clock
                ? `${role === "agent" ? forecast.agent.name : "Dhaka network"} · ${dateTime(forecast.clock)} · Asia/Dhaka`
                : t.simulation}
            </p>
          </div>
          <div className="top-actions">
            <span className="prototype-pill">{t.simulation}</span>
            <span
              className={
                "freshness-pill " +
                (forecast?.stale && role === "agent" ? "stale" : "")
              }
            >
              <span className="freshness-dot" />
              {role === "agent"
                ? forecast?.stale
                  ? t.confirm
                  : t.balanceCurrent
                : `${summary?.stale || 0} ${t.staleCount}`}
            </span>
            <button
              className="alert-shortcut"
              onClick={() =>
                role === "agent"
                  ? go("alerts")
                  : (setRiskFilter("High"), go("overview"))
              }
              aria-label={`${activeAlertCount} active alerts; open ${role === "agent" ? "alerts" : "high-risk watchlist"}`}
            >
              <Bell size={17} />
              <span>{activeAlertCount}</span>
            </button>
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
              disabled={loading}
            >
              <RefreshCcw size={18} className={loading ? "spinning" : ""} />
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="notice error" role="alert">
              <AlertTriangle size={18} />
              {error}
              {!forecast && (
                <button className="text-link" onClick={refresh}>
                  Retry
                </button>
              )}
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
            <div
              className="skeleton-grid"
              aria-label="Loading scenario and forecasts"
              aria-busy="true"
            >
              <div className="skeleton-line wide" />
              <div className="skeleton-row">
                <div />
                <div />
                <div />
                <div />
              </div>
              <div className="skeleton-panel" />
            </div>
          ) : null}
          {forecast && (
            <>
              {(role === "agent" || page === "details" || page === "demo") && (
                <div className="agent-strip">
                  <div>
                    <span className="eyebrow">{t.selectedAgent}</span>
                    <h2>
                      {forecast.agent.name}{" "}
                      <span className="muted">{forecast.agent.id}</span>
                    </h2>
                    <p>
                      {forecast.agent.area} ·{" "}
                      {isOpen
                        ? lang === "bn"
                          ? "এখন খোলা"
                          : "Open now"
                        : lang === "bn"
                          ? "এখন বন্ধ"
                          : "Closed now"}{" "}
                      · {lang === "bn" ? "শেষ নিশ্চিত" : "Last confirmed"}{" "}
                      {dateTime(forecast.agent.confirmed_at)}
                    </p>
                    <p className="strip-recommendation">
                      {forecast.stale
                        ? lang === "bn"
                          ? "পদক্ষেপের আগে গণনা করা ব্যালেন্স নিশ্চিত করুন।"
                          : "Confirm the counted balance before acting."
                        : forecast.kind
                          ? lang === "bn"
                            ? `${time(forecast.earliest_breach)}-এর আগে ${taka(forecast.required[forecast.kind])} ${forecast.kind === "cash" ? t.cash : t.emoney} প্রস্তুত করুন।`
                            : `Prepare ${taka(forecast.required[forecast.kind])} ${forecast.kind === "cash" ? t.cash : t.emoney} before ${time(forecast.earliest_breach)}.`
                          : lang === "bn"
                            ? "পরবর্তী ছয় ঘণ্টায় উভয় ব্যালেন্স সংরক্ষণের ওপরে থাকবে।"
                            : "Both balances stay above reserve for six forecast hours."}
                    </p>
                  </div>
                  <div className="strip-actions">
                    <Badge risk={forecast.risk} lang={lang} />
                    <label className="select-label">
                      {lang === "bn" ? "এজেন্ট" : "Agent"}
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
                  <div className="balance-grid dashboard-metrics">
                    <BalanceCard
                      icon={Wallet}
                      title={t.cash}
                      value={forecast.agent.cash}
                      reserve={forecast.agent.cash_reserve}
                      tone="blue"
                      reserveLabel={t.reserve}
                    />
                    <BalanceCard
                      icon={ArrowLeftRight}
                      title={t.emoney}
                      value={forecast.agent.emoney}
                      reserve={forecast.agent.emoney_reserve}
                      tone="yellow"
                      reserveLabel={t.reserve}
                    />
                    <InfoCard
                      icon={AlertTriangle}
                      title={t.additionalRequired}
                      value={taka(
                        forecast.kind ? forecast.required[forecast.kind] : 0,
                      )}
                      detail={
                        forecast.kind
                          ? `${forecast.kind === "cash" ? t.cash : t.emoney} · ${lang === "bn" ? "সম্ভাব্য সর্বনিম্ন ব্যালেন্স সংরক্ষণের ওপরে রাখতে" : "to keep the projected minimum above reserve"}`
                          : lang === "bn"
                            ? "এই ছয় ঘণ্টায় অতিরিক্ত ব্যালেন্স লাগবে না"
                            : "No additional balance needed in this horizon"
                      }
                    />
                    <InfoCard
                      icon={BarChart3}
                      title={t.forecastRequests}
                      value={forecast.buckets
                        .reduce((total, b) => total + b.demand_count, 0)
                        .toLocaleString("en-BD")}
                      detail={`${t.forecastHour} · ${t.peak} ${peakBucket?.demand_count || 0} ${time(peakBucket?.time || null)}`}
                    />
                  </div>
                  <div className="forecast-layout">
                    <div className="card chart-card forecast-anchor">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">
                            {lang === "bn"
                              ? "ছয় ঘণ্টার তারল্য পূর্বাভাস"
                              : "SIX-HOUR LIQUIDITY PROJECTION"}
                          </span>
                          <h3>{t.forecast}</h3>
                          <p>
                            {t.currentBalanceLabel}{" "}
                            {chartKind === "cash" ? t.cash : t.emoney}:{" "}
                            {taka(forecast.agent[chartKind])} · {t.reserve}{" "}
                            {taka(forecast.agent[`${chartKind}_reserve`])}
                          </p>
                        </div>
                        <div
                          className="segmented"
                          aria-label="Forecast balance"
                        >
                          <button
                            className={chartKind === "cash" ? "on" : ""}
                            aria-pressed={chartKind === "cash"}
                            onClick={() => setChartKind("cash")}
                          >
                            {t.cash}
                          </button>
                          <button
                            className={chartKind === "emoney" ? "on" : ""}
                            aria-pressed={chartKind === "emoney"}
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
                            margin={{ top: 12, right: 12, left: 3, bottom: 0 }}
                          >
                            <CartesianGrid vertical={false} stroke="#e8edf3" />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              width={58}
                              tickFormatter={takaAxis}
                              domain={([dataMin, dataMax]) => {
                                const reserve =
                                  forecast.agent[`${chartKind}_reserve`] / 100;
                                const low = Math.min(dataMin, reserve);
                                const high = Math.max(dataMax, reserve);
                                const pad = Math.max(500, (high - low) * 0.12);
                                return [low - pad, high + pad];
                              }}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                const row = payload?.[0]?.payload as
                                  (typeof chartData)[number] | undefined;
                                return active && row ? (
                                  <div className="chart-tooltip">
                                    <strong>{row.fullTime}</strong>
                                    <span>
                                      {lang === "bn" ? "সম্ভাব্য" : "Projected"}{" "}
                                      {chartKind === "cash" ? t.cash : t.emoney}
                                      : ৳
                                      {row[chartKind].toLocaleString("en-BD")}
                                    </span>
                                    <span>
                                      {t.reserve}: ৳
                                      {row[
                                        `${chartKind}Reserve`
                                      ].toLocaleString("en-BD")}
                                    </span>
                                    <span>
                                      {t.forecastRequests}: {row.count}
                                    </span>
                                    <span>
                                      Cash-in: ৳
                                      {row.cashIn.toLocaleString("en-BD")} ·
                                      Cash-out: ৳
                                      {row.cashOut.toLocaleString("en-BD")}
                                    </span>
                                  </div>
                                ) : null;
                              }}
                            />
                            <ReferenceLine
                              y={
                                (chartKind === "cash"
                                  ? forecast.agent.cash_reserve
                                  : forecast.agent.emoney_reserve) / 100
                              }
                              stroke="#c05649"
                              strokeDasharray="5 4"
                            />
                            <Line
                              type="monotone"
                              isAnimationActive={false}
                              dataKey={chartKind}
                              name={chartKind === "cash" ? t.cash : t.emoney}
                              stroke="#2253A0"
                              strokeWidth={3}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i className="legend-line" />
                          {t.projectedBalance}
                        </span>
                        <span>
                          <i className="legend-dash" />
                          {t.reserve}
                        </span>
                      </div>
                      <p className="sr-only">
                        {chartKind === "cash" ? t.cash : t.emoney} starts at{" "}
                        {taka(forecast.agent[chartKind])}; reserve is{" "}
                        {taka(forecast.agent[`${chartKind}_reserve`])}.{" "}
                        {forecast[`breach_${chartKind}`]
                          ? `Earliest reserve breach at ${dateTime(forecast[`breach_${chartKind}`])}.`
                          : "No reserve breach in the six-hour forecast."}
                      </p>
                      <p className="chart-note">
                        {forecast.method} ·{" "}
                        {lang === "bn"
                          ? `ঐতিহাসিক যাচাই ত্রুটি থেকে উদাহরণস্বরূপ ছয় ঘণ্টার সীমা ±${taka(forecast.buckets[5].range_half_width)}। এটি নিশ্চিততার সীমা বা ঘাটতির সম্ভাবনা নয়।`
                          : `Illustrative six-hour error range ±${taka(forecast.buckets[5].range_half_width)}. This is based on historical validation error, not a confidence interval or shortage probability.`}
                      </p>
                    </div>
                    <div
                      className={
                        "card risk-action " +
                        (forecast.risk === "High" ? "risk-high" : "")
                      }
                    >
                      <span className="eyebrow">{t.reserveWatch}</span>
                      <div className="risk-head">
                        <Badge risk={forecast.risk} lang={lang} />
                        <Clock3 size={20} />
                      </div>
                      <h3>
                        {forecast.earliest_breach
                          ? lang === "bn"
                            ? `${forecast.kind === "cash" ? t.cash : t.emoney} সংরক্ষণ কমতে পারে`
                            : `${forecast.kind === "cash" ? t.cash : t.emoney} reserve may be breached`
                          : t.allclear}
                      </h3>
                      <p className="risk-time">
                        {forecast.earliest_breach
                          ? dateTime(forecast.earliest_breach)
                          : `${lang === "bn" ? "পরবর্তী পর্যালোচনা" : "Next review"}: ${time(forecast.buckets[5]?.time || null)}`}
                      </p>
                      {forecast.kind && (
                        <p className="risk-amount">
                          {lang === "bn" ? "প্রয়োজন" : "Required"}{" "}
                          {taka(forecast.required[forecast.kind])}
                        </p>
                      )}
                      <p>
                        {lang === "en"
                          ? forecast.explanation_en
                          : forecast.explanation_bn}
                      </p>
                      <p className="chart-note">
                        {lang === "bn"
                          ? "সংরক্ষণ সীমা অতিক্রম একটি পরিচালন সতর্কতা; এর অর্থ প্রতিটি লেনদেন ব্যর্থ হবে না।"
                          : "A reserve breach is an operating warning; it does not by itself mean a customer transaction fails."}
                      </p>
                      <div className="button-row">
                        <button
                          className="button primary"
                          onClick={() => go("rebalance")}
                        >
                          {t.options}
                          <ChevronRight size={16} />
                        </button>
                        {forecast.stale && (
                          <button
                            className="button secondary"
                            onClick={() => go("confirm")}
                          >
                            {t.confirm}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-secondary">
                    <div className="card chart-card demand-panel">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">{t.forecastHour}</span>
                          <h3>{t.demand}</h3>
                          <p>
                            {t.peak}: {peakBucket?.demand_count || 0}{" "}
                            {lang === "bn" ? "অনুরোধ" : "requests at"}{" "}
                            {time(peakBucket?.time || null)}
                          </p>
                        </div>
                        <span className="small-pill">
                          {forecast.buckets.reduce(
                            (total, b) => total + b.demand_count,
                            0,
                          )}{" "}
                          {lang === "bn" ? "অনুরোধ" : "requests"}
                        </span>
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
                            <Tooltip
                              formatter={(value) =>
                                `${value} requested transactions`
                              }
                              labelFormatter={(label) =>
                                `Forecast hour ${label}`
                              }
                            />
                            <Bar
                              dataKey="count"
                              isAnimationActive={false}
                              name="Requested transactions"
                              fill="#F1C93B"
                              radius={[4, 4, 0, 0]}
                            >
                              <LabelList
                                dataKey="count"
                                position="top"
                                fontSize={11}
                                fill="#4d627b"
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="chart-note">
                        Requested transactions per hour. Completed-only history
                        can hide unmet demand.
                      </p>
                    </div>
                    <div className="card list-card compact-options">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">{t.safeSources}</span>
                          <h3>{t.options}</h3>
                        </div>
                        <ShieldCheck size={20} />
                      </div>
                      {safeCandidates.slice(0, 3).map((c) => (
                        <div className="option-row" key={c.id}>
                          <div>
                            <strong>{c.name}</strong>
                            <span>
                              {c.area} · {c.distance_km} km · about{" "}
                              {c.travel_minutes} min
                            </span>
                            <small>{c.reason}</small>
                          </div>
                          <b>{taka(c.safe_available)}</b>
                        </div>
                      ))}
                      {!safeCandidates.length && (
                        <Empty>
                          No safe source is currently available. Confirm
                          balances or review the distributor later.
                        </Empty>
                      )}
                      <button
                        className="text-link"
                        onClick={() => go("rebalance")}
                      >
                        Compare all options <ChevronRight size={16} />
                      </button>
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
                  <div className="card list-card recent-panel">
                    <div className="card-title">
                      <div>
                        <span className="eyebrow">
                          {lang === "bn" ? "কার্যক্রমের ইতিহাস" : "AUDIT TRAIL"}
                        </span>
                        <h3>{t.recentActivity}</h3>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => go("activity")}
                      >
                        View all <ChevronRight size={16} />
                      </button>
                    </div>
                    {activity?.events.length ? (
                      activity.events.slice(0, 3).map((e) => (
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
                      <Empty>
                        No events recorded yet. Balance confirmations and
                        requests will appear here.
                      </Empty>
                    )}
                  </div>
                </>
              )}
              {page === "alerts" && (
                <>
                  <SectionHead
                    title="Active alerts"
                    subtitle="Operational rules use breach timing and projected negative balances, not probabilities."
                  />
                  <div className="filter-chips" aria-label="Alert filters">
                    {(["all", "cash", "emoney"] as const).map((k) => (
                      <button
                        key={k}
                        className={alertFilter === k ? "selected" : ""}
                        aria-pressed={alertFilter === k}
                        onClick={() => setAlertFilter(k)}
                      >
                        {k === "all"
                          ? "All alerts"
                          : k === "cash"
                            ? t.cash
                            : t.emoney}
                      </button>
                    ))}
                    <select
                      aria-label="Filter alerts by risk"
                      value={alertRiskFilter}
                      onChange={(e) => setAlertRiskFilter(e.target.value)}
                    >
                      {[
                        "All risks",
                        "High",
                        "Medium",
                        "Low",
                        "Needs confirmation",
                      ].map((risk) => (
                        <option key={risk} value={risk}>
                          {riskLabel(risk, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="card-grid">
                    {(["cash", "emoney"] as const)
                      .filter(
                        (k) =>
                          forecast[`breach_${k}`] &&
                          (alertFilter === "all" || alertFilter === k) &&
                          (alertRiskFilter === "All risks" ||
                            forecast.risk === alertRiskFilter),
                      )
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
                    {!(["cash", "emoney"] as const).some(
                      (k) =>
                        forecast[`breach_${k}`] &&
                        (alertFilter === "all" || alertFilter === k) &&
                        (alertRiskFilter === "All risks" ||
                          forecast.risk === alertRiskFilter),
                    ) && (
                      <Empty>
                        No active reserve alerts match these filters.{" "}
                        <button
                          className="text-link"
                          onClick={() => {
                            setAlertFilter("all");
                            setAlertRiskFilter("All risks");
                          }}
                        >
                          Show all
                        </button>
                      </Empty>
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
                  <div className="rebalance-layout">
                    <div>
                      <SectionHead
                        title={t.suitableSources}
                        subtitle={`${safeCandidates.length} candidates preserve both participants’ projected reserves.`}
                      />
                      <div className="candidate-grid">
                        {safeCandidates.map((c) => (
                          <div
                            className={`card candidate candidate-safe ${selectedCandidate?.id === c.id ? "chosen" : ""}`}
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
                              <span className="status good">Suitable</span>
                            </div>
                            <div className="candidate-facts">
                              <span>
                                <strong>{c.distance_km} km</strong> away
                              </span>
                              <span>
                                <strong>{c.travel_minutes} min</strong> estimate
                              </span>
                              <span>
                                <strong>{taka(c.safe_available)}</strong> safe
                                capacity
                              </span>
                            </div>
                            <p className="reason">{c.reason}</p>
                            <button
                              type="button"
                              className="select-candidate"
                              aria-pressed={selectedCandidate?.id === c.id}
                              onClick={() => setSelectedCandidateId(c.id)}
                            >
                              {selectedCandidate?.id === c.id
                                ? "Selected source"
                                : "Select source"}
                              <ChevronRight size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {!safeCandidates.length && (
                        <Empty>
                          No suitable source right now. Confirm stale balances
                          or review the modeled distributor later.
                        </Empty>
                      )}
                      <details className="excluded-section">
                        <summary>
                          Why {excludedCandidates.length} other sources are
                          excluded
                        </summary>
                        <div className="candidate-grid">
                          {excludedCandidates.map((c) => (
                            <div
                              className="card candidate candidate-excluded"
                              key={c.id}
                            >
                              <div className="card-title">
                                <div>
                                  <h3>{c.name}</h3>
                                  <p>
                                    {c.area} · {c.id}
                                  </p>
                                </div>
                                <span className="status bad">Excluded</span>
                              </div>
                              <div className="candidate-facts">
                                <span>{c.distance_km} km</span>
                                <span>{c.travel_minutes} min estimated</span>
                                <span>
                                  {taka(c.safe_available)} safe capacity
                                </span>
                              </div>
                              <p className="reason">{c.reason}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                    <div className="card form-card request-panel">
                      <span className="eyebrow">{t.requestSummary}</span>
                      <h3>
                        {selectedCandidate
                          ? selectedCandidate.name
                          : "Select a suitable source"}
                      </h3>
                      {selectedCandidate && (
                        <p>
                          {selectedCandidate.area} ·{" "}
                          {selectedCandidate.distance_km} km · estimated arrival{" "}
                          {dateTime(selectedCandidate.eta)}
                        </p>
                      )}
                      <div className="request-facts">
                        <span>
                          Projected need <strong>{taka(rec.required)}</strong>
                        </span>
                        <span>
                          Remaining gap <strong>{taka(outstanding)}</strong>
                        </span>
                        <span>
                          Safe capacity{" "}
                          <strong>
                            {taka(selectedCandidate?.safe_available || 0)}
                          </strong>
                        </span>
                      </div>
                      <label>
                        Exchange amount (৳)
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={(requestLimit / 100).toFixed(2)}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </label>
                      {selectedCandidate &&
                        Number(amount) * 100 > requestLimit && (
                          <p className="inline-error" role="alert">
                            Request at most {taka(requestLimit)} to stay within
                            this source’s safe capacity and the remaining gap.
                            Reduce the amount or choose another source.
                          </p>
                        )}
                      {outstanding === 0 && (
                        <p className="notice success">
                          Existing open requests cover the projected need.
                        </p>
                      )}
                      <p>
                        {rec.kind === "cash"
                          ? "Receiving cash gives the same amount of e-money to the source."
                          : "Receiving e-money gives the same amount of cash to the source."}{" "}
                        No live transfer occurs.
                      </p>
                      <p>
                        Requested {taka(Math.round(Number(amount || 0) * 100))}{" "}
                        · gap after request{" "}
                        {taka(
                          Math.max(
                            0,
                            outstanding - Math.round(Number(amount || 0) * 100),
                          ),
                        )}
                      </p>
                      <button
                        className="button primary"
                        disabled={
                          busy ||
                          !selectedCandidate ||
                          !amount ||
                          Number(amount) <= 0 ||
                          Math.round(Number(amount) * 100) > requestLimit
                        }
                        onClick={() => {
                          if (!selectedCandidate) return;
                          const val = Number(amount);
                          if (
                            !Number.isFinite(val) ||
                            val <= 0 ||
                            Math.round(val * 100) > requestLimit
                          ) {
                            setError(
                              `Enter an amount up to ${taka(requestLimit)}.`,
                            );
                            return;
                          }
                          mutate(
                            () =>
                              post("/requests", {
                                recipient_id: aid,
                                donor_id: selectedCandidate.id,
                                kind: rec.kind,
                                amount: Math.round(val * 100),
                              }),
                            `Request sent to ${selectedCandidate.name}. Awaiting supervisor acceptance.`,
                          );
                        }}
                      >
                        {busy ? "Sending…" : t.request}
                        <ChevronRight size={16} />
                      </button>
                      <p className="chart-note">{rec.travel_method}</p>
                    </div>
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
                        aria-invalid={
                          cashInput !== "" &&
                          (!Number.isInteger(Number(cashInput)) ||
                            Number(cashInput) < 0)
                        }
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
                        aria-invalid={
                          emoneyInput !== "" &&
                          (!Number.isInteger(Number(emoneyInput)) ||
                            Number(emoneyInput) < 0)
                        }
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
                    <p className="chart-note">
                      Values are whole taka. The saved ledger records paisa and
                      updates the forecast after confirmation.
                    </p>
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
                      [t.openAgents, summary.open],
                      [t.highRisk, summary.high_risk],
                      [t.cashBreaches, summary.cash_breaches],
                      [t.emoneyBreaches, summary.emoney_breaches],
                      [t.pendingRequests, summary.pending],
                      [t.staleBalances, summary.stale],
                    ].map(([label, value]) => (
                      <div className="card metric" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="supervisor-insights">
                    <div className="card risk-overview">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">{t.riskOverview}</span>
                          <h3>{t.filterByRisk}</h3>
                        </div>
                        <button
                          className="text-link"
                          onClick={() => setRiskFilter("All risks")}
                        >
                          {lang === "bn" ? "ফিল্টার মুছুন" : "Reset filters"}
                        </button>
                      </div>
                      <div className="risk-filters">
                        {[
                          "All risks",
                          "High",
                          "Medium",
                          "Low",
                          "Needs confirmation",
                        ].map((risk) => (
                          <button
                            key={risk}
                            className={riskFilter === risk ? "selected" : ""}
                            aria-pressed={riskFilter === risk}
                            onClick={() => setRiskFilter(risk)}
                          >
                            <span>{riskLabel(risk, lang)}</span>
                            <strong>
                              {risk === "All risks"
                                ? summary.agents.length
                                : summary.agents.filter((f) => f.risk === risk)
                                    .length}
                            </strong>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="card pending-panel">
                      <span className="eyebrow">{t.pendingRequests}</span>
                      <h3>
                        {summary.pending}{" "}
                        {lang === "bn"
                          ? "পর্যালোচনার অপেক্ষায়"
                          : "awaiting review"}
                      </h3>
                      {requests
                        .filter((r) => r.status === "Pending")
                        .slice(0, 3)
                        .map((r) => (
                          <div className="pending-row" key={r.id}>
                            <span>
                              #{r.id} · {r.recipient_id} ← {r.donor_id}
                            </span>
                            <strong>{taka(r.amount)}</strong>
                          </div>
                        ))}
                      {!summary.pending && (
                        <p>
                          {lang === "bn"
                            ? `গ্রহণের অপেক্ষায় কোনো অনুরোধ নেই। ${summary.accepted}টি গৃহীত অনুরোধ কার্যক্রমে আছে।`
                            : `No requests need acceptance. ${summary.accepted} accepted requests remain in Operations.`}
                        </p>
                      )}
                      <button
                        className="text-link"
                        onClick={() => go("operations")}
                      >
                        {t.operations} <ChevronRight size={16} />
                      </button>
                    </div>
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
                          <option key={a} value={a}>
                            {a === "All areas" && lang === "bn"
                              ? "সব এলাকা"
                              : a}
                          </option>
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
                          <option key={r} value={r}>
                            {riskLabel(r, lang)}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Sort agents"
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(e.target.value as typeof sortBy)
                        }
                      >
                        <option value="risk">
                          {lang === "bn" ? "বাছাই: ঝুঁকি" : "Sort: risk"}
                        </option>
                        <option value="breach">
                          {lang === "bn"
                            ? "বাছাই: প্রথম ঘাটতি"
                            : "Sort: earliest breach"}
                        </option>
                        <option value="required">
                          {lang === "bn"
                            ? "বাছাই: প্রয়োজনীয় পরিমাণ"
                            : "Sort: required amount"}
                        </option>
                      </select>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Agent</th>
                            <th>Area</th>
                            <th>Cash</th>
                            <th>E-money</th>
                            <th>Risk</th>
                            <th>Breach</th>
                            <th>Required</th>
                            <th>Freshness</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedAgents.map((f) => (
                            <tr key={f.agent.id}>
                              <td>
                                <strong>{f.agent.name}</strong>
                                <small>{f.agent.id}</small>
                              </td>
                              <td>{f.agent.area}</td>
                              <td className="number-cell">
                                {taka(f.agent.cash)}
                              </td>
                              <td className="number-cell">
                                {taka(f.agent.emoney)}
                              </td>
                              <td>
                                <Badge risk={f.risk} lang={lang} />
                              </td>
                              <td>{dateTime(f.earliest_breach)}</td>
                              <td>{f.kind ? taka(f.required[f.kind]) : "—"}</td>
                              <td>
                                {f.stale
                                  ? "Stale"
                                  : dateTime(f.agent.confirmed_at)}
                              </td>
                              <td>
                                <button
                                  className="text-link"
                                  aria-label={`View details for ${f.agent.name}`}
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
                        <Empty>
                          No agents match these filters.{" "}
                          <button
                            className="text-link"
                            onClick={() => {
                              setAreaFilter("All areas");
                              setRiskFilter("All risks");
                              setSearch("");
                            }}
                          >
                            Clear filters
                          </button>
                        </Empty>
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
                      reserveLabel={t.reserve}
                    />
                    <BalanceCard
                      icon={ArrowLeftRight}
                      title={t.emoney}
                      value={forecast.agent.emoney}
                      reserve={forecast.agent.emoney_reserve}
                      tone="yellow"
                      reserveLabel={t.reserve}
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
                              isAnimationActive={false}
                              stroke="#2253A0"
                              strokeWidth={2}
                            />
                            <Line
                              dataKey="emoney"
                              isAnimationActive={false}
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
                              isAnimationActive={false}
                              name="Cash-in ৳"
                              fill="#2253A0"
                            />
                            <Bar
                              dataKey="cashOut"
                              isAnimationActive={false}
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
                                <strong>{key.replaceAll("_", " ")}</strong>
                                <small>
                                  {key === "demand_count"
                                    ? "Requested transactions per hour"
                                    : "Paisa converted to taka"}
                                </small>
                              </td>
                              <td>
                                {key === "demand_count"
                                  ? `${m.baseline_mae.toFixed(1)} requests`
                                  : taka(m.baseline_mae)}
                              </td>
                              <td>
                                {m.model_mae === null
                                  ? "Unavailable"
                                  : key === "demand_count"
                                    ? `${m.model_mae.toFixed(1)} requests`
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
                    <p>
                      Amounts use integer paisa (৳1 = 100 paisa). Timestamps
                      need a timezone offset, for example <code>+06:00</code>.
                      Maximum file size: 3 MB.
                    </p>
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
                        disabled={!csvFile || busy || previewBusy}
                        onClick={async () => {
                          if (!csvFile) return;
                          setPreviewBusy(true);
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
                          } finally {
                            setPreviewBusy(false);
                          }
                        }}
                      >
                        {previewBusy ? "Checking rows…" : "Preview import"}
                      </button>
                      <button
                        className="button primary"
                        disabled={
                          !csvFile ||
                          !csvPreview ||
                          csvPreview.errors.length > 0 ||
                          busy ||
                          previewBusy
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
                        {busy ? "Importing…" : "Commit import"}
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
                    <div className="card demo-steps">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">GUIDED SEQUENCE</span>
                          <h3>
                            {currentDemoStep < 0
                              ? "Walkthrough complete"
                              : `Step ${currentDemoStep + 1} of ${demoSteps.length}`}
                          </h3>
                        </div>
                        <span className="small-pill">
                          {demoSteps.filter((step) => step.done).length}/
                          {demoSteps.length} done
                        </span>
                      </div>
                      <ol className="steps">
                        {demoSteps.map((step, index) => (
                          <li
                            key={step.label}
                            className={
                              step.done
                                ? "done"
                                : index === currentDemoStep
                                  ? "current"
                                  : ""
                            }
                          >
                            <span className="step-marker">
                              {step.done ? (
                                <CheckCircle2 size={17} />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <button onClick={step.action}>
                              <strong>{step.label}</strong>
                              <small>
                                {step.done
                                  ? "Completed"
                                  : index === currentDemoStep
                                    ? "Next action"
                                    : "Open screen"}
                              </small>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="card outcome">
                      <div className="card-title">
                        <div>
                          <span className="eyebrow">SAME SEEDED DEMAND</span>
                          <h3>Service outcome simulation</h3>
                        </div>
                        <button
                          className="text-link"
                          onClick={refreshReplay}
                          disabled={replayBusy}
                        >
                          {replayBusy ? "Calculating…" : "Recalculate"}
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
                  <button
                    className="button danger"
                    onClick={reset}
                    disabled={busy}
                  >
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
              aria-current={page === p ? "page" : undefined}
              onClick={() => go(p)}
            >
              <Icon size={19} />
              <span>{t[p]}</span>
            </button>
          );
        })}
        <button
          className="more-nav"
          onClick={() => setMenu(true)}
          aria-label="More destinations and settings"
        >
          <MoreHorizontal size={20} />
          <span>{t.more}</span>
        </button>
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
  reserveLabel,
}: {
  icon: typeof Wallet;
  title: string;
  value: number;
  reserve: number;
  tone: string;
  reserveLabel: string;
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
        <span>{reserveLabel}</span>
        <b>{taka(reserve)}</b>
      </div>
    </div>
  );
}
function InfoCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Wallet;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card balance-card info-card">
      <div className="balance-title">
        <span className="icon-box">
          <Icon size={20} />
        </span>
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
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
      <div className="request-lifecycle" aria-label="Request lifecycle">
        <span>1 · Pending</span>
        <ChevronRight size={15} />
        <span>2 · Accepted</span>
        <ChevronRight size={15} />
        <span>3 · Completed</span>
        <small>
          Rejected and cancelled requests close without an exchange.
        </small>
      </div>
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
      {items
        .filter((r) => r.status === "Completed")
        .map((r) => (
          <CompletionDetails key={r.id} request={r} />
        ))}
    </div>
  );
}
