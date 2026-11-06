// Indicateurs d'accueil liés au COMPTE (jamais au pseudo ni à une valeur du navigateur seule) :
//  - GET  ?flag=ios_install_tip → { account, seen }
//  - POST { flag }              → mémorise que le tutoriel a été présenté à ce compte
// Un invité (profil sans compte) reçoit { account: false } : le suivi se fait alors par visite, côté navigateur.
import { authProfile } from "@/lib/profiles";
import { srv7 } from "@/lib/srv";
import { handle, json } from "@/lib/api";
import { RuleError } from "@/lib/rules";

export const dynamic = "force-dynamic";
const FLAGS = new Set(["ios_install_tip"]);

async function who(req: Request) {
  return authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
}

export async function GET(req: Request) {
  try {
    const flag = new URL(req.url).searchParams.get("flag") ?? "";
    if (!FLAGS.has(flag)) throw new RuleError("Indicateur inconnu");
    const prof = await who(req);
    if (!prof) return json({ account: false, seen: false });
    const seen = await srv7<boolean | null>("flag_get", { profile_id: prof.id, flag });
    return json({ account: seen !== null, seen: !!seen });
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    if (!FLAGS.has(b.flag)) throw new RuleError("Indicateur inconnu");
    const prof = await who(req);
    if (!prof) return json({ ok: false });
    const r = await srv7<boolean | null>("flag_set", { profile_id: prof.id, flag: b.flag });
    return json({ ok: r === true });
  } catch (e) {
    return handle(e);
  }
}
