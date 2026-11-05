// Toutes les actions de jeu : lancer, annoncer, menteur, exact, manche suivante,
// rejouer, bots, map, quitter. Le serveur vérifie tout.
import {
  addBot, botStep, callExact, callLiar, leaveGame, nextRound, placeBid, removeBot, restart,
  ResultRow, RuleError, startGame, takeResults, viewFor,
} from "@/lib/rules";
import { mutate } from "@/lib/store";
import { addResults } from "@/lib/profiles";
import { rewardGame } from "@/lib/progression";
import { cleanCode, handle, json, mapPool, playerFromToken } from "@/lib/api";
import { publicContent } from "@/lib/content-server";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const body = await req.json();
    const token = req.headers.get("x-player-token");
    // la map est tirée par le serveur au lancement (et à chaque « rejouer ») parmi les maps activées
    const pool = body.type === "start" || body.type === "restart" ? mapPool(await publicContent()) : undefined;
    let meId = "";
    let rows: ResultRow[] = [];
    const state = await mutate(code, (s) => {
      rows = [];
      const me = playerFromToken(s, token);
      if (!me) throw new RuleError("Tu ne fais pas partie de cette partie");
      meId = me.id;
      // un joueur parti ou éliminé ne peut plus jouer (mais peut quitter / regarder)
      const playing = ["bid", "liar", "exact"].includes(body.type);
      if (playing && (me.left || me.diceCount === 0)) throw new RuleError("Tu es éliminé : tu regardes la partie");
      switch (body.type) {
        case "start": startGame(s, me.id, pool); break;
        case "bid": placeBid(s, me.id, { qty: Number(body.qty), face: Number(body.face) }); break;
        case "liar": callLiar(s, me.id); break;
        case "exact": callExact(s, me.id); break;
        case "next": nextRound(s, me.id); break;
        case "restart": restart(s, me.id, pool); break;
        case "addBot": addBot(s, me.id); break;
        case "removeBot": removeBot(s, me.id, String(body.botId)); break;
        case "leave": leaveGame(s, me.id); break;
        // n'importe quel joueur connecté peut « réveiller » le bot dont c'est le tour
        case "bot": botStep(s, String(body.expect)); break;
        default: throw new RuleError("Action inconnue");
      }
      rows = takeResults(s); // partie terminée → résultats (une seule fois)
    });
    await addResults(rows);
    await rewardGame(rows); // Doblons, XP, défis (comptes uniquement, une seule fois par partie)
    return json(viewFor(state, meId));
  } catch (e) {
    return handle(e);
  }
}
