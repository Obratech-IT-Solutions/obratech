import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "firebase/auth";
import { X } from "lucide-react";
import { createManualLead } from "./crm/crmApi";
import type { LeadSource, Niche } from "./crm/crmModel";
import { LEAD_SOURCES, LEAD_SOURCE_LABELS } from "./crm/crmModel";

const NICHES: { id: Niche; label: string }[] = [
  { id: "dentist", label: "Dentist clinic" },
  { id: "aesthetics", label: "Aesthetic clinic" },
  { id: "private_clinic", label: "Private consultation clinic" },
  { id: "other", label: "Other" },
];

type Props = {
  user: User;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const empty = {
  clinicName: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  niche: "other" as Niche,
  source: "cold_reach" as LeadSource,
  referralDetail: "",
  extraDetails: "",
};

export default function CrmAddLeadModal({ user, open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ ...empty });
      setErr(null);
    }
  }, [open]);

  if (!open) return null;

  const set = (k: keyof typeof empty, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await createManualLead(user, {
        clinicName: form.clinicName,
        contactName: form.contactName,
        email: form.email.trim(),
        phone: form.phone,
        address: form.address,
        city: form.city,
        niche: form.niche,
        source: form.source,
        referralDetail: form.referralDetail,
        extraDetails: form.extraDetails,
      });
      setForm(empty);
      onCreated();
      onClose();
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crm-modal-root" role="dialog" aria-modal="true" aria-labelledby="crm-add-lead-title">
      <button type="button" className="crm-modal-backdrop" aria-label="Close" onClick={onClose} />
      <form className="crm-modal-dialog crm-modal-dialog-wide" onSubmit={(e) => void handleSubmit(e)}>
        <button type="button" className="crm-modal-x" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2 id="crm-add-lead-title" className="crm-modal-title">
          Add lead manually
        </h2>
        <p className="crm-modal-sub">Creates a clinic account, deal (New lead), and a follow-up task. No website inquiry required.</p>

        {err ? (
          <div className="crm-modal-error" role="alert">
            {err}
          </div>
        ) : null}

        <div className="crm-add-grid">
          <label className="crm-field crm-field-half">
            <span className="crm-field-label">Clinic / business name *</span>
            <input
              className="crm-input"
              required
              value={form.clinicName}
              onChange={(e) => set("clinicName", e.target.value)}
              maxLength={300}
            />
          </label>
          <label className="crm-field crm-field-half">
            <span className="crm-field-label">Contact name</span>
            <input
              className="crm-input"
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="crm-field crm-field-half">
            <span className="crm-field-label">Email (optional)</span>
            <input
              className="crm-input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          <label className="crm-field crm-field-half">
            <span className="crm-field-label">Phone</span>
            <input
              className="crm-input"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              maxLength={50}
            />
          </label>
          <label className="crm-field crm-field-half">
            <span className="crm-field-label">City</span>
            <input className="crm-input" value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={200} />
          </label>
          <label className="crm-field crm-field-half">
            <span className="crm-field-label">Clinic type</span>
            <select className="crm-select" value={form.niche} onChange={(e) => set("niche", e.target.value as Niche)}>
              {NICHES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field" style={{ gridColumn: "1 / -1" }}>
            <span className="crm-field-label">Address</span>
            <input
              className="crm-input"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              maxLength={1000}
            />
          </label>
          <label className="crm-field" style={{ gridColumn: "1 / -1" }}>
            <span className="crm-field-label">Lead source *</span>
            <select className="crm-select" value={form.source} onChange={(e) => set("source", e.target.value as LeadSource)}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          {form.source === "referral" ? (
            <label className="crm-field" style={{ gridColumn: "1 / -1" }}>
              <span className="crm-field-label">Who referred? (clinic, person, link)</span>
              <input
                className="crm-input"
                value={form.referralDetail}
                onChange={(e) => set("referralDetail", e.target.value)}
                maxLength={500}
                placeholder="e.g. Dr. Ana, XYZ Dental…"
              />
            </label>
          ) : null}
          <label className="crm-field" style={{ gridColumn: "1 / -1" }}>
            <span className="crm-field-label">Extra details</span>
            <textarea
              className="crm-textarea"
              value={form.extraDetails}
              onChange={(e) => set("extraDetails", e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Pain points, current tools, budget hints, best time to call…"
            />
          </label>
        </div>

        <div className="crm-modal-actions">
          <button type="button" className="crm-btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="crm-btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Create lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
