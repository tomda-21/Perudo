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
import { AVATARS, CUPS, isAvatarId, isCupId, isUnlocked, Stats } from "./catalog";
import { RuleError, ResultRow } from "./rules";

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
  if (!r || r.key_sha256 !== sha(key)) return null;
  return r;
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
  const stats = computeStats(rows);
  return {
    profile: {
      id: r.id, name: r.name, avatar: r.avatar, hasPhoto: !!r.photo, photoV: r.photo_v,
      cup: r.cup, since: r.created_at, publicAvatar: publicAvatar(r),
    },
    stats,
    unlocked: CUPS.filter((c) => isUnlocked(c.cond, stats)).map((c) => c.id),
    recent: rows.slice(-10).reverse().map((x) => ({ won: x.won, at: x.finished_at, humans: x.humans, rounds: x.rounds })),
  };
}

export async function updateProfile(r: Row, patch: Record<string, unknown>) {
  const next = { ...r };
  if ("name" in patch) {
    const n = cleanName(patch.name);
    if (!n) throw new RuleError("Choisis un pseudo");
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
    if (!isCupId(patch.cup)) throw new RuleError("Gobelet inconnu");
    // le déblocage est vérifié ici, côté serveur, depuis les vrais résultats
    const stats = computeStats(await results(r.id));
    const cup = CUPS.find((c) => c.id === patch.cup)!;
    if (!isUnlocked(cup.cond, stats)) throw new RuleError("Ce gobelet n'est pas encore débloqué");
    next.cup = cup.id;
  }
  await putRow(next);
  return (await getRow(r.id))!;
}

export async function photoOf(id: string) {
  const r = await getRow(id);
  return r?.photo ?? null;
}

export async function addResults(rows: ResultRow[]) {
  if (!rows.length) return;
  const { error } = await db().rpc("res_add", { p_secret: secret(), p_rows: rows });
  if (error) console.error("res_add", error.message);
}
