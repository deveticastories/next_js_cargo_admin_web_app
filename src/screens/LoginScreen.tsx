"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ship } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/utils/apiClient";

/**
 * The only screen outside `/admin` — signs an admin in via
 * `POST /api/auth/login`, which sets the access/refresh cookies, then sends
 * them to whichever page they were trying to reach (`?from=`, set by
 * `src/proxy.ts`) or `/admin` by default.
 */
export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="cc-root cc-auth-page">
      <form className="cc-auth-card" onSubmit={submit}>
        <div className="cc-auth-brand">
          <div className="cc-brand-mark">
            <Ship size={20} color="#2A1600" />
          </div>
          <div>
            <div className="cc-auth-title cc-h">Cargo Admin</div>
            <div className="cc-auth-sub">Sign in to manage Kochi ⇄ UAE shipments</div>
          </div>
        </div>

        {error && <div className="cc-auth-error">{error}</div>}

        <Field
          field={{ key: "email", label: "Email", type: "text", required: true }}
          value={email}
          onChange={(_, v) => setEmail(v)}
        />
        <Field
          field={{ key: "password", label: "Password", type: "password", required: true }}
          value={password}
          onChange={(_, v) => setPassword(v)}
        />

        <Button type="submit" variant="primary" className="cc-auth-submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
