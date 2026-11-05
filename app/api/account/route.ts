// Compte e-mail (Supabase Auth) :
//  - session : jeton vérifié → profil du compte (créé au 1er passage) + clé pour cet appareil
//  - delete  : suppression définitive du compte et de ses données
import { accountOf, authUser, deviceKey } from "@/lib/account";
import { authProfile, createProfile } from "@/lib/profiles";
import { srv4 } from "@/lib/srv";
import { handle, json } from "@/lib/api";
import { RuleError } from "@/lib/rules";

export const dynamic = "force-dynamic";

type Link = { auth_uid: string; profile_id: string; public_id: string } | null;

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const user = await authUser(req);
    if (!user) throw new RuleError("Session expirée : reconnecte-toi");
    if (!user.email_confirmed_at) throw new RuleError("Confirme d'abord ton adresse e-mail (lien reçu par e-mail)");

    if (b.op === "session") {
      let link = await srv4<Link>("link_get", { auth_uid: user.id });
      if (!link) {
        // nouveau compte : profil neuf (rien n'est repris d'une session invitée)
        const name = String(user.user_metadata?.name ?? b.name ?? "").trim();
        const { id } = await createProfile(name);
        link = await srv4<Link>("link_create", { auth_uid: user.id, profile_id: id });
        if (!link) throw new RuleError("Compte non vérifié");
      }
      // rôle admin : uniquement le compte dont l'e-mail VÉRIFIÉ est celui du propriétaire (contrôlé en base)
      await srv4("admin_claim", { auth_uid: user.id }).catch(() => false);
      return json({ id: link.profile_id, key: await deviceKey(link.profile_id) });
    }

    if (b.op === "delete") {
      // double contrôle : jeton Supabase frais + profil de cet appareil = ce compte
      const prof = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
      const link = await srv4<Link>("link_get", { auth_uid: user.id });
      if (!prof || !link || link.profile_id !== prof.id || !(await accountOf(prof.id))) throw new RuleError("Reconnecte-toi sur cet appareil avant de supprimer le compte");
      if (b.confirm !== "SUPPRIMER") throw new RuleError("Écris SUPPRIMER pour confirmer");
      const ok = await srv4<boolean>("acct_delete", { auth_uid: user.id }).catch((e: Error) => { throw new RuleError(e.message.includes("administrateur") ? "Le compte administrateur ne peut pas être supprimé" : "Suppression impossible"); });
      if (!ok) throw new RuleError("Compte introuvable");
      return json({ ok: true });
    }
    throw new RuleError("Action inconnue");
  } catch (e) {
    return handle(e);
  }
}
