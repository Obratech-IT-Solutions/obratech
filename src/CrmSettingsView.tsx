import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { saveCrmConfig, fetchCrmConfig } from "./crm/crmApi";

type Props = {
  user: User;
  refreshKey: number;
  onSaved: () => void;
};

export default function CrmSettingsView({ user, refreshKey, onSaved }: Props) {
  const [target, setTarget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const c = await fetchCrmConfig();
      setTarget(c.monthlyRevenueTarget);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setMsg(null);
    setErr(null);
    setSaving(true);
    try {
      await saveCrmConfig(target, user);
      setMsg("Saved.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="crm-state">Loading settings…</div>;
  }

  return (
    <div className="crm-settings">
      <header className="crm-main-header">
        <div>
          <h1>Settings</h1>
          <p>Monthly revenue target for dashboard progress. Currency is informational (e.g. PHP).</p>
        </div>
      </header>
      {err ? (
        <div className="crm-state crm-state-error" role="alert">
          {err}
        </div>
      ) : null}
      {msg ? (
        <div className="crm-state" style={{ borderStyle: "solid", color: "var(--crm-text)" }}>
          {msg}
        </div>
      ) : null}
      <div className="crm-settings-form">
        <label className="crm-field" style={{ maxWidth: 320 }}>
          <span className="crm-field-label">Monthly revenue target</span>
          <input
            type="number"
            className="crm-input"
            min={0}
            step={1000}
            value={Number.isNaN(target) ? 0 : target}
            onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
          />
        </label>
        <button type="button" className="crm-btn-primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
