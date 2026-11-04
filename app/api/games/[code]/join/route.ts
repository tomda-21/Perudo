// Rejoindre une partie
import { randomBytes, randomUUID } from "crypto";
import { addPlayer } from "@/lib/rules";
import { mutate } from "@/lib/store";
import { cleanCode, handle, json } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const { name } = await req.json();
    const playerId = randomUUID();
    const token = randomBytes(24).toString("hex");
    await mutate(code, (s) => addPlayer(s, playerId, String(name ?? ""), token));
    return json({ code, playerId, token });
  } catch (e) {
    return handle(e);
  }
}
