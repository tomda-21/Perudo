// Lire l'état d'une partie (chacun ne reçoit que ses propres dés)
import { viewFor } from "@/lib/rules";
import { loadGame } from "@/lib/store";
import { cleanCode, handle, json, playerFromToken } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const row = await loadGame(code);
    if (!row) return json({ error: "Partie introuvable" }, 404);
    const me = playerFromToken(row.state, req.headers.get("x-player-token"));
    return json(viewFor(row.state, me?.id ?? null));
  } catch (e) {
    return handle(e);
  }
}
