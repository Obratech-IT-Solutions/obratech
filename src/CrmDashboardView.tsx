import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { Target, TrendingUp, UserPlus, Kanban, AlertCircle } from "lucide-react";
import { db } from "./firebase";
import { fetchCrmConfig, fetchCrmDeals, fetchCrmActivities } from "./crm/crmApi";
import { STAGE_LABELS, type DealStage } from "./crm/crmModel";

const CLOSED: DealStage[] = ["closed_won", "closed_lost"];

type Props = {
  user: User;
  refreshKey: number;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseInquiryTime(raw: unknown): number {
  if (raw instanceof Timestamp) return raw.toMillis();
  return 0;
}

export default function CrmDashboardView({ user, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newToday, setNewToday] = useState(0);
  const [newWeek, setNewWeek] = useState(0);
  const [openDeals, setOpenDeals] = useState(0);
  const [proposals, setProposals] = useState(0);
  const [closedWonValue, setClosedWonValue] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [target, setTarget] = useState(0);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      await user.getIdToken(true);
      const [inqSnap, deals, activities, conf] = await Promise.all([
        getDocs(collection(db, "inquiries")),
        fetchCrmDeals(),
        fetchCrmActivities(),
        fetchCrmConfig(),
      ]);
      setTarget(conf.monthlyRevenueTarget);

      const t0 = startOfToday().getTime();
      const tw = startOfWeek(new Date()).getTime();
      let nt = 0;
      let nw = 0;
      inqSnap.docs.forEach((s) => {
        const t = parseInquiryTime(s.data().createdAt);
        if (t >= t0) nt += 1;
        if (t >= tw) nw += 1;
      });
      setNewToday(nt);
      setNewWeek(nw);

      let op = 0;
      let pr = 0;
      let cval = 0;
      for (const d of deals) {
        if (!CLOSED.includes(d.stage) && d.stage !== "nurture_later") {
          op += 1;
        }
        if (d.stage === "proposal_sent" || d.stage === "negotiation") pr += 1;
        if (d.stage === "closed_won") {
          cval += d.value;
        }
      }
      setOpenDeals(op);
      setProposals(pr);
      setClosedWonValue(cval);

      let od = 0;
      for (const a of activities) {
        if (a.completedAt) continue;
        if (!a.dueAt || a.dueAt === "—") continue;
        const t = new Date(a.dueAt).getTime();
        if (t < Date.now()) od += 1;
      }
      setOverdue(od);
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

  const pct = target > 0 ? Math.min(100, Math.round((closedWonValue / target) * 100)) : 0;

  if (loading) {
    return <div className="crm-state">Loading dashboard…</div>;
  }
  if (err) {
    return (
      <div className="crm-state crm-state-error" role="alert">
        {err}
      </div>
    );
  }

  return (
    <div className="crm-dashboard">
      <header className="crm-main-header">
        <div>
          <h1>Dashboard</h1>
          <p>Next actions, pipeline health, and monthly target at a glance.</p>
        </div>
      </header>

      <div className="crm-kpi-row">
        <div className="crm-kpi">
          <div className="crm-kpi-icon" aria-hidden>
            <UserPlus size={20} />
          </div>
          <div>
            <div className="crm-kpi-label">New leads today</div>
            <div className="crm-kpi-value">{newToday}</div>
          </div>
        </div>
        <div className="crm-kpi">
          <div className="crm-kpi-icon" aria-hidden>
            <UserPlus size={20} />
          </div>
          <div>
            <div className="crm-kpi-label">New leads this week</div>
            <div className="crm-kpi-value">{newWeek}</div>
          </div>
        </div>
        <div className="crm-kpi">
          <div className="crm-kpi-icon" aria-hidden>
            <Kanban size={20} />
          </div>
          <div>
            <div className="crm-kpi-label">Open pipeline (excl. closed)</div>
            <div className="crm-kpi-value">{openDeals}</div>
          </div>
        </div>
        <div className="crm-kpi">
          <div className="crm-kpi-icon" aria-hidden>
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="crm-kpi-label">Proposals in play</div>
            <div className="crm-kpi-value">{proposals}</div>
            <div className="crm-kpi-hint">Sent + negotiation</div>
          </div>
        </div>
        <div className="crm-kpi crm-kpi-warn">
          <div className="crm-kpi-icon" aria-hidden>
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="crm-kpi-label">Overdue follow-ups</div>
            <div className="crm-kpi-value">{overdue}</div>
            <div className="crm-kpi-hint">Past due, not completed</div>
          </div>
        </div>
        <div className="crm-kpi crm-kpi-wide">
          <div className="crm-kpi-icon" aria-hidden>
            <Target size={20} />
          </div>
          <div className="crm-kpi-body">
            <div className="crm-kpi-label">Monthly target progress</div>
            <div className="crm-kpi-value-row">
              <span>
                {closedWonValue.toLocaleString()} {target > 0 ? `/ ${target.toLocaleString()}` : ""} {target > 0 ? " PHP" : ""}
              </span>
              {target > 0 ? <span className="crm-kpi-pct">{pct}%</span> : null}
            </div>
            {target > 0 ? (
              <div className="crm-kpi-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="crm-kpi-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            ) : (
              <p className="crm-kpi-hint">Set a monthly revenue target in Settings to track progress.</p>
            )}
            <div className="crm-kpi-hint">Closed won deal value (all time) vs target. Refine with close dates in a later version.</div>
          </div>
        </div>
      </div>

      <div className="crm-dashboard-footnote">
        <strong>Staged for action:</strong> every promoted deal should have a follow-up. Check{" "}
        <em>Overdue</em> and the Pipeline. Stage labels: {Object.values(STAGE_LABELS).slice(0, 4).join(" → ")}…
      </div>
    </div>
  );
}
