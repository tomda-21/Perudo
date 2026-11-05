// Amis (§ 13) : demandes, liste, présence (en ligne / en partie / hors ligne, masquable),
// invitations aux salons, blocage, signalement, notifications internes, classements entre amis.
// Comptes uniquement ; tout est vérifié ici, côté serveur.
import { authProfile, fullStats, isMember, unlockedCups } from "@/lib/profiles";
import { srv6 } from "@/lib/srv";
import { rankings } from "@/lib/ranking-server";
import { handle, json, cleanCode } from "@/lib/api";
import { RuleError } from "@/lib/rules";
import { loadGame } from "@/lib/store";

export const dynamic = "force-dynamic";

const ONLINE_MS = 2 * 60_000;
type Friend = { id: string; name: string; status: "pending" | "accepted"; incoming: boolean; seen_at: string | null; game: string | null; hidden: boolean; [k: string]: unknown };
type Overview = { friends: Friend[]; blocked: { id: string; name: string }[]; notifications: unknown[]; me: { hidden: boolean; showcase: string[] } | null };

async function who(req: Request) {
  const r = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
  if (!r) throw new RuleError("Profil introuvable, recharge la page");
  if (!(await isMember(r.id))) throw new RuleError("Les amis sont réservés aux joueurs avec un compte");
  return r;
}
const uuid = (x: unknown) => { const s = String(x ?? ""); if (!/^[0-9a-f-]{36}$/i.test(s)) throw new RuleError("Joueur inconnu"); return s; };

export async function GET(req: Request) {
  try {
    const me = await who(req);
    const url = new URL(req.url);
    const game = url.searchParams.get("game");
    await srv6("touch", { me: me.id, game: game ? cleanCode(game) : null }); // présence
    const o = await srv6<Overview>("overview", { me: me.id });
    const now = Date.now();
    const friends = o.friends.map((f) => ({
      ...f,
      presence: f.status !== "accepted" || !f.seen_at ? "offline" : now - new Date(f.seen_at).getTime() < ONLINE_MS ? (f.game ? "game" : "online") : "offline",
      seen_at: undefined, // l'heure exacte n'est pas exposée
    }));
    const accepted = friends.filter((f) => f.status === "accepted");
    const rank = await rankings([{ id: me.id, name: me.name }, ...accepted.map((f) => ({ id: f.id, name: f.name }))]);
    return json({ ...o, friends, ranking: rank, meId: me.id });
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request) {
  try {
    const me = await who(req);
    const b = await req.json().catch(() => ({}));
    switch (b.op) {
      case "request": {
        const pub = String(b.publicId ?? "").replace(/^#/, "").trim().toUpperCase();
        if (!/^[0-9A-F]{6}$/.test(pub)) throw new RuleError("Identifiant public : 6 caractères, ex. #24E5E2");
        const f = await srv6<{ id: string; name: string } | null>("find", { public_id: pub });
        if (!f) throw new RuleError("Aucun joueur avec cet identifiant");
        const r = await srv6<string>("request", { me: me.id, other: f.id });
        const msg: Record<string, string> = { self: "C'est ton propre identifiant 🙂", blocked: "Impossible d'ajouter ce joueur", already: "Vous êtes déjà amis", pending: "Demande déjà envoyée", limit: "Liste d'amis pleine", sent: `Demande envoyée à ${f.name}`, accepted: `Vous êtes maintenant amis avec ${f.name} !` };
        if (["self", "blocked", "already", "pending", "limit"].includes(r)) throw new RuleError(msg[r]);
        return json({ ok: true, message: msg[r] });
      }
      case "respond": return json({ ok: await srv6("respond", { me: me.id, other: uuid(b.id), accept: b.accept === true }) });
      case "remove": return json({ ok: await srv6("remove", { me: me.id, other: uuid(b.id) }) });
      case "block": return json({ ok: await srv6("block", { me: me.id, other: uuid(b.id) }) });
      case "unblock": return json({ ok: await srv6("unblock", { me: me.id, other: uuid(b.id) }) });
      case "report": {
        const reason = String(b.reason ?? "").trim();
        if (reason.length < 3) throw new RuleError("Explique en quelques mots ce qui s'est passé");
        const r = await srv6<string>("report", { me: me.id, other: uuid(b.id), reason });
        if (r === "limit") throw new RuleError("Trop de signalements aujourd'hui");
        return json({ ok: true, message: "Signalement envoyé à l'administrateur. Merci !" });
      }
      case "invite": {
        const code = cleanCode(String(b.code ?? ""));
        const g = await loadGame(code);
        if (!g || g.state.phase !== "lobby") throw new RuleError("Invite tes amis depuis la salle d'attente");
        if (!g.state.players.some((p) => p.profileId === me.id)) throw new RuleError("Tu n'es pas dans ce salon");
        const r = await srv6<string>("invite", { me: me.id, other: uuid(b.id), code });
        if (r !== "ok") throw new RuleError("Tu ne peux inviter que tes amis");
        return json({ ok: true });
      }
      case "read": return json({ ok: await srv6("read", { me: me.id }) });
      case "settings": {
        const patch: Record<string, unknown> = { me: me.id };
        if (typeof b.hidden === "boolean") patch.hidden = b.hidden;
        if (Array.isArray(b.showcase)) {
          // vitrine : 3 gobelets au plus, parmi ceux que le joueur possède vraiment
          const { usable } = await unlockedCups(me.id, await fullStats(me.id), true);
          patch.showcase = [...new Set(b.showcase.map((x: unknown) => String(x)))].filter((x) => usable.includes(x as string)).slice(0, 3);
        }
        return json({ ok: await srv6("set", patch) });
      }
    }
    throw new RuleError("Action inconnue");
  } catch (e) {
    return handle(e);
  }
}
