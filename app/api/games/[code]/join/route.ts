// Rejoindre une partie
import { randomBytes, randomUUID } from "crypto";
import { addPlayer, RuleError } from "@/lib/rules";
import { mutate } from "@/lib/store";
import { authProfile, isBlocked } from "@/lib/profiles";
import { playerExtra } from "@/lib/progression";
import { cleanCode, handle, json } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const { name } = await req.json();
    const prof = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
    if (prof && (await isBlocked(prof.id))) return json({ error: "Ce compte a été bloqué" }, 403);
    const extra = await playerExtra(prof);
    const playerId = randomUUID();
    const token = randomBytes(24).toString("hex");
    await mutate(code, (s) => {
      if (prof && s.players.some((p) => p.profileId === prof.id && !p.left))
        throw new RuleError("Tu es déjà à cette table (autre onglet ?)");
      addPlayer(s, playerId, String(name ?? prof?.name ?? ""), token, extra);
    });
    return json({ code, playerId, token });
  } catch (e) {
    return handle(e);
  }
}
