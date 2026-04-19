import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut, type User } from "firebase/auth";
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { Calendar, LogOut, Mail, MapPin, RefreshCw, Users } from "lucide-react";
import { auth, db } from "./firebase";
import "./admin-crm.css";

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
};

const SERVICE_LABELS: Record<string, string> = {
  "custom-system": "Custom system",
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Props = {
  user: User;
};

export default function AdminCRM({ user }: Props) {
  const [clients, setClients] = useState<InquiryClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadClients = useCallback(async (isRefresh = false) => {
    setError(null);
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const q = query(collection(db, "inquiries"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const rows: InquiryClient[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const created = d.createdAt;
        let createdAt = "—";
        if (created instanceof Timestamp) {
          createdAt = created.toDate().toLocaleString();
        }
        const servicesRaw = d.services;
        const services = Array.isArray(servicesRaw)
          ? servicesRaw.map((s) => String(s))
          : [];
        return {
          id: docSnap.id,
          name: String(d.name ?? ""),
          email: String(d.email ?? ""),
          address: String(d.address ?? ""),
          clientKind: String(d.clientKind ?? ""),
          services,
          projectCategory: String(d.projectCategory ?? ""),
          description: String(d.description ?? ""),
          meetingDate: String(d.meetingDate ?? ""),
          createdAt,
        };
      });
      setClients(rows);
    } catch (e) {
      console.error(e);
      setError("Could not load clients. Check Firestore rules and your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadClients(false);
  }, [loadClients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const handleRefresh = () => {
    void loadClients(true);
  };

  const handleSignOut = () => void signOut(auth);

  return (
    <div className="crm-app">
      <aside className="crm-sidebar" aria-label="CRM navigation">
        <div className="crm-sidebar-brand">
          <img src="/logo.png" alt="" />
          <span>Obratech CRM</span>
        </div>
        <nav className="crm-nav">
          <button type="button" className="crm-nav-item is-active">
            <Users size={18} strokeWidth={2} aria-hidden />
            Clients
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
        <div className="crm-mobile-bar">
          <img src="/logo.png" alt="Obratech" />
          <strong>CRM</strong>
          <div className="crm-mobile-actions">
            <a className="crm-link-site" href="/">
              Site
            </a>
            <button type="button" className="crm-btn-ghost" onClick={handleSignOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="crm-main-inner">
          <header className="crm-main-header">
            <div>
              <h1>Clients</h1>
              <p>Inquiries submitted from your site. Search by name, email, or address.</p>
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

          {loading ? (
            <div className="crm-state">Loading clients…</div>
          ) : null}

          {!loading && error ? (
            <div className="crm-state crm-state-error" role="alert">
              {error}
            </div>
          ) : null}

          {!loading && !error && filtered.length === 0 ? (
            <div className="crm-state">
              {clients.length === 0
                ? "No inquiries yet. Submissions from your public form will appear here."
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
                  </div>

                  <div className="crm-badges">
                    <span className="crm-badge crm-badge-accent">{c.clientKind || "—"}</span>
                    <span className="crm-badge">
                      {CATEGORY_LABELS[c.projectCategory] ?? c.projectCategory}
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
                  </div>

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

                  <footer className="crm-card-footer">Submitted {c.createdAt}</footer>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
