// =============================================================
//  PROGRESSION — comptes, Doblons, XP, roue, boutique, fragments, défis.
//  Côté serveur uniquement. Toutes les récompenses passent par la base
//  (fonction srv2) avec un identifiant d'événement unique : impossible de
//  toucher deux fois la même récompense, même en rafraîchissant la page.
// =============================================================
import "server-only";
import { createHash, randomBytes, randomInt } from "crypto";
import { checkPassword, hashPassword } from "./admin";
import { publicContent } from "./content-server";
import type { CupItem, PublicContent, Rarity } from "./content";
import { CHEST_CATS, ChestCat, drawChest, drawPrize, EconomyConfig, rarityFallbacks, levelOf, levelRewardsUpTo, periodEnd, periodKeys, pickChallenges, titlesUnlocked, ChallengeItem } from "./economy";
import { ResultRow, RuleError } from "./rules";
import { srv, srv2, srv5 } from "./srv";

const sha = (x: string) => createHash("sha256").update(x).digest("hex");
const rnd = () => randomInt(0, 1_000_000) / 1_000_000;

export type ItemType = "cup" | "phrase" | "sound" | "reaction" | "frame" | "victory";
type Inv = { type: ItemType; id: string; source: string; at: string };
type WalletDb = {
  wallet: { doblons: number; xp: number; fragments: number; last_spin: string | null; title: string | null; frame: string | null; victory: string | null };
  inventory: Inv[];
  ledger: { id: number; kind: string; doblons: number; xp: number; fragments: number; detail: Record<string, unknown> | null; at: string }[];
  extra: { phoenix: number; flawless: number; bids: number };
  now: string;
};

// ---------------- comptes ----------------
const LOGIN_RE = /^[a-z0-9_.-]{3,20}$/;
export const cleanLogin = (x: unknown) => String(x ?? "").trim().toLowerCase();
export const loginProblem = (l: string) => (LOGIN_RE.test(l) ? null : "Identifiant : 3 à 20 caractères (lettres, chiffres, . _ -)");
export const playerPasswordProblem = (pw: string) => (pw.length < 8 ? "Le mot de passe doit faire au moins 8 caractères" : pw.length > 100 ? "Mot de passe trop long" : null);

import { accountOf } from "./account";
export { accountOf };

/** Transforme le profil invité de cet appareil en compte permanent (il garde ses stats). */
export async function createAccount(profileId: string, login: string, password: string) {
  const p = loginProblem(login) ?? playerPasswordProblem(password);
  if (p) throw new RuleError(p);
  const r = await srv2<string>("acct_create", { profile_id: profileId, login, pw_hash: hashPassword(password) });
  if (r === "taken") throw new RuleError("Cet identifiant est déjà pris");
  if (r === "has_account") throw new RuleError("Ce profil a déjà un compte");
}

/** Connexion depuis un autre appareil : renvoie une nouvelle clé pour cet appareil. */
export async function loginAccount(login: string, password: string) {
  const a = await srv2<{ profile_id: string; pw_hash: string; failed: number; locked_until: string | null } | null>("acct_by_login", { login });
  // même message dans tous les cas : on ne révèle pas si l'identifiant existe
  const bad = new RuleError("Identifiant ou mot de passe incorrect");
  if (!a) { checkPassword(password, "scrypt$00$00"); throw bad; }
  if (a.locked_until && new Date(a.locked_until) > new Date()) throw new RuleError("Trop d'essais : réessaie dans 15 minutes");
  if (!checkPassword(password, a.pw_hash)) { await srv2("acct_fail", { profile_id: a.profile_id }); throw bad; }
  await srv2("acct_ok", { profile_id: a.profile_id });
  const key = randomBytes(24).toString("hex");
  await srv2("device_add", { profile_id: a.profile_id, key_sha256: sha(key) });
  return { id: a.profile_id, key };
}

/** Clé d'un appareil connecté à un compte ? (en plus de la clé d'origine du profil) */
export async function deviceKeyOwner(key: string) {
  return srv2<string | null>("device_check", { key_sha256: sha(key) });
}

// ---------------- possession des objets ----------------
export function catalogOf(c: PublicContent, type: ItemType): { id: string; name: string; price: number; reward?: boolean }[] {
  switch (type) {
    case "phrase": return c.phrases.map((x) => ({ id: x.id, name: x.text, price: x.price ?? 0 }));
    case "sound": return c.sounds.map((x) => ({ id: x.id, name: x.label, price: x.price ?? 0 }));
    case "reaction": return c.reactions.map((x) => ({ id: x.id, name: `${x.emoji} ${x.label}`, price: x.price }));
    case "frame": return c.frames.map((x) => ({ id: x.id, name: x.name, price: x.price, reward: !!x.reward }));
    case "victory": return c.victories.map((x) => ({ id: x.id, name: x.name, price: x.price }));
    case "cup": return c.cups.filter((x) => x.category === "shop").map((x) => ({ id: x.id, name: x.name, price: x.price ?? 0 }));
  }
}
const owns = (inv: Inv[], type: ItemType, id: string) => inv.some((i) => i.type === type && i.id === id);
/** Objets gratuits + objets achetés/gagnés. */
export function ownedIds(c: PublicContent, inv: Inv[], type: Exclude<ItemType, "cup">) {
  // gratuits (sauf objets de palier, qui se gagnent) + achetés / gagnés
  return catalogOf(c, type).filter((x) => (x.price === 0 && !x.reward) || owns(inv, type, x.id)).map((x) => x.id);
}

export async function wallet(profileId: string) {
  return srv2<WalletDb>("wallet", { profile_id: profileId });
}

// ---------------- récompenses de fin de partie ----------------
export function isOfficial(r: ResultRow, e: EconomyConfig) {
  return r.humans >= e.official.minHumans && r.rounds >= e.official.minRounds && (e.official.allowBots || r.extra.bots === 0);
}
export function gameReward(r: ResultRow, e: EconomyConfig) {
  const liar = Math.min(r.liar_wins, e.limits.liarPerGame);
  const exact = Math.min(r.exact_wins, e.limits.exactPerGame);
  const R = e.rewards;
  return {
    doblons: R.complete.doblons + (r.won ? R.win.doblons : 0) + liar * R.liar.doblons + exact * R.exact.doblons,
    xp: R.complete.xp + (r.won ? R.win.xp : 0) + liar * R.liar.xp + exact * R.exact.xp,
    detail: { won: r.won, liar, exact, game: r.game_id },
  };
}

/** Appelé une fois la partie terminée (et enregistrée). Ne lève jamais d'erreur. */
export async function rewardGame(rows: ResultRow[]) {
  if (!rows.length) return;
  try {
    // invités : rien n'est enregistré (ni compteurs, ni récompenses)
    const members: ResultRow[] = [];
    for (const r of rows) if (await accountOf(r.profile_id)) members.push(r);
    rows = members;
    if (!rows.length) return;
    const c = await publicContent();
    const e = c.economy;
    await srv2("extra_add", { rows: rows.map((r) => ({ game_id: r.game_id, profile_id: r.profile_id, phoenix: r.extra.phoenix, flawless: r.extra.flawless, bids: r.extra.bids })) });
    for (const r of rows) {
      // invités, joueurs partis avant la fin, parties non officielles : rien
      if (r.extra.left || !isOfficial(r, e)) continue;
      if (!(await accountOf(r.profile_id))) continue;
      const g = gameReward(r, e);
      const fresh = await srv2<boolean>("grant", { profile_id: r.profile_id, event_id: `game:${r.game_id}`, kind: "game", doblons: g.doblons, xp: g.xp, detail: g.detail });
      if (!fresh) continue; // déjà récompensé
      await advanceChallenges(r.profile_id, c, { games: 1, wins: r.won ? 1 : 0, liarWins: r.liar_wins, exactWins: r.exact_wins, bids: r.extra.bids });
      await grantLevelRewards(r.profile_id, c);
    }
  } catch (err) {
    console.error("rewardGame", err);
  }
}

function currentChallenges(c: PublicContent, now = new Date()) {
  const k = periodKeys(now);
  const exact = c.settings.exactEnabled !== false;
  return [
    ...pickChallenges(c.challenges, "daily", k.day, exact).map((ch) => ({ ...ch, key: k.day })),
    ...pickChallenges(c.challenges, "weekly", k.week, exact, 1).map((ch) => ({ ...ch, key: k.week })), // 3 quotidiens + 1 hebdo
  ];
}
const evId = (key: string, ch: ChallengeItem) => `challenge:${key.replace(":", "-")}:${ch.id}`;

async function advanceChallenges(profileId: string, c: PublicContent, inc: Record<string, number>) {
  const k = periodKeys();
  const clean = Object.fromEntries(Object.entries(inc).filter(([, v]) => v > 0));
  const prog = await srv2<Record<string, number>>("progress_add", { profile_id: profileId, periods: [k.day, k.week], inc: clean });
  for (const ch of currentChallenges(c)) {
    if ((prog[`${ch.key}|${ch.metric}`] ?? 0) >= ch.target) {
      const r = challengeReward(c.economy, ch);
      const f = ch.fragments ? convertFragments(c, (await wallet(profileId)).inventory, ch.fragments) : { fragments: 0, doblons: 0 };
      await srv2("grant", { profile_id: profileId, event_id: evId(ch.key, ch), kind: "challenge", doblons: r.doblons + f.doblons, xp: r.xp, fragments: f.fragments, detail: { name: ch.name, period: ch.period } });
    }
  }
}
/** Récompense fixe d'un défi (§ 43) : quotidien 25 Doblons / 30 XP, hebdo 100 / 120 (réglables). */
export const challengeReward = (e: EconomyConfig, ch: { period: "daily" | "weekly" }) =>
  ch.period === "weekly" ? { doblons: e.rewards.weeklyChallenge, xp: e.rewards.weeklyChallengeXp } : { doblons: e.rewards.dailyChallenge, xp: e.rewards.dailyChallengeXp };

/** Paliers de niveau atteints : versés une seule fois chacun (clé unique `level:N` en base). */
export async function grantLevelRewards(profileId: string, c: PublicContent) {
  const w = await wallet(profileId);
  const lvl = levelOf(c.economy, w.wallet.xp).level;
  for (const r of levelRewardsUpTo(c.economy, lvl)) {
    const items = r.frame && c.frames.some((f) => f.id === r.frame) ? [{ type: "frame", id: r.frame }] : [];
    // Doblons + cadre dans la même écriture atomique, une seule fois par palier
    await srv2("grant", { profile_id: profileId, event_id: `level:${r.level}`, kind: "level", doblons: r.doblons, xp: 0, items, detail: { level: r.level, frame: r.frame ?? null } });
  }
}

// ---------------- vue « progression » du joueur ----------------
export async function progressionPayload(profileId: string, isMember: boolean, unlockedCups: string[]) {
  const c = await publicContent();
  const e = c.economy;
  if (!isMember) {
    return { member: false, economy: publicEconomy(e) };
  }
  const k = periodKeys();
  const [w, prog] = await Promise.all([wallet(profileId), srv2<Record<string, number>>("progress_get", { profile_id: profileId, periods: [k.day, k.week] })]);
  const lvl = levelOf(e, w.wallet.xp);
  const titles = titlesUnlocked(e, lvl.level, unlockedCups);
  const now = new Date(w.now);
  const nextSpin = w.wallet.last_spin ? new Date(new Date(w.wallet.last_spin).getTime() + e.wheel.cooldownHours * 3600_000) : null;
  return {
    member: true,
    economy: publicEconomy(e),
    doblons: w.wallet.doblons, xp: w.wallet.xp, fragments: w.wallet.fragments,
    level: lvl,
    titles: titles.map((t) => ({ id: t.id, name: t.name })),
    allTitles: e.titles,
    title: titles.find((t) => t.id === w.wallet.title)?.name ?? titles[0]?.name ?? null,
    titleId: w.wallet.title,
    frame: w.wallet.frame, victory: w.wallet.victory,
    owned: {
      phrase: ownedIds(c, w.inventory, "phrase"), sound: ownedIds(c, w.inventory, "sound"),
      reaction: ownedIds(c, w.inventory, "reaction"), frame: ownedIds(c, w.inventory, "frame"),
      victory: ownedIds(c, w.inventory, "victory"), cup: w.inventory.filter((i) => i.type === "cup").map((i) => i.id),
    },
    wheel: { ready: !nextSpin || nextSpin <= now, next: nextSpin && nextSpin > now ? nextSpin.toISOString() : null },
    challenges: currentChallenges(c, now).map((ch) => ({
      id: ch.id, name: ch.name, period: ch.period, metric: ch.metric, target: ch.target,
      have: Math.min(ch.target, prog[`${ch.key}|${ch.metric}`] ?? 0),
      // la récompense est versée dès que l'objectif est atteint
      done: (prog[`${ch.key}|${ch.metric}`] ?? 0) >= ch.target,
      ...challengeReward(e, ch), fragments: ch.fragments,
      ends: periodEnd(now, ch.period === "weekly").toISOString(),
    })),
    history: w.ledger.slice(0, 20).map((l) => ({ kind: l.kind, doblons: l.doblons, xp: l.xp, fragments: l.fragments, at: l.at, label: ledgerLabel(l) })),
    stats: w.extra,
  };
}
function ledgerLabel(l: { kind: string; detail: Record<string, unknown> | null }) {
  const d = l.detail ?? {};
  switch (l.kind) {
    case "game": return d.won ? "Victoire" : "Partie terminée";
    case "level": return `Palier du niveau ${d.level ?? ""}`;
    case "chest": return `${d.name ?? "Coffre"} : ${d.item ?? (d.converted ? "fragment converti" : d.comp || d.compensated ? "compensation" : "fragment universel")}`;
    case "challenge": return `Défi : ${d.name ?? ""}`;
    case "wheel": return `Roue : ${d.label ?? ""}${Number(d.compensated) ? " (doublon compensé)" : ""}`;
    case "shop": return `Achat : ${d.name ?? ""}`;
    case "fragments": return "Échange de fragments";
    case "admin": return `Ajustement admin${d.reason ? ` : ${d.reason}` : ""}`;
    default: return l.kind;
  }
}
/** Ce que les joueurs peuvent voir de l'économie (probabilités affichées). */
export function publicEconomy(e: EconomyConfig) {
  return {
    rewards: e.rewards, limits: e.limits, official: e.official, fragments: e.fragments,
    levelRewards: e.levelRewards, levelAfter: e.levelAfter,
    wheel: { cooldownHours: e.wheel.cooldownHours, duplicateDoblons: e.wheel.duplicateDoblons, prizes: e.wheel.prizes.filter((p) => p.active).map(({ id, label, icon, weight }) => ({ id, label, icon, weight })) },
  };
}

// ---------------- roue du Gobelin ----------------
const pickOne = <T,>(list: T[]) => list[randomInt(0, list.length)];
const mysteries = (c: PublicContent) => c.cups.filter((x) => x.category === "mystery");

/** Une fois tous les mystères possédés, chaque fragment devient des Doblons (30 par défaut). */
function convertFragments(c: PublicContent, inv: Inv[], fragments: number) {
  if (fragments <= 0 || mysteries(c).some((m) => !owns(inv, "cup", m.id))) return { fragments, doblons: 0 };
  return { fragments: 0, doblons: fragments * c.economy.fragments.allOwnedDoblons };
}
/** Cosmétiques vendus (cadres + animations) pas encore possédés, éventuellement d'une rareté. */
function freeCosmetics(c: PublicContent, inv: Inv[], rarity?: Rarity) {
  return [
    ...c.frames.filter((x) => !x.reward && x.price > 0).map((x) => ({ type: "frame" as ItemType, id: x.id, name: x.name, rarity: x.rarity ?? "commun" })),
    ...c.victories.filter((x) => x.price > 0).map((x) => ({ type: "victory" as ItemType, id: x.id, name: x.name, rarity: x.rarity ?? "commun" })),
  ].filter((x) => !owns(inv, x.type, x.id) && (!rarity || x.rarity === rarity));
}

export async function spinWheel(profileId: string) {
  const c = await publicContent();
  const e = c.economy;
  const w = await wallet(profileId);
  const prize = drawPrize(e.wheel.prizes, rnd()); // tiré côté serveur AVANT l'animation
  let item: { type: ItemType; id: string; name: string } | null = null;
  let doblons = 0, fragments = 0, compensated = false;
  if (prize.type === "doblons") doblons = prize.amount;
  else if (prize.type === "fragment") {
    const f = convertFragments(c, w.inventory, Math.max(1, prize.amount));
    fragments = f.fragments; doblons = f.doblons; compensated = f.doblons > 0;
  } else if (prize.type === "mystery") {
    const free = mysteries(c).filter((m) => !owns(w.inventory, "cup", m.id));
    if (free.length) { const m = pickOne(free); item = { type: "cup", id: m.id, name: m.name }; }
    else { doblons = e.wheel.duplicateDoblons; compensated = true; } // tous possédés : 100 Doblons
  } else if (prize.type === "cosmetic") {
    const free = freeCosmetics(c, w.inventory);
    if (free.length) item = pickOne(free);
    else { doblons = e.wheel.cosmeticDoblons; compensated = true; }
  } else {
    const types: ItemType[] = prize.type === "phrase" ? ["phrase", "reaction"] : [prize.type];
    const free = types.flatMap((t) => catalogOf(c, t).filter((x) => x.price > 0 && !owns(w.inventory, t, x.id)).map((x) => ({ type: t, id: x.id, name: x.name })));
    if (free.length) item = pickOne(free);
    else { doblons = e.wheel.cosmeticDoblons; compensated = true; }
  }
  const res = await srv2<{ ok: boolean; next: string; compensated: number }>("spin", {
    profile_id: profileId, hours: e.wheel.cooldownHours, prize_id: prize.id,
    doblons, fragments, item: item ? { type: item.type, id: item.id } : null, fallback: e.wheel.duplicateDoblons,
    result: { label: prize.label, item: item?.name ?? null, compensated: compensated ? doblons : 0 },
  });
  if (!res.ok) throw new RuleError("La roue n'est pas encore prête");
  return {
    prizeId: prize.id, label: prize.label, icon: prize.icon,
    item: item?.name ?? null, itemType: item?.type ?? null, itemId: item?.id ?? null,
    doblons: doblons + res.compensated, fragments,
    compensated: compensated || res.compensated > 0, next: res.next,
  };
}

// ---------------- coffres mystères (§ 54–55) ----------------
const RAR: Record<"common" | "rare" | "epic" | "legendary", Rarity> = { common: "commun", rare: "rare", epic: "épique", legendary: "légendaire" };
export async function openChest(profileId: string, chestId: string) {
  const c = await publicContent();
  const chest = c.economy.chests.find((x) => x.id === chestId);
  if (!chest) throw new RuleError("Coffre introuvable");
  const w = await wallet(profileId);
  if (w.wallet.doblons < chest.price) throw new RuleError("Pas assez de Doblons");
  const cat: ChestCat = drawChest(chest.odds, rnd());
  let item: { type: ItemType; id: string; name: string; rarity?: Rarity } | null = null;
  let doblons = 0, fragments = 0, compensated = false, converted = false;
  if (cat === "fragment") {
    const f = convertFragments(c, w.inventory, 1);
    fragments = f.fragments; doblons = f.doblons; converted = f.doblons > 0;
  } else if (cat === "mystery") {
    const free = mysteries(c).filter((m) => !owns(w.inventory, "cup", m.id));
    if (free.length) { const m = pickOne(free); item = { type: "cup", id: m.id, name: m.name, rarity: m.rarity }; }
  } else {
    // objet non possédé de la rareté tirée, sinon la rareté éligible la plus proche
    for (const r of rarityFallbacks(cat, chest.odds)) {
      const free = freeCosmetics(c, w.inventory, RAR[r]);
      if (free.length) { item = pickOne(free); break; }
    }
  }
  if (cat !== "fragment" && !item) { doblons = chest.compensation; compensated = true; }
  const res = await srv5<"funds" | { ok: true; compensated: number }>("chest_open", {
    profile_id: profileId, price: chest.price, doblons, fragments, compensation: chest.compensation,
    item: item ? { type: item.type, id: item.id } : null,
    detail: { chest: chest.id, name: chest.name, cat, item: item?.name ?? null, type: item?.type ?? null, comp: compensated ? doblons : 0, converted },
  });
  if (res === "funds") throw new RuleError("Pas assez de Doblons");
  const late = res.compensated > 0; // objet obtenu entre-temps : compensé
  return {
    chest: chest.id, cat, item: late ? null : item, doblons: doblons + res.compensated, fragments,
    compensated: compensated || late, converted,
  };
}
export { CHEST_CATS };

export async function buy(profileId: string, type: ItemType, id: string) {
  const c = await publicContent();
  const it = catalogOf(c, type).find((x) => x.id === id);
  if (!it) throw new RuleError("Objet introuvable");
  if (it.reward) throw new RuleError("Cet objet se gagne en montant de niveau");
  if (it.price <= 0) throw new RuleError("Cet objet est déjà gratuit");
  const r = await srv2<string>("buy", { profile_id: profileId, type, id, price: it.price, name: it.name });
  if (r === "owned") throw new RuleError("Tu possèdes déjà cet objet");
  if (r === "funds") throw new RuleError("Pas assez de Doblons");
  return it;
}

// ---------------- fragments ----------------
/** 6 fragments → le gobelet mystère CHOISI (non possédé). */
export async function exchangeFragments(profileId: string, cupId?: string) {
  const c = await publicContent();
  const e = c.economy;
  const w = await wallet(profileId);
  if (w.wallet.fragments < e.fragments.needed) throw new RuleError(`Il faut ${e.fragments.needed} fragments`);
  const free = mysteries(c).filter((m) => !owns(w.inventory, "cup", m.id));
  if (!free.length) throw new RuleError("Tu possèdes déjà tous les gobelets mystères");
  const m: CupItem | null = cupId ? free.find((x) => x.id === cupId) ?? null : pickOne(free);
  if (!m) throw new RuleError("Choisis un gobelet mystère que tu ne possèdes pas encore");
  const r = await srv2<string | { ok: boolean; compensated: number }>("exchange", {
    profile_id: profileId, need: e.fragments.needed, item: m ? { id: m.id } : null, fallback: e.fragments.allOwnedDoblons,
  });
  if (r === "fragments") throw new RuleError(`Il faut ${e.fragments.needed} fragments`);
  const comp = typeof r === "object" ? r.compensated : 0;
  return { cup: comp ? null : m?.name ?? null, cupId: comp ? null : m?.id ?? null, doblons: comp };
}

// ---------------- équipement ----------------
export async function equip(profileId: string, field: "title" | "frame" | "victory", value: string | null, unlockedCups: string[]) {
  const c = await publicContent();
  const w = await wallet(profileId);
  if (value) {
    if (field === "title") {
      const lvl = levelOf(c.economy, w.wallet.xp).level;
      if (!titlesUnlocked(c.economy, lvl, unlockedCups).some((t) => t.id === value)) throw new RuleError("Titre pas encore débloqué");
    } else if (!ownedIds(c, w.inventory, field).includes(value)) throw new RuleError("Tu ne possèdes pas cet objet");
  }
  await srv2("equip", { profile_id: profileId, field, value });
}

/** Cosmétiques équipés, pour la table de jeu (purement visuel). */
export async function cosmeticsOf(profileId: string | null | undefined) {
  if (!profileId || !(await accountOf(profileId))) return { frame: null, victory: null, title: null, level: null, owned: null };
  const c = await publicContent();
  const w = await wallet(profileId);
  const lvl = levelOf(c.economy, w.wallet.xp).level;
  const kept = await srv<string[]>("unlocks_get", { profile_id: profileId });
  const titles = titlesUnlocked(c.economy, lvl, [...kept, ...w.inventory.filter((i) => i.type === "cup").map((i) => i.id)]);
  const fr = ownedIds(c, w.inventory, "frame"), vi = ownedIds(c, w.inventory, "victory");
  return {
    frame: w.wallet.frame && fr.includes(w.wallet.frame) ? w.wallet.frame : null,
    victory: w.wallet.victory && vi.includes(w.wallet.victory) ? w.wallet.victory : null,
    title: (titles.find((t) => t.id === w.wallet.title) ?? null)?.name ?? null,
    level: lvl,
    owned: { phrase: ownedIds(c, w.inventory, "phrase"), sound: ownedIds(c, w.inventory, "sound"), reaction: ownedIds(c, w.inventory, "reaction") },
  };
}

/** Infos publiques d'un joueur à la table : profil + cosmétiques équipés. */
export async function playerExtra(prof: { id: string; cup: string; photo: string | null; photo_v: number; avatar: string } | null) {
  if (!prof) return {};
  const { publicAvatar } = await import("./profiles");
  const cos = await cosmeticsOf(prof.id).catch(() => null);
  return {
    profileId: prof.id, avatar: publicAvatar(prof as Parameters<typeof publicAvatar>[0]), cup: prof.cup,
    frame: cos?.frame ?? null, title: cos?.title ?? null, victory: cos?.victory ?? null, level: cos?.level ?? null,
    // bruitages / phrases / réactions possédés : les autres joueurs ignorent ceux qui ne le sont pas
    fxOwned: cos?.owned ? (["phrase", "sound", "reaction"] as const).flatMap((t) => cos.owned![t].map((id) => `${t}:${id}`)) : null,
  };
}
