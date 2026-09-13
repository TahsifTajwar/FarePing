"use client";

import { type FormEvent, useEffect, useState } from "react";
import { LogOut, Mail, ShieldCheck } from "lucide-react";
import {
  authSessionChangedEvent,
  getStoredSession,
  onAuthSessionChange,
  sendEmailSignInLink,
  signOut,
  type ChordSession
} from "./authClient";
import { backupCurrentResultsForAuth } from "./currentFlightTypes";

type AuthPanelProps = {
  compact?: boolean;
  compactHint?: string;
  compactLabel?: string;
};

export function AuthPanel({
  compact = false,
  compactHint = "Optional",
  compactLabel = "Sign in to save alerts"
}: AuthPanelProps) {
  const [session, setSession] = useState<ChordSession | null>(null);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function syncSession() {
      try {
        setSession(await getStoredSession());
      } catch (sessionError) {
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Could not read the sign-in session."
        );
      }
    }

    syncSession();
    const unsubscribeAuthChange = onAuthSessionChange((nextSession) => {
      setSession(nextSession);

      if (nextSession) {
        setMessage("Signed in. Your alerts are now separate from other users.");
        setError("");
      }
    });

    window.addEventListener(authSessionChangedEvent, syncSession);

    return () => {
      unsubscribeAuthChange();
      window.removeEventListener(authSessionChangedEvent, syncSession);
    };
  }, []);

  async function handleSendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedEmail = String(
      new FormData(event.currentTarget).get("email") ?? email
    ).trim();
    setEmail(submittedEmail);
    setLoading(true);
    setMessage("");
    setError("");

    try {
      backupCurrentResultsForAuth();
      await sendEmailSignInLink(submittedEmail);
      setLinkSent(true);
      setMessage("Sign-in link sent. Open it from your email to continue.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send the sign-in link.");
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    void signOut();
    setSession(null);
    setMessage("Signed out.");
    setError("");
  }

  if (compact && session) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-white/10 bg-[#071010]/72 px-3 text-sm text-white shadow-lg backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="shrink-0 text-[#9ff3d0]" size={17} aria-hidden="true" />
          <span className="truncate font-medium">{session.user.email}</span>
        </div>
        <button
          className="inline-flex h-8 shrink-0 items-center justify-center gap-2 px-2 font-medium text-white/55 transition hover:text-white"
          onClick={handleSignOut}
          type="button"
        >
          <LogOut size={15} aria-hidden="true" />
          Sign out
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <details className="group rounded-md border border-white/10 bg-[#071010]/72 text-sm text-white shadow-lg backdrop-blur-xl">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 marker:hidden">
          <span className="flex items-center gap-2 font-medium">
            <Mail className="text-[#9ff3d0]" size={17} aria-hidden="true" />
            {compactLabel}
          </span>
          <span className="text-xs text-white/40 group-open:hidden">{compactHint}</span>
        </summary>
        <div className="border-t border-white/10 p-3">
          <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={handleSendLink}>
            <input
              autoCapitalize="none"
              autoComplete="email"
              className="fareping-auth-input h-10 rounded-md border border-white/14 bg-black/25 px-3 text-white outline-none placeholder:text-white/35 focus:border-[#9ff3d0]"
              defaultValue={email}
              inputMode="email"
              name="email"
              onInput={(event) => setEmail(event.currentTarget.value)}
              placeholder="you@example.com"
              required
              spellCheck={false}
              type="email"
            />
            <button
              className="h-10 rounded-md bg-[#9ff3d0] px-4 font-semibold text-[#07110f] transition hover:bg-white disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {loading ? "Sending link..." : linkSent ? "Resend link" : "Email sign-in link"}
            </button>
          </form>
          {message ? <p className="mt-2 text-[#9ff3d0]">{message}</p> : null}
          {error ? <p className="mt-2 text-[#ffaaa2]">{error}</p> : null}
        </div>
      </details>
    );
  }

  if (session) {
    return (
      <div className="rounded-lg border border-cyan-100/15 bg-white/[0.07] p-4 text-sm text-white shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-cyan-100 text-[#07111f]">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold">Signed in</p>
              <p className="mt-1 text-slate-300">{session.user.email}</p>
            </div>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 px-3 font-semibold text-slate-100 transition hover:bg-white/10"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-cyan-100/15 bg-white/[0.07] p-4 text-sm text-white shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-cyan-100 text-[#07111f]">
          <Mail size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="font-bold">Sign in with email</p>
          <p className="mt-1 text-slate-300">
            We will email you a secure sign-in link. No password needed.
          </p>
        </div>
      </div>

      <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSendLink}>
        <input
          autoCapitalize="none"
          autoComplete="email"
          className="fareping-auth-input h-11 rounded-md border border-white/14 bg-white/[0.08] px-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
          defaultValue={email}
          inputMode="email"
          name="email"
          onInput={(event) => setEmail(event.currentTarget.value)}
          placeholder="you@example.com"
          required
          spellCheck={false}
          type="email"
        />
        <button
          className="h-11 rounded-md bg-cyan-100 px-4 font-bold text-[#07111f] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white"
          disabled={loading}
          type="submit"
        >
          {loading ? "Sending link..." : linkSent ? "Resend link" : "Email sign-in link"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm font-semibold text-cyan-100">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-200">{error}</p> : null}
    </div>
  );
}
