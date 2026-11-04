// =============================================================
//  ÉCONOMIE ET PROGRESSION — toutes les valeurs d'équilibrage au même
//  endroit. Les valeurs ci-dessous sont celles par défaut ; l'admin peut
//  les modifier (onglet Économie) sans toucher au code.
//  Rappel : tout est cosmétique, rien ne change les dés ni les règles.
// =============================================================

export type Reward = { doblons: number; xp: number };
export type WheelPrize = {
  id: string; label: string; icon: string;
  type: "doblons" | "fragment" | "mystery" | "phrase" | "sound" | "reaction";
  amount: number; // Doblons ou fragments
  weight: number; // en %
  active: boolean;
};
export type Title = { id: string; name: string; cond: { type: "level"; n: number } | { type: "cup"; id: string } };

export type EconomyConfig = {
  rewards: { complete: Reward; win: Reward; liar: Reward; exact: Reward; dailyChallenge: number; weeklyChallenge: number };
  limits: { liarPerGame: number; exactPerGame: number };
  official: { minHumans: number; minRounds: number; allowBots: boolean };
  wheel: { cooldownHours: number; duplicateDoblons: number; prizes: WheelPrize[] };
  fragments: { needed: number; allOwnedDoblons: number };
  levels: { base: number; step: number };
  titles: Title[];
};

export const DEFAULT_ECONOMY: EconomyConfig = {
  rewards: {
    complete: { doblons: 40, xp: 60 }, win: { doblons: 60, xp: 100 },
    liar: { doblons: 10, xp: 15 }, exact: { doblons: 15, xp: 20 },
    dailyChallenge: 40, weeklyChallenge: 150,
  },
  limits: { liarPerGame: 3, exactPerGame: 2 },
  official: { minHumans: 2, minRounds: 3, allowBots: false },
  wheel: {
    cooldownHours: 24, duplicateDoblons: 100,
    prizes: [
      { id: "d75", label: "75 Doblons", icon: "🪙", type: "doblons", amount: 75, weight: 40, active: true },
      { id: "d150", label: "150 Doblons", icon: "💰", type: "doblons", amount: 150, weight: 25, active: true },
      { id: "cosmetic", label: "Phrase ou réaction", icon: "💬", type: "phrase", amount: 0, weight: 15, active: true },
      { id: "frag", label: "Fragment mystère", icon: "🧩", type: "fragment", amount: 1, weight: 12, active: true },
      { id: "d300", label: "300 Doblons", icon: "👑", type: "doblons", amount: 300, weight: 6, active: true },
      { id: "mystery", label: "Gobelet mystère", icon: "🎁", type: "mystery", amount: 0, weight: 2, active: true },
    ],
  },
  fragments: { needed: 6, allOwnedDoblons: 500 },
  levels: { base: 120, step: 60 },
  titles: [
    { id: "t1", name: "Débutant du bluff", cond: { type: "level", n: 1 } },
    { id: "t2", name: "Apprenti menteur", cond: { type: "level", n: 3 } },
    { id: "t3", name: "Bluffeur confirmé", cond: { type: "level", n: 6 } },
    { id: "t4", name: "Menteur professionnel", cond: { type: "level", n: 10 } },
    { id: "t5", name: "Détecteur de mythos", cond: { type: "cup", id: "detective" } },
    { id: "t6", name: "Roi du bluff", cond: { type: "level", n: 20 } },
    { id: "t7", name: "Phénix renaissant", cond: { type: "cup", id: "phoenix" } },
    { id: "t8", name: "L'Invincible", cond: { type: "cup", id: "invincible" } },
  ],
};

// ---------- niveaux ----------
/** XP nécessaire pour passer du niveau L au niveau L+1. */
export const xpStep = (c: EconomyConfig, level: number) => c.levels.base + c.levels.step * (level - 1);
export function levelOf(c: EconomyConfig, xp: number) {
  let level = 1, rest = xp;
  while (rest >= xpStep(c, level) && level < 999) { rest -= xpStep(c, level); level++; }
  return { level, into: rest, need: xpStep(c, level) };
}
export function titlesUnlocked(c: EconomyConfig, level: number, cups: string[]) {
  return c.titles.filter((t) => (t.cond.type === "level" ? level >= t.cond.n : cups.includes(t.cond.id)));
}

// ---------- validation (admin) ----------
export class EconomyError extends Error {}
const int = (x: unknown, lo: number, hi: number, d: number) => {
  const v = Math.round(Number(x));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
};
const rew = (x: unknown, d: Reward): Reward => {
  const o = (x ?? {}) as Record<string, unknown>;
  return { doblons: int(o.doblons, 0, 100000, d.doblons), xp: int(o.xp, 0, 100000, d.xp) };
};
const PRIZE_TYPES: WheelPrize["type"][] = ["doblons", "fragment", "mystery", "phrase", "sound", "reaction"];

export function cleanEconomy(x: Record<string, unknown>): EconomyConfig {
  const D = DEFAULT_ECONOMY;
  const r = (x.rewards ?? {}) as Record<string, unknown>;
  const l = (x.limits ?? {}) as Record<string, unknown>;
  const o = (x.official ?? {}) as Record<string, unknown>;
  const w = (x.wheel ?? {}) as Record<string, unknown>;
  const f = (x.fragments ?? {}) as Record<string, unknown>;
  const lv = (x.levels ?? {}) as Record<string, unknown>;
  const prizes = (Array.isArray(w.prizes) ? w.prizes : D.wheel.prizes).slice(0, 12).map((p, i) => {
    const q = p as Record<string, unknown>;
    const type = PRIZE_TYPES.includes(q.type as WheelPrize["type"]) ? (q.type as WheelPrize["type"]) : "doblons";
    return {
      id: String(q.id || `lot${i + 1}`).replace(/[^a-z0-9-]/gi, "").slice(0, 20) || `lot${i + 1}`,
      label: String(q.label ?? "").slice(0, 30) || "Lot", icon: String(q.icon ?? "🎁").slice(0, 4),
      type, amount: int(q.amount, 0, 100000, 0), weight: Math.max(0, Math.round(Number(q.weight) * 100) / 100 || 0), active: q.active !== false,
    };
  });
  const total = prizes.filter((p) => p.active).reduce((n, p) => n + p.weight, 0);
  if (Math.abs(total - 100) > 0.01) throw new EconomyError(`Les probabilités des lots actifs doivent faire 100 % (actuellement ${total} %)`);
  const titles = (Array.isArray(x.titles) ? x.titles : D.titles).slice(0, 40).map((t, i) => {
    const q = t as Record<string, unknown>; const c = (q.cond ?? {}) as Record<string, unknown>;
    return {
      id: String(q.id || `t${i + 1}`).slice(0, 20), name: String(q.name ?? "").slice(0, 32) || "Titre",
      cond: c.type === "cup" ? { type: "cup" as const, id: String(c.id ?? "") } : { type: "level" as const, n: int(c.n, 1, 999, 1) },
    };
  });
  return {
    rewards: {
      complete: rew(r.complete, D.rewards.complete), win: rew(r.win, D.rewards.win), liar: rew(r.liar, D.rewards.liar), exact: rew(r.exact, D.rewards.exact),
      dailyChallenge: int(r.dailyChallenge, 0, 100000, D.rewards.dailyChallenge), weeklyChallenge: int(r.weeklyChallenge, 0, 100000, D.rewards.weeklyChallenge),
    },
    limits: { liarPerGame: int(l.liarPerGame, 0, 50, 3), exactPerGame: int(l.exactPerGame, 0, 50, 2) },
    official: { minHumans: int(o.minHumans, 2, 8, 2), minRounds: int(o.minRounds, 1, 50, 3), allowBots: o.allowBots === true },
    wheel: { cooldownHours: int(w.cooldownHours, 1, 168, 24), duplicateDoblons: int(w.duplicateDoblons, 0, 100000, 100), prizes },
    fragments: { needed: int(f.needed, 1, 100, 6), allOwnedDoblons: int(f.allOwnedDoblons, 0, 100000, 500) },
    levels: { base: int(lv.base, 10, 100000, 120), step: int(lv.step, 0, 100000, 60) },
    titles,
  };
}

/** Tirage pondéré (côté serveur uniquement). */
export function drawPrize(prizes: WheelPrize[], rnd: number): WheelPrize {
  const list = prizes.filter((p) => p.active && p.weight > 0);
  const total = list.reduce((n, p) => n + p.weight, 0);
  let x = rnd * total;
  for (const p of list) { if (x < p.weight) return p; x -= p.weight; }
  return list[list.length - 1];
}

// ---------- défis ----------
export type ChallengeMetric = "games" | "wins" | "liarWins" | "exactWins" | "bids";
export type ChallengeItem = { id: string; name: string; period: "daily" | "weekly"; metric: ChallengeMetric; target: number; doblons: number; fragments: number };
export const METRIC_LABEL: Record<ChallengeMetric, string> = {
  games: "parties officielles terminées", wins: "victoires officielles", liarWins: "« Menteur ! » réussis",
  exactWins: "« Exact ! » réussis", bids: "annonces valides",
};

/** Fuseau de référence des défis : Europe/Paris (minuit, et lundi minuit pour la semaine). */
const TZ = "Europe/Paris";
function parisParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, wd: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday) };
}
export function periodKeys(now = new Date()) {
  const p = parisParts(now);
  const day = `d:${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  const monday = new Date(Date.UTC(p.y, p.m - 1, p.d - p.wd));
  const week = `w:${monday.toISOString().slice(0, 10)}`;
  return { day, week };
}
/** Fin de la période (minuit à Paris), pour afficher le temps restant. */
export function periodEnd(now = new Date(), weekly = false) {
  const p = parisParts(now);
  // décalage Paris/UTC du moment (+1 h ou +2 h)
  const probe = new Date(Date.UTC(p.y, p.m - 1, p.d, 12));
  const off = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(probe)) - 12;
  const days = weekly ? 7 - p.wd : 1;
  return new Date(Date.UTC(p.y, p.m - 1, p.d + days, 0) - off * 3600 * 1000);
}
/** Les 3 défis de la période, choisis de façon stable (même tirage pour tout le monde). */
export function pickChallenges(all: ChallengeItem[], period: "daily" | "weekly", key: string, exactEnabled: boolean, n = 3) {
  const pool = all.filter((c) => c.period === period && (exactEnabled || c.metric !== "exactWins"));
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, n);
}
