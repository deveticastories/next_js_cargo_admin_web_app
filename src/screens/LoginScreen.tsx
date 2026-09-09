"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ship } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/utils/apiClient";

/**
 * The only screen outside `/admin` — a two-panel layout matching the
 * "Cargo Admin.dc.html" design reference (brand story on the left, form on
 * the right). Signs in via `POST /api/auth/login`, which sets the
 * access/refresh cookies, then sends the admin to wherever they were
 * originally headed (`?from=`, set by `src/proxy.ts`) or `/admin`.
 */
export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/auth/login", { email: email.trim(), password });
      const destination = searchParams.get("from") || "/admin";
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="cc-root cc-login">
      <div className="cc-login-panel">
        <div className="cc-login-brand">
          <div className="cc-brand-mark">
            <Ship size={16} color="#fff" />
          </div>
          <span className="cc-brand-name cc-h">Cargo Admin</span>
        </div>

        <div>
          <h1 className="cc-login-headline">
            Every booking,
            <br />
            bundle and container
            <br />
            in one console.
          </h1>
          <p className="cc-login-desc">
            Cargo operations across Kochi and the UAE — bookings, packing, stuffing, invoicing and daily settlements.
          </p>
        </div>

        <span className="cc-login-version">v1.0 · team console</span>
      </div>

      <div className="cc-login-form-wrap">
        <form className="cc-login-form" onSubmit={submit}>
          <div>
            <div className="cc-login-eyebrow">Sign in</div>
            <h2 className="cc-login-title cc-h">Welcome back</h2>
            <p className="cc-login-sub">Use your Cargo Admin email and password.</p>
          </div>

          {error && <div className="cc-alert-error">{error}</div>}

          <Field
            field={{ key: "email", label: "Email address", type: "email", required: true }}
            value={email}
            onChange={(_, v) => setEmail(v)}
          />

          <div className="cc-field">
            <label>Password</label>
            <span className="cc-login-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ paddingRight: 74 }}
              />
              <button type="button" className="cc-login-pw-toggle" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </div>

          <Button type="submit" variant="primary" className="cc-login-submit" loading={submitting}>
            {submitting ? "Signing in…" : "Sign in to dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
