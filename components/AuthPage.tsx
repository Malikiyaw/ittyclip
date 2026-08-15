"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";

export default function AuthPage() {
  const router = useRouter();
  const session = useAuth((s) => s.session);
  const login = useAuth((s) => s.login);
  const signup = useAuth((s) => s.signup);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) router.replace("/studio");
  }, [session, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!password.trim()) {
      setError("Enter a password.");
      return;
    }
    setError("");
    if (mode === "signup") signup(email.trim(), name.trim());
    else login(email.trim());
    router.push("/studio");
  };

  const input =
    "w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 font-sans text-[15px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none transition-colors";

  return (
    <div className="swiss">
      <div className="bg" aria-hidden />
      <div className="auth-grid" aria-hidden />

      <div className="auth-wrap">
        <Link href="/" className="auth-logo" aria-label="ittyclip home">
          <img src="/assets/logo.jpg" alt="" width={44} height={44} />
        </Link>

        <div className="auth-card">
          <div className="flex items-center justify-between">
            <h1 className="auth-title">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="auth-close"
              aria-label="Back to home"
            >
              ×
            </button>
          </div>

          <div className="auth-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : ""}
              onClick={() => {
                setMode("signin");
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={input}
                autoComplete="name"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={input}
              autoComplete="email"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={input}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit">
              {mode === "signin" ? "Sign in →" : "Create account →"}
            </button>
          </form>

          <span className="auth-hint">
            Fake gate — any credentials work. Backend coming soon.
          </span>
        </div>

        <p className="auth-footer">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
