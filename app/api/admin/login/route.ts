// Connexion admin (mot de passe) ou activation (code à usage unique)
import { AdminError, claim, login, setSessionCookie, verifySession, COOKIE } from "@/lib/admin";
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
    return Response.json({ admin: row?.role === "admin" && !row.blocked, name: row?.name ?? null });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host")) throw new AdminError("Origine refusée", 403);
    const body = await req.json().catch(() => ({}));
    const pid = req.headers.get("x-profile-id"), pkey = req.headers.get("x-profile-key");
    const password = String(body.password ?? "");
    const id = body.mode === "claim"
      ? await claim(pid, pkey, String(body.code ?? ""), password)
      : await login(pid, pkey, password);
    await setSessionCookie(id);
    return Response.json({ ok: true });
  } catch (e) { return fail(e); }
}
