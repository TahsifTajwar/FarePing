"use client";

import { createClient, type Session } from "@supabase/supabase-js";

export type FarePingSession = {
  accessToken: string;
  user: {
    id: string;
    email: string | null;
  };
};

export const authSessionChangedEvent = "fareping-auth-session-changed";

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase Auth is not configured in the frontend.");
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  });

  return supabaseClient;
}

export async function getStoredSession() {
  const {
    data: { session }
  } = await getSupabaseClient().auth.getSession();

  return toFarePingSession(session);
}

export async function sendEmailCode(email: string) {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo
    }
  });

  if (error) {
    throw new Error(error.message || "Could not send the sign-in email.");
  }
}

export async function verifyEmailCode(email: string, token: string) {
  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    email,
    token,
    type: "email"
  });

  if (error) {
    throw new Error(error.message || "That code did not work. Try a fresh code.");
  }

  window.dispatchEvent(new Event(authSessionChangedEvent));
  return toFarePingSession(data.session);
}

export async function signOut() {
  await getSupabaseClient().auth.signOut();
  window.dispatchEvent(new Event(authSessionChangedEvent));
}

export function onAuthSessionChange(callback: (session: FarePingSession | null) => void) {
  const {
    data: { subscription }
  } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    callback(toFarePingSession(session));
    window.dispatchEvent(new Event(authSessionChangedEvent));
  });

  return () => subscription.unsubscribe();
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const session = await getStoredSession();

  if (!session) {
    throw new Error("Sign in before managing saved alerts.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);

  return fetch(input, {
    ...init,
    headers
  });
}

function toFarePingSession(session: Session | null): FarePingSession | null {
  if (!session) {
    return null;
  }

  return {
    accessToken: session.access_token,
    user: {
      id: session.user.id,
      email: session.user.email ?? null
    }
  };
}
