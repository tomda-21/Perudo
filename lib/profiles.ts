// =============================================================
//  Profils permanents — côté serveur uniquement.
//  Pas de compte à créer : l'appareil garde un identifiant + une clé
//  secrète. Le serveur vérifie la clé avant toute lecture/modification.
//  Les stats sont TOUJOURS recalculées depuis les résultats enregistrés
//  par le serveur : impossible de les gonfler depuis le navigateur.
// =============================================================
import "server-only";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { AVATARS, isAvatarId, isUnlocked, Stats } from "./catalog";
import { publicContent } from "./content-server";
import { srv, srv2 } from "./srv";
import { RuleError, ResultRow } from "./rules";
import { accountOf, isOwner, NAME_CHANGES_PER_MONTH, parisMonth } from "./account";
import { srv4 } from "./srv";

const sha = (x: string) => createHash("sha256").update(x).digest("hex");
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, {
    auth: { persistSession: false },
  });
}
const secret = () => process.env.APP_SECRET!;

type Row = {
  id: string; key_sha256: string; name: string; avatar: string;
  photo: string | null; photo_v: number; cup: string; created_at: string;
};
type ResultDb = { game_id: string; won: boolean; humans: number; rounds: number; liar_calls: number; liar_wins: number; exact_calls: number; exact_wins: number; finished_at: string };

async function getRow(id: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().rpc("prof_get", { p_secret: secret(), p_id: id });
  if (error) throw new Error(error.message);
  return data as Row | null;
}
async function putRow(r: Row) {
  const { error } = await db().rpc("prof_put", { p_secret: secret(), p_profile: r });
  if (error) throw new Error(error.message);
}

export async function authProfile(id: string | null | undefined, key: string | null | undefined) {
  if (!id || !key) return null;
  const r = await getRow(id);
  if (!r) return null;
  if (r.key_sha256 === sha(key)) return r;
  // appareil connecté plus tard au même compte (clé propre à cet appareil)
  const owner = await srv2<string | null>("device_check", { key_sha256: sha(key) });
  return owner === r.id ? r : null;
}

export async function isMember(id: string) {
  return !!(await accountOf(id));
}

/** Profil bloqué par l'admin ? (il ne peut plus créer ni rejoindre de partie) */
export async function isBlocked(id: string) {
  const r = await srv<{ blocked: boolean } | null>("admin_get", { profile_id: id });
  return !!r?.blocked;
}

/**
 * Gobelets obtenus : ceux déjà gagnés (conservés pour toujours, même si
 * l'admin durcit une condition) + ceux que les stats actuelles débloquent.
 */
export async function unlockedCups(id: string, stats: Stats, member: boolean) {
  const [cups, kept, inv] = await Promise.all([
    publicContent().then((c) => c.cups),
    srv<string[]>("unlocks_get", { profile_id: id }),
    member ? srv2<{ inventory: { type: string; id: string }[] }>("wallet", { profile_id: id }).then((w) => w.inventory) : Promise.resolve([]),
  ]);
  // exploits : seulement avec un compte (les invités n'ont pas de progression)
  const now = member ? cups.filter((c) => (c.category ?? "exploit") === "exploit" && isUnlocked(c.cond, stats)).map((c) => c.id) : [];
  const fresh = now.filter((x) => !kept.includes(x));
  if (fresh.length) await srv("unlocks_add", { profile_id: id, ids: fresh });
  // mystères / boutique : uniquement ce qui est dans l'inventaire
  const all = new Set(["classic", ...kept, ...now, ...inv.filter((i) => i.type === "cup").map((i) => i.id)]);
  const unlocked = cups.filter((c) => all.has(c.id)).map((c) => c.id);
  // § 74 : l'admin peut UTILISER tous les gobelets, sans que ses succès soient validés
  const usable = member && (await isOwner(id)) ? cups.map((c) => c.id) : unlocked;
  return { cups, unlocked, usable };
}

/** Stats + compteurs supplémentaires (Phénix, Invincible, annonces). */
export async function fullStats(id: string, rows?: ResultDb[]) {
  const [res, extra] = await Promise.all([
    rows ? Promise.resolve(rows) : results(id),
    srv2<{ extra: { phoenix: number; flawless: number; bids: number } }>("wallet", { profile_id: id }).then((w) => w.extra).catch(() => null),
  ]);
  return { ...computeStats(res), phoenix: Number(extra?.phoenix ?? 0), flawless: Number(extra?.flawless ?? 0), bids: Number(extra?.bids ?? 0) };
}

const cleanName = (n: unknown) => String(n ?? "").trim().slice(0, 20);

export async function createProfile(name: unknown) {
  const n = cleanName(name) || "Joueur";

  const id = randomUUID();
  const key = randomBytes(24).toString("hex");
  const row: Row = {
    id, key_sha256: sha(key), name: n,
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    photo: null, photo_v: 0, cup: "classic", created_at: new Date().toISOString(),
  };
  await putRow(row);
  return { id, key, row: (await getRow(id))! };
}

/** Avatar public tel qu'il apparaît à la table. */
export const publicAvatar = (r: Row) => (r.photo ? `photo:${r.id}:${r.photo_v}` : r.avatar);

export async function results(id: string): Promise<ResultDb[]> {
  const { data, error } = await db().rpc("res_list", { p_secret: secret(), p_id: id });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResultDb[];
}

export function computeStats(rows: ResultDb[]): Stats {
  // rows triés du plus ancien au plus récent
  let streak = 0, best = 0;
  for (const r of rows) { streak = r.won ? streak + 1 : 0; best = Math.max(best, streak); }
  const wins = rows.filter((r) => r.won).length;
  const sum = (k: keyof ResultDb) => rows.reduce((n, r) => n + Number(r[k] ?? 0), 0);
  return {
    played: rows.length, wins, losses: rows.length - wins,
    rate: rows.length ? Math.round((wins / rows.length) * 100) : 0,
    liarCalls: sum("liar_calls"), liarWins: sum("liar_wins"),
    exactCalls: sum("exact_calls"), exactWins: sum("exact_wins"),
    winStreak: streak, bestWinStreak: best,
  };
}

/** Ce que le joueur voit de son propre profil. */
export async function profilePayload(r: Row) {
  const rows = await results(r.id);
  const [stats, account] = await Promise.all([fullStats(r.id, rows), accountOf(r.id)]);
  const { unlocked, usable, cups } = await unlockedCups(r.id, stats, !!account);
  const admin = !!account && (await isOwner(r.id));
  return {
    profile: {
      id: r.id, name: r.name, avatar: r.avatar, hasPhoto: !!r.photo, photoV: r.photo_v,
      cup: r.cup, since: r.created_at, publicAvatar: publicAvatar(r),
    },
    // privé : visible uniquement par le titulaire (jamais dans les fiches publiques)
    account: account ? { login: account.public_id, since: account.created_at, email: account.email, nameChangesLeft: Math.max(0, NAME_CHANGES_PER_MONTH - account.name_changes) } : null,
    stats,
    unlocked, // succès réels (jamais validés artificiellement)
    usable, // gobelets utilisables (tous pour l'admin)
    isAdmin: admin, // affiche l'accès Administration (droits revérifiés côté serveur)
    cups,
    recent: [], // pas d'historique détaillé des parties côté joueur (statistiques agrégées seulement)
  };
}

export async function updateProfile(r: Row, patch: Record<string, unknown>) {
  const next = { ...r };
  if ("name" in patch) {
    const n = cleanName(patch.name);
    if (!n) throw new RuleError("Choisis un pseudo");
    if (n.length < 2) throw new RuleError("Pseudo : 2 caractères minimum");
    // comptes : 2 changements par mois civil (Paris), vérifié et compté en base
    if (n !== r.name && (await accountOf(r.id))) {
      const ok = await srv4<boolean>("name_change", { profile_id: r.id, month: parisMonth() });
      if (!ok) throw new RuleError("Tu as déjà changé de pseudo 2 fois ce mois-ci");
    }
    next.name = n;
  }
  if ("avatar" in patch) {
    if (!isAvatarId(patch.avatar)) throw new RuleError("Avatar inconnu");
    next.avatar = String(patch.avatar);
  }
  if ("photo" in patch) {
    if (patch.photo === null) next.photo = null;
    else {
      const p = String(patch.photo);
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p)) throw new RuleError("Image invalide");
      if (p.length > 200_000) throw new RuleError("Image trop lourde");
      next.photo = p;
    }
    next.photo_v = r.photo_v + 1;
  }
  if ("cup" in patch) {
    // le déblocage est vérifié ici, côté serveur, depuis les vrais résultats
    const stats = await fullStats(r.id);
    const { usable } = await unlockedCups(r.id, stats, await isMember(r.id));
    if (!usable.includes(String(patch.cup))) throw new RuleError("Ce gobelet n'est pas encore débloqué");
    next.cup = String(patch.cup);
  }
  await putRow(next);
  return (await getRow(r.id))!;
}

export async function photoOf(id: string) {
  const r = await getRow(id);
  return r?.photo ?? null;
}

export async function addResults(rows: ResultRow[]) {
  // invités : mode « à blanc », aucune statistique enregistrée
  const kept: ResultRow[] = [];
  for (const r of rows) if (await isMember(r.profile_id)) kept.push(r);
  rows = kept;
  if (!rows.length) return;
  const { error } = await db().rpc("res_add", { p_secret: secret(), p_rows: rows.map(({ extra, ...x }) => (void extra, x)) });
  if (error) console.error("res_add", error.message);
}
