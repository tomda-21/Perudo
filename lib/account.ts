// =============================================================
//  Comptes : e-mail + mot de passe (Supabase Auth). Côté serveur uniquement.
//  - Le navigateur envoie le jeton de session Supabase ; le serveur le fait
//    vérifier par Supabase (jamais décodé « sur parole »).
//  - Un compte = un profil permanent (identifiant technique) + un
//    identifiant public unique + un pseudo (2 changements / mois civil).
//  - Les invités jouent « à blanc » : rien n'est sauvegardé pour eux.
// =============================================================
import "server-only";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { srv2, srv4 } from "./srv";

export type AccountInfo = { login: string; public_id: string; created_at: string; email: string | null; name_changes: number };

/** Mois civil courant à Paris (« 2026-11 »). */
export function parisMonth(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}
export const NAME_CHANGES_PER_MONTH = 2;

export async function accountOf(profileId: string): Promise<AccountInfo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return null;
  return srv4<AccountInfo | null>("link_by_profile", { profile_id: profileId, month: parisMonth() });
}

/** Utilisateur Supabase derrière le jeton « Authorization: Bearer … » (vérifié par Supabase). */
export async function authUser(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/** Nouvelle clé pour cet appareil, rattachée au profil du compte. */
export async function deviceKey(profileId: string) {
  const key = randomBytes(24).toString("hex");
  await srv2("device_add", { profile_id: profileId, key_sha256: createHash("sha256").update(key).digest("hex") });
  return key;
}
