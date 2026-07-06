"use client";

import { useEffect, useState } from "react";
import { authApi, hasToken, onUnauthorized } from "@/lib/api";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    onUnauthorized(() => setAuthed(false));
    authApi.status().then(({ required }) => {
      setAuthed(!required || hasToken());
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.login(password);
      setAuthed(true);
      setPassword("");
    } catch {
      setError("Wrong password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="auth-gate">
        <form className="auth-box" onSubmit={handleSubmit}>
          <div className="brand-mark auth-mark" />
          <div className="auth-title">Basecamp Cockpit</div>
          <div className="auth-sub">Enter password to continue</div>
          <input
            type="password"
            className="board-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="board-error">{error}</p>}
          <button className="btn-primary auth-submit" type="submit" disabled={submitting || !password}>
            {submitting ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
