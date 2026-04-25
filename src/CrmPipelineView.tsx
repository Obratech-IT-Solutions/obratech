import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Kanban } from "lucide-react";
import { fetchCrmAccounts, fetchCrmDeals, updateDealStage } from "./crm/crmApi";
import type { CrmAccount, CrmDeal, DealStage } from "./crm/crmModel";
import { DEAL_STAGES, STAGE_LABELS } from "./crm/crmModel";

type Props = {
  user: User;
  refreshKey: number;
};

export default function CrmPipelineView({ user, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      await user.getIdToken(true);
      const [d, a] = await Promise.all([fetchCrmDeals(), fetchCrmAccounts()]);
      setDeals(d);
      setAccounts(a);
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

  const accountName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, a.clinicName || a.contactName || a.email);
    return m;
  }, [accounts]);

  const byStage = useMemo(() => {
    const g: Record<string, CrmDeal[]> = {};
    for (const s of DEAL_STAGES) g[s] = [];
    for (const d of deals) {
      if (!g[d.stage]) g[d.stage] = [];
      g[d.stage].push(d);
    }
    return g;
  }, [deals]);

  const onStageChange = async (dealId: string, stage: DealStage) => {
    setUpdating(dealId);
    try {
      await updateDealStage(dealId, stage, user);
      await load();
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return <div className="crm-state">Loading pipeline…</div>;
  }
  if (err) {
    return (
      <div className="crm-state crm-state-error" role="alert">
        {err}
      </div>
    );
  }

  return (
    <div className="crm-pipeline">
      <header className="crm-main-header">
        <div>
          <h1 className="crm-pipeline-title">
            <Kanban size={22} strokeWidth={2} aria-hidden className="crm-pipeline-title-icon" />
            Pipeline
          </h1>
          <p>Move deals through your process. Stages match the Obratech sales flow.</p>
        </div>
      </header>

      <div className="crm-pipeline-board" role="region" aria-label="Sales pipeline by stage">
        {DEAL_STAGES.map((stage) => (
          <div key={stage} className="crm-pipeline-col">
            <div className="crm-pipeline-col-head">
              <span className="crm-pipeline-col-title">{STAGE_LABELS[stage]}</span>
              <span className="crm-pipeline-col-count">{byStage[stage]?.length ?? 0}</span>
            </div>
            <div className="crm-pipeline-col-cards">
              {(byStage[stage] ?? []).map((d) => (
                <article key={d.id} className="crm-pipeline-card">
                  <h3 className="crm-pipeline-card-title">{d.title}</h3>
                  <p className="crm-pipeline-card-sub">{accountName.get(d.accountId) ?? "Account"}</p>
                  <p className="crm-pipeline-card-meta">
                    {d.value > 0 ? `${d.currency} ${d.value.toLocaleString()}` : "Value TBD"}{" "}
                    {d.probability > 0 ? `· ${d.probability}%` : null}
                  </p>
                  <label className="crm-pipeline-card-move">
                    <span className="visually-hidden">Change stage</span>
                    <select
                      className="crm-select crm-select-tight"
                      value={d.stage}
                      disabled={updating === d.id}
                      onChange={(e) => void onStageChange(d.id, e.target.value as DealStage)}
                    >
                      {DEAL_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
