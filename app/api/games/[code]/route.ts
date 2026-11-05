// Lire l'état d'une partie (chacun ne reçoit que ses propres dés).
// Sert aussi d'horloge : tour expiré → coup automatique, révélation finie → manche suivante,
// et note la présence du joueur (relais par un bot après 60 s d'absence).
import { GameState, ResultRow, tick, touch, viewFor } from "@/lib/rules";
import { loadGame, mutate } from "@/lib/store";
import { addResults } from "@/lib/profiles";
import { rewardGame } from "@/lib/progression";
import { cleanCode, handle, json, playerFromToken } from "@/lib/api";
import { takeResults } from "@/lib/rules";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const row = await loadGame(code);
    if (!row) return json({ error: "Partie introuvable" }, 404);
    const token = req.headers.get("x-player-token");
    let state: GameState = row.state;
    let meId = playerFromToken(state, token)?.id ?? null;
    // n'écrit que si nécessaire (copie d'essai pour ne pas toucher à l'état lu)
    const probe = structuredClone(state);
    if (tick(probe) || (meId && touch(probe, meId))) {
      let rows: ResultRow[] = [];
      state = await mutate(code, (s) => {
        tick(s);
        const me = playerFromToken(s, token);
        if (me) touch(s, me.id);
        rows = takeResults(s);
      });
      meId = playerFromToken(state, token)?.id ?? null;
      await addResults(rows);
      await rewardGame(rows);
    }
    return json(viewFor(state, meId));
  } catch (e) {
    return handle(e);
  }
}
