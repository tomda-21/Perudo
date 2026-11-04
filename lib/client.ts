"use client";
// Outils côté navigateur : session du joueur, appels à l'API, temps réel.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { PlayerView } from "./rules";

export type Session = { playerId: string; token: string };

const KEY = (code: string) => `perudo:${code}`;

export function getSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(KEY(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(code: string, s: Session) {
  try {
    localStorage.setItem(KEY(code), JSON.stringify(s));
  } catch {}
}

export function rememberName(name: string) {
  try { localStorage.setItem("perudo:name", name); } catch {}
}
export function lastName() {
  try { return localStorage.getItem("perudo:name") ?? ""; } catch { return ""; }
}

async function call<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.token ? { "x-player-token": init.token } : {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erreur réseau");
  return data as T;
}

export const api = {
  create: (name: string) =>
    call<{ code: string } & Session>("/api/games", { method: "POST", body: JSON.stringify({ name }) }),
  join: (code: string, name: string) =>
    call<{ code: string } & Session>(`/api/games/${code}/join`, { method: "POST", body: JSON.stringify({ name }) }),
  state: (code: string, token?: string) => call<PlayerView>(`/api/games/${code}`, { token }),
  action: (code: string, token: string, body: Record<string, unknown>) =>
    call<PlayerView>(`/api/games/${code}/action`, { method: "POST", token, body: JSON.stringify(body) }),
};

let supa: SupabaseClient | null = null;
export function realtime() {
  if (!supa)
    supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, {
      auth: { persistSession: false },
    });
  return supa;
}
