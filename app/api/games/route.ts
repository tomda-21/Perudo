// Créer une partie
import { randomBytes, randomInt, randomUUID } from "crypto";
import { addPlayer, newGame } from "@/lib/rules";
import { createGame } from "@/lib/store";
import { authProfile, isBlocked, publicAvatar } from "@/lib/profiles";
import { publicContent } from "@/lib/content-server";
import { handle, json, mapPool } from "@/lib/api";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I ni O pour éviter les confusions
const makeCode = () => Array.from({ length: 4 }, () => LETTERS[randomInt(0, LETTERS.length)]).join("");

export async function POST(req: Request) {
  try {
    const { name, map } = await req.json();
    const prof = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
    if (prof && (await isBlocked(prof.id))) return json({ error: "Ce compte a été bloqué" }, 403);
    const content = await publicContent();
    // règles figées pour toute la durée du salon (un changement admin ne touche pas les parties en cours)
    const config = { startDice: content.settings.startDice, exactEnabled: content.settings.exactEnabled, palificoEnabled: content.settings.palificoEnabled };
    const pool = mapPool(content);
    const extra = prof ? { profileId: prof.id, avatar: publicAvatar(prof), cup: prof.cup } : {};
    for (let i = 0; i < 10; i++) {
      const state = newGame(makeCode(), typeof map === "string" ? map : undefined, { config, pool });
      const playerId = randomUUID();
      const token = randomBytes(24).toString("hex");
      addPlayer(state, playerId, String(name ?? prof?.name ?? ""), token, extra);
      if (await createGame(state)) return json({ code: state.code, playerId, token });
    }
    return json({ error: "Impossible de créer la partie" }, 500);
  } catch (e) {
    return handle(e);
  }
}
