// Connexion admin : uniquement avec le compte (e-mail vérifié) de l'administrateur
import { AdminError, isOwner, loginWithAccount, setSessionCookie, verifySession, COOKIE } from "@/lib/admin";
import { srv } from "@/lib/srv";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const fail = (e: unknown) => {
  if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Erreur serveur" }, { status: 500 });
};

/** Suis-je connecté en admin ? */
export async function GET() {
  try {
    const id = verifySession((await cookies()).get(COOKIE)?.value);
    if (!id) return Response.json({ admin: false });
    const row = await srv<{ role: string; blocked: boolean; name: string } | null>("admin_get", { profile_id: id });
    return Response.json({ admin: row?.role === "admin" && !row.blocked && (await isOwner(id)), name: row?.name ?? null });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host")) throw new AdminError("Origine refusée", 403);
    // seule voie d'accès : le compte connecté de l'administrateur (plus de mot de passe admin séparé)
    const id = await loginWithAccount(req);
    await setSessionCookie(id);
    return Response.json({ ok: true });
  } catch (e) { return fail(e); }
}
