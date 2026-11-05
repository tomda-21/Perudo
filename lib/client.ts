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
export type ProfileCreds = { id: string; key: string; acct?: boolean }; // acct : profil d'un compte e-mail
export function getProfileCreds(): ProfileCreds | null {
  try {
    const raw = localStorage.getItem("perudo:profile");
    return raw ? (JSON.parse(raw) as ProfileCreds) : null;
  } catch { return null; }
}
export function saveProfileCreds(c: ProfileCreds) {
  try { localStorage.setItem("perudo:profile", JSON.stringify(c)); } catch {}
}

export type MyProfile = {
  profile: { id: string; name: string; avatar: string; hasPhoto: boolean; photoV: number; cup: string; since: string; publicAvatar: string };
  stats: import("./catalog").Stats;
  unlocked: string[];
  usable?: string[]; // gobelets utilisables (admin : tous)
  isAdmin?: boolean;
  cups: import("./content").CupItem[];
  recent: { won: boolean; at: string; humans: number; rounds: number }[];
  account: { login: string; since: string; email?: string | null; nameChangesLeft?: number } | null;
};

export type Progress = import("./progression-types").Progress;
export function forgetProfile() {
  try { localStorage.removeItem("perudo:profile"); } catch {}
}

async function call<T>(url: string, init: RequestInit & { token?: string; profile?: boolean; bearer?: string } = {}): Promise<T> {
  const prof = init.profile ? getProfileCreds() : null;
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.token ? { "x-player-token": init.token } : {}),
      ...(prof ? { "x-profile-id": prof.id, "x-profile-key": prof.key } : {}),
      ...(init.bearer ? { authorization: `Bearer ${init.bearer}` } : {}),
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
    await syncAccount().catch(() => {});
    if (getProfileCreds()) {
      try { return await call<MyProfile>("/api/profile", { profile: true }); } catch {}
    }
    const r = await call<MyProfile & ProfileCreds>("/api/profile", { method: "POST", body: JSON.stringify({ name: name ?? lastName() }) });
    saveProfileCreds({ id: r.id, key: r.key });
    return r;
  },
  updateProfile: (patch: Record<string, unknown>) =>
    call<MyProfile>("/api/profile", { method: "PATCH", profile: true, body: JSON.stringify(patch) }),
  progress: () => call<Progress>("/api/progress", { profile: true }),
  progressAction: <T = unknown>(body: Record<string, unknown>) =>
    call<{ result: T; progress: Progress }>("/api/progress", { method: "POST", profile: true, body: JSON.stringify(body) }),
  social: (game?: string) => call<Social>(`/api/social${game ? `?game=${game}` : ""}`, { profile: true }),
  socialAction: (body: Record<string, unknown>) =>
    call<{ ok: boolean; message?: string }>("/api/social", { method: "POST", profile: true, body: JSON.stringify(body) }),
  deleteAccount: (bearer: string) =>
    call<{ ok: true }>("/api/account", { method: "POST", profile: true, bearer, body: JSON.stringify({ op: "delete", confirm: "SUPPRIMER" }) }),
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

// ---------- compte e-mail (Supabase Auth : session gardée et rafraîchie dans ce navigateur) ----------
let authClient: SupabaseClient | null = null;
export function auth() {
  if (!authClient)
    authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "perudo-auth" },
    });
  return authClient.auth;
}

/** Relie cet appareil au profil du compte connecté (ou revient en invité après déconnexion). */
export async function syncAccount() {
  const { data, error } = await auth().getSession();
  if (error) return; // réseau : on ne touche à rien
  const s = data.session;
  const c = getProfileCreds();
  if (s?.user.email_confirmed_at && !c?.acct) {
    const r = await call<ProfileCreds>("/api/account", { method: "POST", bearer: s.access_token, body: JSON.stringify({ op: "session", name: lastName() }) });
    saveProfileCreds({ id: r.id, key: r.key, acct: true });
  } else if (!s && c?.acct) {
    forgetProfile(); // session terminée : retour en invité
  }
}

/** Messages Supabase → français. */
export function authError(e: unknown) {
  const m = String((e as Error)?.message ?? e ?? "");
  if (/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect";
  if (/email not confirmed/i.test(m)) return "Adresse e-mail pas encore confirmée : clique le lien reçu par e-mail";
  if (/already registered|already been registered/i.test(m)) return "Un compte existe déjà avec cet e-mail";
  if (/rate limit|too many|security purposes/i.test(m)) return "Trop de demandes : réessaie dans quelques minutes";
  if (/password should be|weak password/i.test(m)) return "Mot de passe trop faible (8 caractères minimum)";
  if (/invalid.*email|unable to validate email/i.test(m)) return "Adresse e-mail invalide";
  return m || "Erreur réseau";
}

// ---------- amis ----------
export type Friend = {
  id: string; name: string; avatar?: string | null; photo?: string | null; photo_v?: number; cup?: string | null; public_id: string;
  status: "pending" | "accepted"; incoming: boolean; presence: "online" | "game" | "offline"; game: string | null; hidden: boolean; showcase: string[];
};
export type RankRow = { id: string; name: string; wins: number; played: number; rate: number; rank: number };
export type Notif = { id: number; kind: "friend_request" | "friend_accepted" | "invite"; read: boolean; at: string; code: string | null; from: string | null; from_name: string | null };
export type Social = {
  meId: string; friends: Friend[]; blocked: { id: string; name: string }[]; notifications: Notif[];
  me: { hidden: boolean; showcase: string[] } | null; ranking: { permanent: RankRow[]; monthly: RankRow[] };
};
