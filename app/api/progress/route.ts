// Progression du joueur connecté : portefeuille, roue, boutique, fragments, titres, défis.
// Tout est décidé ici, côté serveur (le navigateur ne fait qu'afficher).
import { authProfile, fullStats, isMember, unlockedCups } from "@/lib/profiles";
import { buy, equip, exchangeFragments, ItemType, openChest, progressionPayload, spinWheel } from "@/lib/progression";
import { handle, json } from "@/lib/api";
import { RuleError } from "@/lib/rules";

export const dynamic = "force-dynamic";

async function who(req: Request) {
  const r = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
  if (!r) throw new RuleError("Profil introuvable, recharge la page");
  const member = await isMember(r.id);
  return { r, member };
}
const cupsOf = async (id: string) => (await unlockedCups(id, await fullStats(id), true)).unlocked;

export async function GET(req: Request) {
  try {
    const { r, member } = await who(req);
    return json(await progressionPayload(r.id, member, member ? await cupsOf(r.id) : []));
  } catch (e) {
    return handle(e);
  }
}

// § 51–52 : seuls les cadres, animations et gobelets de prestige se vendent (sons, phrases, réactions offerts)
const TYPES: ItemType[] = ["cup", "frame", "victory"];

export async function POST(req: Request) {
  try {
    const { r, member } = await who(req);
    if (!member) throw new RuleError("Crée un compte pour gagner et dépenser des Doblons");
    const b = await req.json().catch(() => ({}));
    let result: unknown = null;
    switch (b.op) {
      case "spin": result = await spinWheel(r.id); break;
      case "buy": {
        if (!TYPES.includes(b.type)) throw new RuleError("Catégorie inconnue");
        result = await buy(r.id, b.type, String(b.id ?? ""));
        break;
      }
      case "exchange": result = await exchangeFragments(r.id, b.cup ? String(b.cup) : undefined); break;
      case "chest": result = await openChest(r.id, String(b.id ?? "")); break;
      case "equip": {
        if (!["title", "frame", "victory"].includes(b.field)) throw new RuleError("Champ inconnu");
        await equip(r.id, b.field, b.value ? String(b.value) : null, await cupsOf(r.id));
        break;
      }
      default: throw new RuleError("Action inconnue");
    }
    return json({ result, progress: await progressionPayload(r.id, true, await cupsOf(r.id)) });
  } catch (e) {
    return handle(e);
  }
}
