// Toutes les actions de jeu : lancer, annoncer, menteur, exact, manche suivante, rejouer, bots
import {
  addBot, botStep, callExact, callLiar, nextRound, placeBid, removeBot, restart, RuleError, startGame, viewFor,
} from "@/lib/rules";
import { mutate } from "@/lib/store";
import { cleanCode, handle, json, playerFromToken } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const body = await req.json();
    const token = req.headers.get("x-player-token");
    let meId = "";
    const state = await mutate(code, (s) => {
      const me = playerFromToken(s, token);
      if (!me) throw new RuleError("Tu ne fais pas partie de cette partie");
      meId = me.id;
      switch (body.type) {
        case "start": return startGame(s, me.id);
        case "bid": return placeBid(s, me.id, { qty: Number(body.qty), face: Number(body.face) });
        case "liar": return callLiar(s, me.id);
        case "exact": return callExact(s, me.id);
        case "next": return nextRound(s, me.id);
        case "restart": return restart(s, me.id);
        case "addBot": return addBot(s, me.id);
        case "removeBot": return removeBot(s, me.id, String(body.botId));
        // n'importe quel joueur connecté peut « réveiller » le bot dont c'est le tour
        case "bot": return botStep(s, String(body.expect));
        default: throw new RuleError("Action inconnue");
      }
    });
    return json(viewFor(state, meId));
  } catch (e) {
    return handle(e);
  }
}
