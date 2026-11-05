// =============================================================
//  ÉCONOMIE ET PROGRESSION — toutes les valeurs d'équilibrage au même
//  endroit. Les valeurs ci-dessous sont celles par défaut ; l'admin peut
//  les modifier (onglet Économie) sans toucher au code.
//  Rappel : tout est cosmétique, rien ne change les dés ni les règles.
// =============================================================

export type Reward = { doblons: number; xp: number };
export type WheelPrize = {
  id: string; label: string; icon: string;
  type: "doblons" | "fragment" | "mystery" | "cosmetic" | "phrase" | "sound" | "reaction"; // cosmetic : cadre ou animation non possédé
  amount: number; // Doblons ou fragments
  weight: number; // en %
  active: boolean;
};
export type Title = { id: string; name: string; cond: { type: "level"; n: number } | { type: "cup"; id: string } };
/** Palier de niveau : récompense versée une seule fois (Doblons + éventuellement un cadre). */
/** Coffre mystère : une seule récompense, tirée côté serveur selon ces pourcentages. */
export type ChestOdds = { common: number; rare: number; epic: number; legendary: number; fragment: number; mystery: number };
export type ChestConfig = { id: string; name: string; price: number; compensation: number; odds: ChestOdds };
export const CHEST_CATS = ["common", "rare", "epic", "legendary", "fragment", "mystery"] as const;
export type ChestCat = (typeof CHEST_CATS)[number];
export type LevelReward = { level: number; doblons: number; frame?: string | null };

export type EconomyConfig = {
  rewards: { complete: Reward; win: Reward; liar: Reward; exact: Reward; dailyChallenge: number; weeklyChallenge: number; dailyChallengeXp: number; weeklyChallengeXp: number };
  limits: { liarPerGame: number; exactPerGame: number };
  official: { minHumans: number; minRounds: number; allowBots: boolean };
  wheel: { cooldownHours: number; duplicateDoblons: number; cosmeticDoblons: number; prizes: WheelPrize[] };
  /** allOwnedDoblons : Doblons donnés PAR fragment une fois tous les mystères possédés. */
  fragments: { needed: number; allOwnedDoblons: number };
  chests: ChestConfig[];
  levels: { base: number; step: number; quad: number };
  levelRewards: LevelReward[];
  /** Après le dernier palier : quelques Doblons tous les `every` niveaux. */
  levelAfter: { every: number; doblons: number };
  titles: Title[];
};

export const DEFAULT_ECONOMY: EconomyConfig = {
  rewards: {
    // gains définitifs (cahier des charges V1.0, § 40)
    complete: { doblons: 20, xp: 40 }, win: { doblons: 35, xp: 70 },
    liar: { doblons: 5, xp: 10 }, exact: { doblons: 10, xp: 15 },
    dailyChallenge: 25, weeklyChallenge: 100, dailyChallengeXp: 30, weeklyChallengeXp: 120,
  },
  limits: { liarPerGame: 3, exactPerGame: 2 },
  // toute partie terminée compte, bots compris (les invités ne gagnent rien)
  official: { minHumans: 1, minRounds: 1, allowBots: true },
  wheel: {
    // § 57–58 : 1 tour gratuit / 24 h glissantes, jamais achetable
    cooldownHours: 24, duplicateDoblons: 100, cosmeticDoblons: 40,
    prizes: [
      { id: "d20", label: "20 Doblons", icon: "🪙", type: "doblons", amount: 20, weight: 40, active: true },
      { id: "d40", label: "40 Doblons", icon: "💰", type: "doblons", amount: 40, weight: 25, active: true },
      { id: "cosmetic", label: "Cosmétique", icon: "🖼️", type: "cosmetic", amount: 0, weight: 15, active: true },
      { id: "frag", label: "Fragment universel", icon: "🧩", type: "fragment", amount: 1, weight: 12, active: true },
      { id: "d100", label: "100 Doblons", icon: "👑", type: "doblons", amount: 100, weight: 6, active: true },
      { id: "mystery", label: "Gobelet mystère", icon: "🎁", type: "mystery", amount: 0, weight: 2, active: true },
    ],
  },
  fragments: { needed: 6, allOwnedDoblons: 30 },
  // § 53–55
  chests: [
    { id: "classic", name: "Coffre Classique", price: 300, compensation: 75, odds: { common: 70, rare: 23, epic: 0, legendary: 0, fragment: 6, mystery: 1 } },
    { id: "rare", name: "Coffre Rare", price: 800, compensation: 200, odds: { common: 20, rare: 50, epic: 20, legendary: 0, fragment: 8, mystery: 2 } },
    { id: "epic", name: "Coffre Épique", price: 2000, compensation: 500, odds: { common: 0, rare: 15, epic: 45, legendary: 25, fragment: 10, mystery: 5 } },
  ],
  // XP pour passer du niveau n à n+1 : 100 + 30 × (n − 1) + (n − 1)²
  levels: { base: 100, step: 30, quad: 1 },
  levelRewards: [
    { level: 5, doblons: 25 },
    { level: 10, doblons: 50 }, // + titre « Apprenti du bluff »
    { level: 20, doblons: 100, frame: "bronze-gobelin" },
    { level: 30, doblons: 150 }, // + titre « Maître des dés »
    { level: 50, doblons: 250, frame: "gold-anim" },
  ],
  levelAfter: { every: 10, doblons: 100 },
  titles: [
    { id: "t1", name: "Débutant du bluff", cond: { type: "level", n: 1 } },
    { id: "t-apprenti", name: "Apprenti du bluff", cond: { type: "level", n: 10 } },
    { id: "t-maitre", name: "Maître des dés", cond: { type: "level", n: 30 } },
    { id: "t5", name: "Détecteur de mythos", cond: { type: "cup", id: "detective" } },
    { id: "t7", name: "Phénix renaissant", cond: { type: "cup", id: "phoenix" } },
    { id: "t8", name: "L'Invincible", cond: { type: "cup", id: "invincible" } },
  ],
};

// ---------- niveaux ----------
/** XP nécessaire pour passer du niveau L au niveau L+1. */
export const xpStep = (c: EconomyConfig, level: number) =>
  c.levels.base + c.levels.step * (level - 1) + (c.levels.quad ?? 0) * (level - 1) ** 2;
export function levelOf(c: EconomyConfig, xp: number) {
  let level = 1, rest = xp;
  while (rest >= xpStep(c, level) && level < 100000) { rest -= xpStep(c, level); level++; } // niveaux illimités
  return { level, into: rest, need: xpStep(c, level) };
}
/** Paliers atteints au niveau `level` (chacun versé une seule fois, clé `level:N`). */
export function levelRewardsUpTo(c: EconomyConfig, level: number): LevelReward[] {
  const list = c.levelRewards.filter((r) => r.level <= level);
  const last = Math.max(0, ...c.levelRewards.map((r) => r.level));
  if (c.levelAfter.every > 0 && c.levelAfter.doblons > 0)
    for (let n = last + c.levelAfter.every; n <= level; n += c.levelAfter.every) list.push({ level: n, doblons: c.levelAfter.doblons });
  return list;
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
const PRIZE_TYPES: WheelPrize["type"][] = ["doblons", "fragment", "mystery", "cosmetic", "phrase", "sound", "reaction"];

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
      dailyChallengeXp: int(r.dailyChallengeXp, 0, 100000, D.rewards.dailyChallengeXp), weeklyChallengeXp: int(r.weeklyChallengeXp, 0, 100000, D.rewards.weeklyChallengeXp),
    },
    limits: { liarPerGame: int(l.liarPerGame, 0, 50, 3), exactPerGame: int(l.exactPerGame, 0, 50, 2) },
    official: { minHumans: int(o.minHumans, 1, 6, 1), minRounds: int(o.minRounds, 1, 50, 1), allowBots: o.allowBots !== false },
    wheel: { cooldownHours: int(w.cooldownHours, 1, 168, 24), duplicateDoblons: int(w.duplicateDoblons, 0, 100000, 100), cosmeticDoblons: int(w.cosmeticDoblons, 0, 100000, 40), prizes },
    fragments: { needed: int(f.needed, 1, 100, 6), allOwnedDoblons: int(f.allOwnedDoblons, 0, 100000, 30) },
    chests: (Array.isArray(x.chests) ? x.chests : D.chests).slice(0, 6).map((q, i) => {
      const c = q as Record<string, unknown>; const d = D.chests[i] ?? D.chests[0];
      const o = (c.odds ?? {}) as Record<string, unknown>;
      const odds = Object.fromEntries(CHEST_CATS.map((k) => [k, int(o[k], 0, 100, 0)])) as ChestOdds;
      const tot = CHEST_CATS.reduce((n, k) => n + odds[k], 0);
      if (tot !== 100) throw new EconomyError(`${String(c.name ?? d.name)} : les probabilités doivent faire 100 % (actuellement ${tot} %)`);
      return { id: String(c.id ?? d.id).slice(0, 20), name: String(c.name ?? d.name).slice(0, 30), price: int(c.price, 1, 1_000_000, d.price), compensation: int(c.compensation, 0, 1_000_000, d.compensation), odds };
    }),
    levels: { base: int(lv.base, 10, 100000, 100), step: int(lv.step, 0, 100000, 30), quad: int(lv.quad, 0, 1000, 1) },
    levelRewards: (Array.isArray(x.levelRewards) ? x.levelRewards : D.levelRewards).slice(0, 40).map((q) => {
      const o2 = q as Record<string, unknown>;
      return { level: int(o2.level, 2, 100000, 5), doblons: int(o2.doblons, 0, 100000, 0), frame: o2.frame ? String(o2.frame).slice(0, 30) : null };
    }).sort((a, b) => a.level - b.level),
    levelAfter: { every: int((x.levelAfter as Record<string, unknown> | undefined)?.every, 0, 1000, D.levelAfter.every), doblons: int((x.levelAfter as Record<string, unknown> | undefined)?.doblons, 0, 100000, D.levelAfter.doblons) },
    titles,
  };
}

/** Tirage pondéré (côté serveur uniquement). */
/** Catégorie tirée dans un coffre (rnd ∈ [0, 1[). */
export function drawChest(odds: ChestOdds, rnd: number): ChestCat {
  let x = rnd * 100;
  for (const k of CHEST_CATS) { if (odds[k] <= 0) continue; if (x < odds[k]) return k; x -= odds[k]; }
  return CHEST_CATS.filter((k) => odds[k] > 0).at(-1) ?? "common";
}
/** Raretés de repli si la rareté tirée est épuisée : la plus proche d'abord (à égalité, la plus haute). */
export function rarityFallbacks(cat: "common" | "rare" | "epic" | "legendary", odds: ChestOdds) {
  const order = ["common", "rare", "epic", "legendary"] as const;
  const i = order.indexOf(cat);
  return [...order].filter((k) => k === cat || odds[k] > 0)
    .sort((a, b) => Math.abs(order.indexOf(a) - i) - Math.abs(order.indexOf(b) - i) || order.indexOf(b) - order.indexOf(a));
}
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
  games: "parties terminées", wins: "victoires", liarWins: "Dudo réussis",
  exactWins: "Exact réussis", bids: "annonces valides",
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
