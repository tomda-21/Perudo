import "server-only";
import { NextResponse } from "next/server";
import { GameState, RuleError } from "./rules";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function handle(e: unknown) {
  if (e instanceof RuleError) return json({ error: e.message }, 400);
  console.error(e);
  return json({ error: "Erreur serveur, réessaie" }, 500);
}

export function playerFromToken(s: GameState, token: string | null) {
  if (!token) return null;
  return s.players.find((p) => p.token === token) ?? null;
}

export const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
