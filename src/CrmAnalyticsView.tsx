import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Award, Building2, Kanban, PieChart, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { fetchCrmAccounts, fetchCrmDeals } from "./crm/crmApi";
import {
  DEAL_STAGES,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  NICHE_LABELS,
  STAGE_LABELS,
  type CrmAccount,
  type CrmDeal,
  type DealStage,
  type Niche,
} from "./crm/crmModel";

const CLOSED: DealStage[] = ["closed_won", "closed_lost"];
const PIE_COLORS = ["#111827", "#374151", "#6b7280", "#9ca3af", "#c9a227", "#d4b84a", "#a16207", "#854d0e"];

function isOpenPipelineStage(stage: DealStage): boolean {
  return !CLOSED.includes(stage) && stage !== "nurture_later";
}

function accountLabel(a: CrmAccount): string {
  return a.clinicName?.trim() || a.contactName?.trim() || a.email?.trim() || "Account";
}

type PeriodPreset = "all" | "month" | "d30" | "d90" | "custom";

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(ymd: string): number {
  const [y, m, day] = ymd.split("-").map(Number);
  if (!y || !m || !day) return 0;
  const d = new Date(y, m - 1, day, 0, 0, 0, 0);
  return d.getTime();
}

function endOfLocalDay(ymd: string): number {
  const [y, m, day] = ymd.split("-").map(Number);
  if (!y || !m || !day) return 0;
  const d = new Date(y, m - 1, day, 23, 59, 59, 999);
  return d.getTime();
}

function getPeriodBounds(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string
): { allTime: true } | { allTime: false; fromMs: number; toMs: number } {
  if (preset === "all") {
    return { allTime: true };
  }
  const now = new Date();
  if (preset === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { allTime: false, fromMs: from.getTime(), toMs: to.getTime() };
  }
  if (preset === "d30" || preset === "d90") {
    const days = preset === "d30" ? 30 : 90;
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);
    return { allTime: false, fromMs: from.getTime(), toMs: to.getTime() };
  }
  const fromMs = startOfLocalDay(customFrom);
  const toMs = endOfLocalDay(customTo);
  if (!fromMs || !toMs) {
    return { allTime: true };
  }
  return { allTime: false, fromMs: Math.min(fromMs, toMs), toMs: Math.max(fromMs, toMs) };
}

function dealTimeForFilter(d: CrmDeal): number {
  return d.createdAtMs > 0 ? d.createdAtMs : d.updatedAtMs;
}

type Props = {
  user: User;
  refreshKey: number;
};

export default function CrmAnalyticsView({ user, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [dealsData, setDealsData] = useState<CrmDeal[]>([]);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState(() => {
    const t = new Date();
    t.setMonth(t.getMonth() - 2);
    return toYmd(t);
  });
  const [customTo, setCustomTo] = useState(() => toYmd(new Date()));
  const [nicheFilter, setNicheFilter] = useState<"all" | Niche>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | string>("all");

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      await user.getIdToken(true);
      const [deals, accs] = await Promise.all([fetchCrmDeals(), fetchCrmAccounts()]);
      setDealsData(deals);
      setAccounts(accs);
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const accById = useMemo(() => {
    const m = new Map<string, CrmAccount>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  const periodBounds = useMemo(
    () => getPeriodBounds(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );

  const filteredDeals = useMemo(() => {
    return dealsData.filter((d) => {
      if (nicheFilter !== "all" || sourceFilter !== "all") {
        const acc = accById.get(d.accountId);
        if (nicheFilter !== "all" && (!acc || acc.niche !== nicheFilter)) return false;
        if (sourceFilter !== "all" && (!acc || acc.source !== sourceFilter)) return false;
      }
      if (periodBounds.allTime) return true;
      const t = dealTimeForFilter(d);
      if (!t) return false;
      return t >= periodBounds.fromMs && t <= periodBounds.toMs;
    });
  }, [dealsData, accById, periodBounds, nicheFilter, sourceFilter]);

  const {
    topOpenAccounts,
    topWonAccounts,
    largestOpenDeals,
    stageCounts,
    sourceRows,
    maxStageCount,
    stageBarData,
    sourcePieData,
    monthlyTrend,
    topOpenBarData,
  } = useMemo(() => {
    type Agg = { id: string; name: string; open: number; won: number; oN: number; wN: number };
    const accMap = new Map<string, Agg>();
    for (const a of accounts) {
      accMap.set(a.id, { id: a.id, name: accountLabel(a), open: 0, won: 0, oN: 0, wN: 0 });
    }
    const nameFor = (accountId: string) => accMap.get(accountId)?.name ?? "Account";
    for (const d of filteredDeals) {
      const row = accMap.get(d.accountId);
      if (!row) continue;
      if (d.stage === "closed_won") {
        row.won += d.value;
        row.wN += 1;
      }
      if (isOpenPipelineStage(d.stage)) {
        row.open += d.value;
        row.oN += 1;
      }
    }
    const all = [...accMap.values()];
    const topOpenAccounts = all.filter((r) => r.open > 0).sort((a, b) => b.open - a.open).slice(0, 5);
    const topWonAccounts = all.filter((r) => r.won > 0).sort((a, b) => b.won - a.won).slice(0, 5);

    const openDealsList = filteredDeals.filter((d) => isOpenPipelineStage(d.stage));
    const largestOpenDeals = [...openDealsList]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        currency: d.currency,
        stage: d.stage,
        accountName: nameFor(d.accountId),
      }));

    const stageList: { stage: DealStage; n: number }[] = [];
    for (const s of DEAL_STAGES) {
      const n = filteredDeals.filter((d) => d.stage === s).length;
      if (n > 0) stageList.push({ stage: s, n });
    }
    stageList.sort((a, b) => b.n - a.n);
    const maxStageCount = stageList.reduce((m, x) => Math.max(m, x.n), 0);

    const srcMap = new Map<string, { n: number; v: number }>();
    for (const d of filteredDeals) {
      const acc = accById.get(d.accountId);
      const key = acc ? String(acc.source || "other") : "unlinked";
      const cur = srcMap.get(key) ?? { n: 0, v: 0 };
      cur.n += 1;
      if (isOpenPipelineStage(d.stage)) cur.v += d.value;
      srcMap.set(key, cur);
    }
    const sourceLabel = (k: string) =>
      k === "unlinked"
        ? "No linked account"
        : k in LEAD_SOURCE_LABELS
          ? LEAD_SOURCE_LABELS[k as keyof typeof LEAD_SOURCE_LABELS]
          : k;
    const sourceRows = [...srcMap.entries()]
      .map(([key, { n, v }]) => ({ key, label: sourceLabel(key), n, v }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);

    const shortStage = (s: DealStage) => {
      const w = STAGE_LABELS[s].split(" ")[0];
      return w.length > 10 ? w.slice(0, 9) + "…" : w;
    };
    const stageBarData = DEAL_STAGES.map((s) => {
      const n = filteredDeals.filter((d) => d.stage === s).length;
      if (n === 0) return null;
      return { name: shortStage(s), full: STAGE_LABELS[s], count: n };
    }).filter((row): row is { name: string; full: string; count: number } => row !== null);

    const sourcePieData = [...srcMap.entries()].map(([key, { n }]) => ({
      name: sourceLabel(key),
      value: n,
      key,
    }));

    const monthBuckets = new Map<string, number>();
    for (const d of filteredDeals) {
      const t = dealTimeForFilter(d);
      if (!t) continue;
      const dt = new Date(t);
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      monthBuckets.set(k, (monthBuckets.get(k) ?? 0) + 1);
    }
    const monthlyTrend = [...monthBuckets.entries()]
      .map(([k, count]) => ({ month: k, label: k, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const topOpenBarData = topOpenAccounts.map((r) => ({
      name: r.name.length > 22 ? r.name.slice(0, 20) + "…" : r.name,
      fullName: r.name,
      value: r.open,
    }));

    return {
      topOpenAccounts,
      topWonAccounts,
      largestOpenDeals,
      stageCounts: stageList,
      sourceRows,
      maxStageCount,
      stageBarData,
      sourcePieData,
      monthlyTrend,
      topOpenBarData,
    };
  }, [accounts, filteredDeals, accById]);

  const periodHint = !periodBounds.allTime
    ? "Showing deals with activity in the selected date range (created date, or last updated if created is missing)."
    : "All time. Pick a date range to narrow results.";

  const resetFilters = () => {
    setPeriodPreset("all");
    setNicheFilter("all");
    setSourceFilter("all");
  };

  if (loading) {
    return <div className="crm-state">Loading analytics…</div>;
  }
  if (err) {
    return (
      <div className="crm-state crm-state-error" role="alert">
        {err}
      </div>
    );
  }

  return (
    <div className="crm-analytics">
      <header className="crm-main-header crm-ana-header">
        <div>
          <h1>Analytics</h1>
          <p>Top clients, deal size, pipeline mix, and lead sources from your CRM data.</p>
        </div>
      </header>

      <div className="crm-ana-filters" role="search" aria-label="Analytics filters">
        <div className="crm-ana-filters-row">
          <label className="crm-ana-field">
            <span className="crm-ana-label">Period</span>
            <select
              className="crm-ana-select"
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
            >
              <option value="all">All time</option>
              <option value="month">This month</option>
              <option value="d30">Last 30 days</option>
              <option value="d90">Last 90 days</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          {periodPreset === "custom" ? (
            <div className="crm-ana-dates">
              <label className="crm-ana-field">
                <span className="crm-ana-label">From</span>
                <input
                  type="date"
                  className="crm-ana-input"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="crm-ana-field">
                <span className="crm-ana-label">To</span>
                <input
                  type="date"
                  className="crm-ana-input"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
            </div>
          ) : null}
          <label className="crm-ana-field">
            <span className="crm-ana-label">Category (niche)</span>
            <select
              className="crm-ana-select"
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value as "all" | Niche)}
            >
              <option value="all">All niches</option>
              {(Object.keys(NICHE_LABELS) as Niche[]).map((k) => (
                <option key={k} value={k}>
                  {NICHE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-ana-field">
            <span className="crm-ana-label">Source</span>
            <select
              className="crm-ana-select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as "all" | string)}
            >
              <option value="all">All sources</option>
              {LEAD_SOURCES.map((k) => (
                <option key={k} value={k}>
                  {LEAD_SOURCE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="crm-ana-reset" onClick={resetFilters}>
            Reset
          </button>
        </div>
        <p className="crm-ana-filters-hint">{periodHint} Filters apply to the charts and tables below.</p>
      </div>

      {filteredDeals.length === 0 && dealsData.length > 0 ? (
        <p className="crm-ana-nodata" role="status">
          No deals match these filters. Try <strong>All time</strong>, reset category/source, or widen the custom date range.
        </p>
      ) : null}

      <div className="crm-ana-charts">
        {monthlyTrend.length > 0 ? (
          <section className="crm-dash-card crm-ana-chart-card" aria-labelledby="ana-trend">
            <h2 id="ana-trend" className="crm-dash-card-title">
              <TrendingUp size={18} strokeWidth={2} aria-hidden />
              Deals in period (by month)
            </h2>
            <p className="crm-dash-card-sub">Count of deals that match your filters, grouped by month (created / updated time).</p>
            <div className="crm-ana-rechart" role="img" aria-label="Bar chart of deal counts by month">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [v, "Deals"]}
                    labelFormatter={(l) => `Month: ${l}`}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5" }}
                  />
                  <Bar dataKey="count" name="Deals" fill="#111827" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : null}

        <div className="crm-ana-charts-row">
          <section className="crm-dash-card crm-ana-chart-card" aria-labelledby="ana-stage-bar">
            <h2 id="ana-stage-bar" className="crm-dash-card-title">
              <Kanban size={18} strokeWidth={2} aria-hidden />
              Pipeline by stage
            </h2>
            {stageBarData.length === 0 ? (
              <p className="crm-dash-empty">No deals in this view.</p>
            ) : (
              <div className="crm-ana-rechart" role="img" aria-label="Bar chart of deal count by pipeline stage">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={stageBarData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 64 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={92}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(v: number) => [v, "Deals"]}
                      labelFormatter={(_, p) => (p && p.length ? p[0].payload.full : "")}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5" }}
                    />
                    <Bar dataKey="count" name="Deals" fill="#374151" radius={[0, 4, 4, 0]}>
                      {stageBarData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="crm-dash-card crm-ana-chart-card" aria-labelledby="ana-pie">
            <h2 id="ana-pie" className="crm-dash-card-title">
              <PieChart size={18} strokeWidth={2} aria-hidden />
              Lead source
            </h2>
            <p className="crm-dash-card-sub">Share of deals by account source (linked account).</p>
            {sourcePieData.length === 0 ? (
              <p className="crm-dash-empty">No deals in this view.</p>
            ) : (
              <div className="crm-ana-rechart crm-ana-pie" role="img" aria-label="Pie chart of deals by lead source">
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPie>
                    <Pie
                      data={sourcePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {sourcePieData.map((entry, i) => (
                        <Cell key={entry.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, _n, props) => {
                        const total = sourcePieData.reduce((s, x) => s + x.value, 0);
                        const pct = total ? Math.round((v / total) * 100) : 0;
                        return [`${v} deals (${pct}%)`, props.payload.name];
                      }}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5" }}
                    />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>

        {topOpenBarData.length > 0 ? (
          <section className="crm-dash-card crm-ana-chart-card" aria-labelledby="ana-top-open-bar">
            <h2 id="ana-top-open-bar" className="crm-dash-card-title">
              <Building2 size={18} strokeWidth={2} aria-hidden />
              Open pipeline by account
            </h2>
            <p className="crm-dash-card-sub">Total open deal value (PHP) per account in this view.</p>
            <div className="crm-ana-rechart" role="img" aria-label="Horizontal bar chart of open pipeline value by account">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={topOpenBarData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => {
                      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                      if (v >= 10_000) return `${Math.round(v / 1_000)}k`;
                      if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
                      return String(v);
                    }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [`PHP ${v.toLocaleString()}`, "Open value"]}
                    labelFormatter={(_, p) => (p && p.length ? p[0].payload.fullName : "")}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5" }}
                  />
                  <Bar dataKey="value" name="Open PHP" fill="#c9a227" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : null}
      </div>

      <div className="crm-dash-analytics">
        <div className="crm-dash-analytics-grid">
          <section className="crm-dash-card" aria-labelledby="ana-top-open">
            <h2 id="ana-top-open" className="crm-dash-card-title">
              <Building2 size={18} strokeWidth={2} aria-hidden />
              Top accounts — open pipeline
            </h2>
            <p className="crm-dash-card-sub">By total deal value (excl. closed &amp; nurture)</p>
            {topOpenAccounts.length === 0 ? (
              <p className="crm-dash-empty">No open pipeline value in this view.</p>
            ) : (
              <table className="crm-dash-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Client</th>
                    <th scope="col" className="crm-dash-num">
                      Value
                    </th>
                    <th scope="col" className="crm-dash-num">
                      Deals
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topOpenAccounts.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td className="crm-dash-ellipsis" title={r.name}>
                        {r.name}
                      </td>
                      <td className="crm-dash-num">PHP {r.open.toLocaleString()}</td>
                      <td className="crm-dash-num">{r.oN}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="crm-dash-card" aria-labelledby="ana-top-won">
            <h2 id="ana-top-won" className="crm-dash-card-title">
              <Award size={18} strokeWidth={2} aria-hidden />
              Top clients — won revenue
            </h2>
            <p className="crm-dash-card-sub">Sum of closed won deal values per account</p>
            {topWonAccounts.length === 0 ? (
              <p className="crm-dash-empty">No closed-won deals in this view.</p>
            ) : (
              <table className="crm-dash-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Client</th>
                    <th scope="col" className="crm-dash-num">
                      Won
                    </th>
                    <th scope="col" className="crm-dash-num">
                      # Won
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topWonAccounts.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td className="crm-dash-ellipsis" title={r.name}>
                        {r.name}
                      </td>
                      <td className="crm-dash-num">PHP {r.won.toLocaleString()}</td>
                      <td className="crm-dash-num">{r.wN}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className="crm-dash-analytics-grid crm-dash-analytics-row2">
          <section className="crm-dash-card" aria-labelledby="ana-largest">
            <h2 id="ana-largest" className="crm-dash-card-title">
              <TrendingUp size={18} strokeWidth={2} aria-hidden />
              Largest open deals
            </h2>
            <p className="crm-dash-card-sub">Highest value opportunities in play</p>
            {largestOpenDeals.length === 0 ? (
              <p className="crm-dash-empty">No open deals in this view.</p>
            ) : (
              <ol className="crm-dash-ol">
                {largestOpenDeals.map((d) => (
                  <li key={d.id}>
                    <div className="crm-dash-ol-row">
                      <div className="crm-dash-ol-main">
                        <span className="crm-dash-ol-title">{d.title}</span>
                        <span className="crm-dash-ol-meta">
                          {d.accountName} · {STAGE_LABELS[d.stage]}
                        </span>
                      </div>
                      <span className="crm-dash-ol-value">
                        {d.currency} {d.value.toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="crm-dash-side-col">
            <section className="crm-dash-card" aria-labelledby="ana-stages">
              <h2 id="ana-stages" className="crm-dash-card-title">
                <Kanban size={18} strokeWidth={2} aria-hidden />
                Pipeline (list)
              </h2>
              {stageCounts.length === 0 ? (
                <p className="crm-dash-empty">No deals in this view.</p>
              ) : (
                <ul className="crm-dash-stage-list">
                  {stageCounts.map(({ stage, n }) => (
                    <li key={stage} className="crm-dash-stage-item">
                      <div className="crm-dash-stage-head">
                        <span className="crm-dash-stage-name">{STAGE_LABELS[stage]}</span>
                        <span className="crm-dash-stage-n">{n}</span>
                      </div>
                      <div className="crm-dash-stage-bar" role="img" aria-label={`${STAGE_LABELS[stage]}: ${n} deals`}>
                        <div
                          className="crm-dash-stage-bar-fill"
                          style={{ width: maxStageCount > 0 ? `${(n / maxStageCount) * 100}%` : "0%" }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="crm-dash-card" aria-labelledby="ana-source">
              <h2 id="ana-source" className="crm-dash-card-title">
                <PieChart size={18} strokeWidth={2} aria-hidden />
                Lead source (detail)
              </h2>
              <p className="crm-dash-card-sub">Deals by account source (CRM field)</p>
              {sourceRows.length === 0 ? (
                <p className="crm-dash-empty">No deals in this view.</p>
              ) : (
                <ul className="crm-dash-source-list">
                  {sourceRows.map((r) => (
                    <li key={r.key} className="crm-dash-source-row">
                      <span className="crm-dash-source-label">{r.label}</span>
                      <span className="crm-dash-source-stats">
                        {r.n} deal{r.n === 1 ? "" : "s"} · open PHP {r.v.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
