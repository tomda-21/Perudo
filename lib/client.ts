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

// ---------- profil permanent (gardé sur cet appareil) ----------
export type ProfileCreds = { id: string; key: string };
export function getProfileCreds(): ProfileCreds | null {
  try {
    const raw = localStorage.getItem("perudo:profile");
    return raw ? (JSON.parse(raw) as ProfileCreds) : null;
  } catch { return null; }
}
function saveProfileCreds(c: ProfileCreds) {
  try { localStorage.setItem("perudo:profile", JSON.stringify(c)); } catch {}
}

export type MyProfile = {
  profile: { id: string; name: string; avatar: string; hasPhoto: boolean; photoV: number; cup: string; since: string; publicAvatar: string };
  stats: import("./catalog").Stats;
  unlocked: string[];
  recent: { won: boolean; at: string; humans: number; rounds: number }[];
};

async function call<T>(url: string, init: RequestInit & { token?: string; profile?: boolean } = {}): Promise<T> {
  const prof = init.profile ? getProfileCreds() : null;
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.token ? { "x-player-token": init.token } : {}),
      ...(prof ? { "x-profile-id": prof.id, "x-profile-key": prof.key } : {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erreur réseau");
  return data as T;
}

export const api = {
  create: (name: string) =>
    call<{ code: string } & Session>("/api/games", { method: "POST", profile: true, body: JSON.stringify({ name }) }),
  join: (code: string, name: string) =>
    call<{ code: string } & Session>(`/api/games/${code}/join`, { method: "POST", profile: true, body: JSON.stringify({ name }) }),
  /** Charge mon profil, ou le crée au premier passage. */
  async myProfile(name?: string): Promise<MyProfile> {
    if (getProfileCreds()) {
      try { return await call<MyProfile>("/api/profile", { profile: true }); } catch {}
    }
    const r = await call<MyProfile & ProfileCreds>("/api/profile", { method: "POST", body: JSON.stringify({ name: name ?? lastName() }) });
    saveProfileCreds({ id: r.id, key: r.key });
    return r;
  },
  updateProfile: (patch: Record<string, unknown>) =>
    call<MyProfile>("/api/profile", { method: "PATCH", profile: true, body: JSON.stringify(patch) }),
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
