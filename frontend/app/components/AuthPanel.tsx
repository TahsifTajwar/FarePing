"use client";

import { type FormEvent, useEffect, useState } from "react";
import { LogOut, Mail, ShieldCheck } from "lucide-react";
import {
  authSessionChangedEvent,
  getStoredSession,
  onAuthSessionChange,
  sendEmailCode,
  signOut,
  verifyEmailCode,
  type FarePingSession
} from "./authClient";

export function AuthPanel() {
  const [session, setSession] = useState<FarePingSession | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
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

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await sendEmailCode(email.trim());
      setCodeSent(true);
      setMessage("Check your email. Open the sign-in link or paste the one-time code here.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send a sign-in code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const nextSession = await verifyEmailCode(email.trim(), code.trim());
      setSession(nextSession);
      setCode("");
      setCodeSent(false);
      setMessage("Signed in. Your alerts are now separate from other users.");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Could not verify this code.");
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
            Use the email link or paste the one-time code. No password needed.
          </p>
        </div>
      </div>

      {!codeSent ? (
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSendCode}>
          <input
            className="h-11 rounded-md border border-white/14 bg-white/[0.08] px-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          <button
            className="h-11 rounded-md bg-cyan-100 px-4 font-bold text-[#07111f] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white"
            disabled={loading}
            type="submit"
          >
            {loading ? "Sending..." : "Send code"}
          </button>
        </form>
      ) : (
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={handleVerifyCode}>
          <input
            className="h-11 rounded-md border border-white/14 bg-white/[0.08] px-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
            onChange={(event) => setCode(event.target.value)}
            placeholder="One-time code"
            required
            value={code}
          />
          <button
            className="h-11 rounded-md bg-cyan-100 px-4 font-bold text-[#07111f] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white"
            disabled={loading}
            type="submit"
          >
            {loading ? "Checking..." : "Verify"}
          </button>
          <button
            className="h-11 rounded-md border border-white/15 px-4 font-semibold text-slate-100 transition hover:bg-white/10"
            onClick={() => setCodeSent(false)}
            type="button"
          >
            Change email
          </button>
        </form>
      )}

      {message ? <p className="mt-3 text-sm font-semibold text-cyan-100">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-200">{error}</p> : null}
    </div>
  );
}
