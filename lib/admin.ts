// =============================================================
//  Sécurité de l'espace admin — côté serveur uniquement.
//  1. Le rôle « admin » est stocké en base, jamais déduit d'un pseudo.
//  2. Pour se connecter : profil de l'appareil + mot de passe admin
//     (haché avec scrypt, 5 essais puis blocage 15 min).
//  3. La session = un cookie httpOnly signé (12 h), revérifié en base
//     à CHAQUE appel. Le navigateur ne voit jamais de clé secrète.
// =============================================================
import "server-only";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { srv } from "./srv";
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
  const row = await srv<AdminRow>("admin_get", { profile_id: id });
  if (!row || row.role !== "admin" || row.blocked) throw new AdminError("Accès refusé", 403);
  return { id, name: row.name };
}

/** Connexion : profil de l'appareil (id + clé) + mot de passe admin. */
export async function login(profileId: string | null, profileKey: string | null, password: string) {
  const prof = await authProfile(profileId, profileKey);
  if (!prof) throw new AdminError("Profil inconnu sur cet appareil", 401);
  const row = await srv<AdminRow>("admin_get", { profile_id: prof.id });
  if (!row || row.role !== "admin" || !row.pw_hash) throw new AdminError("Ce profil n'est pas administrateur", 403);
  if (row.locked_until && new Date(row.locked_until) > new Date()) throw new AdminError("Trop d'essais : réessaie dans 15 minutes", 429);
  if (!checkPassword(password, row.pw_hash)) {
    await srv("admin_fail", { profile_id: prof.id });
    throw new AdminError("Mot de passe incorrect", 401);
  }
  await srv("admin_ok", { profile_id: prof.id });
  return prof.id;
}

/** Activation : code à usage unique + choix du mot de passe admin. */
export async function claim(profileId: string | null, profileKey: string | null, code: string, password: string) {
  const prof = await authProfile(profileId, profileKey);
  if (!prof) throw new AdminError("Profil inconnu sur cet appareil", 401);
  const problem = passwordProblem(password);
  if (problem) throw new AdminError(problem, 400);
  const ok = await srv<boolean>("admin_claim", {
    code_sha256: createHash("sha256").update(code.trim().toUpperCase()).digest("hex"),
    profile_id: prof.id,
    pw_hash: hashPassword(password),
  });
  if (!ok) throw new AdminError("Code d'activation invalide ou déjà utilisé", 403);
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
