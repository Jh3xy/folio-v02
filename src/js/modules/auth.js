
/**
 * auth.js — Supabase Auth: client init, sign up/in/out, session helpers.
 * No session caching here — getSession() always asks Supabase directly,
 * which itself just reads localStorage (fast) except when the stored token
 * needs a refresh (a real network call). Callers that care about that gap
 * should debounce their own busy-state, not assume this always resolves instantly.
 */

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
}

/**
 * @returns {Promise<import("@supabase/supabase-js").Session | null>}
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("[auth] getSession failed:", error.message);
    return null;
  }
  return data.session;
}

/**
 * Fires immediately with the current session, then again on every sign-in/
 * sign-out/token-refresh — this is how the rest of the app reacts to auth
 * changes without polling.
 * @param {(session: import("@supabase/supabase-js").Session | null) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Maps common Supabase Auth error messages to toast-friendly text.
 * Falls back to the raw message (still readable) for anything unmapped.
 * @param {import("@supabase/supabase-js").AuthError | null} error
 */
export function getAuthErrorMessage(error) {
  if (!error) return "Something went wrong — try again.";
  const msg = error.message || "";

  if (msg.includes("Invalid login credentials")) {
    return "Wrong email or password.";
  }
  if (msg.includes("already registered")) {
    return "That email's already registered — try logging in instead.";
  }
  if (msg.includes("Password should be at least")) {
    return msg; // already specific enough as-is
  }
  if (msg.includes("Unable to validate email")) {
    return "That doesn't look like a valid email address.";
  }
  if (msg.toLowerCase().includes("rate limit")) {
    return "Too many attempts — wait a moment and try again.";
  }

  return msg || "Something went wrong — try again.";
}
