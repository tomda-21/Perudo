// Rejoindre une partie
import { randomBytes, randomUUID } from "crypto";
import { addPlayer, RuleError } from "@/lib/rules";
import { mutate } from "@/lib/store";
import { authProfile, publicAvatar } from "@/lib/profiles";
import { cleanCode, handle, json } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const { name } = await req.json();
    const prof = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
    const extra = prof ? { profileId: prof.id, avatar: publicAvatar(prof), cup: prof.cup } : {};
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
