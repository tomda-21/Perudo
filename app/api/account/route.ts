// Compte permanent : créer (depuis le profil de cet appareil) ou se connecter sur un autre appareil.
import { authProfile } from "@/lib/profiles";
import { cleanLogin, createAccount, loginAccount } from "@/lib/progression";
import { handle, json } from "@/lib/api";
import { RuleError } from "@/lib/rules";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const login = cleanLogin(b.login);
    const password = String(b.password ?? "");
    if (b.op === "create") {
      const r = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
      if (!r) throw new RuleError("Profil introuvable, recharge la page");
      await createAccount(r.id, login, password);
      return json({ ok: true });
    }
    if (b.op === "login") return json(await loginAccount(login, password));
    throw new RuleError("Action inconnue");
  } catch (e) {
    return handle(e);
  }
}
