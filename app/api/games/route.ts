// Créer une partie
import { randomBytes, randomInt, randomUUID } from "crypto";
import { addPlayer, newGame } from "@/lib/rules";
import { createGame } from "@/lib/store";
import { handle, json } from "@/lib/api";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I ni O pour éviter les confusions
const makeCode = () => Array.from({ length: 4 }, () => LETTERS[randomInt(0, LETTERS.length)]).join("");

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    for (let i = 0; i < 10; i++) {
      const state = newGame(makeCode());
      const playerId = randomUUID();
      const token = randomBytes(24).toString("hex");
      addPlayer(state, playerId, String(name ?? ""), token);
      if (await createGame(state)) return json({ code: state.code, playerId, token });
    }
    return json({ error: "Impossible de créer la partie" }, 500);
  } catch (e) {
    return handle(e);
  }
}
