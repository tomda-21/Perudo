// Créer une partie
import { randomBytes, randomInt, randomUUID } from "crypto";
import { addPlayer, newGame } from "@/lib/rules";
import { createGame } from "@/lib/store";
import { authProfile, publicAvatar } from "@/lib/profiles";
import { isMapId } from "@/lib/catalog";
import { handle, json } from "@/lib/api";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I ni O pour éviter les confusions
const makeCode = () => Array.from({ length: 4 }, () => LETTERS[randomInt(0, LETTERS.length)]).join("");

export async function POST(req: Request) {
  try {
    const { name, map } = await req.json();
    const prof = await authProfile(req.headers.get("x-profile-id"), req.headers.get("x-profile-key"));
    const extra = prof ? { profileId: prof.id, avatar: publicAvatar(prof), cup: prof.cup } : {};
    for (let i = 0; i < 10; i++) {
      const state = newGame(makeCode(), isMapId(map) ? map : undefined);
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
