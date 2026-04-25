import { FormEvent, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";
import AdminCRM from "./AdminCRM.tsx";
import { track } from "./analytics";
import { auth } from "./firebase";
import "./admin-login.css";

export default function AdminLogin() {
  useEffect(() => {
    document.title = "Admin · CRM · Obratech";
    return () => {
      document.title = "Obratech";
    };
  }, []);

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null);
        setAuthReady(true);
        return;
      }
      setUser(u);
      setNotice(null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      track.adminLogin();
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setNotice("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setNotice("Too many attempts. Try again later.");
      } else {
        setNotice("Sign-in failed. Check the browser console and Firebase Auth settings.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  if (!authReady) {
    return (
      <div className="admin-gate">
        <div className="admin-gate-card admin-gate-loading">
          <p className="admin-gate-sub">Loading…</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <AdminCRM user={user} />;
  }

  return (
    <div className="admin-gate">
      <div className="admin-gate-card">
        <header className="admin-gate-head">
          <div className="admin-gate-logo-shell">
            <a className="admin-gate-brand" href="/" aria-label="Obratech home">
              <img src="/logo.png" alt="" className="admin-gate-logo" />
            </a>
          </div>
          <p className="admin-gate-label">Admin</p>
          <h1 className="admin-gate-title">CRM sign-in</h1>
          <p className="admin-gate-sub">
            Sign in with your Firebase account to access the CRM.
          </p>
        </header>

        <form className="admin-gate-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="admin-gate-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </label>
          <label className="admin-gate-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <button type="submit" className="admin-gate-submit" disabled={signingIn}>
            {signingIn ? "Signing in…" : "Sign in to CRM"}
          </button>
        </form>

        {notice ? (
          <p className={`admin-gate-notice${notice.includes("not authorized") ? " admin-gate-notice-error" : ""}`}>
            {notice}
          </p>
        ) : null}

        <a className="admin-gate-back" href="/">
          ← Back to public site
        </a>
      </div>
    </div>
  );
}
