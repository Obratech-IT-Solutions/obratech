import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut, type User } from "firebase/auth";
import {
  collection,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Calendar,
  Kanban,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Pencil,
  RefreshCw,
  Settings,
  Users,
  X,
} from "lucide-react";
import { auth, db } from "./firebase";
import { CrmLandingCalendar } from "./CrmLandingCalendar";
import CrmDashboardView from "./CrmDashboardView";
import CrmPipelineView from "./CrmPipelineView";
import CrmSettingsView from "./CrmSettingsView";
import { dealExistsForInquiry, fetchCrmDeals, promoteInquiryToPipeline } from "./crm/crmApi";
import type { CrmDeal } from "./crm/crmModel";
import "./admin-crm.css";

export type MeetingStatus = "scheduled" | "met" | "no_show" | "rescheduled" | "not_applicable";

export type InquiryClient = {
  id: string;
  name: string;
  email: string;
  address: string;
  clientKind: string;
  services: string[];
  projectCategory: string;
  description: string;
  meetingDate: string;
  createdAt: string;
  meetingStatus: MeetingStatus;
  revisionNotes: string;
  deadlineAt: string;
  crmUpdatedAt: string;
};

const SERVICE_LABELS: Record<string, string> = {
  "web-app": "Web app",
  "mobile-app": "Mobile app",
  "3d-model": "3D model",
  "3d-printing": "3D printing",
  "iot-fabrication": "IoT fabrication",
};

const CATEGORY_LABELS: Record<string, string> = {
  none: "—",
  business: "Business",
  capstone: "Capstone",
  model3d: "3D model",
};

const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Scheduled",
  met: "Met",
  no_show: "No show",
  rescheduled: "Rescheduled",
  not_applicable: "N/A",
};

const MEETING_STATUS_ORDER: MeetingStatus[] = [
  "scheduled",
  "met",
  "no_show",
  "rescheduled",
  "not_applicable",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISODateLocal(s: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return undefined;
  return dt;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function defaultMeetingStatus(meetingDate: string): MeetingStatus {
  const hasDate = meetingDate.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(meetingDate);
  return hasDate ? "scheduled" : "not_applicable";
}

function parseMeetingStatus(raw: unknown, meetingDate: string): MeetingStatus {
  const s = typeof raw === "string" ? raw : "";
  if (
    s === "scheduled" ||
    s === "met" ||
    s === "no_show" ||
    s === "rescheduled" ||
    s === "not_applicable"
  ) {
    return s;
  }
  return defaultMeetingStatus(meetingDate);
}

function timestampToDisplay(ts: Timestamp): string {
  return ts.toDate().toLocaleString();
}

function timestampToISODate(ts: Timestamp): string {
  return toISODateLocal(ts.toDate());
}

function deadlineTimestampFromISO(iso: string): Timestamp {
  const d = fromISODateLocal(iso);
  if (!d) return Timestamp.fromDate(new Date());
  return Timestamp.fromDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
}

type Props = {
  user: User;
};

type AdminView = "dashboard" | "leads" | "pipeline" | "settings";

export default function AdminCRM({ user }: Props) {
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const [crmRefreshKey, setCrmRefreshKey] = useState(0);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const [clients, setClients] = useState<InquiryClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(() => startOfDayLocal(new Date()));
  const [calendarSelected, setCalendarSelected] = useState<Date | undefined>(undefined);

  const [editClient, setEditClient] = useState<InquiryClient | null>(null);
  const [editMeetingStatus, setEditMeetingStatus] = useState<MeetingStatus>("scheduled");
  const [editRevisionNotes, setEditRevisionNotes] = useState("");
  const [editDeadlineIso, setEditDeadlineIso] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadClients = useCallback(
    async (isRefresh = false) => {
      setError(null);
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        await user.getIdToken(true);
        const snap = await getDocs(collection(db, "inquiries"));
        const rowsWithMs = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const created = d.createdAt;
          let createdAt = "—";
          let ms = 0;
          if (created instanceof Timestamp) {
            const dt = created.toDate();
            createdAt = dt.toLocaleString();
            ms = dt.getTime();
          }
          const servicesRaw = d.services;
          const services = Array.isArray(servicesRaw)
            ? servicesRaw.map((s) => String(s))
            : [];
          const meetingDate = String(d.meetingDate ?? "");
          const meetingStatus = parseMeetingStatus(d.meetingStatus, meetingDate);
          const revisionNotes =
            typeof d.revisionNotes === "string" ? d.revisionNotes : "";
          let deadlineAt = "";
          if (d.deadline instanceof Timestamp) {
            deadlineAt = timestampToISODate(d.deadline);
          }
          let crmUpdatedAt = "—";
          if (d.crmUpdatedAt instanceof Timestamp) {
            crmUpdatedAt = timestampToDisplay(d.crmUpdatedAt);
          }
          const row: InquiryClient = {
            id: docSnap.id,
            name: String(d.name ?? ""),
            email: String(d.email ?? ""),
            address: String(d.address ?? ""),
            clientKind: String(d.clientKind ?? ""),
            services,
            projectCategory: String(d.projectCategory ?? ""),
            description: String(d.description ?? ""),
            meetingDate,
            createdAt,
            meetingStatus,
            revisionNotes,
            deadlineAt,
            crmUpdatedAt,
          };
          return { row, ms };
        });
        rowsWithMs.sort((a, b) => b.ms - a.ms);
        setClients(rowsWithMs.map((x) => x.row));
        const dealSnap = await fetchCrmDeals();
        setDeals(dealSnap);
      } catch (e) {
        console.error(e);
        const o = e && typeof e === "object" ? (e as Record<string, unknown>) : null;
        const duck =
          o && typeof o.code === "string" && typeof o.message === "string"
            ? `${o.code}: ${o.message}`
            : null;
        const fallback =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : e != null
                ? String(e)
                : "Unknown error";
        setError(
          duck ??
            fallback +
              " — If this is permission-denied, open Firebase → Firestore → Rules, paste repo firestore.rules, Publish, then hard-refresh this page.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void loadClients(false);
  }, [loadClients]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  const meetingDays = useMemo(() => {
    const set = new Map<string, Date>();
    for (const c of clients) {
      const d = fromISODateLocal(c.meetingDate);
      if (d) {
        const k = toISODateLocal(startOfDayLocal(d));
        set.set(k, startOfDayLocal(d));
      }
    }
    return [...set.values()];
  }, [clients]);

  const deadlineDays = useMemo(() => {
    const set = new Map<string, Date>();
    for (const c of clients) {
      if (!c.deadlineAt || c.deadlineAt.length !== 10) continue;
      const d = fromISODateLocal(c.deadlineAt);
      if (d) {
        const k = toISODateLocal(startOfDayLocal(d));
        set.set(k, startOfDayLocal(d));
      }
    }
    return [...set.values()];
  }, [clients]);

  const filtered = useMemo(() => {
    let list = clients;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q),
      );
    }
    if (calendarSelected) {
      const sel = calendarSelected;
      list = list.filter((c) => {
        const md = fromISODateLocal(c.meetingDate);
        const meetingMatch = md ? sameCalendarDay(md, sel) : false;
        const dd = fromISODateLocal(c.deadlineAt);
        const deadlineMatch = dd ? sameCalendarDay(dd, sel) : false;
        return meetingMatch || deadlineMatch;
      });
    }
    return list;
  }, [clients, search, calendarSelected]);

  const openEdit = (c: InquiryClient) => {
    setMobileMenuOpen(false);
    setEditClient(c);
    setEditMeetingStatus(c.meetingStatus);
    setEditRevisionNotes(c.revisionNotes);
    setEditDeadlineIso(c.deadlineAt);
    setSaveError(null);
  };

  const closeEdit = () => {
    setEditClient(null);
    setSaveError(null);
  };

  const handlePromote = async (c: InquiryClient) => {
    setPromotingId(c.id);
    try {
      await promoteInquiryToPipeline(user, {
        id: c.id,
        name: c.name,
        email: c.email,
        address: c.address,
        projectCategory: c.projectCategory,
        description: c.description,
      });
      setCrmRefreshKey((k) => k + 1);
      await loadClients(true);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPromotingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editClient) return;
    setSaveError(null);
    setSaving(true);
    try {
      const ref = doc(db, "inquiries", editClient.id);
      const hasDeadline =
        editDeadlineIso.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(editDeadlineIso);
      await updateDoc(ref, {
        meetingStatus: editMeetingStatus,
        revisionNotes: editRevisionNotes,
        crmUpdatedAt: serverTimestamp(),
        deadline: hasDeadline ? deadlineTimestampFromISO(editDeadlineIso) : deleteField(),
      });
      closeEdit();
      await loadClients(true);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    void loadClients(true);
  };

  const handleSignOut = () => void signOut(auth);

  const clearCalendarFilter = () => setCalendarSelected(undefined);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const scrollToSection = (id: string) => {
    closeMobileMenu();
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className={`crm-app${mobileMenuOpen ? " crm-mobile-menu-open" : ""}`}>
      <aside className="crm-sidebar" aria-label="CRM navigation">
        <div className="crm-sidebar-brand">
          <img src="/logo.png" alt="" />
          <span>Obratech CRM</span>
        </div>
        <nav className="crm-nav">
          <button
            type="button"
            className={`crm-nav-item${activeView === "dashboard" ? " is-active" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            <LayoutDashboard size={18} strokeWidth={2} aria-hidden />
            Dashboard
          </button>
          <button
            type="button"
            className={`crm-nav-item${activeView === "leads" ? " is-active" : ""}`}
            onClick={() => setActiveView("leads")}
          >
            <Users size={18} strokeWidth={2} aria-hidden />
            Leads inbox
          </button>
          <button
            type="button"
            className={`crm-nav-item${activeView === "pipeline" ? " is-active" : ""}`}
            onClick={() => setActiveView("pipeline")}
          >
            <Kanban size={18} strokeWidth={2} aria-hidden />
            Pipeline
          </button>
          <button
            type="button"
            className={`crm-nav-item${activeView === "settings" ? " is-active" : ""}`}
            onClick={() => setActiveView("settings")}
          >
            <Settings size={18} strokeWidth={2} aria-hidden />
            Settings
          </button>
        </nav>
        <div className="crm-sidebar-spacer" />
        <div className="crm-sidebar-footer">
          <span className="crm-user-email">{user.email}</span>
          <button type="button" className="crm-btn-ghost" onClick={handleSignOut}>
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Sign out
          </button>
          <a className="crm-link-site" href="/">
            ← Public website
          </a>
        </div>
      </aside>

      <div className="crm-main">
        <div className={`crm-mobile-header${mobileMenuOpen ? " is-menu-open" : ""}`}>
          <div className="crm-mobile-bar">
            <div className="crm-mobile-bar-start">
              <img src="/logo.png" alt="Obratech" />
              <strong>CRM</strong>
            </div>
            <button
              type="button"
              className="crm-mobile-burger"
              aria-expanded={mobileMenuOpen}
              aria-controls="crm-mobile-nav"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenuOpen((o) => !o)}
            >
              {mobileMenuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
            </button>
          </div>

          <div
            id="crm-mobile-nav"
            className={`crm-mobile-nav${mobileMenuOpen ? " is-open" : ""}`}
            aria-hidden={!mobileMenuOpen}
          >
            <button
              type="button"
              className="crm-mobile-nav-item"
              onClick={() => {
                setActiveView("dashboard");
                closeMobileMenu();
              }}
            >
              <LayoutDashboard size={18} strokeWidth={2} aria-hidden />
              Dashboard
            </button>
            <button
              type="button"
              className="crm-mobile-nav-item"
              onClick={() => {
                setActiveView("leads");
                closeMobileMenu();
                window.requestAnimationFrame(() => scrollToSection("crm-schedule"));
              }}
            >
              <Calendar size={18} strokeWidth={2} aria-hidden />
              Schedule / calendar
            </button>
            <button
              type="button"
              className="crm-mobile-nav-item"
              onClick={() => {
                setActiveView("leads");
                closeMobileMenu();
                window.requestAnimationFrame(() => scrollToSection("crm-clients"));
              }}
            >
              <Users size={18} strokeWidth={2} aria-hidden />
              Leads inbox
            </button>
            <button
              type="button"
              className="crm-mobile-nav-item"
              onClick={() => {
                setActiveView("pipeline");
                closeMobileMenu();
              }}
            >
              <Kanban size={18} strokeWidth={2} aria-hidden />
              Pipeline
            </button>
            <button
              type="button"
              className="crm-mobile-nav-item"
              onClick={() => {
                setActiveView("settings");
                closeMobileMenu();
              }}
            >
              <Settings size={18} strokeWidth={2} aria-hidden />
              Settings
            </button>
            <a className="crm-mobile-nav-item" href="/" onClick={closeMobileMenu}>
              Public website
            </a>
            <button
              type="button"
              className="crm-mobile-nav-item crm-mobile-nav-danger"
              onClick={() => {
                closeMobileMenu();
                void handleSignOut();
              }}
            >
              <LogOut size={18} strokeWidth={2} aria-hidden />
              Sign out
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <button
            type="button"
            className="crm-mobile-nav-backdrop"
            aria-label="Close menu"
            onClick={closeMobileMenu}
          />
        ) : null}

        <div className="crm-main-inner">
          {activeView === "dashboard" ? (
            <CrmDashboardView user={user} refreshKey={crmRefreshKey} />
          ) : null}
          {activeView === "pipeline" ? <CrmPipelineView user={user} refreshKey={crmRefreshKey} /> : null}
          {activeView === "settings" ? (
            <CrmSettingsView
              user={user}
              refreshKey={crmRefreshKey}
              onSaved={() => setCrmRefreshKey((k) => k + 1)}
            />
          ) : null}

          {activeView === "leads" ? (
            <>
          <header className="crm-main-header" id="crm-clients">
            <div>
              <h1>Leads inbox</h1>
              <p>
                Web inquiries. Track meetings, revisions, and deadlines — or add a lead to the sales pipeline.
              </p>
            </div>
            <div className="crm-toolbar">
              <input
                type="search"
                className="crm-search"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search clients"
              />
              <button
                type="button"
                className="crm-btn-primary"
                onClick={handleRefresh}
                disabled={refreshing || loading}
              >
                <RefreshCw
                  size={16}
                  strokeWidth={2}
                  className={refreshing ? "crm-icon-spin" : undefined}
                  aria-hidden
                />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </header>

          <section
            id="crm-schedule"
            className="crm-landing-calendar"
            aria-label="Meetings and deadlines"
          >
            {loading ? (
              <p className="crm-calendar-placeholder">Loading calendar…</p>
            ) : error ? (
              <p className="crm-calendar-placeholder">Schedule appears after the list loads.</p>
            ) : (
              <>
                <div className="crm-landing-calendar-head">
                  <h2 className="crm-section-title">Schedule</h2>
                  {calendarSelected ? (
                    <button type="button" className="crm-btn-text" onClick={clearCalendarFilter}>
                      Clear day filter ({toISODateLocal(calendarSelected)})
                    </button>
                  ) : null}
                </div>
                <CrmLandingCalendar
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={calendarSelected}
                  onSelect={setCalendarSelected}
                  meetingDays={meetingDays}
                  deadlineDays={deadlineDays}
                />
              </>
            )}
          </section>

          <div className="crm-stats">
            <div className="crm-stat">
              <div className="crm-stat-label">Total leads</div>
              <div className="crm-stat-value">{clients.length}</div>
            </div>
            <div className="crm-stat">
              <div className="crm-stat-label">Showing</div>
              <div className="crm-stat-value">{filtered.length}</div>
            </div>
          </div>

          {loading ? <div className="crm-state">Loading clients…</div> : null}

          {!loading && error ? (
            <div className="crm-state crm-state-error" role="alert">
              {error}
            </div>
          ) : null}

          {!loading && !error && filtered.length === 0 ? (
            <div className="crm-state">
              {clients.length === 0
                ? "No inquiries yet. Submissions from your public form will appear here."
                : calendarSelected
                  ? `No clients with a meeting or deadline on ${toISODateLocal(calendarSelected)}.`
                  : "No clients match your search."}
            </div>
          ) : null}

          {!loading && !error && filtered.length > 0 ? (
            <div className="crm-grid">
              {filtered.map((c) => (
                <article key={c.id} className="crm-card">
                  <div className="crm-card-top">
                    <div className="crm-avatar" aria-hidden>
                      {initials(c.name)}
                    </div>
                    <div className="crm-card-title">
                      <h2 className="crm-card-name">{c.name || "Unnamed"}</h2>
                      <p className="crm-card-email">
                        <Mail size={12} strokeWidth={2} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                        {c.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="crm-card-edit"
                      onClick={() => openEdit(c)}
                      aria-label={`Edit CRM fields for ${c.name || c.email}`}
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </button>
                  </div>

                  <div className="crm-badges">
                    <span className="crm-badge crm-badge-accent">{c.clientKind || "—"}</span>
                    <span className="crm-badge">
                      {CATEGORY_LABELS[c.projectCategory] ?? c.projectCategory}
                    </span>
                    <span
                      className={`crm-badge crm-badge-meeting crm-badge-meeting-${c.meetingStatus}`}
                    >
                      {MEETING_STATUS_LABELS[c.meetingStatus]}
                    </span>
                  </div>

                  <div className="crm-card-meta">
                    <div className="crm-meta-row">
                      <MapPin size={14} strokeWidth={2} aria-hidden />
                      <span>{c.address || "—"}</span>
                    </div>
                    <div className="crm-meta-row">
                      <Calendar size={14} strokeWidth={2} aria-hidden />
                      <span>Meeting: {c.meetingDate || "—"}</span>
                    </div>
                    {c.deadlineAt ? (
                      <div className="crm-meta-row crm-meta-deadline">
                        <Calendar size={14} strokeWidth={2} aria-hidden />
                        <span>Deadline: {c.deadlineAt}</span>
                      </div>
                    ) : null}
                  </div>

                  {c.revisionNotes ? (
                    <p className="crm-revision-preview">
                      <strong>Revision notes</strong> — {c.revisionNotes}
                    </p>
                  ) : null}

                  {c.services.length > 0 ? (
                    <div className="crm-tags" aria-label="Services">
                      {c.services.map((sid) => (
                        <span key={sid} className="crm-tag">
                          {SERVICE_LABELS[sid] ?? sid}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {c.description ? <p className="crm-desc">{c.description}</p> : null}

                  <div className="crm-card-actions">
                    {dealExistsForInquiry(deals, c.id) ? (
                      <span className="crm-pipeline-pill">In pipeline</span>
                    ) : (
                      <button
                        type="button"
                        className="crm-btn-promote"
                        disabled={promotingId === c.id}
                        onClick={() => void handlePromote(c)}
                      >
                        {promotingId === c.id ? "Adding…" : "Add to pipeline"}
                      </button>
                    )}
                  </div>

                  <footer className="crm-card-footer">
                    Submitted {c.createdAt}
                    {c.crmUpdatedAt !== "—" ? ` · CRM updated ${c.crmUpdatedAt}` : null}
                  </footer>
                </article>
              ))}
            </div>
          ) : null}
            </>
          ) : null}
        </div>
      </div>

      {editClient ? (
        <div className="crm-modal-root" role="dialog" aria-modal="true" aria-labelledby="crm-edit-title">
          <button type="button" className="crm-modal-backdrop" aria-label="Close" onClick={closeEdit} />
          <div className="crm-modal-dialog">
            <button type="button" className="crm-modal-x" onClick={closeEdit} aria-label="Close">
              <X size={18} />
            </button>
            <h2 id="crm-edit-title" className="crm-modal-title">
              {editClient.name || editClient.email}
            </h2>
            <p className="crm-modal-sub">Meeting status, revision notes, and deadline</p>

            <label className="crm-field">
              <span className="crm-field-label">Meeting status</span>
              <select
                className="crm-select"
                value={editMeetingStatus}
                onChange={(e) => setEditMeetingStatus(e.target.value as MeetingStatus)}
              >
                {MEETING_STATUS_ORDER.map((v) => (
                  <option key={v} value={v}>
                    {MEETING_STATUS_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>

            <label className="crm-field">
              <span className="crm-field-label">Revision notes</span>
              <textarea
                className="crm-textarea"
                value={editRevisionNotes}
                onChange={(e) => setEditRevisionNotes(e.target.value)}
                rows={5}
                placeholder="Scope changes, feedback, next deliverables…"
                maxLength={8000}
              />
            </label>

            <label className="crm-field">
              <span className="crm-field-label">Deadline</span>
              <input
                type="date"
                className="crm-input"
                value={editDeadlineIso}
                onChange={(e) => setEditDeadlineIso(e.target.value)}
              />
              <span className="crm-field-hint">Leave empty to clear deadline.</span>
            </label>

            {saveError ? (
              <div className="crm-modal-error" role="alert">
                {saveError}
              </div>
            ) : null}

            <div className="crm-modal-actions">
              <button type="button" className="crm-btn-ghost" onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="crm-btn-primary" onClick={() => void handleSaveEdit()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
