// =============================================================
//  Sécurité de l'espace admin — côté serveur uniquement.
//  1. Le rôle « admin » est stocké en base, jamais déduit d'un pseudo.
//  2. Pour se connecter : son COMPTE connecté (jeton Supabase vérifié) ;
//     seul le compte dont l'e-mail vérifié est celui du propriétaire
//     (private.admin_owner, lié à son identifiant permanent) est admin.
//  3. La session = un cookie httpOnly signé (12 h), revérifié en base
//     à CHAQUE appel. Le navigateur ne voit jamais de clé secrète.
// =============================================================
import "server-only";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { srv, srv4 } from "./srv";
import { authUser, isOwner, ownerCache } from "./account";
export { isOwner };
import { authProfile } from "./profiles";

export const COOKIE = "perudo_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;

export class AdminError extends Error {
  constructor(msg: string, public status = 403) { super(msg); }
}

const key = () => createHash("sha256").update("perudo-admin:" + process.env.APP_SECRET).digest();

export function signSession(profileId: string, now = Date.now()) {
  const body = `${profileId}.${now + SESSION_MS}`;
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Vérifie la signature et l'expiration du jeton. Renvoie l'id du profil ou null. */
export function verifySession(token: string | undefined | null, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d+$/.test(exp)) return null;
  const good = createHmac("sha256", key()).update(`${id}.${exp}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  if (Number(exp) < now) return null;
  return id;
}

export function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}
export function checkPassword(pw: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const h = scryptSync(pw, Buffer.from(saltHex, "hex"), 32);
  const want = Buffer.from(hashHex, "hex");
  return want.length === h.length && timingSafeEqual(h, want);
}
export const passwordProblem = (pw: string) =>
  pw.length < 10 ? "Le mot de passe doit faire au moins 10 caractères" : null;

type AdminRow = { role: string; blocked: boolean; name: string; pw_hash: string | null; failed: number; locked_until: string | null } | null;

/** À appeler au début de CHAQUE route admin. */
export async function requireAdmin(req: Request): Promise<{ id: string; name: string }> {
  // anti-CSRF : les écritures doivent venir du site lui-même
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) throw new AdminError("Origine refusée", 403);
  }
  const id = verifySession((await cookies()).get(COOKIE)?.value);
  if (!id) throw new AdminError("Connexion admin requise", 401);
  const [row, owner] = await Promise.all([srv<AdminRow>("admin_get", { profile_id: id }), isOwner(id)]);
  if (!row || row.role !== "admin" || row.blocked || !owner) throw new AdminError("Accès refusé", 403);
  return { id, name: row.name };
}

/** Connexion admin avec son compte : jeton Supabase frais + profil de cet appareil = ce compte. */
export async function loginWithAccount(req: Request) {
  const user = await authUser(req);
  if (!user || !user.email_confirmed_at) throw new AdminError("Connecte-toi d'abord à ton compte (Mon profil)", 401);
  const prof = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
  const link = await srv4<{ profile_id: string } | null>("link_get", { auth_uid: user.id });
  if (!prof || !link || link.profile_id !== prof.id) throw new AdminError("Reconnecte ton compte sur cet appareil", 401);
  await srv4("admin_claim", { auth_uid: user.id }).catch(() => false); // provisionnement : e-mail vérifié du propriétaire uniquement
  ownerCache.delete(prof.id);
  const row = await srv<AdminRow>("admin_get", { profile_id: prof.id });
  if (!row || row.role !== "admin" || row.blocked || !(await isOwner(prof.id))) throw new AdminError("Ce compte n'est pas administrateur", 403);
  return prof.id;
}

export async function setSessionCookie(profileId: string) {
  (await cookies()).set(COOKIE, signSession(profileId), {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: SESSION_MS / 1000,
  });
}
export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}
